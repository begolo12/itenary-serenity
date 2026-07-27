const MAX_PHOTO_BYTES = 300 * 1024;
const MAX_DIMENSION = 1600;
const MIN_DIMENSION = 320;

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Browser tidak dapat mengompres gambar ini."));
      }
    }, "image/webp", quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca foto hasil kompresi."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const source = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(source);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("Format foto tidak didukung. Gunakan JPG, PNG, atau WebP."));
    };
    image.src = source;
  });
}

/**
 * Produces a WebP data URL small enough for a single Firestore document.
 */
export async function compressPhotoForFirestore(file) {
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    throw new Error("Pilih file gambar terlebih dahulu.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  let width = Math.max(MIN_DIMENSION, Math.round(image.width * scale));
  let height = Math.max(MIN_DIMENSION, Math.round(image.height * scale));

  for (let resizeAttempt = 0; resizeAttempt < 8; resizeAttempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);

    for (let quality = 0.86; quality >= 0.4; quality -= 0.08) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= MAX_PHOTO_BYTES) {
        return {
          photoData: await blobToDataUrl(blob),
          mimeType: "image/webp",
          sizeBytes: blob.size,
          width,
          height,
        };
      }
    }

    width = Math.max(MIN_DIMENSION, Math.round(width * 0.8));
    height = Math.max(MIN_DIMENSION, Math.round(height * 0.8));
  }

  throw new Error("Foto tidak dapat dikompres hingga 300 KB. Pilih foto lain.");
}
