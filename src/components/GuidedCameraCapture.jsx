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
  HelpCircle
} from "lucide-react";
import { compressImage, formatBytes } from "../utils/compressor";

const PRODUCT_STEPS = [
  {
    id: "Front",
    label: "Front Label",
    mr: "मुख्य बाजू",
    tip: "Full branding & product title",
    guide: "Hold bottle/pack upright. Frame entire brand title, manufacturer logo, and active chemistry percentage."
  },
  {
    id: "Side",
    label: "Side Panel",
    mr: "बाजूचा भाग",
    tip: "Dosage, batch, barcode",
    guide: "Rotate 90°. Frame technical directions, crop dosage charts (ml/ha), toxicity triangle, and license."
  },
  {
    id: "Cap/Lid",
    label: "Cap / Lid",
    mr: "झाकण / सील",
    tip: "Seal color, brand embossing",
    guide: "Shoot from 45° above. Capture tamper-evident foil seal, band color, and embossed brand logo on cap."
  },
  {
    id: "Barcode",
    label: "Barcode / QR",
    mr: "बारकोड",
    tip: "High-contrast close-up",
    guide: "Get a sharp, glare-free close-up (10-15 cm). On flexible pouches, hold package flat to keep barcode straight."
  },
  {
    id: "Back panel",
    label: "Back / Composition",
    mr: "मागील रचना",
    tip: "Chemical formulation & warning",
    guide: "Frame ink-jet printed batch number, Mfg Date, Expiry date, MRP, and antidote medical warnings."
  }
];

const NOISE_STEPS = [
  {
    id: "Noise Sample",
    label: "Noise / Negative Sample",
    mr: "निगेटिव्ह नमुना",
    tip: "Non-product context",
    guide: "Capture blur, empty shop racks, hand holding cash/keys, or unrelated store counter clutter."
  }
];

