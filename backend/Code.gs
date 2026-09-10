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
  const condition = (data.condition || "").trim();
  const angles = Array.isArray(data.angles) ? data.angles.join(", ") : (data.angles || "");
  const notes = (data.notes || "").trim();
  const photos = data.photos || [];

  // Use client submissionId if provided for idempotency, or generate unique fallback ID
  const submissionId = (data.submissionId && String(data.submissionId).trim()) ||
    ("SUB_" + folderDateStr + "_" + Math.floor(Math.random() * 899 + 100));

  // 1. Determine Subfolder Name
  let subfolderName = "";
  if (isNoise) {
    subfolderName = `[NOISE] ${productName || "Negative_Sample"} (${folderDateStr})`;
  } else {
    const brandTag = manufacturer ? ` - ${manufacturer}` : "";
    subfolderName = `[${category}] ${productName}${brandTag} (${folderDateStr})`;
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
      const angleTag = photo.angle ? `_${photo.angle.replace(/\s+/g, "")}` : `_photo${i + 1}`;
      const filename = `${submissionId}${angleTag}.${extension}`;

      const decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
      const file = submissionFolder.createFile(decodedBlob);
      file.setDescription(`Product: ${productName} | Category: ${category} | Packaging: ${packagingType} | Angle: ${photo.angle || "N/A"}`);
    }
  } catch (err) {
    // If saving photos failed and folder was just created, trash it to avoid orphaned empty folders
    if (isNewFolder && submissionFolder) {
      submissionFolder.setTrashed(true);
    }
    throw new Error("Failed saving photos to Google Drive: " + err.message);
  }

  // 3. Log into Master Google Sheet in the root folder (Thread-safe)
  logToMasterSheet(rootFolder, {
    submissionId: submissionId,
    timestamp: timestampStr,
    category: category,
    packagingType: packagingType,
    productName: productName,
    manufacturer: manufacturer,
    regNumber: regNumber,
    packSize: packSize,
    condition: condition,
    angles: angles,
    photoCount: photos.length,
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

    const headers = [
      "Submission ID",
      "Timestamp (IST)",
      "Category",
      "Packaging Type",
      "Product Name",
      "Manufacturer",
      "Reg / Cert No",
      "Pack Size",
      "Condition",
      "Angles Captured",
      "Photo Count",
      "Drive Folder Link",
      "Notes"
    ];

    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.open(files.next());
      const sheet = spreadsheet.getActiveSheet();

      // Check if existing sheet has the "Packaging Type" column
      const lastCol = sheet.getLastColumn();
      if (lastCol >= 3) {
        const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        if (headerRow.indexOf("Packaging Type") === -1) {
          // Seamlessly insert Packaging Type after Category (Col 3)
          sheet.insertColumnAfter(3);
          const newCell = sheet.getRange(1, 4);
          newCell.setValue("Packaging Type");
          newCell.setFontWeight("bold");
          newCell.setBackground("#1B4332");
          newCell.setFontColor("#FFFFFF");
        }
      }
    } else {
      // Create new spreadsheet inside rootFolder
      spreadsheet = SpreadsheetApp.create(MASTER_SHEET_NAME);
      const sheetFile = DriveApp.getFileById(spreadsheet.getId());
      rootFolder.addFile(sheetFile);
      DriveApp.getRootFolder().removeFile(sheetFile);

      const sheet = spreadsheet.getActiveSheet();
      sheet.setName("Submissions");

      sheet.appendRow(headers);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1B4332");
      headerRange.setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }

    const sheet = spreadsheet.getActiveSheet();
    sheet.appendRow([
      sanitizeCell(entry.submissionId),
      sanitizeCell(entry.timestamp),
      sanitizeCell(entry.category),
      sanitizeCell(entry.packagingType),
      sanitizeCell(entry.productName),
      sanitizeCell(entry.manufacturer),
      sanitizeCell(entry.regNumber),
      sanitizeCell(entry.packSize),
      sanitizeCell(entry.condition),
      sanitizeCell(entry.angles),
      Number(entry.photoCount) || 0,
      sanitizeCell(entry.folderUrl),
      sanitizeCell(entry.notes)
    ]);

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
