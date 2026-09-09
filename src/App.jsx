import React, { useState, useEffect } from "react";
import {
  API_ENDPOINT,
  CATEGORIES,
  PACKAGING_CONDITIONS,
  NOISE_TYPES
} from "./config";
import GuidedCameraCapture from "./components/GuidedCameraCapture";
import UserManualModal from "./components/UserManualModal";
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  FolderCheck,
  ChevronRight,
  ExternalLink,
  Info,
  BookOpen,
  FlaskConical,
  Wheat,
  Sprout,
  Ban
} from "lucide-react";
import "./App.css";

export default function App() {
  // --- Form State ---
  const [category, setCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("testState") === "noise") return "Not a Product — Noise";
    return "Pesticide";
  });
  const [productName, setProductName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [packSize, setPackSize] = useState("");
  const [condition, setCondition] = useState("New/Clean");
  const [notes, setNotes] = useState("");
  const [noiseTag, setNoiseTag] = useState("");

  // --- Photos State (Managed sequentially via GuidedCameraCapture) ---
  const [photos, setPhotos] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("testState") === "noise") {
      const mockLabels = ["Shop Counter Clutter", "Empty Shelf Rack", "Unrelated Box & Hand"];
      return mockLabels.map((lbl, idx) => ({
        originalName: `noise_sample_${idx + 1}.jpg`,
        mimeType: "image/jpeg",
        angle: `Noise #${idx + 1}`,
        compressedSize: 45000 + idx * 3800
      }));
    }
    return [];
  });
  const [resetTrigger, setResetTrigger] = useState(0);

  // --- Network & Session State ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionHistory, setSessionHistory] = useState([]);

  // --- User Manual Modal State ---
  const [isManualOpen, setIsManualOpen] = useState(() => {
    return new URLSearchParams(window.location.search).get("manual") === "1";
  });

  // --- Submission State ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastSubmissionResult, setLastSubmissionResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);

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

  // Validation
  const isValid = () => {
    if (photos.length === 0) return false;
    if (isNoise) return true; // Noise only needs at least 1 photo
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

    const finalAngles = isNoise
      ? photos.map((_, i) => `Noise #${i + 1}`)
      : photos.map((p) => p.angle || "Angle");
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
      photos: photos.map((p, idx) => ({
        name: p.originalName || (isNoise ? `noise_${idx + 1}.jpg` : `photo_${idx + 1}.jpg`),
        type: p.mimeType || "image/jpeg",
        angle: isNoise ? `Noise #${idx + 1}` : (p.angle || `Angle_${idx + 1}`),
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
    setNotes("");
    setNoiseTag("");
    setPhotos([]);
    setResetTrigger((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Category Icon Helper
  const getCategoryIcon = (catId) => {
    switch (catId) {
      case "Pesticide":
        return <FlaskConical size={20} />;
      case "Fertilizer":
        return <Wheat size={20} />;
      case "Seed":
        return <Sprout size={20} />;
      default:
        return <Ban size={20} />;
    }
  };

  return (
    <div className="app-wrapper">
      {/* --- Top Professional Institutional Header --- */}
      <header className="app-header">
        <div className="header-top">
          <div className="brand-badge">
            <div className="brand-logo-icon">
              <Sprout size={24} strokeWidth={2.4} />
            </div>
            <div>
              <div className="brand-title-row">
                <h1 className="brand-title">Agri-Product Dataset Collector</h1>
                <span className="brand-badge-tag">Field Portal</span>
              </div>
              <p className="brand-subtitle">
                Maharashtra Agri-Product Survey Portal • महाराष्ट्र कृषी उत्पादन सर्वेक्षण पोर्टल
              </p>
            </div>
          </div>

          {/* Header Action Badges */}
          <div className="header-actions-group">
            <button
              type="button"
              className="btn-manual-trigger"
              id="btn-field-guidelines"
              onClick={() => setIsManualOpen(true)}
              title="Open Field Photography Guidelines"
            >
              <BookOpen size={16} />
              <span>Field Guidelines (मार्गदर्शक)</span>
            </button>

            <div className="status-indicator">
              <span className={`status-dot ${isOnline ? "" : "offline"}`} />
              <span>{isOnline ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>

        <div className="header-meta-bar">
          <p className="header-mission">
            Field documentation system for capturing standardized high-resolution photos of agricultural input packaging.
          </p>

          <div className="header-session-counter">
            <span>Session Logs:</span>
            <span className="counter-num">{sessionCount} submitted</span>
          </div>
        </div>
      </header>

      {/* --- Main Interactive Form (2-Column Grid on Desktop) --- */}
      <main className="main-content">
        {/* Left Column: Product & Sample Metadata */}
        <div className="form-col-details">
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
                    id={`cat-select-${cat.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                    className={`category-card ${isSelected ? "selected" : ""} ${
                      cat.isNoise ? "is-noise" : ""
                    }`}
                    onClick={() => setCategory(cat.id)}
                  >
                    <div className="cat-icon-wrapper">
                      {getCategoryIcon(cat.id)}
                    </div>
                    <div className="cat-text-group">
                      <span className="cat-title">{cat.label}</span>
                      <span className="cat-subtitle">{cat.mr}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="cat-check-badge" size={16} />}
                  </button>
                );
              })}
            </div>

            {/* Noise Guidance Banner */}
            {isNoise && (
              <div className="noise-banner">
                <Info className="noise-banner-icon" />
                <div>
                  <h4 className="noise-banner-title">Negative / Noise Sample Mode</h4>
                  <p className="noise-banner-desc">
                    Capture empty shop shelves, dealer hands, counter clutter, or unrelated cartons. This data trains the offline AI to reject false positives.
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
                    Product Brand Name <span className="field-required-star">*</span>
                  </span>
                  <span className="field-optional">नाव (उदा. Coromandel Gromor 28-28-0)</span>
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
                    placeholder="e.g. Bayer, UPL, Syngenta, Mahyco"
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
                    placeholder="e.g. 250ml, 500ml, 1kg, 50kg"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-field-group">
                <label className="field-label" htmlFor="prod-reg">
                  <span>Registration / CIB No.</span>
                  <span className="field-optional">Optional (नोंदणी क्रमांक)</span>
                </label>
                <input
                  id="prod-reg"
                  type="text"
                  className="text-input"
                  placeholder="e.g. CIR-18239/2018 or Mfg Lic No"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                />
              </div>

              <div className="input-field-group">
                <label className="field-label">
                  <span>Packaging Physical Condition</span>
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

        </div>

        {/* Right Column: Guided Sequential Camera & Preview */}
        <div className="form-col-camera">
          <section className="form-card guided-capture-card">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">3</span>
                <h2 className="card-title">
                  {isNoise ? "Negative Sample Photos" : "Guided Angle Capture"}
                </h2>
                <span className="card-subtitle-mr">
                  {isNoise ? "(नमुने फोटो)" : "(कोनानुसार कॅमेरा)"}
                </span>
              </div>
            </div>

            <GuidedCameraCapture
              isNoise={isNoise}
              photos={photos}
              onPhotosChange={setPhotos}
              resetTrigger={resetTrigger}
              onOpenManual={() => setIsManualOpen(true)}
            />
          </section>

          {/* Error message banner */}
          {submitError && (
            <div className="error-banner">
              <AlertCircle size={20} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Recent Submissions List in this session */}
          {sessionHistory.length > 0 && (
            <div className="form-card session-history-card">
              <h3 className="session-history-title">
                <span>Recent Submissions</span>
                <span className="session-history-count">{sessionHistory.length} saved</span>
              </h3>
              <div className="session-history-list">
                {sessionHistory.map((item) => (
                  <div key={item.id} className="session-history-item">
                    <div className="session-item-info">
                      <div className="session-item-name">{item.name}</div>
                      <div className="session-item-meta">
                        {item.category} • {item.photoCount} photos • {item.time}
                      </div>
                    </div>
                    {item.folderUrl && (
                      <a
                        href={item.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="session-item-link"
                        title="Open Drive folder"
                      >
                        <FolderCheck size={16} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- Sticky Bottom Submit Bar --- */}
      <div className="sticky-submit-container">
        <div className="submit-inner-wrapper">
          <div className="submit-info-text">
            <span className="submit-count-label">
              {isNoise
                ? `${photos.length} photo${photos.length !== 1 ? "s" : ""} ready`
                : `${photos.length} of 5 angles documented`}
            </span>
            <span className="submit-target-folder">
              Target Repository: Google Drive / Field Master Registry
            </span>
          </div>

          <button
            type="button"
            className="btn-primary-submit"
            id="btn-submit-drive"
            disabled={!isValid() || isSubmitting}
            onClick={handleSubmit}
          >
            <Upload size={18} />
            <span>Submit to Drive</span>
          </button>
        </div>
      </div>

      {/* --- User Manual / Field Guidelines Modal --- */}
      <UserManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />

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
                <span>Open Created Drive Folder</span>
                <ExternalLink size={12} />
              </a>
            )}

            <button
              type="button"
              className="btn-next-product"
              onClick={handleNextProduct}
            >
              <span>Submit Next Product</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
