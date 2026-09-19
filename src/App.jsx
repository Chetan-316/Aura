import React, { useState, useEffect } from "react";
import {
  API_ENDPOINT,
  CATEGORIES,
  PACKAGING_TYPES,
  PACKAGING_CONDITIONS,
  NOISE_TYPES,
  COMMON_NPK_GRADES,
  COMMON_VOLUME_SIZES,
  COMMON_WEIGHT_SIZES
} from "./config";
import GuidedCameraCapture from "./components/GuidedCameraCapture";
import UserManualModal from "./components/UserManualModal";
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  FolderCheck,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Info,
  BookOpen,
  Wheat,
  Shield,
  Scissors,
  Bug,
  Sparkles,
  TrendingUp,
  Leaf,
  Sprout,
  Ban,
  FlaskConical,
  Package,
  Archive,
  Edit3,
  Camera,
  Check
} from "lucide-react";
import "./App.css";

export default function App() {
  // --- Wizard Step State: 1 (Category), 2 (Packaging), 3 (Details), 4 (Camera), 5 (Review) ---
  const [currentStep, setCurrentStep] = useState(1);

  // --- Form State ---
  const [category, setCategory] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("testState") === "noise") return "Not a Product — Noise";
    return "";
  });
  const [packagingType, setPackagingType] = useState("");
  const [productName, setProductName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [packSize, setPackSize] = useState("");
  const [customPackSize, setCustomPackSize] = useState("");
  const [packSizeUnit, setPackSizeUnit] = useState(""); // 'volume' | 'weight' | 'custom' | ''
  const [npk, setNpk] = useState("");
  const [customNpk, setCustomNpk] = useState("");
  const [isCustomNpk, setIsCustomNpk] = useState(false);
  const [condition, setCondition] = useState("");
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
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);

  const isNoise = Boolean(category && (category.includes("Noise") || category.includes("Not a Product")));

  // Derive photo angles from selected packaging type
  const currentPackaging = PACKAGING_TYPES.find((p) => p.id === packagingType) || null;
  const currentPhotoAngles = currentPackaging ? currentPackaging.photoAngles : [];

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

  // When packaging type changes, adapt default pack size smartly
  const handlePackagingChange = (pkgId) => {
    setPackagingType(pkgId);
    setPhotos([]);
    if (pkgId === "Bottle") {
      setPackSizeUnit("volume");
      setPackSize("500 ml");
    } else if (pkgId === "Bag") {
      setPackSizeUnit("weight");
      setPackSize("50 kg");
    } else if (pkgId === "Pouch") {
      setPackSizeUnit("weight");
      setPackSize("100 g");
    }
  };

  // When category changes, purge any conditional NPK so it never leaks into other categories
  const handleCategorySelect = (catId) => {
    setCategory(catId);
    if (catId !== "Fertilizer") {
      setNpk("");
      setCustomNpk("");
      setIsCustomNpk(false);
    }
    if (catId.includes("Noise") || catId.includes("Not a Product")) {
      goToStep(4);
    }
  };

  // Category Icon Helper
  const getCategoryIcon = (catId) => {
    switch (catId) {
      case "Fertilizer":
        return <Wheat size={20} />;
      case "Fungicide":
        return <Shield size={20} />;
      case "Herbicide":
        return <Scissors size={20} />;
      case "Insecticide":
        return <Bug size={20} />;
      case "Micronutrient":
        return <Sparkles size={20} />;
      case "PGR / Plant Growth Regulator":
        return <TrendingUp size={20} />;
      case "Biostimulant":
        return <Leaf size={20} />;
      case "Seed":
        return <Sprout size={20} />;
      default:
        return <Ban size={20} />;
    }
  };

  // Packaging Type Icon Helper
  const getPackagingIcon = (pkgId) => {
    switch (pkgId) {
      case "Bottle":
        return <FlaskConical size={22} />;
      case "Pouch":
        return <Package size={22} />;
      case "Bag":
        return <Archive size={22} />;
      default:
        return <Package size={22} />;
    }
  };

  // Effective Pack Size computation
  const getEffectivePackSize = () => {
    if (packSizeUnit === "custom") {
      return customPackSize.trim();
    }
    return packSize;
  };

  // Effective NPK computation
  const getEffectiveNpk = () => {
    if (category !== "Fertilizer") return "";
    if (isCustomNpk) return customNpk.trim();
    return npk;
  };

  // Validation: At least 1 photo is required
  const isValid = () => {
    return photos.length > 0;
  };

  // Step Navigation Handlers
  const goToStep = (stepNumber) => {
    setCurrentStep(stepNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!isValid() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitStep("Packaging and compressing data...");
    setUploadProgress(20);

    let currentId = activeSubmissionId;
    if (!currentId) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      currentId = `SUB_${datePart}_${Math.floor(Math.random() * 899 + 100)}`;
      setActiveSubmissionId(currentId);
    }

    const finalAngles = isNoise
      ? photos.map((_, i) => `Noise #${i + 1}`)
      : photos.map((p) => p.angle || "Angle");
    const fallbackName = isNoise ? "Noise Negative Sample" : `${category} Sample`;
    const finalProductName = isNoise
      ? (noiseTag || notes || fallbackName)
      : (productName.trim() || fallbackName);

    const effectivePackSize = getEffectivePackSize();
    const effectiveNpk = getEffectiveNpk();
    const additionalCount = photos.filter(p => p.angle && p.angle.toLowerCase().includes("additional")).length;

    const payload = {
      submissionId: currentId,
      category: category,
      productName: finalProductName,
      packagingType: isNoise ? "" : packagingType,
      regNumber: isNoise ? "" : regNumber.trim(),
      manufacturer: isNoise ? "" : manufacturer.trim(),
      packSize: isNoise ? "" : effectivePackSize,
      npk: effectiveNpk,
      condition: isNoise ? "" : condition,
      angles: finalAngles,
      additionalPhotoCount: additionalCount,
      totalPhotos: photos.length,
      notes: isNoise ? (notes || noiseTag) : notes.trim(),
      photos: photos.map((p, idx) => ({
        name: p.originalName || (isNoise ? `noise_${idx + 1}.jpg` : `${(p.angle || `photo_${idx + 1}`).replace(/[^\w-]/g, "_")}.jpg`),
        type: p.mimeType || "image/jpeg",
        angle: isNoise ? `Noise #${idx + 1}` : (p.angle || `Angle_${idx + 1}`),
        base64: p.base64
      }))
    };

    try {
      setSubmitStep("Uploading images to Google Drive...");
      setUploadProgress(50);

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      setUploadProgress(85);
      setSubmitStep("Logging to Master Registry Sheet...");

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
            packaging: isNoise ? "Noise" : packagingType,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            photoCount: photos.length,
            folderUrl: result.folderUrl
          },
          ...prev
        ]);
      } else {
        throw new Error(result?.error || "Submission rejected by backend");
      }
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError(
        "Upload failed. Please check network connection and retry: " +
          (err.message || "Network Error")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form for next product (Completely clean slate: Category & Packaging unselected)
  const handleNextProduct = () => {
    setCategory("");
    setPackagingType("");
    setProductName("");
    setRegNumber("");
    setManufacturer("");
    setPackSize("");
    setCustomPackSize("");
    setPackSizeUnit("");
    setNpk("");
    setCustomNpk("");
    setIsCustomNpk(false);
    setCondition("");
    setNotes("");
    setNoiseTag("");
    setPhotos([]);
    setResetTrigger((prev) => prev + 1);
    setActiveSubmissionId(null);
    setLastSubmissionResult(null);
    setSubmitError(null);
    setSubmitStep("");
    setUploadProgress(0);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-wrapper">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-top">
          <div className="brand-badge">
            <div className="brand-logo-icon">
              <Sprout size={22} strokeWidth={2.4} />
            </div>
            <div className="brand-title-row">
              <h1 className="brand-title">Product Catalog Collector</h1>
            </div>
          </div>

          <div className="header-actions-group">
            <button
              type="button"
              className="btn-manual-trigger"
              id="btn-field-guidelines"
              onClick={() => setIsManualOpen(true)}
              title="Open Photography Guidelines"
            >
              <BookOpen size={14} />
              <span>Guidelines</span>
            </button>

            <div className="status-indicator">
              <span className={`status-dot ${isOnline ? "" : "offline"}`} />
              <span>{isOnline ? "Online" : "Offline"}</span>
            </div>

            {sessionCount > 0 && (
              <div className="header-session-counter">
                <span className="counter-num">{sessionCount} saved</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Progressive Step Progress Bar */}
        <nav className="wizard-stepper-bar" aria-label="Survey Steps">
          <button
            type="button"
            className={`wizard-step-item ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}
            onClick={() => goToStep(1)}
          >
            <span className="step-circle">{currentStep > 1 ? <Check size={12} strokeWidth={3} /> : "1"}</span>
            <span className="step-text">Category</span>
          </button>

          {!isNoise && (
            <>
              <div className="step-connector" />
              <button
                type="button"
                className={`wizard-step-item ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}
                onClick={() => goToStep(2)}
              >
                <span className="step-circle">{currentStep > 2 ? <Check size={12} strokeWidth={3} /> : "2"}</span>
                <span className="step-text">Packaging</span>
              </button>

              <div className="step-connector" />
              <button
                type="button"
                className={`wizard-step-item ${currentStep === 3 ? "active" : currentStep > 3 ? "completed" : ""}`}
                onClick={() => goToStep(3)}
              >
                <span className="step-circle">{currentStep > 3 ? <Check size={12} strokeWidth={3} /> : "3"}</span>
                <span className="step-text">Details</span>
              </button>
            </>
          )}

          <div className="step-connector" />
          <button
            type="button"
            className={`wizard-step-item ${currentStep === 4 ? "active" : currentStep > 4 ? "completed" : ""}`}
            onClick={() => goToStep(4)}
          >
            <span className="step-circle">{photos.length > 0 ? <Check size={12} strokeWidth={3} /> : isNoise ? "2" : "4"}</span>
            <span className="step-text">Camera</span>
          </button>

          <div className="step-connector" />
          <button
            type="button"
            className={`wizard-step-item ${currentStep === 5 ? "active" : ""}`}
            onClick={() => goToStep(5)}
          >
            <span className="step-circle">{isNoise ? "3" : "5"}</span>
            <span className="step-text">Review</span>
          </button>
        </nav>
      </header>

      {/* Main Workflow Area */}
      <main className="main-content">
        {/* ==================================================================== */}
        {/* STEP 1: CATEGORY SELECTION (9 CATEGORIES)                           */}
        {/* ==================================================================== */}
        {currentStep === 1 && (
          <section className="form-card step-card" id="step-category-section">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">1</span>
                <div>
                  <h2 className="card-title">Select Product Category</h2>
                  <span className="card-subtitle-mr">कॅटेगरी निवडा — Choose specific category</span>
                </div>
              </div>
            </div>

            {/* Redesigned 9-Category Responsive Mobile Grid */}
            <div className="category-grid-enhanced">
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    id={`cat-select-${cat.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                    className={`category-pill-card ${isSelected ? "selected" : ""} ${cat.isNoise ? "is-noise" : ""}`}
                    onClick={() => handleCategorySelect(cat.id)}
                  >
                    <div className="cat-icon-badge" style={{ color: cat.color }}>
                      {getCategoryIcon(cat.id)}
                    </div>
                    <div className="cat-text-wrap">
                      <span className="cat-title">{cat.label}</span>
                      <span className="cat-subtitle">{cat.mr}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="cat-check-badge" size={18} />}
                  </button>
                );
              })}
            </div>

            {/* Noise Banner */}
            {isNoise && (
              <div className="noise-banner">
                <Info className="noise-banner-icon" />
                <div>
                  <h4 className="noise-banner-title">Negative / Noise Mode Selected</h4>
                  <p className="noise-banner-desc">
                    Photograph empty shop shelves, dealer hands, counter clutter, or unrelated cartons to train AI rejection.
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

            {/* Step 1 Footer Action */}
            <div className="step-nav-row">
              <button
                type="button"
                className="btn-step-next primary"
                id="btn-cat-next"
                disabled={!category}
                onClick={() => goToStep(isNoise ? 4 : 2)}
              >
                <span>{isNoise ? "Continue to Camera" : "Next: Packaging Type"}</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* STEP 2: PACKAGING TYPE (BOTTLE, POUCH, BAG / LARGE SACK)             */}
        {/* ==================================================================== */}
        {currentStep === 2 && !isNoise && (
          <section className="form-card step-card" id="step-packaging-section">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">2</span>
                <div>
                  <h2 className="card-title">Packaging Type</h2>
                  <span className="card-subtitle-mr">पॅकेजिंगचा प्रकार — Select container form</span>
                </div>
              </div>
            </div>

            <div className="packaging-type-grid-enhanced">
              {PACKAGING_TYPES.map((pkg) => {
                const isSelected = packagingType === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    id={`pkg-type-${pkg.id.toLowerCase()}`}
                    className={`packaging-card-enhanced ${isSelected ? "selected" : ""}`}
                    onClick={() => handlePackagingChange(pkg.id)}
                  >
                    <div className="pkg-icon-badge">
                      {getPackagingIcon(pkg.id)}
                    </div>
                    <div className="pkg-body-wrap">
                      <div className="pkg-header-row">
                        <span className="pkg-title">{pkg.label}</span>
                        <span className="pkg-mr">{pkg.mr}</span>
                      </div>
                      <span className="pkg-desc">{pkg.description}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="pkg-check-badge" size={20} />}
                  </button>
                );
              })}
            </div>

            {/* Sequence Preview Strip */}
            {currentPackaging ? (
              <div className="packaging-sequence-summary">
                <span className="seq-label">Angle Sequence ({currentPackaging.photoAngles.length} photos):</span>
                <div className="seq-chips-row">
                  {currentPhotoAngles.map((a, idx) => (
                    <span key={a.id} className="seq-angle-chip">
                      {idx + 1}. {a.tabLabel || a.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="packaging-sequence-summary neutral">
                <span className="seq-label">Select a packaging type above to see required photo sequence.</span>
              </div>
            )}

            <div className="step-nav-row between">
              <button
                type="button"
                className="btn-step-prev"
                onClick={() => goToStep(1)}
              >
                <ChevronLeft size={18} />
                <span>Back</span>
              </button>

              <button
                type="button"
                className="btn-step-next primary"
                id="btn-pkg-next"
                disabled={!packagingType}
                onClick={() => goToStep(3)}
              >
                <span>Next: Product Details</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* STEP 3: PRODUCT DETAILS (STRUCTURED PACK SIZE & NPK GRADE)           */}
        {/* ==================================================================== */}
        {currentStep === 3 && !isNoise && (
          <section className="form-card step-card" id="step-details-section">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">3</span>
                <div>
                  <h2 className="card-title">Product Details</h2>
                  <span className="card-subtitle-mr">उत्पादनाची माहिती — Fill visible label details</span>
                </div>
              </div>
            </div>

            {/* Product Name */}
            <div className="input-field-group">
              <label className="field-label" htmlFor="prod-name">
                <span>Product Brand Name</span>
                <span className="field-optional">नाव (उदा. Coromandel Gromor)</span>
              </label>
              <input
                id="prod-name"
                type="text"
                className="text-input"
                placeholder="e.g. Coromandel Gromor, Confidor, Roundup"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>

            {/* Conditional NPK Grade for Fertilizer Only */}
            {category === "Fertilizer" && (
              <div className="input-field-group npk-special-group">
                <label className="field-label">
                  <span className="highlight-label">NPK / Fertilizer Grade</span>
                  <span className="field-optional">खताचा एन.पी.के. ग्रेड (पोषण प्रमाण)</span>
                </label>
                
                {/* Fast NPK Common Grade Chips */}
                <div className="npk-chips-grid">
                  {COMMON_NPK_GRADES.map((grade) => {
                    const isSelected = !isCustomNpk && npk === grade;
                    return (
                      <button
                        key={grade}
                        type="button"
                        className={`npk-chip ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          setIsCustomNpk(false);
                          setNpk(grade);
                        }}
                      >
                        {grade}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`npk-chip custom-chip ${isCustomNpk ? "selected" : ""}`}
                    onClick={() => setIsCustomNpk(true)}
                  >
                    Other / Custom
                  </button>
                </div>

                {/* Custom NPK Input Field */}
                {isCustomNpk && (
                  <div className="custom-npk-input-box">
                    <label htmlFor="custom-npk-input" className="sr-only">
                      Custom NPK Grade
                    </label>
                    <input
                      id="custom-npk-input"
                      type="text"
                      className="text-input custom-input"
                      placeholder="Enter custom NPK grade (e.g. 13-0-45, 0-0-50)"
                      value={customNpk}
                      onChange={(e) => setCustomNpk(e.target.value)}
                      inputMode="text"
                      enterKeyHint="done"
                      autoComplete="off"
                      aria-label="Custom NPK Grade"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Structured Pack Size Selector */}
            <div className="input-field-group pack-size-group">
              <div className="pack-size-header-row">
                <label className="field-label">
                  <span>Pack Size</span>
                  <span className="field-optional">पॅक साईझ</span>
                </label>

                {/* Unit Switcher */}
                <div className="pack-unit-tabs">
                  <button
                    type="button"
                    className={`unit-tab ${packSizeUnit === "volume" ? "active" : ""}`}
                    onClick={() => {
                      setPackSizeUnit("volume");
                      setPackSize("500 ml");
                    }}
                  >
                    Volume (ml/L)
                  </button>
                  <button
                    type="button"
                    className={`unit-tab ${packSizeUnit === "weight" ? "active" : ""}`}
                    onClick={() => {
                      setPackSizeUnit("weight");
                      setPackSize(packagingType === "Bag" ? "50 kg" : "1 kg");
                    }}
                  >
                    Weight (g/kg)
                  </button>
                  <button
                    type="button"
                    className={`unit-tab ${packSizeUnit === "custom" ? "active" : ""}`}
                    onClick={() => setPackSizeUnit("custom")}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {/* Volume Presets */}
              {packSizeUnit === "volume" && (
                <div className="size-chips-grid">
                  {COMMON_VOLUME_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`size-chip ${packSize === size ? "selected" : ""}`}
                      onClick={() => setPackSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}

              {/* Weight Presets */}
              {packSizeUnit === "weight" && (
                <div className="size-chips-grid">
                  {COMMON_WEIGHT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`size-chip ${packSize === size ? "selected" : ""}`}
                      onClick={() => setPackSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Size Input */}
              {packSizeUnit === "custom" && (
                <div className="custom-size-input-box">
                  <label htmlFor="custom-pack-size-input" className="sr-only">
                    Custom Pack Size
                  </label>
                  <input
                    id="custom-pack-size-input"
                    type="text"
                    className="text-input"
                    placeholder="e.g. 750 ml, 40 kg, 5 kg bucket"
                    value={customPackSize}
                    onChange={(e) => setCustomPackSize(e.target.value)}
                    inputMode="text"
                    enterKeyHint="done"
                    autoComplete="off"
                    aria-label="Custom Pack Size"
                  />
                </div>
              )}
            </div>

            {/* Manufacturer & Registration Number */}
            <div className="input-row-2col">
              <div className="input-field-group">
                <label className="field-label" htmlFor="prod-mfg">
                  <span>Manufacturer</span>
                  <span className="field-optional">उत्पादक कंपनी</span>
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
                <label className="field-label" htmlFor="prod-reg">
                  <span>Registration / CIB No.</span>
                  <span className="field-optional">नोंदणी क्रमांक</span>
                </label>
                <input
                  id="prod-reg"
                  type="text"
                  className="text-input"
                  placeholder="e.g. CIR-18239/2018 or Lic No"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Condition Pills */}
            <div className="input-field-group">
              <label className="field-label">
                <span>Packaging Physical Condition</span>
                <span className="field-optional">पॅकेजिंग स्थिती</span>
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
                      <span className="condition-dot" style={{ background: cond.color }} />
                      <div>
                        <div className="condition-title">{cond.label}</div>
                        <div className="condition-desc">{cond.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="input-field-group">
              <label className="field-label" htmlFor="prod-notes">
                <span>Notes / Additional Observations</span>
                <span className="field-optional">पर्यायी नोंदी</span>
              </label>
              <input
                id="prod-notes"
                type="text"
                className="text-input"
                placeholder="e.g. Stored in dark warehouse corner, slight moisture"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="step-nav-row between">
              <button
                type="button"
                className="btn-step-prev"
                onClick={() => goToStep(2)}
              >
                <ChevronLeft size={18} />
                <span>Back</span>
              </button>

              <button
                type="button"
                className="btn-step-next primary"
                id="btn-details-next"
                onClick={() => goToStep(4)}
              >
                <span>Next: Capture Photos</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* STEP 4: GUIDED CAMERA & ANGLE CAPTURE                                */}
        {/* ==================================================================== */}
        {currentStep === 4 && (
          <section className="form-card step-card guided-capture-card" id="step-camera-section">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">{isNoise ? "2" : "4"}</span>
                <div>
                  <h2 className="card-title">
                    {isNoise ? "Negative Sample Photos" : `Capture Photos ${currentPackaging ? `(${currentPackaging.label})` : ""}`}
                  </h2>
                  <span className="card-subtitle-mr">
                    {isNoise ? "नॉइज / निगेटिव्ह फोटो" : "प्रत्येक अँगल्सचा फोटो काढा"}
                  </span>
                </div>
              </div>
            </div>

            <GuidedCameraCapture
              isNoise={isNoise}
              photos={photos}
              onPhotosChange={setPhotos}
              resetTrigger={resetTrigger}
              onOpenManual={() => setIsManualOpen(true)}
              photoAngles={currentPhotoAngles}
              packagingType={packagingType}
              packagingLabel={currentPackaging ? currentPackaging.label : ""}
              onProceedToReview={() => goToStep(5)}
            />

            <div className="step-nav-row between" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="btn-step-prev"
                onClick={() => goToStep(isNoise ? 1 : 3)}
              >
                <ChevronLeft size={18} />
                <span>Back to {isNoise ? "Category" : "Details"}</span>
              </button>

              <button
                type="button"
                className="btn-step-next primary"
                id="btn-camera-next"
                disabled={photos.length === 0}
                onClick={() => goToStep(5)}
              >
                <span>Review & Submit ({photos.length} photos)</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* STEP 5: REVIEW SCREEN BEFORE SUBMISSION                              */}
        {/* ==================================================================== */}
        {currentStep === 5 && (
          <section className="form-card step-card" id="step-review-section">
            <div className="card-header">
              <div className="card-title-group">
                <span className="step-num">{isNoise ? "3" : "5"}</span>
                <div>
                  <h2 className="card-title">Review & Submit Product</h2>
                  <span className="card-subtitle-mr">तपासा आणि सबमिट करा — Verify before uploading</span>
                </div>
              </div>
            </div>

            {/* Metadata Overview Card */}
            <div className="review-meta-summary-card">
              <div className="review-meta-header">
                <div>
                  <span className="review-cat-tag">{category}</span>
                  {!isNoise && <span className="review-pkg-tag">{packagingType}</span>}
                  {category === "Fertilizer" && getEffectiveNpk() && (
                    <span className="review-npk-tag">NPK {getEffectiveNpk()}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-edit-details-shortcut"
                  onClick={() => goToStep(isNoise ? 1 : 3)}
                >
                  <Edit3 size={13} />
                  <span>Edit Info</span>
                </button>
              </div>

              <h3 className="review-product-name">
                {isNoise ? (notes || noiseTag || "Negative Sample") : (productName.trim() || "Untitled Product Sample")}
              </h3>

              {!isNoise && (
                <div className="review-details-grid">
                  <div className="review-detail-item">
                    <span className="detail-k">Manufacturer:</span>
                    <span className="detail-v">{manufacturer || "—"}</span>
                  </div>
                  <div className="review-detail-item">
                    <span className="detail-k">Pack Size:</span>
                    <span className="detail-v">{getEffectivePackSize() || "—"}</span>
                  </div>
                  <div className="review-detail-item">
                    <span className="detail-k">Reg / CIB:</span>
                    <span className="detail-v">{regNumber || "—"}</span>
                  </div>
                  <div className="review-detail-item">
                    <span className="detail-k">Condition:</span>
                    <span className="detail-v">{condition}</span>
                  </div>
                  {notes && (
                    <div className="review-detail-item full-span">
                      <span className="detail-k">Notes:</span>
                      <span className="detail-v">{notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photos Review Thumbnails */}
            <div className="review-photos-section">
              <div className="review-photos-header">
                <h4 className="review-section-title">Captured Photos ({photos.length})</h4>
                <button
                  type="button"
                  className="btn-retake-shortcut"
                  onClick={() => goToStep(4)}
                >
                  <Camera size={14} />
                  <span>Open Camera / Retake</span>
                </button>
              </div>

              {photos.length === 0 ? (
                <div className="review-no-photos-banner">
                  <AlertCircle size={20} />
                  <span>No photos captured yet. Please capture at least 1 photo before submitting.</span>
                </div>
              ) : (
                <div className="review-photos-grid">
                  {photos.map((p, idx) => (
                    <div key={idx} className="review-photo-card">
                      <div className="review-thumb-wrap">
                        {p.dataUrl ? (
                          <img src={p.dataUrl} alt={p.angle} className="review-thumb-img" />
                        ) : (
                          <div className="review-thumb-placeholder">
                            <Camera size={24} />
                          </div>
                        )}
                        <span className="review-angle-badge">{p.angle || `Photo #${idx + 1}`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="error-banner">
                <AlertCircle size={20} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Review Step Actions */}
            <div className="step-nav-row between" style={{ marginTop: "18px" }}>
              <button
                type="button"
                className="btn-step-prev"
                onClick={() => goToStep(4)}
              >
                <ChevronLeft size={18} />
                <span>Back to Camera</span>
              </button>

              <button
                type="button"
                className="btn-primary-submit big-action"
                id="btn-final-submit"
                disabled={!isValid() || isSubmitting}
                onClick={handleSubmit}
              >
                <Upload size={18} />
                <span>Submit to Google Drive</span>
              </button>
            </div>
          </section>
        )}

        {/* Recent Submissions List in this session */}
        {sessionHistory.length > 0 && (
          <div className="form-card session-history-card">
            <h3 className="session-history-title">
              <span>Recent Submissions This Session</span>
              <span className="session-history-count">{sessionHistory.length} saved</span>
            </h3>
            <div className="session-history-list">
              {sessionHistory.map((item) => (
                <div key={item.id} className="session-history-item">
                  <div className="session-item-info">
                    <div className="session-item-name">{item.name}</div>
                    <div className="session-item-meta">
                      {item.category} • {item.packaging} • {item.photoCount} photos • {item.time}
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
      </main>

      {/* User Manual Modal */}
      <UserManualModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />

      {/* Uploading Modal Dialog */}
      {isSubmitting && (
        <div className="upload-modal-overlay">
          <div className="upload-modal-card">
            <div className="spinner-ring" />
            <h3 className="upload-step-title">{submitStep}</h3>
            <p className="upload-step-desc">
              Please wait while photos and metadata are organized into Google Drive and logged into the master spreadsheet.
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

      {/* Success Confirmation Modal */}
      {lastSubmissionResult && (
        <div className="upload-modal-overlay">
          <div className="success-modal-card">
            <div className="success-icon-badge">
              <CheckCircle2 size={38} />
            </div>
            <h3 className="success-title">Submission Successful!</h3>
            <p style={{ fontSize: "14px", color: "var(--text-subtle)", marginTop: "-6px" }}>
              Photos and catalog metadata have been saved to Google Drive.
            </p>

            <div className="success-summary-box">
              <div className="summary-row">
                <span className="summary-label">Submission ID:</span>
                <span className="summary-val">{lastSubmissionResult.submissionId}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Drive Folder:</span>
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
