/**
 * Agricultural Product Data Collector - Google Apps Script Backend
 * Folder ID: 11V6Coo-3MKs6ibvxqGfY4BXy8ZGPJf4I
 *
 * This script receives product photos & metadata from the field collection web app,
 * creates an organized subfolder inside your Google Drive, saves the photos,
 * and logs every submission to a master Google Sheet.
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
    message: "Field Data Collection API is ready to receive submissions."
  });
}

function handleSubmission(data) {
  const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
  const now = new Date();
  const timestampStr = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");
  const folderDateStr = Utilities.formatDate(now, "Asia/Kolkata", "yyyyMMdd_HHmmss");

  const category = data.category || "Uncategorized";
  const isNoise = category.toLowerCase().includes("noise") || category.toLowerCase().includes("not a product");
  const productName = (data.productName || (isNoise ? "Noise Sample" : "Unknown Product")).trim();
  const manufacturer = (data.manufacturer || "").trim();
  const regNumber = (data.regNumber || "").trim();
  const packSize = (data.packSize || "").trim();
  const condition = (data.condition || "").trim();
  const angles = Array.isArray(data.angles) ? data.angles.join(", ") : (data.angles || "");
  const notes = (data.notes || "").trim();
  const photos = data.photos || [];

  // Generate Unique Submission ID
  const submissionId = "SUB_" + folderDateStr + "_" + Math.floor(Math.random() * 899 + 100);

  // 1. Create Subfolder in Drive for this submission
  let subfolderName = "";
  if (isNoise) {
    subfolderName = `[NOISE] ${productName || "Negative_Sample"} (${folderDateStr})`;
  } else {
    const brandTag = manufacturer ? ` - ${manufacturer}` : "";
    subfolderName = `[${category}] ${productName}${brandTag} (${folderDateStr})`;
  }

  // Clean illegal characters in folder name
  subfolderName = subfolderName.replace(/[\\/:*?"<>|]/g, "_");
  const submissionFolder = rootFolder.createFolder(subfolderName);
  const folderUrl = submissionFolder.getUrl();

  // 2. Save each photo into the subfolder
  const savedPhotoUrls = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    let base64Data = photo.base64 || "";
    // Strip data URL prefix if present (e.g. data:image/jpeg;base64,)
    if (base64Data.indexOf(",") > -1) {
      base64Data = base64Data.split(",")[1];
    }

    const mimeType = photo.type || "image/jpeg";
    const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const angleTag = photo.angle ? `_${photo.angle.replace(/\s+/g, "")}` : `_photo${i + 1}`;
    const filename = `${submissionId}${angleTag}.${extension}`;

    const decodedBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
    const file = submissionFolder.createFile(decodedBlob);
    file.setDescription(`Product: ${productName} | Category: ${category} | Angle: ${photo.angle || "N/A"}`);
    savedPhotoUrls.push(file.getUrl());
  }

  // 3. Log into Master Google Sheet in the same folder
  const sheetUrl = logToMasterSheet(rootFolder, {
    submissionId: submissionId,
    timestamp: timestampStr,
    category: category,
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
    sheetUrl: sheetUrl,
    photoCount: photos.length
  };
}

function logToMasterSheet(rootFolder, entry) {
  let spreadsheet;
  const files = rootFolder.getFilesByName(MASTER_SHEET_NAME);

  if (files.hasNext()) {
    spreadsheet = SpreadsheetApp.open(files.next());
  } else {
    // Create new spreadsheet inside rootFolder
    spreadsheet = SpreadsheetApp.create(MASTER_SHEET_NAME);
    const sheetFile = DriveApp.getFileById(spreadsheet.getId());
    rootFolder.addFile(sheetFile);
    DriveApp.getRootFolder().removeFile(sheetFile); // keep it cleanly inside rootFolder

    const sheet = spreadsheet.getActiveSheet();
    sheet.setName("Submissions");

    // Header styling
    const headers = [
      "Submission ID",
      "Timestamp (IST)",
      "Category",
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
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1B4332");
    headerRange.setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }

  const sheet = spreadsheet.getActiveSheet();
  sheet.appendRow([
    entry.submissionId,
    entry.timestamp,
    entry.category,
    entry.productName,
    entry.manufacturer,
    entry.regNumber,
    entry.packSize,
    entry.condition,
    entry.angles,
    entry.photoCount,
    entry.folderUrl,
    entry.notes
  ]);

  return spreadsheet.getUrl();
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
