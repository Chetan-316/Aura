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
    id: "Right",
    label: "Right Side",
    tabLabel: "Right",
    tabSubtext: "Dosage info",
    mr: "उजवी बाजू",
    tip: "Dosage & usage instructions",
    guide: "Rotate 90° right. Frame dosage chart, directions, and toxicity triangle.",
    tooltip: "Angle 2: Right Side — Dosage chart & directions",
    required: true
  },
  {
    id: "Left",
    label: "Left Side",
    tabLabel: "Left",
    tabSubtext: "Cautions",
    mr: "डावी बाजू",
    tip: "Additional cautions & info panel",
    guide: "Rotate to the left side. Capture any additional info or caution panels.",
    tooltip: "Angle 3: Left Side — Additional info & cautions",
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
    tooltip: "Angle 4: Back Side — Formulation, batch & warning",
    required: true
  },
  {
    id: "Barcode",
    label: "Barcode / QR",
    tabLabel: "Barcode",
    tabSubtext: "Close-up",
    mr: "बारकोड",
    tip: "High-contrast close-up, avoid glare",
    guide: "Get a sharp close-up (10–15 cm). On flexible pouches, hold flat so barcode lines are straight.",
    tooltip: "Angle 5: Barcode / QR — High-contrast scan",
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
  packagingLabel = "Bottle / Container"
}) {
  // Use the dynamic photoAngles prop if provided, fall back to hardcoded steps
  const steps = (!isNoise && photoAngles && photoAngles.length > 0)
    ? photoAngles
    : PRODUCT_STEPS_FALLBACK;
  const totalSteps = steps.length;

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // STRICT CAMERA STATE MACHINE:
  // 'idle'     : Inactive on step load / reset / retake (requires explicit "Open Camera" click)
  // 'live'     : Live camera stream active with viewfinder and shutter
  // 'error'    : Camera permission denied / unavailable
  // 'captured' : Photo taken for current product angle (review screen)
  // 'summary'  : All 5 angles completed review grid
  const [cameraState, setCameraState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const testParam = params.get("testState");
    if (testParam === "error") return "error";
    if (testParam === "captured") return "captured";
    return "idle";
  });

  // Map of angleId -> photo object for 5-angle product flow
  const [capturedPhotos, setCapturedPhotos] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("testState") === "captured") {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#163a2b";
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(20, 20, 760, 560);
      ctx.fillStyle = "#0f291e";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("Dataset Sample - Front Label", 50, 300);
      ctx.font = "20px sans-serif";
      ctx.fillText("Coromandel Gromor 28-28-0 • CIR-18239", 50, 350);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      return {
        Front: {
          dataUrl,
          compressedSize: 52400,
          originalName: "front_sample.jpg",
          mimeType: "image/jpeg",
          angle: "Front",
          base64: dataUrl.split(",")[1]
        }
      };
    }
    return {};
  });

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

  // Sync test mock noise photos to parent on mount if needed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("testState") === "noise" && isNoise && noisePhotos.length > 0 && photos.length === 0) {
      onPhotosChange(noisePhotos);
    }
  }, [isNoise, noisePhotos, onPhotosChange, photos.length]);

  // Camera hardware stream state
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
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentStep = steps[currentStepIdx] || steps[0];
  const currentCapturedPhoto = capturedPhotos[currentStep?.id];

  // Stop camera stream safely
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Track stop error:", e);
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
      setNoisePhotos([]);
      setCurrentStepIdx(0);
      setCameraError(null);
      setCameraState("idle");
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
      setNoisePhotos([]);
      onPhotosChange([]);
    }
  }, [isNoise, onPhotosChange, stopStream]);

  // If packaging type switched (e.g. Bottle <-> Pouch), reset angle steps and photos
  const prevPackagingRef = useRef(packagingType);
  useEffect(() => {
    if (prevPackagingRef.current !== packagingType) {
      prevPackagingRef.current = packagingType;
      stopStream();
      setCurrentStepIdx(0);
      setCameraError(null);
      setCameraState("idle");
      setCapturedPhotos({});
      setNoisePhotos([]);
      onPhotosChange([]);
    }
  }, [packagingType, onPhotosChange, stopStream]);

  // Check hardware camera devices count
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === "videoinput");
          setHasMultipleCameras(videoInputs.length > 1);
        })
        .catch(() => setHasMultipleCameras(false));
    }
  }, []);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Start live camera stream (ONLY invoked on explicit user action)
  const startCamera = useCallback(async (targetFacingMode = facingMode) => {
    stopStream();
    setCameraError(null);

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
        // Outer room/counter background (to verify cropping cuts this out)
        mockCtx.fillStyle = "#1e293b";
        mockCtx.fillRect(0, 0, 1280, 960);

        // Counter edge & texture
        mockCtx.fillStyle = "#334155";
        mockCtx.fillRect(40, 40, 1200, 880);

        // Product bottle centered within the guide area
        mockCtx.fillStyle = "#14532d";
        if (mockCtx.roundRect) {
          mockCtx.beginPath();
          mockCtx.roundRect(320, 140, 640, 680, 32);
          mockCtx.fill();
        } else {
          mockCtx.fillRect(320, 140, 640, 680);
        }

        // Product label inside the bottle
        mockCtx.fillStyle = "#f8fafc";
        mockCtx.fillRect(360, 240, 560, 460);

        mockCtx.fillStyle = "#15803d";
        mockCtx.font = "bold 32px sans-serif";
        mockCtx.textAlign = "center";
        mockCtx.fillText("COROMANDEL GROMOR", 640, 310);

        mockCtx.fillStyle = "#0f172a";
        mockCtx.font = "20px sans-serif";
        mockCtx.fillText("NPK 28-28-0 Fertilizer • CIR-18239", 640, 355);

        // Barcode lines
        mockCtx.fillStyle = "#000000";
        for (let i = 0; i < 34; i++) {
          const w = i % 4 === 0 ? 7 : (i % 2 === 0 ? 4 : 2);
          mockCtx.fillRect(470 + i * 10, 410, w, 90);
        }
        mockCtx.fillStyle = "#334155";
        mockCtx.font = "16px monospace";
        mockCtx.fillText("8 901234 567890", 640, 525);

        // Batch & Expiry
        mockCtx.fillStyle = "#64748b";
        mockCtx.font = "15px sans-serif";
        mockCtx.fillText("B.No: CR-2026-08 • Exp: 08/2028 • MRP ₹ 1,450", 640, 570);

        // Active angle indicator
        mockCtx.fillStyle = "#16a34a";
        mockCtx.font = "bold 20px sans-serif";
        mockCtx.fillText(`[LIVE STREAM ACTIVE] Current: Angle ${currentStepIdx + 1}`, 640, 640);

        // Live animated counter
        mockCtx.fillStyle = "#22c55e";
        mockCtx.font = "14px monospace";
        mockCtx.fillText(`Mock Stream Frame #${frameCount} • ${new Date().toLocaleTimeString()}`, 640, 930);
      };

      drawMockFrame();
      const intervalId = setInterval(drawMockFrame, 66);

      const stream = mockCanvas.captureStream ? mockCanvas.captureStream(30) : null;
      if (stream) {
        stream.getVideoTracks().forEach((track) => {
          const originalStop = track.stop.bind(track);
          track.stop = () => {
            clearInterval(intervalId);
            originalStop();
          };
        });

        streamRef.current = stream;
        setCameraState("live");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => setStreamActive(true)).catch(() => setStreamActive(true));
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
      } catch (constraintErr) {
        console.warn("High-res constraints failed, falling back to basic video:", constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: targetFacingMode
          }
        });
      }

      streamRef.current = stream;
      setCameraState("live");

      // Attach immediately to video element if already mounted
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.play().then(() => {
          setStreamActive(true);
        }).catch((err) => {
          console.warn("Video play error on start:", err);
          setStreamActive(true);
        });
      }
    } catch (err) {
      console.error("Camera access error:", err);
      stopStream();
      let message = "Unable to access camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        message =
          "Camera permission was blocked. Please allow camera permissions in your browser address bar/settings, or use the Upload button below.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        message = "No camera hardware detected on this device. You can choose photos using the Upload button.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        message = "Camera is currently in use by another application. Please close other camera apps and retry.";
      } else if (err.name === "OverconstrainedError") {
        message = "Camera resolution not supported by device. Please retry or use the Upload button.";
      }
      setCameraError({ type: err.name, message });
      setCameraState("error");
    }
  }, [currentStepIdx, facingMode, stopStream]);

  // CRITICAL: Synchronize media stream whenever cameraState switches to 'live' and video element mounts
  useEffect(() => {
    if (cameraState === "live" && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== streamRef.current) {
        video.srcObject = streamRef.current;
      }

      const activate = () => {
        setStreamActive(true);
      };

      video.addEventListener("loadedmetadata", activate);
      video.addEventListener("playing", activate);
      video.addEventListener("canplay", activate);

      video.play().catch((err) => {
        console.warn("Video play promise error:", err);
        setStreamActive(true);
      });

      if (video.readyState >= 2) {
        setStreamActive(true);
      }

      return () => {
        video.removeEventListener("loadedmetadata", activate);
        video.removeEventListener("playing", activate);
        video.removeEventListener("canplay", activate);
      };
    }
  }, [cameraState]);

  // Safety fallback: ensure spinner does not stay stuck indefinitely if camera stream is active
  useEffect(() => {
    if (cameraState === "live" && !streamActive) {
      const timer = setTimeout(() => {
        if (streamRef.current && videoRef.current) {
          console.warn("Fallback timeout: triggering stream active");
          if (!videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
          }
          videoRef.current.play().catch(console.warn);
          setStreamActive(true);
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [cameraState, streamActive]);

  // Handle explicit "Open Camera" click
  const handleUserOpenCamera = () => {
    startCamera();
  };

  // Handle explicit "Turn Off / Done" click
  const handleUserCloseCamera = () => {
    stopStream();
    setCameraState("idle");
  };

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

  // Live skip angle action (while stream is active)
  const handleLiveSkipAngle = () => {
    const skippedEntry = { skipped: true, angle: currentStep.id, dataUrl: null, compressedSize: 0 };
    const updated = { ...capturedPhotos, [currentStep.id]: skippedEntry };
    setCapturedPhotos(updated);
    const orderedList = steps.map((s) => updated[s.id]).filter((p) => p && !p.skipped);
    onPhotosChange(orderedList);

    if (currentStepIdx < totalSteps - 1) {
      const nextIdx = currentStepIdx + 1;
      const prevLabel = currentStep.label;
      const nextLabel = steps[nextIdx].label;
      setCurrentStepIdx(nextIdx);
      setRapidFireToast(`Skipped ${prevLabel}. Framing: ${nextLabel}`);
      setTimeout(() => setRapidFireToast(null), 2000);
    } else {
      stopStream();
      setCameraState("summary");
    }
  };

  // Capture frame from live video feed
  const handleSnapPhoto = async () => {
    if (!videoRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const video = videoRef.current;
      const videoWidth = video.videoWidth || 1280;
      const videoHeight = video.videoHeight || 720;

      // Crop mathematics: align canvas capture strictly to the guide-frame corner brackets
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
            // Video stream is wider than rendered element: clipped horizontally
            scale = videoHeight / videoRect.height;
            const renderedIntrinsicWidth = videoRect.width * scale;
            offsetX = (videoWidth - renderedIntrinsicWidth) / 2;
            offsetY = 0;
          } else {
            // Video stream is taller than rendered element: clipped vertically
            scale = videoWidth / videoRect.width;
            const renderedIntrinsicHeight = videoRect.height * scale;
            offsetX = 0;
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

      if (isNoise) {
        // Multi-photo rapid fire capture for noise
        const nextIndex = noisePhotos.length + 1;
        const photoTag = `Noise #${nextIndex}`;
        const compressed = await processCanvasCapture(canvas, photoTag);

        if (compressed) {
          const updated = [...noisePhotos, compressed];
          setNoisePhotos(updated);
          onPhotosChange(updated);
          setRapidFireToast(`Photo #${updated.length} captured! Snap another or tap Done.`);
          setTimeout(() => setRapidFireToast(null), 2200);
          // Stream stays active so user can rapid-fire snap multiple photos!
        }
      } else {
        // 5-Angle single step capture
        const compressed = await processCanvasCapture(canvas, currentStep.id);
        if (compressed) {
          const updated = {
            ...capturedPhotos,
            [currentStep.id]: compressed
          };
          setCapturedPhotos(updated);

          const orderedList = steps
            .map((s) => updated[s.id])
            .filter(Boolean);
          onPhotosChange(orderedList);

          if (currentStepIdx < totalSteps - 1) {
            // Stream STAYS ACTIVE across angles! Move directly to next angle guidance
            const nextIdx = currentStepIdx + 1;
            const prevLabel = currentStep.label;
            const nextLabel = steps[nextIdx].label;
            setCurrentStepIdx(nextIdx);
            setRapidFireToast(`✓ ${prevLabel} captured! Framing: ${nextLabel}`);
            setTimeout(() => setRapidFireToast(null), 2200);
          } else {
            // All 5 angles finished! Stop camera hardware and transition to summary
            stopStream();
            setCameraState("summary");
          }
        }
      }
    } catch (err) {
      console.error("Snapshot failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Single fallback file handler (Upload button handles 1 or multiple files)
  const handleFallbackFileInput = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setIsCapturing(true);

    try {
      if (isNoise) {
        // Multi-file upload for noise
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
      } else {
        // Product angle single file upload
        const file = fileList[0];
        const compressed = await compressImage(file, 1600, 0.82);
        compressed.angle = currentStep.id;
        // For manual upload, save photo
        saveCapturedPhoto(compressed);
      }
    } catch (err) {
      console.error("Fallback upload failed:", err);
    } finally {
      setIsCapturing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Store photo in state and sync with parent form (Product flow)
  const saveCapturedPhoto = (photoObj) => {
    stopStream();
    const updated = {
      ...capturedPhotos,
      [currentStep.id]: photoObj
    };
    setCapturedPhotos(updated);

    const orderedList = steps
      .map((s) => updated[s.id])
      .filter(Boolean);
    onPhotosChange(orderedList);

    setCameraState("captured");
  };

  // Action: Retake current photo
  const handleRetakeCurrent = () => {
    const updated = { ...capturedPhotos };
    delete updated[currentStep.id];
    setCapturedPhotos(updated);

    const orderedList = steps
      .map((s) => updated[s.id])
      .filter(Boolean);
    onPhotosChange(orderedList);

    // Immediately reuse / start camera stream
    startCamera();
  };

  // Action: Advance to next step or summary
  const handleNextStep = () => {
    stopStream();
    if (currentStepIdx < totalSteps - 1) {
      const nextIdx = currentStepIdx + 1;
      setCurrentStepIdx(nextIdx);
      const nextAngleId = steps[nextIdx].id;

      if (capturedPhotos[nextAngleId]) {
        setCameraState("captured");
      } else {
        // Direct jump into camera for next angle
        startCamera();
      }
    } else {
      setCameraState("summary");
    }
  };

  // Jump to specific angle from summary or stepper
  const handleJumpToStep = (index, targetMode = "ready") => {
    const wasLive = cameraState === "live" && streamActive;
    setCurrentStepIdx(index);
    const angleId = steps[index].id;

    if (wasLive) {
      // KEEP camera stream active!
      if (targetMode === "retake") {
        const updated = { ...capturedPhotos };
        delete updated[angleId];
        setCapturedPhotos(updated);
        const orderedList = steps.map((s) => updated[s.id]).filter(Boolean);
        onPhotosChange(orderedList);
      }
      setCameraState("live");
      return;
    }

    if (targetMode === "retake") {
      const updated = { ...capturedPhotos };
      delete updated[angleId];
      setCapturedPhotos(updated);
      const orderedList = steps.map((s) => updated[s.id]).filter(Boolean);
      onPhotosChange(orderedList);
      // Immediately open camera
      startCamera();
    } else if (capturedPhotos[angleId]) {
      setCameraState("captured");
    } else {
      setCameraState("idle");
    }
  };

  // Delete an individual noise photo
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
    : Object.keys(capturedPhotos).length;

  return (
    <div className="guided-camera-container">
      {/* Packaging type context badge (shown above sequence bar for product flow) */}
      {!isNoise && (
        <div className="packaging-context-badge">
          <span className="pkg-badge-icon">
            {packagingType === "Bottle" ? "🍶" : "📦"}
          </span>
          <span className="pkg-badge-text">
            {packagingLabel}
          </span>
          <span className="pkg-badge-count">
            {steps.length} angles
          </span>
        </div>
      )}

      {/* 1. UPFRONT SEQUENCE SUMMARY BANNER (Shown initially before capture starts) */}
      {!isNoise && capturedCount === 0 && (
        <div className="angle-sequence-summary-bar" id="angle-sequence-summary">
          <span className="sequence-summary-text">
            {steps.length} Photos:{" "}
            {steps.map((s, i) => (
              <span key={s.id}>
                {i > 0 && <span style={{margin: "0 3px", opacity: 0.5}}>→</span>}
                <strong>{i + 1}. {s.label}</strong>
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Upfront Info Banner for Noise mode */}
      {isNoise && capturedCount === 0 && (
        <div className="noise-sequence-summary-bar" id="noise-sequence-summary">
          <span className="noise-summary-text">
            Multi-photo noise: <strong>Empty racks</strong> • <strong>Counter clutter</strong> • <strong>Hands holding items</strong> • <strong>Cartons</strong>
          </span>
        </div>
      )}

      {/* --- Step Indicator Header --- */}
      <div className="guided-step-header">
        <div className="step-progress-row">
          <div className="step-indicator-badge">
            {isNoise ? (
              <span className="step-pill active">
                Noise / Negative Sample Mode
              </span>
            ) : cameraState === "summary" ? (
              <span className="step-pill summary">
                <CheckCircle2 size={13} />
                Summary Review
              </span>
            ) : (
              <span className="step-pill active">
                Angle {currentStepIdx + 1} of {totalSteps}
              </span>
            )}

            <span className="step-angle-title">
              {isNoise ? "Rapid Multi-Photo Capture" : currentStep.label}
            </span>
            <span className="step-angle-mr">
              ({isNoise ? "नॉइज / निगेटिव्ह सॅम्पल्स" : currentStep.mr})
            </span>
          </div>

          <div className="step-header-actions">
            <span className="step-counter-tag">
              {isNoise
                ? `${capturedCount} photo${capturedCount !== 1 ? "s" : ""} added`
                : `${capturedCount}/${totalSteps} captured`}
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

        {/* Stepper Tabs (Shown for 5-angle product flow) */}
        {!isNoise && (
          <div className="stepper-dots-bar" role="tablist" aria-label="Angle capture steps">
            {steps.map((step, idx) => {
              const isCaptured = !!capturedPhotos[step.id];
              const isSkipped = capturedPhotos[step.id]?.skipped === true;
              const isCurrent = idx === currentStepIdx && cameraState !== "summary";
              const fullStepTooltip = step.tooltip || `Angle ${idx + 1} of ${totalSteps}: ${step.label} (${step.mr})`;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`step-dot-btn ${isCurrent ? "current" : ""} ${
                    isCaptured ? (isSkipped ? "skipped" : "completed") : ""
                  }`}
                  onClick={() => handleJumpToStep(idx, isCaptured ? "captured" : "ready")}
                  title={fullStepTooltip}
                  aria-label={fullStepTooltip}
                >
                  <span className="dot-circle">
                    {isSkipped ? (
                      <span style={{fontSize: "9px", opacity: 0.7}}>skip</span>
                    ) : isCaptured ? (
                      <Check size={11} strokeWidth={3} />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <div className="dot-text-group">
                    <span className="dot-label">
                      {step.label}
                    </span>
                    <span className="dot-sublabel">{step.tabSubtext}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Live Guidance Tip Box */}
        {cameraState !== "summary" && (
          <div className="angle-guide-callout">
            <Info size={15} className="guide-icon" />
            <div className="guide-text-wrap">
              <span className="guide-tip-strong">
                {isNoise ? "Rapid-fire capture" : currentStep.tip}:{" "}
              </span>
              <span className="guide-tip-desc">
                {isNoise
                  ? "Capture empty shop racks, counter clutter, hand holding cash/keys, or unrelated cartons. Snap or upload multiple photos repeatedly."
                  : currentStep.guide}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SINGLE HIDDEN FILE INPUT (Used by Upload button, supports multiple for noise) */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        multiple={isNoise}
        onChange={(e) => handleFallbackFileInput(e.target.files)}
      />

      {/* ==================================================================== */}
      {/* STATE A: IDLE / READY SCREEN (EXACTLY TWO CHOICES: OPEN CAMERA & UPLOAD) */}
      {/* ==================================================================== */}
      {cameraState === "idle" && (
        isNoise && noisePhotos.length > 0 ? (
          /* Multi-Photo Active Noise Dashboard */
          <div className="noise-active-dashboard-card" id="noise-active-card">
            <div className="noise-dashboard-header">
              <div className="noise-status-group">
                <div className="noise-status-badge">
                  <CheckCircle2 size={16} />
                  <span>{noisePhotos.length} Photo{noisePhotos.length !== 1 ? "s" : ""} Added</span>
                </div>
                <h3 className="noise-dashboard-title">Noise / Negative Dataset Samples</h3>
                <p className="noise-dashboard-desc">
                  Rapid-fire capture more non-product photos or upload additional files. Submit when you're done.
                </p>
              </div>
            </div>

            {/* Exactly two clear primary/secondary buttons */}
            <div className="ready-action-buttons noise-add-actions">
              <button
                type="button"
                className="btn-open-camera-primary"
                id="btn-open-camera"
                onClick={handleUserOpenCamera}
                title="Open camera to snap more photos"
              >
                <Camera size={18} />
                <span>Open Camera (Snap More)</span>
              </button>

              <button
                type="button"
                className="btn-upload-file-secondary"
                id="btn-upload-file"
                onClick={() => fileInputRef.current?.click()}
                title="Upload more photos from device"
              >
                <Upload size={18} />
                <span>Upload More Photos</span>
              </button>
            </div>

            {/* Noise Gallery Grid */}
            <div className="noise-gallery-grid">
              {noisePhotos.map((photo, index) => (
                <div key={index} className="noise-photo-card">
                  <div className="noise-thumb-wrap">
                    <img
                      src={photo.dataUrl}
                      alt={`Noise sample ${index + 1}`}
                      className="noise-thumb-img"
                    />
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
                    <span className="noise-card-size">
                      {formatBytes(photo.compressedSize)}
                    </span>
                  </div>
                </div>
              ))}

              {/* Add Another Quick Tile */}
              <div
                className="noise-add-another-tile"
                onClick={() => fileInputRef.current?.click()}
                title="Click to upload or select another photo"
              >
                <Plus size={24} className="add-tile-icon" />
                <span className="add-tile-text">Add Another</span>
                <span className="add-tile-sub">Tap to Upload</span>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Ready Card for Product Flow or Empty Noise */
          <div className="camera-ready-card" id="camera-idle-card">
            <div className="ready-icon-container">
              <Camera size={34} className="ready-camera-icon" />
            </div>

            <div className="ready-text-group">
              <h3 className="ready-title">
                {isNoise
                  ? "Capture Noise / Negative Photos"
                  : `Ready to capture: ${currentStep.label}`}
              </h3>
              <p className="ready-subtitle">
                {isNoise
                  ? "Add clutter, counter, or non-product photos to train the AI to reject false positives. Rapid-fire multiple photos in one session."
                  : `${currentStep.mr} • Position the item and choose an option below.`}
              </p>
            </div>

            {/* EXACTLY TWO CLEAR BUTTONS + SKIP IF NOT ON PACKAGE */}
            <div className="ready-action-buttons">
              <button
                type="button"
                className="btn-open-camera-primary"
                id="btn-open-camera"
                onClick={handleUserOpenCamera}
                title="Open live camera preview"
              >
                <Camera size={18} />
                <span>Open Camera</span>
              </button>

              <button
                type="button"
                className="btn-upload-file-secondary"
                id="btn-upload-file"
                onClick={() => fileInputRef.current?.click()}
                title="Upload photo from device storage or gallery"
              >
                <Upload size={18} />
                <span>Upload</span>
              </button>
            </div>

            {/* Skip button — available if an angle or barcode is not present on the package */}
            {!isNoise && (
              <button
                type="button"
                className="btn-skip-optional"
                id="btn-skip-angle"
                onClick={() => {
                  // Mark as skipped and advance
                  const skippedEntry = { skipped: true, angle: currentStep.id, dataUrl: null, compressedSize: 0 };
                  const updated = { ...capturedPhotos, [currentStep.id]: skippedEntry };
                  setCapturedPhotos(updated);
                  // Only push non-skipped photos to parent
                  const orderedList = steps.map(s => updated[s.id]).filter(p => p && !p.skipped);
                  onPhotosChange(orderedList);
                  if (currentStepIdx < totalSteps - 1) {
                    setCurrentStepIdx(currentStepIdx + 1);
                    const nextId = steps[currentStepIdx + 1].id;
                    setCameraState(capturedPhotos[nextId] ? "captured" : "idle");
                  } else {
                    setCameraState("summary");
                  }
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
      {/* STATE B: LIVE ACTIVE CAMERA STREAM                                   */}
      {/* ==================================================================== */}
      {cameraState === "live" && (
        <div className="camera-viewport-card" id="camera-live-card">
          {/* Top Bar inside Viewfinder */}
          <div className="camera-feed-topbar">
            <div className="feed-angle-pill">
              <span className="live-pulse-dot" />
              <span>
                {isNoise
                  ? `Noise Capture (${noisePhotos.length} taken)`
                  : currentStep.label}
              </span>
            </div>

            <div className="feed-controls-group">
              {hasMultipleCameras && (
                <button
                  type="button"
                  className="camera-pill-btn"
                  onClick={toggleCameraFacing}
                  title="Switch Camera (Front/Rear)"
                >
                  <SwitchCamera size={14} />
                  <span>Flip</span>
                </button>
              )}
              <button
                type="button"
                className="camera-pill-btn close"
                id="btn-close-camera"
                onClick={handleUserCloseCamera}
                title={isNoise ? "Finish snapping & review" : "Close Camera"}
              >
                {isNoise ? <Check size={14} /> : <CameraOff size={14} />}
                <span>{isNoise ? "Done" : "Turn Off"}</span>
              </button>
            </div>
          </div>

          <div className="camera-viewfinder-wrapper">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              onLoadedMetadata={() => {
                videoRef.current?.play().catch(console.warn);
                setStreamActive(true);
              }}
              onCanPlay={() => setStreamActive(true)}
              onPlaying={() => setStreamActive(true)}
              className={`camera-video-feed ${streamActive ? "active" : "hidden"}`}
            />

            {/* Live capture flash overlay */}
            {isCapturing && <div className="camera-shutter-flash" />}

            {/* Rapid-fire / angle transition toast notification */}
            {rapidFireToast && (
              <div className="noise-rapid-toast">
                <CheckCircle2 size={15} />
                <span>{rapidFireToast}</span>
              </div>
            )}

            {/* Viewfinder Target Framing Reticle */}
            {streamActive && !isNoise && (
              <div className="viewfinder-overlay">
                <div className="viewfinder-frame" ref={frameRef}>
                  <div className="corner top-left" />
                  <div className="corner top-right" />
                  <div className="corner bottom-left" />
                  <div className="corner bottom-right" />
                  <div className="viewfinder-label-badge">
                    {currentStep.label} • {currentStep.mr}
                  </div>
                </div>
              </div>
            )}

            {/* Connecting Spinner */}
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
          </div>

          {/* Shutter Bar: Center Shutter, Upload Fallback, Skip button */}
          <div className="camera-shutter-bar">
            <button
              type="button"
              className="shutter-side-btn"
              id="btn-shutter-upload"
              onClick={() => fileInputRef.current?.click()}
              title="Upload photo from files"
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
              title={isNoise ? "Snap Noise Photo (Rapid-Fire)" : `Capture ${currentStep.label}`}
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
                onClick={handleUserCloseCamera}
                title="Finish snapping noise photos"
              >
                <Check size={17} />
                <span>Done</span>
              </button>
            ) : (
              <button
                type="button"
                className="shutter-side-btn skip"
                id="btn-live-skip"
                onClick={handleLiveSkipAngle}
                title="Skip this angle if not on package"
              >
                <ChevronRight size={17} />
                <span>Skip</span>
              </button>
            )}
          </div>

          {/* Noise photo thumbnail roll during live stream */}
          {isNoise && noisePhotos.length > 0 && (
            <div className="noise-live-strip">
              <span className="strip-label">{noisePhotos.length} captured:</span>
              <div className="strip-thumbs-container">
                {noisePhotos.map((p, idx) => (
                  <div key={idx} className="strip-thumb-wrap">
                    <img src={p.dataUrl} alt={`Snap #${idx + 1}`} className="strip-thumb-img" />
                    <span className="strip-thumb-num">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATE C: ERROR STATE (SIMPLIFIED TO EXACTLY TWO CHOICES)              */}
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
              onClick={handleUserOpenCamera}
            >
              <RefreshCw size={14} />
              <span>Retry Camera Permission</span>
            </button>

            <button
              type="button"
              className="btn-cancel-error"
              id="btn-cancel-camera"
              onClick={() => setCameraState("idle")}
            >
              Back to Ready Screen
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATE D: CAPTURED PHOTO REVIEW (PRODUCT 5-ANGLE FLOW)                */}
      {/* ==================================================================== */}
      {cameraState === "captured" && !isNoise && currentCapturedPhoto && (
        <div className="preview-viewport-card" id="camera-captured-card">
          <div className="preview-image-container">
            <img
              src={currentCapturedPhoto.dataUrl}
              alt={currentStep.label}
              className="preview-photo-img"
            />
            <div className="preview-badge-overlay">
              <div className="preview-angle-tag">
                <Check size={13} />
                <span>
                  {currentStep.label} ({currentStep.mr})
                </span>
              </div>
              <div className="preview-size-tag">
                {formatBytes(currentCapturedPhoto.compressedSize)}
              </div>
            </div>
          </div>

          {/* Action Row: Retake and Next */}
          <div className="preview-actions-row">
            <button
              type="button"
              className="btn-preview-action retake"
              id="btn-retake-photo"
              onClick={handleRetakeCurrent}
            >
              <RotateCcw size={16} />
              <span>Retake Photo</span>
            </button>

            <button
              type="button"
              className="btn-preview-action next"
              id="btn-next-step"
              onClick={handleNextStep}
            >
              {currentStepIdx < totalSteps - 1 ? (
                <>
                  <span>Next: {steps[currentStepIdx + 1]?.tabLabel || steps[currentStepIdx + 1]?.label}</span>
                  <ChevronRight size={18} />
                </>
              ) : (
                <>
                  <span>Review All Photos</span>
                  <CheckCircle2 size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATE E: SUMMARY SCREEN (ALL 5 ANGLES REVIEW)                        */}
      {/* ==================================================================== */}
      {cameraState === "summary" && !isNoise && (
        <div className="summary-viewport-card" id="camera-summary-card">
          <div className="summary-status-banner">
            <CheckCircle2 size={22} className="summary-banner-icon" />
            <div>
              <h4 className="summary-banner-title">
                {steps.filter(s => s.required).every(s => capturedPhotos[s.id] && !capturedPhotos[s.id].skipped)
                  ? `All ${steps.length} Angles Documented!`
                  : `${Object.values(capturedPhotos).filter(p => p && !p.skipped).length} of ${steps.length} Angles Captured`}
              </h4>
              <p className="summary-banner-desc">
                Review your dataset photos below. Verify that labels and barcodes are sharp and glare-free before final submission.
              </p>
            </div>
          </div>

          <div className="summary-grid">
            {steps.map((step, idx) => {
              const photo = capturedPhotos[step.id];
              const isSkipped = photo?.skipped === true;
              return (
                <div key={step.id} className={`summary-angle-card ${isSkipped ? "skipped" : ""}`}>
                  <div className="summary-thumb-wrap">
                    {photo && !isSkipped ? (
                      <img
                        src={photo.dataUrl}
                        alt={step.label}
                        className="summary-thumb-img"
                      />
                    ) : (
                      <div className={`summary-thumb-empty ${isSkipped ? "was-skipped" : ""}`}>
                        {isSkipped ? (
                          <>
                            <ChevronRight size={18} style={{opacity: 0.4}} />
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
                    {!step.required && (
                      <span className="summary-optional-badge">opt</span>
                    )}
                  </div>

                  <div className="summary-meta-row">
                    <div className="summary-meta-texts">
                      <div className="summary-meta-title">
                        {step.label}
                        <span className="summary-angle-tag-inline"> (Angle {idx + 1} of {steps.length})</span>
                      </div>
                      <div className="summary-meta-sub">{step.mr}</div>
                      {photo && !isSkipped && (
                        <div className="summary-meta-size">
                          {formatBytes(photo.compressedSize)}
                        </div>
                      )}
                      {isSkipped && (
                        <div className="summary-meta-skipped">Skipped — not captured</div>
                      )}
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
              <span>Review Angles One by One</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
