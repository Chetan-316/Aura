import React, { useState } from "react";
import {
  X,
  BookOpen,
  CheckCircle2,
  XCircle,
  Camera,
  ShieldCheck,
  Layers,
  AlertTriangle,
  Lightbulb,
  Sun,
  Eye,
  Focus,
  Hand
} from "lucide-react";

export default function UserManualModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("angles"); // 'angles' | 'checklist' | 'noise'

  if (!isOpen) return null;

  return (
    <div className="manual-modal-overlay" onClick={onClose}>
      <div
        className="manual-modal-card"
        onClick={(e) => e.stopPropagation()}
        id="field-manual-modal"
      >
        {/* Header */}
        <div className="manual-header">
          <div className="manual-header-title-group">
            <div className="manual-icon-badge">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="manual-title">Field Photography Manual & Guidelines</h2>
              <p className="manual-subtitle">
                फील्ड मार्गदर्शक पुस्तिका • Standardized Guidelines for Offline AI Dataset Collection
              </p>
            </div>
          </div>
          <button
            type="button"
            className="manual-close-btn"
            onClick={onClose}
            title="Close Manual"
            id="btn-close-manual-x"
          >
            <X size={18} />
          </button>
        </div>

        {/* 4-Point Golden Checklist Quick Strip */}
        <div className="manual-checklist-strip">
          <div className="checklist-strip-header">
            <span className="strip-badge">Golden Checklist</span>
            <span className="strip-title">4 Rules for Every Snapshot (प्रत्येक फोटोसाठी ४ महत्त्वाचे नियम)</span>
          </div>
          <div className="checklist-strip-items">
            <div className="checklist-item">
              <Sun size={15} className="item-icon" />
              <div>
                <strong>Good Lighting</strong>
                <span>चांगला प्रकाश (No dark shadows)</span>
              </div>
            </div>
            <div className="checklist-item">
              <Eye size={15} className="item-icon" />
              <div>
                <strong>No Glare</strong>
                <span>चमक टाळा (Tilt away from bulbs)</span>
              </div>
            </div>
            <div className="checklist-item">
              <Focus size={15} className="item-icon" />
              <div>
                <strong>Text in Focus</strong>
                <span>स्पष्ट मजकूर (Sharp letters & barcodes)</span>
              </div>
            </div>
            <div className="checklist-item">
              <Hand size={15} className="item-icon" />
              <div>
                <strong>Hold Steady</strong>
                <span>स्थिर हात (Zero motion blur)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="manual-tab-bar">
          <button
            type="button"
            className={`manual-tab-btn ${activeTab === "angles" ? "active" : ""}`}
            onClick={() => setActiveTab("angles")}
            id="tab-angles"
          >
            <Camera size={15} />
            <span>5 Required Angles (५ आवश्यक कोन)</span>
          </button>
          <button
            type="button"
            className={`manual-tab-btn ${activeTab === "checklist" ? "active" : ""}`}
            onClick={() => setActiveTab("checklist")}
            id="tab-checklist"
          >
            <ShieldCheck size={15} />
            <span>Do's & Don'ts (नियम व काळजी)</span>
          </button>
          <button
            type="button"
            className={`manual-tab-btn ${activeTab === "noise" ? "active" : ""}`}
            onClick={() => setActiveTab("noise")}
            id="tab-noise"
          >
            <Layers size={15} />
            <span>Noise / Negative Samples (कचरा नमुने)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="manual-content-body">
          {/* TAB 1: 5 REQUIRED ANGLES */}
          {activeTab === "angles" && (
            <div className="manual-section-stack">
              <div className="manual-intro-card">
                <Lightbulb size={18} className="intro-icon" />
                <p>
                  To ensure complete, standardized, and high-quality photographic documentation of agricultural input packaging,
                  each product container or pouch must be documented across these 5 standard perspectives.
                </p>
              </div>

              {/* Angle 1: Front */}
              <div className="angle-guide-card">
                <div className="angle-guide-header">
                  <span className="angle-number-badge">1</span>
                  <div className="angle-guide-header-info">
                    <div className="angle-title-row">
                      <h3 className="angle-guide-title">Front Label</h3>
                      <span className="angle-mr-tag">मुख्य बाजू</span>
                    </div>
                    <span className="angle-guide-target">
                      Target: Full branding, trade name, active chemical formula & manufacturer logo
                    </span>
                  </div>
                </div>
                <div className="angle-guide-body">
                  <p className="angle-purpose">
                    <strong>Why it matters:</strong> This is the primary view documenting the commercial product brand, its registered trade class, and manufacturer brand assets.
                  </p>
                  <ul className="guide-points-list">
                    <li>Place the bottle or pouch upright on the shop counter.</li>
                    <li>Ensure the entire product brand name (e.g., <em>Coromandel Gromor</em>, <em>Confidor</em>, <em>Roundup</em>) is centered and sharp.</li>
                    <li>Verify that active chemical ingredient percentages (e.g. <em>Imidacloprid 17.8% SL</em>) are clearly legible.</li>
                    <li>Hold packaging only by the outer edges; do not place fingers over front artwork or text.</li>
                  </ul>
                </div>
              </div>

              {/* Angle 2: Side Panel */}
              <div className="angle-guide-card">
                <div className="angle-guide-header">
                  <span className="angle-number-badge">2</span>
                  <div className="angle-guide-header-info">
                    <div className="angle-title-row">
                      <h3 className="angle-guide-title">Side Panel</h3>
                      <span className="angle-mr-tag">बाजूचा भाग</span>
                    </div>
                    <span className="angle-guide-target">
                      Target: Recommended dosage chart, target crops, license & toxicity triangle
                    </span>
                  </div>
                </div>
                <div className="angle-guide-body">
                  <p className="angle-purpose">
                    <strong>Why it matters:</strong> Agro-dealers and farmers need rapid verification of dosage charts (ml/acre or gm/ha), CIB Registration numbers, and the statutory toxicity warning diamond (Red/Yellow/Blue/Green).
                  </p>
                  <ul className="guide-points-list">
                    <li>Rotate the container 90 degrees to capture technical directions and target crop tables.</li>
                    <li>Ensure the statutory toxicity triangle and caution warning text are in sharp focus.</li>
                    <li>Capture the manufacturing license number (Mfg Lic No) and Central Insecticides Board (CIB) registration number.</li>
                  </ul>
                </div>
              </div>

              {/* Angle 3: Cap / Lid */}
              <div className="angle-guide-card">
                <div className="angle-guide-header">
                  <span className="angle-number-badge">3</span>
                  <div className="angle-guide-header-info">
                    <div className="angle-title-row">
                      <h3 className="angle-guide-title">Cap / Lid / Seal</h3>
                      <span className="angle-mr-tag">झाकण आणि सील</span>
                    </div>
                    <span className="angle-guide-target">
                      Target: Tamper-evident band, holographic seal strip, cap color & embossed logo
                    </span>
                  </div>
                </div>
                <div className="angle-guide-body">
                  <p className="angle-purpose">
                    <strong>Why it matters:</strong> Captures specific mold patterns, security rings, holographic foil seals, and embossed manufacturer insignias on the container cap.
                  </p>
                  <ul className="guide-points-list">
                    <li>Shoot from a 45-degree top angle looking directly down at the cap.</li>
                    <li>Capture the tamper-evident security ring, foil seal, or holographic tear strip.</li>
                    <li>Frame any company logos embossed directly onto the plastic lid surface.</li>
                  </ul>
                </div>
              </div>

              {/* Angle 4: Barcode / QR */}
              <div className="angle-guide-card">
                <div className="angle-guide-header">
                  <span className="angle-number-badge">4</span>
                  <div className="angle-guide-header-info">
                    <div className="angle-title-row">
                      <h3 className="angle-guide-title">Barcode & QR Code</h3>
                      <span className="angle-mr-tag">बारकोड व क्यूआर</span>
                    </div>
                    <span className="angle-guide-target">
                      Target: High-contrast 1D EAN barcodes and 2D QR tracking codes
                    </span>
                  </div>
                </div>
                <div className="angle-guide-body">
                  <p className="angle-purpose">
                    <strong>Why it matters:</strong> Enables immediate 1-tap POS scanning, automated government supply-chain lot traceability, and batch database lookups without manual typing.
                  </p>
                  <ul className="guide-points-list">
                    <li>Position phone camera 10–15 cm away to allow the macro lens to lock focus.</li>
                    <li>On flexible plastic foil pouches (seed or fertilizer packets), gently pull corners flat so the barcode lines are straight.</li>
                    <li>Ensure no bright white overhead reflection streak cuts through the black bars.</li>
                  </ul>
                </div>
              </div>

              {/* Angle 5: Back Panel */}
              <div className="angle-guide-card">
                <div className="angle-guide-header">
                  <span className="angle-number-badge">5</span>
                  <div className="angle-guide-header-info">
                    <div className="angle-title-row">
                      <h3 className="angle-guide-title">Back Panel / Composition</h3>
                      <span className="angle-mr-tag">मागील रचना</span>
                    </div>
                    <span className="angle-guide-target">
                      Target: Batch number, Mfg Date, Expiry date, Maximum Retail Price (MRP ₹) & Antidote
                    </span>
                  </div>
                </div>
                <div className="angle-guide-body">
                  <p className="angle-purpose">
                    <strong>Why it matters:</strong> Regulatory compliance, expiry date verification (preventing expired chemical sales), and life-saving emergency medical antidote instructions in regional languages.
                  </p>
                  <ul className="guide-points-list">
                    <li>Frame the ink-jet printed or dot-matrix batch details (Batch No, Mfg Date, Exp Date, MRP ₹).</li>
                    <li>Include antidote emergency instructions in Marathi and Hindi.</li>
                    <li>Capture official manufacturing unit address and customer grievance helpline details.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DO'S & DON'TS */}
          {activeTab === "checklist" && (
            <div className="manual-section-stack">
              <div className="dos-donts-grid">
                {/* Do's Column */}
                <div className="dos-column">
                  <div className="dos-header">
                    <CheckCircle2 size={18} className="dos-icon" />
                    <h4>Best Practices (काय करावे)</h4>
                  </div>
                  <div className="rules-list">
                    <div className="rule-item do">
                      <CheckCircle2 size={15} className="rule-bullet" />
                      <div>
                        <strong>Wipe dusty packaging:</strong> Shop inventory often has chalky fertilizer residue. A quick wipe with a cloth ensures barcode and text clarity.
                      </div>
                    </div>
                    <div className="rule-item do">
                      <CheckCircle2 size={15} className="rule-bullet" />
                      <div>
                        <strong>Diffuse lighting:</strong> Turn bottle slightly away from direct shop tube lights to prevent high-contrast white glare spots.
                      </div>
                    </div>
                    <div className="rule-item do">
                      <CheckCircle2 size={15} className="rule-bullet" />
                      <div>
                        <strong>Keep camera parallel:</strong> Hold phone straight on to the label rather than at a steep tilt to avoid trapezoidal distortion.
                      </div>
                    </div>
                    <div className="rule-item do">
                      <CheckCircle2 size={15} className="rule-bullet" />
                      <div>
                        <strong>Include damaged items:</strong> Sun-faded, dented, or stained bottles reflect true field reality and make the model robust.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Don'ts Column */}
                <div className="donts-column">
                  <div className="donts-header">
                    <XCircle size={18} className="donts-icon" />
                    <h4>Avoid Common Mistakes (काय टाळावे)</h4>
                  </div>
                  <div className="rules-list">
                    <div className="rule-item dont">
                      <XCircle size={15} className="rule-bullet" />
                      <div>
                        <strong>Do not cover text with fingers:</strong> Hold bottles strictly from top and bottom rims without obstructing brand names or barcodes.
                      </div>
                    </div>
                    <div className="rule-item dont">
                      <XCircle size={15} className="rule-bullet" />
                      <div>
                        <strong>Do not take blurry/motion photos:</strong> Hold phone still for 1 second after tapping shutter until snapshot confirms on screen.
                      </div>
                    </div>
                    <div className="rule-item dont">
                      <XCircle size={15} className="rule-bullet" />
                      <div>
                        <strong>Avoid extreme backlight:</strong> Never shoot with a bright sunlit window or open doorway directly behind the bottle.
                      </div>
                    </div>
                    <div className="rule-item dont">
                      <XCircle size={15} className="rule-bullet" />
                      <div>
                        <strong>Do not skip angles:</strong> A 5-angle dataset is mandatory for catalog classification. If an angle is missing, retake it.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOISE SAMPLES */}
          {activeTab === "noise" && (
            <div className="manual-section-stack">
              <div className="manual-intro-card warning">
                <AlertTriangle size={18} className="intro-icon" />
                <p>
                  <strong>Why Negative / Noise Data is Crucial:</strong> When a dealer or farmer opens the app inside a shop, the camera frequently sees the shop counter, empty shelves, hands, or tea cups. The offline AI must be trained with negative examples so it <strong>never hallucinates or triggers a false product detection</strong> on everyday shop surroundings.
                </p>
              </div>

              <h4 className="noise-section-title">What Counts as a Valid Noise Photo:</h4>

              <div className="noise-guidelines-grid">
                <div className="noise-sample-type">
                  <span className="noise-type-badge">Negative Type 1</span>
                  <h4>Empty Shelves & Walls (रिकामे रॅक)</h4>
                  <p>Wooden or metal shop racks, empty pegboard hooks, shadows, price tags, and blank store walls without products.</p>
                </div>

                <div className="noise-sample-type">
                  <span className="noise-type-badge">Negative Type 2</span>
                  <h4>Counter Clutter & Hands (काउंटर व हात)</h4>
                  <p>Dealer or farmer hands holding cash, keys, or pens; sales register books, billing slips, or calculators on the desk.</p>
                </div>

                <div className="noise-sample-type">
                  <span className="noise-type-badge">Negative Type 3</span>
                  <h4>Extreme Blur & Glare (धूसर व चमक)</h4>
                  <p>Motion-blurred camera frames, hand passing in front of lens, extreme daylight bloom, or un-focused shop backgrounds.</p>
                </div>

                <div className="noise-sample-type">
                  <span className="noise-type-badge">Negative Type 4</span>
                  <h4>Non-Agro Everyday Items (इतर वस्तू)</h4>
                  <p>Drinking water bottles, chai glasses, cardboard packing cartons, mobile phones, or unrelated shop supplies.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="manual-footer">
          <div className="manual-footer-note">
            Field Photography SOP • Maharashtra Agro-Input Dataset Platform
          </div>
          <button
            type="button"
            className="btn-close-manual"
            id="btn-close-manual-footer"
            onClick={onClose}
          >
            <CheckCircle2 size={16} />
            <span>Understood, Continue Capturing</span>
          </button>
        </div>
      </div>
    </div>
  );
}
