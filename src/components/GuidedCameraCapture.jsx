import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  RefreshCw,
  SwitchCamera,
  Upload,
  Check,
  Info,
  ShieldAlert,
  CameraOff,
  HelpCircle,
  Trash2,
  Plus
} from "lucide-react";
import { compressImage, formatBytes } from "../utils/compressor";

const PRODUCT_STEPS_FALLBACK = [
  {
    id: "Front",
    label: "Front Side",
    tabLabel: "Front",
    tabSubtext: "Main label",
    mr: "पुढील बाजू",
    tip: "Full branding & product title",
    guide: "Hold bottle/pack upright. Frame entire brand title, manufacturer logo, and active ingredients.",
    tooltip: "Angle 1: Front Side — Full branding & product title",
    required: true
  },
  {
    id: "Back",
    label: "Back Side",
    tabLabel: "Back",
    tabSubtext: "Composition",
    mr: "मागील बाजू",
    tip: "Chemical formulation & warning label",
    guide: "Frame the back panel: chemical formula, batch number, Mfg/Exp dates, MRP ₹.",
    tooltip: "Angle 2: Back Side — Formulation, batch & warning",
    required: true
  },
  {
    id: "Barcode",
    label: "Barcode / QR",
    tabLabel: "Barcode",
    tabSubtext: "Close-up",
    mr: "बारकोड",
    tip: "High-contrast close-up, avoid glare",
    guide: "Get a sharp close-up (10–15 cm). Ensure barcode lines are straight.",
    tooltip: "Angle 3: Barcode / QR — High-contrast scan",
    required: false
  }
];

