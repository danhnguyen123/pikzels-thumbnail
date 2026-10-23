export function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Resize + nén ảnh trước khi gửi (ảnh >~1.5MB làm Pikzels rớt kết nối -> "request invalid").
// Trả JPEG data URL, tối đa `maxDim` px. Fallback về fileToDataUrl nếu không decode được.
export function imageToDataUrl(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (Math.max(w, h) > maxDim) {
        const s = maxDim / Math.max(w, h);
        w = Math.round(w * s); h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { fileToDataUrl(file).then(resolve); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); fileToDataUrl(file).then(resolve); };
    img.src = url;
  });
}

// Ảnh Pikzels hết hạn 24h + có thể vướng CORS → luôn qua proxy backend.
export function imgSrc(url: string) {
  return `/api/image?url=${encodeURIComponent(url)}`;
}
