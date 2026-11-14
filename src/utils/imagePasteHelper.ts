/**
 * Reads an image File or Blob (e.g. from Clipboard paste event or file input)
 * and compresses/resizes it to a lightweight Data URL so it syncs rapidly
 * to Cloud Firestore and across all devices.
 */
export async function fileOrBlobToCompressedDataUrl(
  fileOrBlob: File | Blob,
  maxWidth = 960,
  maxHeight = 720,
  quality = 0.82
): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Không thể đọc dữ liệu hình ảnh.'));
    };
    reader.onerror = () => reject(new Error('Lỗi khi đọc hình ảnh từ bộ nhớ tạm.'));
    reader.readAsDataURL(fileOrBlob);
  });

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.fillStyle = '#FAF3E3';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

/**
 * Extracts an image from a React ClipboardEvent if present.
 */
export async function extractImageFromClipboardEvent(
  e: React.ClipboardEvent
): Promise<string | null> {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) {
        return fileOrBlobToCompressedDataUrl(blob);
      }
    }
  }
  return null;
}
