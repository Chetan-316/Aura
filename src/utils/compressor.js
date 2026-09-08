/**
 * Client-side Image Compressor for Field Data Collection
 * Resizes large smartphone camera photos (5-12MB) to crisp, ML-ready ~1600px JPEGs (~350-600KB)
 * Keeps barcodes and chemical text sharp while slashing upload payload by 85-90%.
 */

export async function compressImage(file, maxDimension = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("File is not a valid image"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));

    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image element"));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale if dimensions exceed maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        // High quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to optimized JPEG
        const mimeType = "image/jpeg";
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64Content = dataUrl.split(",")[1];

        // Approximate byte size of base64
        const compressedSizeBytes = Math.round((base64Content.length * 3) / 4);

        resolve({
          id: "photo_" + Math.random().toString(36).substring(2, 9),
          originalName: file.name,
          originalSize: file.size,
          compressedSize: compressedSizeBytes,
          width: width,
          height: height,
          mimeType: mimeType,
          dataUrl: dataUrl,
          base64: base64Content,
          angle: "" // will be assigned or picked by user
        });
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