export default function GuidedCameraCapture({
  isNoise = false,
  _photos = [],
  onPhotosChange,
  resetTrigger = 0,
  onOpenManual
}) {
  const steps = isNoise ? NOISE_STEPS : PRODUCT_STEPS;
  const totalSteps = steps.length;

  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // STRICT SINGLE-VARIABLE CAMERA STATE MACHINE:
  // 'idle'     : Camera inactive on step load / reset / retake (requires explicit "Open Camera" click)
  // 'live'     : Camera stream active with viewfinder, reticle, flip, turn off, and shutter
  // 'error'    : Camera permission denied or device unavailable (shows only clean error card + fallbacks)
  // 'captured' : Photo taken for current angle, showing photo review with Retake / Next
  // 'summary'  : All angles completed, showing review grid of all photos
  const [cameraState, setCameraState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const testParam = params.get("testState");
    if (testParam === "error") return "error";
    if (testParam === "captured") return "captured";
    return "idle";
  });

  // Map of angleId -> photo object
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

  // Camera hardware stream state
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("testState") === "error") {
      return {
        type: "NotAllowedError",
        message:
          "Camera permission was blocked. Please allow camera permissions in your browser address bar/settings, or use the device camera button below."
      };
    }
    return null;
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileFallbackRef = useRef(null);
  const galleryInputRef = useRef(null);

  const currentStep = steps[currentStepIdx] || steps[0];
  const currentCapturedPhoto = capturedPhotos[currentStep?.id];

  // Stop camera stream safely & synchronously on every track
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
          ? "Live camera stream requires HTTPS or localhost. Use the system camera or upload buttons below."
          : "Live camera access is not supported in this browser. Use the system camera or upload buttons below."
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

      // Set live mode cleanly
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
          "Camera permission was blocked. Please allow camera permissions in your browser address bar/settings, or use the device camera button below.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        message = "No camera hardware detected on this device. You can choose photos from your device.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        message = "Camera is currently in use by another application. Please close other camera apps and retry.";
      }
      setCameraError({ type: err.name, message });
      setCameraState("error");
    }
  }, [facingMode, stopStream]);

  // Handle explicit "Open Camera" click from user
  const handleUserOpenCamera = () => {
    startCamera();
  };

  // Handle explicit "Turn Off Camera" click from user
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

      const compressed = await processCanvasCapture(canvas, currentStep.id);

      if (compressed) {
        stopStream();
        saveCapturedPhoto(compressed);
      }
    } catch (err) {
      console.error("Snapshot failed:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Fallback handler: Native file input (system camera or gallery)
  const handleFallbackFileInput = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setIsCapturing(true);

    try {
      const file = fileList[0];
      const compressed = await compressImage(file, 1600, 0.82);
      compressed.angle = currentStep.id;
      stopStream();
      saveCapturedPhoto(compressed);
    } catch (err) {
      console.error("Fallback capture failed:", err);
    } finally {
      setIsCapturing(false);
      if (fileFallbackRef.current) fileFallbackRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  // Store photo in state and sync with parent form
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
  // Camera MUST remain inactive/closed by default; user explicitly taps "Open Camera"
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
  // Camera MUST remain inactive/closed by default on every step change; no auto-start!
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
      // Completed all angles! Show summary screen
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

  const capturedCount = Object.keys(capturedPhotos).length;

  return (
    <div className="guided-camera-container">
      {/* --- Step Indicator Header --- */}
      <div className="guided-step-header">
        <div className="step-progress-row">
          <div className="step-indicator-badge">
            {cameraState === "summary" ? (
              <span className="step-pill summary">
                <CheckCircle2 size={13} />
                Summary Review
              </span>
            ) : (
              <span className="step-pill active">
                Angle {currentStepIdx + 1} of {totalSteps}
              </span>
            )}
            <span className="step-angle-title">{currentStep.label}</span>
            <span className="step-angle-mr">({currentStep.mr})</span>
          </div>

          <div className="step-header-actions">
            <span className="step-counter-tag">
              {capturedCount}/{totalSteps} captured
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

        {/* Stepper Dots Bar */}
        <div className="stepper-dots-bar">
          {steps.map((step, idx) => {
            const isCaptured = !!capturedPhotos[step.id];
            const isCurrent = idx === currentStepIdx && cameraState !== "summary";
            return (
              <button
                key={step.id}
                type="button"
                className={`step-dot-btn ${isCurrent ? "current" : ""} ${
                  isCaptured ? "completed" : ""
                }`}
                onClick={() => handleJumpToStep(idx, isCaptured ? "captured" : "ready")}
                title={`${step.label} (${step.mr})`}
              >
                <span className="dot-circle">
                  {isCaptured ? <Check size={11} strokeWidth={3} /> : idx + 1}
                </span>
                <span className="dot-label">{step.id}</span>
              </button>
            );
          })}
        </div>

        {/* Angle Guidance Tip Box */}
        {cameraState !== "summary" && (
          <div className="angle-guide-callout">
            <Info size={15} className="guide-icon" />
            <div className="guide-text-wrap">
              <span className="guide-tip-strong">{currentStep.tip}: </span>
              <span className="guide-tip-desc">{currentStep.guide}</span>
            </div>
          </div>
        )}
      </div>

      {/* Hidden native file inputs for fallback */}
      <input
        type="file"
        ref={fileFallbackRef}
        style={{ display: "none" }}
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFallbackFileInput(e.target.files)}
      />
      <input
        type="file"
        ref={galleryInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={(e) => handleFallbackFileInput(e.target.files)}
      />

      {/* ==================================================================== */}
      {/* STATE A: IDLE / NOT-YET-OPENED (MUTUALLY EXCLUSIVE)                 */}
      {/* Never auto-starts getUserMedia. Requires user to click "Open Camera" */}
      {/* ==================================================================== */}
      {cameraState === "idle" && (
        <div className="camera-ready-card" id="camera-idle-card">
          <div className="ready-icon-container">
            <Camera size={34} className="ready-camera-icon" />
          </div>

          <div className="ready-text-group">
            <h3 className="ready-title">
              Ready to capture: {currentStep.label}
            </h3>
            <p className="ready-subtitle">
              {currentStep.mr} • Position the bottle or packet and tap below to open camera preview.
            </p>
          </div>

          <div className="ready-action-buttons">
            <button
              type="button"
              className="btn-open-camera-primary"
              id="btn-open-camera"
              onClick={handleUserOpenCamera}
            >
              <Camera size={18} />
              <span>Open Camera Preview</span>
            </button>

            <div className="ready-secondary-row">
              <button
                type="button"
                className="btn-ready-secondary"
                id="btn-system-camera"
                onClick={() => fileFallbackRef.current?.click()}
                title="Capture via system camera app"
              >
                <Camera size={15} />
                <span>System Camera</span>
              </button>
              <button
                type="button"
                className="btn-ready-secondary"
                id="btn-upload-file"
                onClick={() => galleryInputRef.current?.click()}
                title="Upload image from gallery or storage"
              >
                <Upload size={15} />
                <span>Upload File</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATE B: LIVE ACTIVE CAMERA STREAM (MUTUALLY EXCLUSIVE)               */}
      {/* Visible ONLY when stream is running. No error screens overlap.       */}
      {/* ==================================================================== */}
      {cameraState === "live" && (
        <div className="camera-viewport-card" id="camera-live-card">
          {/* Top Bar inside Viewfinder */}
          <div className="camera-feed-topbar">
            <div className="feed-angle-pill">
              <span className="live-pulse-dot" />
              <span>{currentStep.label}</span>
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
                title="Close Camera Stream"
              >
                <CameraOff size={14} />
                <span>Turn Off</span>
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

            {/* Viewfinder Target Framing Reticle */}
            {streamActive && (
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

          {/* Shutter Bar */}
          <div className="camera-shutter-bar">
            <button
              type="button"
              className="shutter-side-btn"
              onClick={() => galleryInputRef.current?.click()}
              title="Select photo from files"
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
              title={`Capture ${currentStep.label}`}
            >
              <div className="shutter-inner-ring">
                {isCapturing ? (
                  <RefreshCw size={22} className="spinner-ring" />
                ) : (
                  <div className="shutter-center-dot" />
                )}
              </div>
            </button>

            <button
              type="button"
              className="shutter-side-btn"
              onClick={() => fileFallbackRef.current?.click()}
              title="Open native camera app"
            >
              <Camera size={17} />
              <span>Native</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATE C: PERMISSION DENIED / ERROR STATE (MUTUALLY EXCLUSIVE)        */}
      {/* Completely clean card. ZERO video or viewfinder elements underneath  */}
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
                "Camera permission was blocked or hardware is unavailable on this device. You can capture photos using your system camera or upload files."}
            </p>
          </div>

          <div className="fallback-actions">
            <button
              type="button"
              className="btn-fallback-action primary"
              id="btn-fallback-device-camera"
              onClick={() => fileFallbackRef.current?.click()}
            >
              <Camera size={17} />
              <span>Take Photo with Device Camera</span>
            </button>

            <button
              type="button"
              className="btn-fallback-action secondary"
              id="btn-fallback-upload-file"
              onClick={() => galleryInputRef.current?.click()}
            >
              <Upload size={17} />
              <span>Upload Image File</span>
            </button>

            <div className="fallback-sub-actions">
              <button
                type="button"
                className="btn-retry-camera"
                id="btn-retry-camera"
                onClick={handleUserOpenCamera}
              >
                <RefreshCw size={13} />
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
        </div>
      )}

      {/* ==================================================================== */}
      {/* STATE D: CAPTURED PHOTO REVIEW (MUTUALLY EXCLUSIVE)                 */}
      {/* ==================================================================== */}
      {cameraState === "captured" && currentCapturedPhoto && (
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
                <span>{currentStep.label} ({currentStep.mr})</span>
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
                  <span>Next: {steps[currentStepIdx + 1]?.id}</span>
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
      {/* STATE E: SUMMARY SCREEN (ALL ANGLES REVIEW) (MUTUALLY EXCLUSIVE)    */}
      {/* ==================================================================== */}
      {cameraState === "summary" && (
        <div className="summary-viewport-card" id="camera-summary-card">
          <div className="summary-status-banner">
            <CheckCircle2 size={22} className="summary-banner-icon" />
            <div>
              <h4 className="summary-banner-title">
                {isNoise ? "Noise Sample Captured" : "All 5 Angles Documented!"}
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
                      <div className="summary-meta-title">{step.label}</div>
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