export default function GuidedCameraCapture({
  isNoise = false,
  photos = [],
  onPhotosChange,
  resetTrigger = 0,
  onOpenManual,
  photoAngles,
  packagingType = "Bottle",
  packagingLabel = "Bottle / Container",
  onProceedToReview
}) {
  // Configuration-driven photo angles based on packaging type
  const steps = (!isNoise && photoAngles && photoAngles.length > 0)
    ? photoAngles
    : PRODUCT_STEPS_FALLBACK;
  const totalSteps = steps.length;

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // CAMERA STATE MACHINE:
  // 'idle'      : Inactive / ready state
  // 'live'      : Live video stream
  // 'error'     : Hardware / permission issue
  // 'captured'  : Single angle review screen
  // 'summary'   : All angles overview + additional photos
  const [cameraState, setCameraState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const testParam = params.get("testState");
    if (testParam === "error") return "error";
    if (testParam === "captured") return "captured";
    return "idle";
  });

  // Map of angleId -> photo object for standard predefined angles
  const [capturedPhotos, setCapturedPhotos] = useState({});

  // Array of additional custom photos taken by the field agent
  const [additionalPhotos, setAdditionalPhotos] = useState([]);

  // Flag when currently capturing an additional photo in live mode
  const [capturingAdditional, setCapturingAdditional] = useState(false);

  // Noise list for rapid-fire multi-photo capture
  const [noisePhotos, setNoisePhotos] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("testState") === "noise") {
      const mockItems = [
        { label: "Shop Counter Clutter", color: "#1e3a5f" },
        { label: "Empty Shelf Rack", color: "#1e293b" },
        { label: "Unrelated Box & Hand", color: "#334155" }
      ];
      return mockItems.map((item, idx) => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = item.color;
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#22c55e";
          ctx.fillRect(16, 16, 608, 448);
          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 26px sans-serif";
          ctx.fillText(`Noise Sample #${idx + 1}`, 40, 180);
          ctx.font = "20px sans-serif";
          ctx.fillText(item.label, 40, 230);
          ctx.font = "14px sans-serif";
          ctx.fillText("AuRA Field Data Collection • Negative / Noise Sample", 40, 280);
        }
        const dataUrl = canvas.toDataURL ? canvas.toDataURL("image/jpeg", 0.82) : "";
        return {
          dataUrl,
          compressedSize: 45000 + idx * 3800,
          originalName: `noise_sample_${idx + 1}.jpg`,
          mimeType: "image/jpeg",
          angle: `Noise #${idx + 1}`,
          base64: dataUrl.split(",")[1] || ""
        };
      });
    }
    return isNoise && photos && photos.length > 0 ? photos : [];
  });

  const [rapidFireToast, setRapidFireToast] = useState(null);

  // Stream & Hardware State
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("testState") === "error") {
      return {
        type: "NotAllowedError",
        message:
          "Camera permission was blocked. Please allow camera permissions in your browser address bar/settings, or use the Upload button below."
      };
    }
    return null;
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");

  // DOM Refs
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const additionalFileInputRef = useRef(null);

  const currentStep = steps[currentStepIdx] || steps[0];
  const currentCapturedPhoto = capturedPhotos[currentStep?.id];

  // Helper to sync photos array back to parent component
  const syncToParent = useCallback((standardMap, additionalList) => {
    if (isNoise) return;
    const standardList = steps
      .map((s) => standardMap[s.id])
      .filter((p) => p && !p.skipped);
    const combined = [...standardList, ...additionalList];
    onPhotosChange(combined);
  }, [isNoise, onPhotosChange, steps]);

  // Sensory feedback: mechanical shutter audio click + mobile haptic vibration
  const triggerShutterSensory = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 25, 55]);
      }
    } catch {
      // Ignore vibration error
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") ctx.resume();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "triangle";
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(140, now + 0.035);
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.035);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1150, now + 0.04);
        osc2.frequency.exponentialRampToValueAtTime(90, now + 0.075);
        gain2.gain.setValueAtTime(0.35, now + 0.04);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.04);
        osc2.stop(now + 0.075);
      }
    } catch {
      // Audio context blocked or unsupported
    }
  }, []);

  // Safe stream stop
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  // Sync external reset from parent form
  const prevResetRef = useRef(resetTrigger);
  useEffect(() => {
    if (resetTrigger !== prevResetRef.current) {
      prevResetRef.current = resetTrigger;
      stopStream();
      setCapturedPhotos({});
      setAdditionalPhotos([]);
      setNoisePhotos([]);
      setCurrentStepIdx(0);
      setCameraError(null);
      setCameraState("idle");
      setCapturingAdditional(false);
    }
  }, [resetTrigger, stopStream]);

  // If category switched between Noise and Product
  const prevNoiseRef = useRef(isNoise);
  useEffect(() => {
    if (prevNoiseRef.current !== isNoise) {
      prevNoiseRef.current = isNoise;
      stopStream();
      setCurrentStepIdx(0);
      setCameraError(null);
      setCameraState("idle");
      setCapturedPhotos({});
      setAdditionalPhotos([]);
      setNoisePhotos([]);
      setCapturingAdditional(false);
      onPhotosChange([]);
    }
  }, [isNoise, onPhotosChange, stopStream]);

  // If packaging type switched (e.g. Bottle <-> Bag <-> Pouch), reset angle steps
  const prevPackagingRef = useRef(packagingType);
  useEffect(() => {
    if (prevPackagingRef.current !== packagingType) {
      prevPackagingRef.current = packagingType;
      stopStream();
      setCurrentStepIdx(0);
      setCameraError(null);
      setCameraState("idle");
      setCapturedPhotos({});
      setAdditionalPhotos([]);
      setNoisePhotos([]);
      setCapturingAdditional(false);
      onPhotosChange([]);
    }
  }, [packagingType, onPhotosChange, stopStream]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Diagnostic logger (cleaned up after verification)
  const logTransitionEvent = useCallback(() => {}, []);

  // Stable viewport stabilization: only anchor camera into view when initially opened from idle
  const anchorOnInitialOpen = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 800;
      if (rect.top < 60 || rect.bottom > viewportHeight) {
        containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, []);

  // Start live camera stream
  const startCamera = useCallback(async (targetFacingMode = facingMode) => {
    stopStream();
    setCameraError(null);
    logTransitionEvent("CAMERA_OPEN");

    // Defocus any active buttons to prevent mobile browser auto-scroll on unmount
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    const params = new URLSearchParams(window.location.search);
    const useMock = params.get("mockCamera") === "1" || params.get("mockCamera") === "true";

    if (useMock) {
      const mockCanvas = document.createElement("canvas");
      mockCanvas.width = 1280;
      mockCanvas.height = 960;
      const mockCtx = mockCanvas.getContext("2d");

      let frameCount = 0;
      const drawMockFrame = () => {
        frameCount++;
        mockCtx.fillStyle = "#1e293b";
        mockCtx.fillRect(0, 0, 1280, 960);
        mockCtx.fillStyle = "#334155";
        mockCtx.fillRect(40, 40, 1200, 880);

        mockCtx.fillStyle = "#14532d";
        if (mockCtx.roundRect) {
          mockCtx.beginPath();
          mockCtx.roundRect(320, 140, 640, 680, 32);
          mockCtx.fill();
        } else {
          mockCtx.fillRect(320, 140, 640, 680);
        }

        mockCtx.fillStyle = "#f8fafc";
        mockCtx.fillRect(360, 240, 560, 460);

        mockCtx.fillStyle = "#15803d";
        mockCtx.font = "bold 32px sans-serif";
        mockCtx.textAlign = "center";
        mockCtx.fillText("COROMANDEL GROMOR", 640, 310);

        mockCtx.fillStyle = "#0f172a";
        mockCtx.font = "20px sans-serif";
        mockCtx.fillText("NPK 18-46-0 Fertilizer", 640, 355);

        mockCtx.fillStyle = "#000000";
        for (let i = 0; i < 34; i++) {
          const w = i % 4 === 0 ? 7 : (i % 2 === 0 ? 4 : 2);
          mockCtx.fillRect(470 + i * 10, 410, w, 90);
        }

        mockCtx.fillStyle = "#16a34a";
        mockCtx.font = "bold 20px sans-serif";
        const label = capturingAdditional
          ? `Additional View 0${additionalPhotos.length + 1}`
          : steps[currentStepIdx]?.label || "Product View";
        mockCtx.fillText(`[MOCK CAMERA #${frameCount} - ${packagingLabel}] ${label}`, 640, 640);
      };

      drawMockFrame();
      const intervalId = setInterval(drawMockFrame, 66);
      const stream = mockCanvas.captureStream ? mockCanvas.captureStream(30) : null;
      if (stream) {
        stream.getVideoTracks().forEach((track) => {
          const origStop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(intervalId);
            origStop();
          };
        });

        streamRef.current = stream;
        setCameraState("live");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => setStreamActive(true)).catch(() => setStreamActive(true));
        }
        if (cameraState === "idle") {
          anchorOnInitialOpen();
        }
        return;
      }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isHttp =
        window.location.protocol === "http:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";
      setCameraError({
        type: "unsupported",
        message: isHttp
          ? "Live camera stream requires HTTPS or localhost. Use the Upload button below."
          : "Live camera access is not supported in this browser. Use the Upload button below."
      });
      setCameraState("error");
      return;
    }

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: targetFacingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: targetFacingMode }
        });
      }

      streamRef.current = stream;
      setCameraState("live");

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.play().then(() => setStreamActive(true)).catch(() => setStreamActive(true));
      }
      if (cameraState === "idle") {
        anchorOnInitialOpen();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      stopStream();
      let message = "Unable to access camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        message = "Camera permission was blocked. Please allow camera permissions in browser settings or use Upload.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        message = "No camera hardware detected on this device. You can choose photos using the Upload button.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        message = "Camera is currently in use by another application. Please close other camera apps and retry.";
      }
      setCameraError({ type: err.name, message });
      setCameraState("error");
    }
  }, [anchorOnInitialOpen, cameraState, capturingAdditional, currentStepIdx, additionalPhotos.length, facingMode, packagingLabel, steps, stopStream, logTransitionEvent]);

  // Sync media stream whenever cameraState switches to 'live' and video element mounts
  useEffect(() => {
    if (cameraState === "live" && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }
      const activate = () => setStreamActive(true);
      video.addEventListener("loadedmetadata", activate);
      video.addEventListener("playing", activate);
      video.addEventListener("canplay", activate);

      video.play().catch(() => setStreamActive(true));
      if (video.readyState >= 2) setStreamActive(true);

      return () => {
        video.removeEventListener("loadedmetadata", activate);
        video.removeEventListener("playing", activate);
        video.removeEventListener("canplay", activate);
      };
    }
  }, [cameraState]);

  // Flip camera between front and rear
  const toggleCameraFacing = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (cameraState === "live") {
      startCamera(nextMode);
    }
  };

  // Convert canvas snapshot into standard compressed photo object
  const processCanvasCapture = async (canvas, angleId) => {
    return new Promise((resolve) => {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const file = new File(
            [blob],
            `${angleId.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}.jpg`,
            { type: "image/jpeg" }
          );
          const compressed = await compressImage(file, 1600, 0.82);
          compressed.angle = angleId;
          resolve(compressed);
        },
        "image/jpeg",
        0.92
      );
    });
  };

  // Capture frame from live video feed
  const handleSnapPhoto = async () => {
    if (!videoRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const video = videoRef.current;
      const videoWidth = video.videoWidth || 1280;
      const videoHeight = video.videoHeight || 720;

      // Crop mathematics
      let cropX = 0;
      let cropY = 0;
      let cropW = videoWidth;
      let cropH = videoHeight;

      if (!isNoise && frameRef.current && video) {
        const videoRect = video.getBoundingClientRect();
        const frameRect = frameRef.current.getBoundingClientRect();

        if (videoRect.width > 0 && videoRect.height > 0 && frameRect.width > 0 && frameRect.height > 0) {
          const videoRatio = videoWidth / videoHeight;
          const elemRatio = videoRect.width / videoRect.height;
          let scale = 1;
          let offsetX = 0;
          let offsetY = 0;

          if (videoRatio > elemRatio) {
            scale = videoHeight / videoRect.height;
            const renderedIntrinsicWidth = videoRect.width * scale;
            offsetX = (videoWidth - renderedIntrinsicWidth) / 2;
          } else {
            scale = videoWidth / videoRect.width;
            const renderedIntrinsicHeight = videoRect.height * scale;
            offsetY = (videoHeight - renderedIntrinsicHeight) / 2;
          }

          const relX = frameRect.left - videoRect.left;
          const relY = frameRect.top - videoRect.top;

          cropX = Math.max(0, Math.round(offsetX + relX * scale));
          cropY = Math.max(0, Math.round(offsetY + relY * scale));
          cropW = Math.max(10, Math.min(videoWidth - cropX, Math.round(frameRect.width * scale)));
          cropH = Math.max(10, Math.min(videoHeight - cropY, Math.round(frameRect.height * scale)));
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // 1. Noise Mode
      if (isNoise) {
        const nextIndex = noisePhotos.length + 1;
        const photoTag = `Noise #${nextIndex}`;
        const compressed = await processCanvasCapture(canvas, photoTag);
        if (compressed) {
          triggerShutterSensory();
          const updated = [...noisePhotos, compressed];
          setNoisePhotos(updated);
          onPhotosChange(updated);
          setRapidFireToast(`✓ Photo #${updated.length} captured!`);
          setTimeout(() => setRapidFireToast(null), 1400);
        }
        return;
      }

      // 2. Additional Photo Mode
      if (capturingAdditional) {
        logTransitionEvent("BEFORE_CAPTURE");
        const nextIndex = String(additionalPhotos.length + 1).padStart(2, "0");
        const angleTag = `Additional_View_${nextIndex}`;
        const compressed = await processCanvasCapture(canvas, angleTag);
        if (compressed) {
          triggerShutterSensory();
          stopStream();
          logTransitionEvent("AFTER_CAPTURE");
          const updated = [...additionalPhotos, compressed];
          setAdditionalPhotos(updated);
          syncToParent(capturedPhotos, updated);
          setCapturingAdditional(false);
          setCameraState("summary");
          logTransitionEvent("SUMMARY_OPEN");
        }
        return;
      }

      // 3. Standard Predefined Angle Mode
      logTransitionEvent("BEFORE_CAPTURE");
      const compressed = await processCanvasCapture(canvas, currentStep.id);
      if (compressed) {
        triggerShutterSensory();
        stopStream();
        logTransitionEvent("AFTER_CAPTURE");
        const updated = {
          ...capturedPhotos,
          [currentStep.id]: compressed
        };
        setCapturedPhotos(updated);
        syncToParent(updated, additionalPhotos);
        setCameraState("captured");
        logTransitionEvent("PREVIEW_RENDER");
      }
    } catch (err) {
      console.error("Snapshot failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Fallback file input upload
  const handleFallbackFileInput = async (fileList, isExplicitAdditional = false) => {
    if (!fileList || fileList.length === 0) return;
    setIsCapturing(true);

    try {
      if (isNoise) {
        const newItems = [];
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const photoTag = `Noise #${noisePhotos.length + newItems.length + 1}`;
          const compressed = await compressImage(file, 1600, 0.82);
          compressed.angle = photoTag;
          newItems.push(compressed);
        }
        const updated = [...noisePhotos, ...newItems];
        setNoisePhotos(updated);
        onPhotosChange(updated);
      } else if (capturingAdditional || isExplicitAdditional) {
        const file = fileList[0];
        const nextIndex = String(additionalPhotos.length + 1).padStart(2, "0");
        const angleTag = `Additional_View_${nextIndex}`;
        const compressed = await compressImage(file, 1600, 0.82);
        compressed.angle = angleTag;
        const updated = [...additionalPhotos, compressed];
        setAdditionalPhotos(updated);
        syncToParent(capturedPhotos, updated);
        setCapturingAdditional(false);
        setCameraState("summary");
      } else {
        const file = fileList[0];
        const compressed = await compressImage(file, 1600, 0.82);
        compressed.angle = currentStep.id;
        const updated = {
          ...capturedPhotos,
          [currentStep.id]: compressed
        };
        setCapturedPhotos(updated);
        syncToParent(updated, additionalPhotos);
        setCameraState("captured");
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsCapturing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (additionalFileInputRef.current) additionalFileInputRef.current.value = "";
    }
  };

  // Retake current photo
  const handleRetakeCurrent = () => {
    logTransitionEvent("RETAKE");
    const updated = { ...capturedPhotos };
    delete updated[currentStep.id];
    setCapturedPhotos(updated);
    syncToParent(updated, additionalPhotos);
    startCamera();
  };

  // Advance to next angle or summary
  const handleNextStep = () => {
    stopStream();
    logTransitionEvent("ACCEPT_PHOTO");
    if (currentStepIdx < totalSteps - 1) {
      logTransitionEvent("NEXT_ANGLE_START");
      const nextIdx = currentStepIdx + 1;
      setCurrentStepIdx(nextIdx);
      const nextAngleId = steps[nextIdx].id;

      if (capturedPhotos[nextAngleId] && !capturedPhotos[nextAngleId].skipped) {
        setCameraState("captured");
      } else {
        startCamera();
        logTransitionEvent("NEXT_CAMERA_MOUNT");
      }
    } else {
      setCameraState("summary");
      logTransitionEvent("SUMMARY_OPEN");
    }
  };

  // Move to next angle while camera is live
  const handleLiveNextAngle = () => {
    logTransitionEvent("SKIP");
    if (!capturedPhotos[currentStep.id]?.dataUrl) {
      const skippedEntry = { skipped: true, angle: currentStep.id, dataUrl: null, compressedSize: 0 };
      const updated = { ...capturedPhotos, [currentStep.id]: skippedEntry };
      setCapturedPhotos(updated);
      syncToParent(updated, additionalPhotos);
    }

    if (currentStepIdx < totalSteps - 1) {
      const nextIdx = currentStepIdx + 1;
      const nextLabel = steps[nextIdx].label;
      setCurrentStepIdx(nextIdx);
      setRapidFireToast(`Next: ${nextLabel} (${nextIdx + 1}/${totalSteps})`);
      setTimeout(() => setRapidFireToast(null), 1600);
    } else {
      stopStream();
      setCameraState("summary");
      logTransitionEvent("SUMMARY_OPEN");
    }
  };

  // Jump to specific angle
  const handleJumpToStep = (index, targetMode = "ready") => {
    setCurrentStepIdx(index);
    setCapturingAdditional(false);
    const angleId = steps[index].id;

    if (targetMode === "retake") {
      logTransitionEvent("RETAKE");
      const updated = { ...capturedPhotos };
      delete updated[angleId];
      setCapturedPhotos(updated);
      syncToParent(updated, additionalPhotos);
      startCamera();
    } else if (capturedPhotos[angleId] && !capturedPhotos[angleId].skipped) {
      stopStream();
      setCameraState("captured");
    } else {
      stopStream();
      setCameraState("idle");
    }
  };

  // Trigger capturing an additional photo
  const handleStartAdditionalCapture = () => {
    logTransitionEvent("ADDITIONAL_PHOTO_OPEN");
    setCapturingAdditional(true);
    startCamera();
  };

  // Delete an additional photo
  const handleDeleteAdditionalPhoto = (indexToDelete) => {
    const updated = additionalPhotos
      .filter((_, idx) => idx !== indexToDelete)
      .map((item, idx) => ({
        ...item,
        angle: `Additional_View_${String(idx + 1).padStart(2, "0")}`
      }));
    setAdditionalPhotos(updated);
    syncToParent(capturedPhotos, updated);
  };

  // Delete a noise photo
  const handleDeleteNoisePhoto = (indexToDelete) => {
    const updated = noisePhotos
      .filter((_, idx) => idx !== indexToDelete)
      .map((item, idx) => ({
        ...item,
        angle: `Noise #${idx + 1}`
      }));
    setNoisePhotos(updated);
    onPhotosChange(updated);
  };

  const capturedCount = isNoise
    ? noisePhotos.length
    : steps.filter((s) => capturedPhotos[s.id] && !capturedPhotos[s.id].skipped).length;

  const skippedCount = !isNoise
    ? steps.filter((s) => capturedPhotos[s.id]?.skipped === true).length
    : 0;

  return (
    <div className="guided-camera-container" ref={containerRef}>
      {/* Hidden file input for standard upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        multiple={isNoise}
        onChange={(e) => handleFallbackFileInput(e.target.files)}
      />

      {/* Hidden file input for additional photo upload */}
      <input
        type="file"
        ref={additionalFileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={(e) => handleFallbackFileInput(e.target.files, true)}
      />

      {/* Step Header & Indicator */}
      <div className="guided-step-header">
        <div className="step-progress-row">
          <div className="step-indicator-badge">
            {isNoise ? (
              <span className="step-pill active">Noise Mode</span>
            ) : capturingAdditional ? (
              <span className="step-pill active extra">
                <Plus size={13} />
                Additional View #{additionalPhotos.length + 1}
              </span>
            ) : cameraState === "summary" ? (
              <span className="step-pill summary">
                <CheckCircle2 size={13} />
                Review & Angles Overview
              </span>
            ) : (
              <span className="step-pill active">
                Angle {currentStepIdx + 1} of {totalSteps}
              </span>
            )}

            <span className="step-angle-title">
              {isNoise
                ? "Rapid Noise Capture"
                : capturingAdditional
                ? "Additional Product Photo"
                : currentStep.label}
            </span>
            <span className="step-angle-mr">
              ({isNoise
                ? "नॉइज फोटो"
                : capturingAdditional
                ? "अतिरिक्त फोटो"
                : currentStep.mr})
            </span>
          </div>

          <div className="step-header-actions">
            <span className="step-counter-tag">
              {isNoise
                ? `${capturedCount} photo${capturedCount !== 1 ? "s" : ""}`
                : `${capturedCount}/${totalSteps} angles${additionalPhotos.length > 0 ? ` +${additionalPhotos.length} extra` : ""}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`}
            </span>
            {onOpenManual && (
              <button
                type="button"
                className="btn-manual-shortcut"
                onClick={onOpenManual}
                title="View Photography Guidelines"
                id="camera-guide-shortcut"
              >
                <HelpCircle size={13} />
                <span>Guide</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Stepper Bar */}
        {!isNoise && !capturingAdditional && (
          <div className="stepper-dots-bar" role="tablist" aria-label="Angle capture steps">
            {steps.map((step, idx) => {
              const photoEntry = capturedPhotos[step.id];
              const isCaptured = !!photoEntry && !photoEntry.skipped;
              const isSkipped = photoEntry?.skipped === true;
              const isCurrent = idx === currentStepIdx && cameraState !== "summary";
              const fullStepTooltip = `Angle ${idx + 1} of ${totalSteps}: ${step.label} (${step.mr})`;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`step-dot-btn ${isCurrent ? "current" : ""} ${
                    isCaptured ? "completed" : isSkipped ? "skipped" : ""
                  }`}
                  onClick={() => handleJumpToStep(idx, isCaptured ? "captured" : "ready")}
                  title={fullStepTooltip}
                  aria-label={fullStepTooltip}
                >
                  <span className="dot-circle">
                    {isSkipped ? (
                      <span className="dot-skip-icon">✕</span>
                    ) : isCaptured ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <div className="dot-text-group">
                    <span className="dot-label">{step.tabLabel || step.label}</span>
                    <span className="dot-sublabel">
                      {isSkipped ? "Skipped" : isCaptured ? "Done ✓" : isCurrent ? "Active ▶" : step.tabSubtext}
                    </span>
                  </div>
                </button>
              );
            })}

            {/* Quick jump to Summary button */}
            <button
              type="button"
              className={`step-dot-btn summary-dot ${cameraState === "summary" ? "current" : ""}`}
              onClick={() => {
                stopStream();
                setCapturingAdditional(false);
                setCameraState("summary");
                anchorCameraViewport();
              }}
              title="View all photos & add extras"
            >
              <span className="dot-circle">★</span>
              <div className="dot-text-group">
                <span className="dot-label">Summary</span>
                <span className="dot-sublabel">{capturedCount + additionalPhotos.length} total</span>
              </div>
            </button>
          </div>
        )}

        {/* Live Guidance Tip Box */}
        {cameraState !== "summary" && (
          <div className="angle-guide-callout">
            <Info size={15} className="guide-icon" />
            <div className="guide-text-wrap">
              <span className="guide-tip-strong">
                {isNoise
                  ? "Rapid-fire capture: "
                  : capturingAdditional
                  ? "Extra View: "
                  : `${currentStep.tip}: `}
              </span>
              <span className="guide-tip-desc">
                {isNoise
                  ? "Capture empty racks, counter clutter, or unrelated cartons to train AI rejection."
                  : capturingAdditional
                  ? "Photograph batch stencil, MRP stamp, barcode or any special angle of interest."
                  : currentStep.guide}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* STATE A: IDLE / READY SCREEN                                         */}
      {/* ==================================================================== */}
      {cameraState === "idle" && (
        isNoise && noisePhotos.length > 0 ? (
          <div className="noise-active-dashboard-card" id="noise-active-card">
            <div className="noise-dashboard-header">
              <div className="noise-status-group">
                <div className="noise-status-badge">
                  <CheckCircle2 size={16} />
                  <span>{noisePhotos.length} Photo{noisePhotos.length !== 1 ? "s" : ""} Added</span>
                </div>
                <h3 className="noise-dashboard-title">Noise / Negative Samples</h3>
                <p className="noise-dashboard-desc">
                  Rapidly photograph non-product items or shop clutter to improve model precision.
                </p>
              </div>
            </div>

            <div className="ready-action-buttons noise-add-actions">
              <button
                type="button"
                className="btn-open-camera-primary"
                id="btn-open-camera"
                onClick={() => startCamera()}
              >
                <Camera size={18} />
                <span>Open Camera (Snap More)</span>
              </button>

              <button
                type="button"
                className="btn-upload-file-secondary"
                id="btn-upload-file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={18} />
                <span>Upload Photos</span>
              </button>
            </div>

            {/* Noise Gallery Grid */}
            <div className="noise-gallery-grid">
              {noisePhotos.map((photo, index) => (
                <div key={index} className="noise-photo-card">
                  <div className="noise-thumb-wrap">
                    <img src={photo.dataUrl} alt={`Noise sample ${index + 1}`} className="noise-thumb-img" />
                    <button
                      type="button"
                      className="noise-delete-btn"
                      onClick={() => handleDeleteNoisePhoto(index)}
                      title={`Remove photo #${index + 1}`}
                    >
                      <Trash2 size={13} />
                    </button>
                    <span className="noise-photo-num-badge">#{index + 1}</span>
                  </div>
                  <div className="noise-card-meta">
                    <span className="noise-card-name">Noise #{index + 1}</span>
                    <span className="noise-card-size">{formatBytes(photo.compressedSize)}</span>
                  </div>
                </div>
              ))}

              <div
                className="noise-add-another-tile"
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={24} className="add-tile-icon" />
                <span className="add-tile-text">Add Another</span>
                <span className="add-tile-sub">Tap to Upload</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="camera-ready-card" id="camera-idle-card">
            <div className="ready-icon-container">
              <Camera size={34} className="ready-camera-icon" />
            </div>

            <div className="ready-text-group">
              <h3 className="ready-title">
                {isNoise ? "Capture Negative Photos" : `Ready: ${currentStep.label}`}
              </h3>
              <p className="ready-subtitle">
                {isNoise
                  ? "Snap shop rack clutter or counter items. Rapid-fire multiple photos in one session."
                  : `${currentStep.mr} • Position the item and tap below.`}
              </p>
            </div>

            <div className="ready-action-buttons">
              <button
                type="button"
                className="btn-open-camera-primary"
                id="btn-open-camera"
                onClick={() => startCamera()}
              >
                <Camera size={18} />
                <span>Open Camera</span>
              </button>

              <button
                type="button"
                className="btn-upload-file-secondary"
                id="btn-upload-file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={18} />
                <span>Upload</span>
              </button>
            </div>

            {!isNoise && (
              <button
                type="button"
                className="btn-skip-optional"
                id="btn-skip-angle"
                onClick={() => {
                  const skippedEntry = { skipped: true, angle: currentStep.id, dataUrl: null, compressedSize: 0 };
                  const updated = { ...capturedPhotos, [currentStep.id]: skippedEntry };
                  setCapturedPhotos(updated);
                  syncToParent(updated, additionalPhotos);
                  if (currentStepIdx < totalSteps - 1) {
                    setCurrentStepIdx(currentStepIdx + 1);
                    const nextId = steps[currentStepIdx + 1].id;
                    setCameraState(capturedPhotos[nextId] ? "captured" : "idle");
                  } else {
                    setCameraState("summary");
                  }
                  anchorCameraViewport();
                }}
              >
                <ChevronRight size={15} />
                <span>Skip Angle (If Not on Package)</span>
              </button>
            )}
          </div>
        )
      )}

      {/* ==================================================================== */}
      {/* STATES B & D: UNIFIED STABLE CAMERA WORKSPACE (LIVE & CAPTURED)      */}
      {/* ==================================================================== */}
      {(cameraState === "live" || (cameraState === "captured" && !isNoise && currentCapturedPhoto)) && (
        <div className="camera-workspace-card" id="camera-workspace-card">
          {/* Top Control Bar (Stable across Live and Captured states) */}
          <div className="camera-feed-topbar">
            <div className="feed-angle-pill">
              {cameraState === "live" ? (
                <>
                  <span className="live-pulse-dot" />
                  <span>
                    {isNoise
                      ? `Noise (${noisePhotos.length} taken)`
                      : capturingAdditional
                      ? `Extra Photo #${additionalPhotos.length + 1}`
                      : `${currentStep.label} (${currentStepIdx + 1}/${totalSteps})`}
                  </span>
                </>
              ) : (
                <>
                  <Check size={14} style={{ color: "#4ade80" }} />
                  <span>
                    {currentStep.label} ({currentStep.mr})
                  </span>
                </>
              )}
            </div>

            <div className="feed-controls-group">
              {cameraState === "live" ? (
                <>
                  <button
                    type="button"
                    className="camera-pill-btn flip"
                    id="btn-flip-camera"
                    onClick={toggleCameraFacing}
                    title="Switch Camera (Front/Rear)"
                    aria-label="Switch between front and rear cameras"
                  >
                    <SwitchCamera size={14} />
                    <span>Flip</span>
                  </button>
                  <button
                    type="button"
                    className="camera-pill-btn close"
                    id="btn-close-camera"
                    onClick={() => {
                      stopStream();
                      setCapturingAdditional(false);
                      setCameraState("idle");
                    }}
                    title="Close Camera"
                    aria-label="Close camera feed"
                  >
                    <CameraOff size={14} />
                    <span>Close</span>
                  </button>
                </>
              ) : (
                <div className="preview-size-tag">
                  {formatBytes(currentCapturedPhoto.compressedSize)}
                </div>
              )}
            </div>
          </div>

          {/* Stable Media Stage Frame (Exact same 4:3 dimensions for video feed and preview image) */}
          <div className="camera-media-frame">
            {cameraState === "live" ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className={`camera-video-feed ${streamActive ? "active" : "hidden"}`}
                />

                {isCapturing && <div className="camera-shutter-flash" />}

                {rapidFireToast && (
                  <div className="noise-rapid-toast">
                    <CheckCircle2 size={15} />
                    <span>{rapidFireToast}</span>
                  </div>
                )}

                {/* Target Reticle */}
                {streamActive && !isNoise && (
                  <div className="viewfinder-overlay">
                    <div className="viewfinder-frame" ref={frameRef}>
                      <div className="corner top-left" />
                      <div className="corner top-right" />
                      <div className="corner bottom-left" />
                      <div className="corner bottom-right" />
                      <div className="viewfinder-label-badge">
                        {capturingAdditional
                          ? `Additional View 0${additionalPhotos.length + 1}`
                          : `${currentStep.label} • ${currentStep.mr}`}
                      </div>
                    </div>
                  </div>
                )}

                {!streamActive && (
                  <div className="camera-init-spinner">
                    <RefreshCw size={32} className="spinner-ring" />
                    <span>Connecting camera feed...</span>
                    <button
                      type="button"
                      className="spinner-fallback-btn"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        marginTop: "10px",
                        background: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        color: "#ffffff",
                        padding: "6px 12px",
                        borderRadius: "16px",
                        fontSize: "11.5px",
                        cursor: "pointer"
                      }}
                    >
                      Taking long? Tap to Upload
                    </button>
                  </div>
                )}

                {/* Countdown / Angle Progress Strip */}
                {!isNoise && !capturingAdditional && (
                  <div className="camera-media-badge">
                    <span className="countdown-tag">{currentStepIdx + 1} of {totalSteps}</span>
                    <span className="countdown-current-side">
                      <strong>{currentStep.label}</strong>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <img
                src={currentCapturedPhoto.dataUrl}
                alt={currentStep.label}
                className="preview-photo-img"
              />
            )}
          </div>

          {/* Unified Action Bar (Exact same height across Live and Captured) */}
          <div className="camera-action-bar">
            {cameraState === "live" ? (
              <>
                <button
                  type="button"
                  className="shutter-side-btn"
                  id="btn-shutter-upload"
                  onClick={() => {
                    if (capturingAdditional) {
                      additionalFileInputRef.current?.click();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  title="Upload photo from files"
                  aria-label="Upload photo from files"
                >
                  <Upload size={17} />
                  <span>Upload</span>
                </button>

                <button
                  type="button"
                  className="btn-shutter-trigger"
                  id="btn-shutter"
                  onClick={handleSnapPhoto}
                  disabled={isCapturing || !streamActive}
                  title="Capture Photo"
                  aria-label="Capture Photo"
                >
                  <div className="shutter-inner-ring">
                    {isCapturing ? (
                      <RefreshCw size={22} className="spinner-ring" />
                    ) : (
                      <div className="shutter-center-dot" />
                    )}
                  </div>
                </button>

                {isNoise ? (
                  <button
                    type="button"
                    className="shutter-side-btn done"
                    onClick={() => {
                      stopStream();
                      setCameraState("idle");
                    }}
                    aria-label="Finish noise capture"
                  >
                    <Check size={17} />
                    <span>Done</span>
                  </button>
                ) : capturingAdditional ? (
                  <button
                    type="button"
                    className="shutter-side-btn done"
                    onClick={() => {
                      stopStream();
                      setCapturingAdditional(false);
                      setCameraState("summary");
                    }}
                    aria-label="Done capturing additional photos"
                  >
                    <Check size={17} />
                    <span>Done</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shutter-side-btn next"
                    id="btn-live-next"
                    onClick={handleLiveNextAngle}
                    title="Skip or proceed to next angle"
                    aria-label="Skip or proceed to next angle"
                  >
                    <ChevronRight size={18} />
                    <span>Next</span>
                  </button>
                )}
              </>
            ) : (
              <div className="preview-action-buttons-group">
                <button
                  type="button"
                  className="btn-preview-action retake"
                  id="btn-retake-photo"
                  onClick={handleRetakeCurrent}
                  aria-label="Retake Photo"
                >
                  <RotateCcw size={16} />
                  <span>Retake</span>
                </button>

                <button
                  type="button"
                  className="btn-preview-action next"
                  id="btn-next-step"
                  onClick={handleNextStep}
                  aria-label={currentStepIdx < totalSteps - 1 ? `Accept and go to next angle` : "Review All Photos"}
                >
                  {currentStepIdx < totalSteps - 1 ? (
                    <>
                      <span>Accept & Next: {steps[currentStepIdx + 1]?.tabLabel || steps[currentStepIdx + 1]?.label}</span>
                      <ChevronRight size={18} />
                    </>
                  ) : (
                    <>
                      <span>Accept & Review All</span>
                      <CheckCircle2 size={18} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATE C: ERROR STATE                                                 */}
      {/* ==================================================================== */}
      {cameraState === "error" && (
        <div className="camera-error-card" id="camera-error-card">
          <div className="fallback-icon-wrap">
            <ShieldAlert size={34} />
          </div>

          <div className="error-text-group">
            <h4 className="fallback-title">Camera Preview Unavailable</h4>
            <p className="fallback-desc">
              {cameraError?.message ||
                "Camera permission was blocked or hardware is unavailable. You can upload photos directly from your device."}
            </p>
          </div>

          <div className="fallback-actions">
            <button
              type="button"
              className="btn-fallback-action primary"
              id="btn-fallback-upload-file"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={17} />
              <span>Upload Photo</span>
            </button>

            <button
              type="button"
              className="btn-retry-camera"
              id="btn-retry-camera"
              onClick={() => startCamera()}
            >
              <RefreshCw size={14} />
              <span>Retry Camera</span>
            </button>

            <button
              type="button"
              className="btn-cancel-error"
              onClick={() => setCameraState("idle")}
            >
              Back to Ready Screen
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATE E: SUMMARY SCREEN (PREDEFINED ANGLES + ADDITIONAL PHOTOS)       */}
      {/* ==================================================================== */}
      {cameraState === "summary" && !isNoise && (
        <div className="summary-viewport-card" id="camera-summary-card">
          <div className="summary-status-banner">
            <CheckCircle2 size={22} className="summary-banner-icon" />
            <div>
              <h4 className="summary-banner-title">
                {steps.filter((s) => s.required).every((s) => capturedPhotos[s.id] && !capturedPhotos[s.id].skipped)
                  ? `All Required Angles Documented!`
                  : `${capturedCount} of ${steps.length} Standard Angles Captured`}
              </h4>
              <p className="summary-banner-desc">
                Review angles below. You can retake any photo or capture additional photos before final review.
              </p>
            </div>
          </div>

          {/* Standard Angles Grid */}
          <div className="summary-grid">
            {steps.map((step, idx) => {
              const photo = capturedPhotos[step.id];
              const isSkipped = photo?.skipped === true;
              return (
                <div key={step.id} className={`summary-angle-card ${isSkipped ? "skipped" : ""}`}>
                  <div className="summary-thumb-wrap">
                    {photo && !isSkipped ? (
                      <img src={photo.dataUrl} alt={step.label} className="summary-thumb-img" />
                    ) : (
                      <div className={`summary-thumb-empty ${isSkipped ? "was-skipped" : ""}`}>
                        {isSkipped ? (
                          <>
                            <ChevronRight size={18} style={{ opacity: 0.4 }} />
                            <span>Skipped</span>
                          </>
                        ) : (
                          <>
                            <Camera size={22} />
                            <span>Missing</span>
                          </>
                        )}
                      </div>
                    )}
                    <span className="summary-step-number">{idx + 1}</span>
                    {!step.required && <span className="summary-optional-badge">opt</span>}
                  </div>

                  <div className="summary-meta-row">
                    <div className="summary-meta-texts">
                      <div className="summary-meta-title">
                        {step.label}
                        <span className="summary-angle-tag-inline"> (Angle {idx + 1}/{steps.length})</span>
                      </div>
                      <div className="summary-meta-sub">{step.mr}</div>
                      {photo && !isSkipped && (
                        <div className="summary-meta-size">{formatBytes(photo.compressedSize)}</div>
                      )}
                      {isSkipped && <div className="summary-meta-skipped">Skipped</div>}
                    </div>

                    <button
                      type="button"
                      className="btn-summary-retake"
                      onClick={() => handleJumpToStep(idx, "retake")}
                      title={`Retake ${step.label}`}
                    >
                      <RotateCcw size={13} />
                      <span>{isSkipped ? "Capture" : "Retake"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section: Additional Photos */}
          <div className="additional-photos-section">
            <div className="additional-photos-header">
              <div className="additional-title-group">
                <h4 className="additional-section-title">Additional Photos (अतिरिक्त फोटो)</h4>
                <span className="additional-count-badge">
                  {additionalPhotos.length} extra photo{additionalPhotos.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="additional-header-actions">
                <button
                  type="button"
                  className="btn-add-extra-photo"
                  id="btn-add-additional-photo"
                  onClick={handleStartAdditionalCapture}
                  title="Capture another view of this product"
                >
                  <Camera size={14} />
                  <span>+ Add Photo (Camera)</span>
                </button>

                <button
                  type="button"
                  className="btn-add-extra-upload"
                  id="btn-upload-additional-photo"
                  onClick={() => additionalFileInputRef.current?.click()}
                  title="Upload additional view from file"
                >
                  <Upload size={14} />
                  <span>Upload</span>
                </button>
              </div>
            </div>

            {additionalPhotos.length > 0 ? (
              <div className="additional-photos-grid">
                {additionalPhotos.map((photo, idx) => (
                  <div key={idx} className="additional-photo-card">
                    <div className="additional-thumb-wrap">
                      <img src={photo.dataUrl} alt={`Additional ${idx + 1}`} className="additional-thumb-img" />
                      <button
                        type="button"
                        className="additional-delete-btn"
                        onClick={() => handleDeleteAdditionalPhoto(idx)}
                        title="Delete this additional photo"
                      >
                        <Trash2 size={13} />
                      </button>
                      <span className="additional-tag-badge">Extra #{idx + 1}</span>
                    </div>
                    <div className="additional-meta-row">
                      <span className="additional-name">{photo.angle}</span>
                      <span className="additional-size">{formatBytes(photo.compressedSize)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="additional-empty-prompt" onClick={handleStartAdditionalCapture}>
                <Plus size={20} className="empty-prompt-icon" />
                <div>
                  <span className="prompt-strong">Need more angles? Tap here to add an additional photo.</span>
                  <span className="prompt-sub">Useful for batch stencils, seal hologram, chemical composition charts, or second barcodes.</span>
                </div>
              </div>
            )}
          </div>

          {/* Summary Actions Footer */}
          <div className="summary-footer-actions">
            <button
              type="button"
              className="btn-back-capture"
              onClick={() => {
                setCurrentStepIdx(0);
                setCameraState("captured");
              }}
            >
              <ChevronLeft size={15} />
              <span>Review Step-by-Step</span>
            </button>

            {onProceedToReview && (
              <button
                type="button"
                className="btn-proceed-review"
                id="btn-camera-proceed-review"
                onClick={onProceedToReview}
              >
                <span>Proceed to Review & Submit</span>
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
