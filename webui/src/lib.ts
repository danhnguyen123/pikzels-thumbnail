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

// Ảnh Pikzels hết hạn 24h + có thể vướng CORS → luôn qua proxy backend.
export function imgSrc(url: string) {
  return `/api/image?url=${encodeURIComponent(url)}`;
}
