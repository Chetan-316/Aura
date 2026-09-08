/**
 * AuRA Field Data Collector - Client Configuration
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

export const PHOTO_ANGLES = [
  { id: "Front", label: "Front Label", mr: "मुख्य बाजू", tip: "Full branding & product title" },
  { id: "Side", label: "Side Panel", mr: "बाजूचा भाग", tip: "Dosage, batch, barcode" },
  { id: "Cap/Lid", label: "Cap / Lid", mr: "झाकण / सील", tip: "Seal color, brand embossing" },
  { id: "Barcode", label: "Barcode / QR", mr: "बारकोड", tip: "High-contrast close-up" },
  { id: "Back panel", label: "Back / Composition", mr: "मागील रचना", tip: "Chemical formulation & warning" }
];

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
