/**
 * Agri-Product Field Data Collector - Client Configuration
 */

export const DEFAULT_API_ENDPOINT = "https://script.google.com/macros/s/AKfycbwytzY4h0HE_ofWrnsfTCZkHX2M8Iw3y_l_fqGaCxReVJQ-bJ-bPTheVfNeoQ9-gVjw/exec";

// Allows override via Vite environment variable if deployed with custom env
export const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || DEFAULT_API_ENDPOINT;

export const CATEGORIES = [
  { id: "Fertilizer", label: "Fertilizer", mr: "खते / पोषण", icon: "wheat", badge: "Nutrient", color: "#f59e0b" },
  { id: "Fungicide", label: "Fungicide", mr: "बुरशीनाशक", icon: "shield", badge: "Fungi", color: "#06b6d4" },
  { id: "Herbicide", label: "Herbicide", mr: "तणनाशक", icon: "scissors", badge: "Weed", color: "#ec4899" },
  { id: "Insecticide", label: "Insecticide", mr: "कीटकनाशक", icon: "bug", badge: "Insect", color: "#ef4444" },
  { id: "Micronutrient", label: "Micronutrient", mr: "सूक्ष्मअन्नद्रव्ये", icon: "sparkles", badge: "Micro", color: "#10b981" },
  { id: "PGR / Plant Growth Regulator", label: "PGR / Plant Growth Regulator", mr: "पी.जी.आर. (वाढ नियंत्रक)", icon: "trending-up", badge: "Growth", color: "#8b5cf6" },
  { id: "Biostimulant", label: "Biostimulant", mr: "बायोस्टिम्युलंट / जैविक", icon: "leaf", badge: "Bio", color: "#84cc16" },
  { id: "Seed", label: "Seed", mr: "बियाणे", icon: "sprout", badge: "Hybrid", color: "#3b82f6" },
  { id: "Not a Product — Noise", label: "Noise / Negative", mr: "नॉइज / निगेटिव्ह", icon: "slash", badge: "Noise", color: "#64748b", isNoise: true }
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
    description: "Seed packets, powder sachets, small foil packs",
    descriptionMr: "बियाणे पाकीट, पावडर सॅशे, लहान पिशवी",
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
  },
  {
    id: "Bag",
    label: "Bag / Large Sack",
    mr: "पोते / मोठी गोणी",
    icon: "archive",
    description: "25 kg / 50 kg fertilizer bags, large agricultural sacks",
    descriptionMr: "२५ किलो / ५० किलो खताचे पोते, मोठी कृषी गोणी",
    photoAngles: [
      {
        id: "Front",
        label: "Front Side",
        tabLabel: "Front",
        tabSubtext: "Brand & grade",
        mr: "पुढील बाजू",
        tip: "Brand name, nutrient grade (NPK) & net weight",
        guide: "Stand 1–2m back. Frame the full front of the sack showing brand title, NPK ratio, and net weight (e.g. 50kg).",
        tooltip: "Angle 1: Front Side — Brand, NPK grade & weight",
        required: true
      },
      {
        id: "Back",
        label: "Back Side",
        tabLabel: "Back",
        tabSubtext: "Specs & Mfg",
        mr: "मागील बाजू",
        tip: "Nutrient specifications, manufacturer, MRP & batch",
        guide: "Photograph the reverse side: nutrient percentage chart, manufacturer address, batch no, and maximum retail price.",
        tooltip: "Angle 2: Back Side — Composition, specs & batch",
        required: true
      },
      {
        id: "Side",
        label: "Side Gusset / Tag",
        tabLabel: "Side / Tag",
        tabSubtext: "Gusset or stitched tag",
        mr: "साइड / टॅग",
        tip: "Side printed gusset or stitched mouth certification tag",
        guide: "Capture side gusset print or the sewn certification tag at the mouth of the sack showing lot number and testing date.",
        tooltip: "Angle 3: Side Gusset / Tag — Lot number & certification",
        required: false
      },
      {
        id: "Barcode",
        label: "Barcode / QR",
        tabLabel: "Barcode",
        tabSubtext: "Printed code",
        mr: "बारकोड",
        tip: "Close-up of printed barcode or tracking QR code",
        guide: "Get a sharp close-up of printed barcode or government tracking QR code on the bag.",
        tooltip: "Angle 4: Barcode / QR — Close-up if present",
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

// Common Indian Fertilizer NPK grades for 1-tap fast selection
export const COMMON_NPK_GRADES = [
  "19-19-19",
  "10-26-26",
  "12-32-16",
  "18-46-0 (DAP)",
  "20-20-0-13",
  "0-52-34 (MKP)",
  "14-35-14",
  "24-24-0",
  "0-0-50 (SOP)",
  "12-61-0",
  "46-0-0 (Urea)"
];

// Fast Pack Size selector presets
export const COMMON_VOLUME_SIZES = [
  "50 ml",
  "100 ml",
  "200 ml",
  "250 ml",
  "500 ml",
  "1 L",
  "5 L"
];

export const COMMON_WEIGHT_SIZES = [
  "50 g",
  "100 g",
  "250 g",
  "500 g",
  "1 kg",
  "5 kg",
  "10 kg",
  "25 kg",
  "50 kg"
];
