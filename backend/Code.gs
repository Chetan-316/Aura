/**
 * Agricultural Product Data Collector - Google Apps Script Backend
 * Folder ID: 11V6Coo-3MKs6ibvxqGfY4BXy8ZGPJf4I
 *
 * This script receives product photos & metadata from the field collection web app,
 * creates an organized subfolder inside your Google Drive, saves the photos,
 * and logs every submission to a master Google Sheet with duplicate prevention.
 */

const ROOT_FOLDER_ID = "11V6Coo-3MKs6ibvxqGfY4BXy8ZGPJf4I";
const MASTER_SHEET_NAME = "Field_Data_Master_Registry";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ success: false, error: "No post data received" });
    }

    const data = JSON.parse(e.postData.contents);
    const result = handleSubmission(data);
    return responseJSON({ success: true, ...result });
  } catch (error) {
    return responseJSON({ success: false, error: error.toString() });
  }
}

function doGet(e) {
  return responseJSON({
    status: "online",
    message: "AuRA Field Data Collection API is ready to receive submissions."
  });
}

function handleSubmission(data) {
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const now = new Date();
  const timestampStr = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
  const folderDateStr = Utilities.formatDate(now, "Asia/Kolkata", "yyyyMMdd_HHmmss");

  const category = (data.category || "Uncategorized").trim();
  const isNoise = category.toLowerCase().includes("noise") || category.toLowerCase().includes("not a product");
  const packagingType = isNoise ? "Noise" : (data.packagingType || "Bottle").trim();
  const productName = (data.productName || (isNoise ? "Noise Sample" : "Unknown Product")).trim();
  const manufacturer = (data.manufacturer || "").trim();
  const regNumber = (data.regNumber || "").trim();
  const packSize = (data.packSize || "").trim();
  const npk = (data.npk || "").trim();
  const condition = (data.condition || "").trim();
  const angles = Array.isArray(data.angles) ? data.angles.join(", ") : (data.angles || "");
  const notes = (data.notes || "").trim();
  const photos = data.photos || [];
  const additionalPhotoCount = Number(data.additionalPhotoCount) || 
    photos.filter(p => p.angle && p.angle.toLowerCase().includes("additional")).length;
  const totalPhotos = photos.length;

  // Use client submissionId if provided for idempotency, or generate unique fallback ID
  const submissionId = (data.submissionId && String(data.submissionId).trim()) ||
    ("SUB_" + folderDateStr + "_" + Math.floor(Math.random() * 899 + 100));

  // 1. Determine Subfolder Name
  let subfolderName = "";
  if (isNoise) {
    subfolderName = `[NOISE] ${productName || "Negative_Sample"} (${folderDateStr})`;
  } else {
    const npkTag = (category.toLowerCase() === "fertilizer" && npk) ? ` [${npk}]` : "";
    const brandTag = manufacturer ? ` - ${manufacturer}` : "";
    subfolderName = `[${category}] ${productName}${npkTag}${brandTag} (${folderDateStr})`;
  }
  subfolderName = subfolderName.replace(/[\\/:*?"<>|]/g, "_");

  // Idempotency: Check if an identical folder already exists with photos
  let submissionFolder;
  let isNewFolder = false;
  const existingFolders = rootFolder.getFoldersByName(subfolderName);
  if (existingFolders.hasNext()) {
    submissionFolder = existingFolders.next();
    if (submissionFolder.getFiles().hasNext()) {
      // Already saved photos in a previous try - return existing folder URL directly
      return {
        submissionId: submissionId,
        folderName: subfolderName,
        folderUrl: submissionFolder.getUrl(),
        photoCount: photos.length,
        alreadyProcessed: true
      };
    }
  } else {
    submissionFolder = rootFolder.createFolder(subfolderName);
    isNewFolder = true;
  }

  const folderUrl = submissionFolder.getUrl();

  // 2. Save each photo into the subfolder with rollback safety
  try {
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      let base64Data = photo.base64 || "";
      if (base64Data.indexOf(",") > -1) {
        base64Data = base64Data.split(",")[1];
      }

      const mimeType = photo.type || "image/jpeg";
      const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
      const angleTag = photo.angle ? `_${photo.angle.replace(/[^\w-]/g, "_")}` : `_photo${i + 1}`;
      const filename = `${submissionId}${angleTag}.${extension}`;

      const decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
      const file = submissionFolder.createFile(decodedBlob);
      file.setDescription(`Product: ${productName} | Category: ${category} | Packaging: ${packagingType}${npk ? ` | NPK: ${npk}` : ""} | Angle: ${photo.angle || "N/A"}`);
    }
  } catch (err) {
    // If saving photos failed and folder was just created, trash it to avoid orphaned empty folders
    if (isNewFolder && submissionFolder) {
      submissionFolder.setTrashed(true);
    }
    throw new Error("Failed saving photos to Google Drive: " + err.message);
  }

  // 3. Log into Master Google Sheet in the root folder (Thread-safe & schema-resilient)
  logToMasterSheet(rootFolder, {
    submissionId: submissionId,
    timestamp: timestampStr,
    category: category,
    packagingType: packagingType,
    productName: productName,
    manufacturer: manufacturer,
    regNumber: regNumber,
    packSize: packSize,
    npk: npk,
    condition: condition,
    angles: angles,
    additionalPhotoCount: additionalPhotoCount,
    totalPhotos: totalPhotos,
    photoCount: totalPhotos,
    folderUrl: folderUrl,
    notes: notes
  });

  return {
    submissionId: submissionId,
    folderName: subfolderName,
    folderUrl: folderUrl,
    photoCount: photos.length
  };
}

/**
 * Sanitizes cell input to prevent spreadsheet formula execution (=, +, -, @)
 * and prevent display formatting errors.
 */
function sanitizeCell(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function logToMasterSheet(rootFolder, entry) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // Wait up to 20 seconds for lock to serialize writes
  } catch (e) {
    console.warn("Could not acquire script lock, proceeding: " + e.message);
  }

  try {
    let spreadsheet;
    const files = rootFolder.getFilesByName(MASTER_SHEET_NAME);

    const canonicalHeaders = [
      "Submission ID",
      "Timestamp (IST)",
      "Category",
      "Packaging Type",
      "Product Name",
      "Manufacturer",
      "Reg / Cert No",
      "Pack Size",
      "NPK / Fertilizer Grade",
      "Condition",
      "Angles Captured",
      "Additional Photos",
      "Total Photos",
      "Drive Folder Link",
      "Notes"
    ];

    let sheet;

    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.open(files.next());
      sheet = spreadsheet.getActiveSheet();

      // Inspect existing headers dynamically
      const lastCol = sheet.getLastColumn();
      let existingHeaders = [];
      if (lastCol > 0) {
        existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
      }

      // Check for missing canonical headers and append them without corrupting previous columns
      canonicalHeaders.forEach(targetHeader => {
        // Match canonical name or compatible aliases
        const hasHeader = existingHeaders.some(h => {
          if (h.toLowerCase() === targetHeader.toLowerCase()) return true;
          if (targetHeader === "Total Photos" && h.toLowerCase() === "photo count") return true;
          return false;
        });

        if (!hasHeader) {
          const newCol = sheet.getLastColumn() + 1;
          const cell = sheet.getRange(1, newCol);
          cell.setValue(targetHeader);
          cell.setFontWeight("bold");
          cell.setBackground("#1B4332");
          cell.setFontColor("#FFFFFF");
          existingHeaders.push(targetHeader);
        }
      });
    } else {
      // Create brand new spreadsheet inside rootFolder
      spreadsheet = SpreadsheetApp.create(MASTER_SHEET_NAME);
      const sheetFile = DriveApp.getFileById(spreadsheet.getId());
      rootFolder.addFile(sheetFile);
      DriveApp.getRootFolder().removeFile(sheetFile);

      sheet = spreadsheet.getActiveSheet();
      sheet.setName("Submissions");

      sheet.appendRow(canonicalHeaders);
      const headerRange = sheet.getRange(1, 1, 1, canonicalHeaders.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1B4332");
      headerRange.setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    // Refresh header row map for exact column index mapping
    const finalLastCol = sheet.getLastColumn();
    const finalHeaders = sheet.getRange(1, 1, 1, finalLastCol).getValues()[0].map(h => String(h).trim().toLowerCase());

    const valueForHeader = (headerName) => {
      switch (headerName) {
        case "submission id":
          return sanitizeCell(entry.submissionId);
        case "timestamp (ist)":
        case "timestamp":
          return sanitizeCell(entry.timestamp);
        case "category":
          return sanitizeCell(entry.category);
        case "packaging type":
        case "packaging":
          return sanitizeCell(entry.packagingType);
        case "product name":
        case "product":
          return sanitizeCell(entry.productName);
        case "manufacturer":
          return sanitizeCell(entry.manufacturer);
        case "reg / cert no":
        case "reg number":
        case "cib number":
          return sanitizeCell(entry.regNumber);
        case "pack size":
          return sanitizeCell(entry.packSize);
        case "npk / fertilizer grade":
        case "npk":
          return sanitizeCell(entry.npk);
        case "condition":
          return sanitizeCell(entry.condition);
        case "angles captured":
        case "angles":
          return sanitizeCell(entry.angles);
        case "additional photos":
          return Number(entry.additionalPhotoCount) || 0;
        case "total photos":
        case "photo count":
          return Number(entry.totalPhotos || entry.photoCount) || 0;
        case "drive folder link":
        case "folder link":
          return sanitizeCell(entry.folderUrl);
        case "notes":
          return sanitizeCell(entry.notes);
        default:
          return "";
      }
    };

    const rowData = finalHeaders.map(h => valueForHeader(h));
    sheet.appendRow(rowData);

    return spreadsheet.getUrl();
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {
      // ignore lock release error
    }
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
