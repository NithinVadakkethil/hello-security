/**
 * Mobile Image Compression & Optimization Utility
 * Reduces large camera image data URLs to lightweight (~150KB - 250KB) payloads
 * maintaining clear evidence visibility while preventing network timeouts.
 */
export async function optimizeBase64Image(
  dataUrl: string,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.8,
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.length < 50000) {
    // If small or already compressed, return as is
    return dataUrl;
  }

  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : {};

  // If running in browser / WebView / Canvas environment
  if (globalObj.window && globalObj.window.document) {
    return new Promise(resolve => {
      const img = new globalObj.window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = globalObj.window.document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  return dataUrl;
}
