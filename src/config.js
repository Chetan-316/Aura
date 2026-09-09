/**
 * Agri-Product Field Data Collector - Client Configuration
 */

export const DEFAULT_API_ENDPOINT = "https://script.google.com/macros/s/AKfycbwytzY4h0HE_ofWrnsfTCZkHX2M8Iw3y_l_fqGaCxReVJQ-bJ-bPTheVfNeoQ9-gVjw/exec";

// Allows override via Vite environment variable if deployed with custom env
export const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || DEFAULT_API_ENDPOINT;

export const CATEGORIES = [
  { id: "Pesticide", label: "Pesticide", mr: "कीटकनाशक", icon: "spray", badge: "Chem", color: "#10b981" },
  { id: "Fertilizer", label: "Fertilizer", mr: "खते / पोषण", icon: "wheat", badge: "Nutrient", color: "#f59e0b" },
  { id: "Seed", label: "Seed", mr: "बियाणे", icon: "sprout", badge: "Hybrid", color: "#3b82f6" },
  { id: "Not a Product — Noise", label: "Noise / Negative", mr: "निगेटिव्ह / कचरा", icon: "slash", badge: "Noise", color: "#ef4444", isNoise: true }
];

// Configurable packaging types — each carries its own ordered set of photo angles.
// Field agents choose the packaging type per product before capture begins.
export const PACKAGING_TYPES = [
  {
    id: "Bottle",
    label: "Bottle / Container",
    mr: "बाटली / कंटेनर",
    icon: "flask",
    description: "Plastic / glass bottles, cans, jerry cans",
    descriptionMr: "प्लास्टिक बाटली, कॅन, जेरी कॅन",
    photoAngles: [
      {
        id: "Front",
        label: "Front Side",
        tabLabel: "Front",
        tabSubtext: "Main label",
        mr: "पुढील बाजू",
        tip: "Full branding & product title",
        guide: "Hold bottle upright. Frame entire brand title, manufacturer logo, and active ingredients clearly.",
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
        guide: "Rotate bottle to the right side. Frame dosage chart, usage directions, and safety info.",
        tooltip: "Angle 2: Right Side — Dosage chart & usage directions",
        required: true
      },
      {
        id: "Left",
        label: "Left Side",
        tabLabel: "Left",
        tabSubtext: "Cautions",
        mr: "डावी बाजू",
        tip: "Additional cautions & info panel",
        guide: "Rotate to the left side. Capture any additional cautions, certifications, or info panels.",
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
        guide: "Frame the back panel: chemical formula, batch number, Mfg/Exp dates, MRP ₹, and warning symbols.",
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
        guide: "Get a sharp close-up (10–15 cm). Ensure barcode lines are straight and there is no glare or blur.",
        tooltip: "Angle 5: Barcode / QR — High-contrast scan",
        required: false
      }
    ]
  },
  {
    id: "Pouch",
    label: "Pouch / Packet",
    mr: "पाऊच / पाकीट",
    icon: "package",
    description: "Seed packets, powder sachets, granule bags",
    descriptionMr: "बियाणे पाकीट, पावडर सॅशे, दाणे पिशवी",
    photoAngles: [
      {
        id: "Front",
        label: "Front Side",
        tabLabel: "Front",
        tabSubtext: "Brand & crop",
        mr: "पुढील बाजू",
        tip: "Brand name, crop type, variety name",
        guide: "Lay packet flat or hold upright. Frame brand name, crop type, hybrid variety, and net weight clearly.",
        tooltip: "Angle 1: Front Side — Brand, crop & variety",
        required: true
      },
      {
        id: "Back",
        label: "Back Side",
        tabLabel: "Back",
        tabSubtext: "Instructions",
        mr: "मागील बाजू",
        tip: "Sowing instructions, composition, batch info",
        guide: "Flip the packet. Frame sowing instructions, germination %, batch number, Mfg/Exp dates, and MRP.",
        tooltip: "Angle 2: Back Side — Instructions, batch & dates",
        required: true
      },
      {
        id: "Barcode",
        label: "Barcode / QR",
        tabLabel: "Barcode",
        tabSubtext: "If present",
        mr: "बारकोड",
        tip: "Close-up of barcode if present on packet",
        guide: "If the packet has a barcode or QR code, get a sharp close-up. Hold flat to keep lines straight.",
        tooltip: "Angle 3: Barcode / QR — Close-up if present",
        required: false
      }
    ]
  }
];

// Backward-compatible fallback (defaults to Bottle angles)
export const PHOTO_ANGLES = PACKAGING_TYPES[0].photoAngles;

export const PACKAGING_CONDITIONS = [
  { id: "New/Clean", label: "New / Clean", desc: "Fresh stock, crisp label", icon: "sparkles", color: "#10b981" },
  { id: "Dusty", label: "Dusty / Aged", desc: "Shop dust, normal wear", icon: "wind", color: "#f59e0b" },
  { id: "Faded", label: "Sun Faded", desc: "Discolored print from sunlight", icon: "sun", color: "#f97316" },
  { id: "Damaged", label: "Damaged / Torn", desc: "Torn label, dented bottle/can", icon: "alert-triangle", color: "#ef4444" }
];

export const NOISE_TYPES = [
  "Empty shelf / shop rack",
  "Hand holding an item",
  "Blurry / motion blur photo",
  "Unrelated object (tool, bottle, carton)",
  "Store counter / floor / wall",
  "Off-catalog non-agri product",
  "Shadow / extreme glare"
];
