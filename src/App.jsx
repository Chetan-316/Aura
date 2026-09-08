import React, { useState, useEffect, useRef } from "react";
import {
  API_ENDPOINT,
  CATEGORIES,
  PHOTO_ANGLES,
  PACKAGING_CONDITIONS,
  NOISE_TYPES
} from "./config";
import { compressImage, formatBytes } from "./utils/compressor";
import {
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Upload,
  RefreshCw,
  FolderCheck,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Info
} from "lucide-react";
import "./App.css";

export default function App() {
  // --- Form State ---
  const [category, setCategory] = useState("Pesticide");
  const [productName, setProductName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [packSize, setPackSize] = useState("");
  const [condition, setCondition] = useState("New/Clean");
  const [selectedAngles, setSelectedAngles] = useState(["Front"]);
  const [notes, setNotes] = useState("");
  const [noiseTag, setNoiseTag] = useState("");

  // --- Photos State ---
  const [photos, setPhotos] = useState([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // --- Network & Session State ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionHistory, setSessionHistory] = useState([]);

  // --- Submission State ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastSubmissionResult, setLastSubmissionResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const isNoise = category.includes("Noise") || category.includes("Not a Product");

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Toggle angle checkbox
  const toggleAngle = (angleId) => {
    setSelectedAngles((prev) =>
      prev.includes(angleId) ? prev.filter((a) => a !== angleId) : [...prev, angleId]
    );
  };

  // Handle file uploads (both camera and gallery)
  const handleFilesSelected = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setIsCompressing(true);

    const files = Array.from(fileList);
    const compressedList = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressed = await compressImage(file, 1600, 0.82);
        // Pre-assign an angle if available from remaining unassigned selectedAngles
        const currentCount = photos.length + compressedList.length;
        if (!isNoise && selectedAngles[currentCount]) {
          compressed.angle = selectedAngles[currentCount];
        } else if (!isNoise && selectedAngles.length > 0) {
          compressed.angle = selectedAngles[0];
        } else {
          compressed.angle = isNoise ? "Noise Sample" : "Front";
        }
        compressedList.push(compressed);
      } catch (err) {
        console.error("Failed to compress file:", file.name, err);
      }
    }

    setPhotos((prev) => [...prev, ...compressedList]);
    setIsCompressing(false);

    // Reset native input values so re-selecting same photo triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removePhoto = (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePhotoAngle = (id, newAngle) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, angle: newAngle } : p))
    );
  };

  // Validation
  const isValid = () => {
    if (photos.length === 0) return false;
    if (isNoise) return true; // Noise only needs photos
    return productName.trim().length > 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isValid() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitStep("Optimizing & packaging data...");
    setUploadProgress(20);

    const finalAngles = isNoise ? ["Noise"] : selectedAngles;
    const finalProductName = isNoise
      ? (noiseTag || notes || "Noise Negative Sample")
      : productName.trim();

    const payload = {
      category: category,
      productName: finalProductName,
      regNumber: isNoise ? "" : regNumber.trim(),
      manufacturer: isNoise ? "" : manufacturer.trim(),
      packSize: isNoise ? "" : packSize.trim(),
      condition: isNoise ? "" : condition,
      angles: finalAngles,
      notes: isNoise ? (notes || noiseTag) : notes.trim(),
      photos: photos.map((p) => ({
        name: p.originalName,
        type: p.mimeType,
        angle: p.angle,
        base64: p.base64
      }))
    };

    try {
      setSubmitStep("Sending to Google Drive folder...");
      setUploadProgress(50);

      // We use text/plain to avoid browser CORS preflight blocks with Google Apps Script
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      setUploadProgress(85);
      setSubmitStep("Creating Drive folder & updating sheet...");

      const result = await response.json();

      if (result && result.success) {
        setUploadProgress(100);
        setLastSubmissionResult(result);
        setSessionCount((prev) => prev + 1);
        setSessionHistory((prev) => [
          {
            id: result.submissionId,
            name: finalProductName,
            category: category,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            photoCount: photos.length,
            folderUrl: result.folderUrl
          },
          ...prev
        ]);
      } else {
        throw new Error(result?.error || "Submission rejected by server");
      }
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError(
        "Upload failed. Please check your internet connection and try again: " +
          (err.message || "Network Error")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form for next product
  const handleNextProduct = () => {
    setLastSubmissionResult(null);
    setProductName("");
    setRegNumber("");
    setManufacturer("");
    setPackSize("");
    setCondition("New/Clean");
    setSelectedAngles(["Front"]);
    setNotes("");
    setNoiseTag("");
    setPhotos([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-wrapper">
      {/* --- Top App Header --- */}
      <header className="app-header">
        <div className="header-top">
          <div className="brand-badge">
            <div className="brand-logo-icon">🌿</div>
            <div>
              <h1 className="brand-title">AuRA Vision</h1>
              <p className="brand-subtitle">Agri Dataset Collector</p>
            </div>
          </div>
          <div className="status-indicator">
            <span className={`status-dot ${isOnline ? "" : "offline"}`} />
            <span>{isOnline ? "Online" : "Offline"}</span>
          </div>
        </div>

        <p className="header-mission">
          Collecting field photo datasets for offline crop input recognition across Maharashtra.
        </p>

        <div className="header-session-counter">
          <span>Session Submissions:</span>
          <span className="counter-num">{sessionCount} completed</span>
        </div>
      </header>

      {/* --- Main Interactive Form --- */}
      <main className="main-content">
        {/* Step 1: Category Selection */}
        <section className="form-card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="step-num">1</span>
              <h2 className="card-title">Select Category</h2>
              <span className="card-subtitle-mr">(श्रेणी निवडा)</span>
            </div>
          </div>

          <div className="category-grid">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-card ${isSelected ? "selected" : ""} ${
                    cat.isNoise ? "is-noise" : ""
                  }`}
                  onClick={() => setCategory(cat.id)}
                >
                  <div
                    className="cat-icon-wrapper"
                    style={{
                      background: isSelected ? cat.color : "#f1f5f9",
                      color: isSelected ? "#ffffff" : "#475569"
                    }}
                  >
                    {cat.id === "Pesticide" && "🧪"}
                    {cat.id === "Fertilizer" && "🌾"}
                    {cat.id === "Seed" && "🌱"}
                    {cat.id.includes("Noise") && "🚫"}
                  </div>
                  <div className="cat-text-group">
                    <span className="cat-title">{cat.label}</span>
                    <span className="cat-subtitle">{cat.mr}</span>
                  </div>
                  {isSelected && <CheckCircle2 className="cat-check-badge" size={18} />}
                </button>
              );
            })}
          </div>

          {/* Noise Guidance Banner */}
          {isNoise && (
            <div className="noise-banner">
              <Info className="noise-banner-icon" />
              <div>
                <h4 className="noise-banner-title">Negative / Noise Example Mode</h4>
                <p className="noise-banner-desc">
                  Take photos of blurry items, empty shelves, hands, counter clutter, or unrelated objects. This critical data trains our offline model to avoid false positives in rural shops.
                </p>
                <div className="quick-tags-group">
                  {NOISE_TYPES.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`quick-tag-chip ${noiseTag === tag ? "active" : ""}`}
                      onClick={() => {
                        setNoiseTag(tag);
                        setNotes(tag);
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Product Details (Hidden if Noise) */}
        {!isNoise ? (
          <section className="form-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">2</span>
                <h2 className="card-title">Product Details</h2>
                <span className="card-subtitle-mr">(उत्पादनाची माहिती)</span>
              </div>
            </div>

            <div className="input-field-group">
              <label className="field-label" htmlFor="prod-name">
                <span>
                  Product Name <span className="field-required-star">*</span>
                </span>
                <span className="field-optional">नाव (उदा. Coromandel Gromor)</span>
              </label>
              <input
                id="prod-name"
                type="text"
                className="text-input"
                placeholder="e.g. Coromandel Gromor 28-28-0"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />
            </div>

            <div className="input-row-2col">
              <div className="input-field-group">
                <label className="field-label" htmlFor="prod-mfg">
                  <span>Manufacturer</span>
                  <span className="field-optional">Optional</span>
                </label>
                <input
                  id="prod-mfg"
                  type="text"
                  className="text-input"
                  placeholder="e.g. Bayer, UPL, Syngenta"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </div>

              <div className="input-field-group">
                <label className="field-label" htmlFor="prod-pack">
                  <span>Pack Size</span>
                  <span className="field-optional">Optional</span>
                </label>
                <input
                  id="prod-pack"
                  type="text"
                  className="text-input"
                  placeholder="e.g. 250ml, 1kg, 50kg"
                  value={packSize}
                  onChange={(e) => setPackSize(e.target.value)}
                />
              </div>
            </div>

            <div className="input-field-group">
              <label className="field-label" htmlFor="prod-reg">
                <span>Registration / Certification No.</span>
                <span className="field-optional">Optional (नोंदणी क्रमांक)</span>
              </label>
              <input
                id="prod-reg"
                type="text"
                className="text-input"
                placeholder="e.g. CIR-18239/2018..."
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
              />
            </div>

            <div className="input-field-group">
              <label className="field-label">
                <span>Packaging Condition</span>
                <span className="field-optional">स्थिती</span>
              </label>
              <div className="condition-grid">
                {PACKAGING_CONDITIONS.map((cond) => {
                  const isSelected = condition === cond.id;
                  return (
                    <button
                      key={cond.id}
                      type="button"
                      className={`condition-pill ${isSelected ? "selected" : ""}`}
                      onClick={() => setCondition(cond.id)}
                    >
                      <span
                        className="condition-dot"
                        style={{ background: cond.color }}
                      />
                      <div>
                        <div className="condition-title">{cond.label}</div>
                        <div className="condition-desc">{cond.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        ) : (
          /* Noise Description input */
          <section className="form-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">2</span>
                <h2 className="card-title">Noise Description</h2>
                <span className="card-subtitle-mr">(नमुन्याचे वर्णन)</span>
              </div>
            </div>
            <div className="input-field-group">
              <label className="field-label" htmlFor="noise-desc">
                <span>What does this noise photo represent?</span>
                <span className="field-optional">Optional</span>
              </label>
              <input
                id="noise-desc"
                type="text"
                className="text-input"
                placeholder="e.g. Blurry bottle rack, counter floor, hand in frame"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </section>
        )}

        {/* Step 3: Photo Angles Checklist (Only for real products) */}
        {!isNoise && (
          <section className="form-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">3</span>
                <h2 className="card-title">Photo Angles Captured</h2>
                <span className="card-subtitle-mr">(फोटोचे कोन)</span>
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-subtle)", marginBottom: "12px" }}>
              Check all angles you are capturing for this product:
            </p>
            <div className="angles-checklist">
              {PHOTO_ANGLES.map((angle) => {
                const isChecked = selectedAngles.includes(angle.id);
                return (
                  <div
                    key={angle.id}
                    className={`angle-row-item ${isChecked ? "checked" : ""}`}
                    onClick={() => toggleAngle(angle.id)}
                  >
                    <div className="angle-left">
                      <div className="custom-checkbox">
                        {isChecked && <CheckCircle2 size={16} />}
                      </div>
                      <div>
                        <span className="angle-title">{angle.label}</span>
                        <span className="angle-mr">{angle.mr}</span>
                      </div>
                    </div>
                    <span className="angle-tip">{angle.tip}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Step 4: Photo Capture & Upload */}
        <section className="form-card">
          <div className="card-header">
            <div className="card-title-group">
              <span className="step-num">{isNoise ? "3" : "4"}</span>
              <h2 className="card-title">Product Photos</h2>
              <span className="card-subtitle-mr">(फोटो अपलोड करा)</span>
            </div>
          </div>

          {/* Hidden inputs for camera and gallery */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            multiple
            accept="image/*"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <input
            type="file"
            ref={cameraInputRef}
            style={{ display: "none" }}
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {/* Dropzone / Upload Area */}
          <div
            className={`upload-dropzone ${dragOver ? "dragover" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-icon-circle">
              <Camera size={26} />
            </div>
            <div>
              <div className="upload-primary-text">
                Tap to Take Photos or Browse Gallery
              </div>
              <div className="upload-secondary-text">
                Auto-compresses high-res camera photos in browser for fast rural upload. (4–6 typical)
              </div>
            </div>

            <div className="upload-button-row" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn-upload-action primary"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera size={16} />
                Open Camera
              </button>
              <button
                type="button"
                className="btn-upload-action"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={16} />
                Select Multiple Files
              </button>
            </div>
          </div>

          {/* Loading spinner while compressing */}
          {isCompressing && (
            <div style={{ textAlign: "center", padding: "16px", color: "var(--primary-700)" }}>
              <RefreshCw className="spinner-ring" style={{ width: 28, height: 28, margin: "0 auto 8px" }} />
              <div style={{ fontSize: "13.5px", fontWeight: 600 }}>Optimizing photos on device...</div>
            </div>
          )}

          {/* Photo Preview Grid */}
          {photos.length > 0 && (
            <div>
              <div className="photos-grid-header">
                <span style={{ fontSize: "14px", fontWeight: 700 }}>Attached Photos</span>
                <span className="photos-count-badge">
                  {photos.length} photo{photos.length > 1 ? "s" : ""} ready
                </span>
              </div>

              <div className="photos-grid">
                {photos.map((photo, idx) => {
                  const savings = Math.round(
                    ((photo.originalSize - photo.compressedSize) / photo.originalSize) * 100
                  );
                  return (
                    <div key={photo.id} className="photo-card">
                      <div className="photo-thumb-wrap">
                        <img
                          src={photo.dataUrl}
                          alt={`Uploaded ${idx + 1}`}
                          className="photo-thumb-img"
                        />
                        <button
                          type="button"
                          className="photo-delete-btn"
                          title="Remove photo"
                          onClick={() => removePhoto(photo.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                        {savings > 0 && (
                          <div className="photo-savings-pill">
                            -{savings}% ({formatBytes(photo.compressedSize)})
                          </div>
                        )}
                      </div>

                      <div className="photo-meta-bar">
                        {!isNoise ? (
                          <select
                            className="photo-angle-select"
                            value={photo.angle}
                            onChange={(e) => updatePhotoAngle(photo.id, e.target.value)}
                          >
                            <option value="Front">Front Label</option>
                            <option value="Side">Side Panel</option>
                            <option value="Cap/Lid">Cap / Lid</option>
                            <option value="Barcode">Barcode / QR</option>
                            <option value="Back panel">Back Panel</option>
                            <option value="Other">Other Angle</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-subtle)", fontWeight: 600 }}>
                            Noise Photo #{idx + 1}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Error message banner */}
        {submitError && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #f87171",
              borderRadius: "12px",
              padding: "14px",
              color: "#991b1b",
              fontSize: "13.5px",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <AlertCircle size={20} />
            <span>{submitError}</span>
          </div>
        )}
      </main>

      {/* --- Sticky Bottom Submit Bar --- */}
      <div className="sticky-submit-container">
        <div className="submit-inner-wrapper">
          <div className="submit-info-text">
            <span className="submit-count-label">
              {photos.length} photo{photos.length !== 1 ? "s" : ""} selected
            </span>
            <span className="submit-target-folder">
              Target: Google Drive / AuRA Registry
            </span>
          </div>

          <button
            type="button"
            className="btn-primary-submit"
            disabled={!isValid() || isSubmitting}
            onClick={handleSubmit}
          >
            <Upload size={18} />
            Submit to Drive
          </button>
        </div>
      </div>

      {/* --- Uploading Modal Dialog --- */}
      {isSubmitting && (
        <div className="upload-modal-overlay">
          <div className="upload-modal-card">
            <div className="spinner-ring" />
            <h3 className="upload-step-title">{submitStep}</h3>
            <p className="upload-step-desc">
              Please wait while your photos are saved directly into your Google Drive folder and logged into the master spreadsheet.
            </p>
            <div className="progress-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* --- Success Confirmation Modal --- */}
      {lastSubmissionResult && (
        <div className="upload-modal-overlay">
          <div className="success-modal-card">
            <div className="success-icon-badge">
              <CheckCircle2 size={38} />
            </div>
            <h3 className="success-title">Submission Successful!</h3>
            <p style={{ fontSize: "14px", color: "var(--text-subtle)", marginTop: "-6px" }}>
              Photos and metadata have been saved to Google Drive.
            </p>

            <div className="success-summary-box">
              <div className="summary-row">
                <span className="summary-label">Submission ID:</span>
                <span className="summary-val">{lastSubmissionResult.submissionId}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Folder Created:</span>
                <span className="summary-val" style={{ maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lastSubmissionResult.folderName}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Photos Saved:</span>
                <span className="summary-val">{lastSubmissionResult.photoCount} files</span>
              </div>
            </div>

            {lastSubmissionResult.folderUrl && (
              <a
                href={lastSubmissionResult.folderUrl}
                target="_blank"
                rel="noreferrer"
                className="link-drive-folder"
              >
                <FolderCheck size={16} />
                Open Created Drive Folder
                <ExternalLink size={12} />
              </a>
            )}

            <button
              type="button"
              className="btn-next-product"
              onClick={handleNextProduct}
            >
              Submit Next Product
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
