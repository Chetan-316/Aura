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

const PRODUCT_STEPS = [
  {
    id: "Front",
    label: "Front Label",
    tabLabel: "Front Label",
    tabSubtext: "Main brand",
    mr: "मुख्य बाजू",
    tip: "Brand & product name",
    guide: "Hold bottle/pack upright. Frame entire brand title, manufacturer logo, and active ingredients.",
    tooltip: "Angle 1 of 5: Front Label — Full branding & product title"
  },
  {
    id: "Side",
    label: "Side Panel",
    tabLabel: "Side Panel",
    tabSubtext: "Any 1 side",
    mr: "बाजूचा भाग",
    tip: "Dosage & toxicity info",
    guide: "Rotate 90°. Frame dosage chart, directions, and toxicity triangle. Either side is fine.",
    tooltip: "Angle 2 of 5: Side Panel — Dosage chart & toxicity triangle"
  },
  {
    id: "Cap/Lid",
    label: "Cap / Lid",
    tabLabel: "Cap / Lid",
    tabSubtext: "Top seal",
    mr: "झाकण / सील",
    tip: "Seal & cap details",
    guide: "Shoot from 45° above. Capture tamper-evident foil seal, band color, and embossed logo on lid.",
    tooltip: "Angle 3 of 5: Cap / Lid — Tamper seal, color & embossing"
  },
  {
    id: "Barcode",
    label: "Barcode / QR",
    tabLabel: "Barcode / QR",
    tabSubtext: "Close-up",
    mr: "बारकोड",
    tip: "Sharp barcode code",
    guide: "Get a sharp close-up (10-15 cm). On flexible pouches, hold flat so barcode lines are straight.",
    tooltip: "Angle 4 of 5: Barcode / QR — High-contrast scan"
  },
  {
    id: "Back panel",
    label: "Back Panel",
    tabLabel: "Back Panel",
    tabSubtext: "Batch & MRP",
    mr: "मागील रचना",
    tip: "Batch, dates & price",
    guide: "Frame back text: chemical formula, batch number, Mfg/Exp dates, and MRP ₹.",
    tooltip: "Angle 5 of 5: Back Panel — Formulation, batch & dates"
  }
];

export default function GuidedCameraCapture({
  isNoise = false,
  photos = [],
  onPhotosChange,
  resetTrigger = 0,
  onOpenManual
}) {
  const steps = PRODUCT_STEPS;
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
  const startCamera = useCallback(async () => {
    stopStream();
    setCameraError(null);

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
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraState("live");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => {
            console.warn("Video play interrupted:", err);
          });
          setStreamActive(true);
        };
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
      }
      setCameraError({ type: err.name, message });
      setCameraState("error");
    }
  }, [facingMode, stopStream]);

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
      setTimeout(() => startCamera(), 100);
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
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, width, height);

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
          stopStream();
          saveCapturedPhoto(compressed);
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
        stopStream();
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
    stopStream();
    const updated = { ...capturedPhotos };
    delete updated[currentStep.id];
    setCapturedPhotos(updated);

    const orderedList = steps
      .map((s) => updated[s.id])
      .filter(Boolean);
    onPhotosChange(orderedList);

    setCameraState("idle");
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
        setCameraState("idle");
      }
    } else {
      setCameraState("summary");
    }
  };

  // Jump to specific angle from summary or stepper
  const handleJumpToStep = (index, targetMode = "ready") => {
    stopStream();
    setCurrentStepIdx(index);
    const angleId = steps[index].id;
    if (targetMode === "retake") {
      const updated = { ...capturedPhotos };
      delete updated[angleId];
      setCapturedPhotos(updated);
      const orderedList = steps.map((s) => updated[s.id]).filter(Boolean);
      onPhotosChange(orderedList);
      setCameraState("idle");
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
      {/* 1. UPFRONT 5-ANGLE SUMMARY BANNER (Shown initially before capture starts) */}
      {!isNoise && capturedCount === 0 && (
        <div className="angle-sequence-summary-bar" id="angle-sequence-summary">
          <span className="sequence-summary-text">
            5 Photos: <strong>1. Front</strong> → <strong>2. Side</strong> → <strong>3. Cap/Lid</strong> → <strong>4. Barcode</strong> → <strong>5. Back</strong>
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
              ({isNoise ? "निगेटिव्ह नमुने" : currentStep.mr})
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
              const isCurrent = idx === currentStepIdx && cameraState !== "summary";
              const fullStepTooltip = step.tooltip || `Angle ${idx + 1} of 5: ${step.label} (${step.mr})`;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`step-dot-btn ${isCurrent ? "current" : ""} ${
                    isCaptured ? "completed" : ""
                  }`}
                  onClick={() => handleJumpToStep(idx, isCaptured ? "captured" : "ready")}
                  title={fullStepTooltip}
                  aria-label={fullStepTooltip}
                >
                  <span className="dot-circle">
                    {isCaptured ? <Check size={11} strokeWidth={3} /> : idx + 1}
                  </span>
                  <div className="dot-text-group">
                    <span className="dot-label">{step.tabLabel}</span>
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

            {/* EXACTLY TWO CLEAR BUTTONS */}
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
              className={`camera-video-feed ${streamActive ? "active" : "hidden"}`}
            />

            {/* Rapid-fire toast notification for Noise mode */}
            {isNoise && rapidFireToast && (
              <div className="noise-rapid-toast">
                <CheckCircle2 size={15} />
                <span>{rapidFireToast}</span>
              </div>
            )}

            {/* Viewfinder Target Framing Reticle */}
            {streamActive && !isNoise && (
              <div className="viewfinder-overlay">
                <div className="viewfinder-frame">
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
              </div>
            )}
          </div>

          {/* Shutter Bar: Center Shutter, Upload Fallback, No Native duplicate */}
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
              <div className="shutter-side-placeholder" />
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
                All 5 Angles Documented!
              </h4>
              <p className="summary-banner-desc">
                Review your dataset photos below. Verify that labels and barcodes are sharp and glare-free before final submission.
              </p>
            </div>
          </div>

          <div className="summary-grid">
            {steps.map((step, idx) => {
              const photo = capturedPhotos[step.id];
              return (
                <div key={step.id} className="summary-angle-card">
                  <div className="summary-thumb-wrap">
                    {photo ? (
                      <img
                        src={photo.dataUrl}
                        alt={step.label}
                        className="summary-thumb-img"
                      />
                    ) : (
                      <div className="summary-thumb-empty">
                        <Camera size={22} />
                        <span>Missing</span>
                      </div>
                    )}
                    <span className="summary-step-number">{idx + 1}</span>
                  </div>

                  <div className="summary-meta-row">
                    <div className="summary-meta-texts">
                      <div className="summary-meta-title">
                        {step.label}
                        {idx === 4 && <span className="summary-angle-tag-inline"> (Angle 5 of 5)</span>}
                      </div>
                      <div className="summary-meta-sub">{step.mr}</div>
                      {photo && (
                        <div className="summary-meta-size">
                          {formatBytes(photo.compressedSize)}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn-summary-retake"
                      onClick={() => handleJumpToStep(idx, "retake")}
                      title={`Retake ${step.label}`}
                    >
                      <RotateCcw size={13} />
                      <span>Retake</span>
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
