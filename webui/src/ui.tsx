import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Upload } from "lucide-react";
import { cn } from "./lib";

export function Button({
  variant = "ghost", className, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return <button className={cn("btn", variant === "primary" ? "btn-primary" : "btn-ghost", className)} {...p} />;
}

export function Field({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      {label && <label className="label">{label}</label>}
      {children}
    </div>
  );
}

export const Input = ({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn("input", className)} {...p} />
);

export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn("input resize-y", className)} {...p} />
);

export function Select({ options, className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select className={cn("input", className)} {...p}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card p-4", className)}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-transparent", className)} />
  );
}

export function Chip({ tone = "muted", children }: { tone?: "muted" | "green" | "amber" | "red"; children: React.ReactNode }) {
  const map = {
    muted: "bg-border text-muted",
    green: "bg-emerald-500/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-400",
    red: "bg-red-500/15 text-red-400",
  } as const;
  return <span className={cn("chip", map[tone])}>{children}</span>;
}

// ---- Toast ----
type Toast = { id: number; msg: string; tone: "info" | "error" | "success" };
const ToastCtx = createContext<(msg: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn(
            "card px-4 py-3 text-sm shadow-lg max-w-sm",
            t.tone === "error" && "border-red-500/40 text-red-300",
            t.tone === "success" && "border-emerald-500/40 text-emerald-300"
          )}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// upload ảnh: nút styled + icon (thay emoji)
export function FileButton({
  onFiles, multiple, label = "Chọn ảnh", className,
}: { onFiles: (f: File[]) => void; multiple?: boolean; label?: string; className?: string }) {
  return (
    <label className={cn("btn btn-ghost cursor-pointer text-sm", className)}>
      <Upload size={15} /> {label}
      <input type="file" accept="image/*" multiple={multiple} className="hidden"
        onChange={(e) => onFiles(Array.from(e.target.files || []))} />
    </label>
  );
}

// Lightbox: xem phóng to/thu nhỏ ảnh, có nút Close
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const dz = (d: number) => setZoom((z) => Math.min(5, Math.max(0.2, +(z + d).toFixed(2))));
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
      onClick={onClose}>
      <div className="flex items-center justify-end gap-2 p-3" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-ghost !py-1.5" onClick={() => dz(-0.25)}><ZoomOut size={16} /></button>
        <span className="text-sm text-muted w-14 text-center">{Math.round(zoom * 100)}%</span>
        <button className="btn btn-ghost !py-1.5" onClick={() => dz(0.25)}><ZoomIn size={16} /></button>
        <button className="btn btn-ghost !py-1.5" onClick={() => setZoom(1)}><RotateCcw size={16} /></button>
        <button className="btn btn-primary !py-1.5" onClick={onClose}><X size={16} /> Close</button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4"
        onWheel={(e) => dz(e.deltaY > 0 ? -0.1 : 0.1)}>
        <img src={src} style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-none transition-transform select-none cursor-default" />
      </div>
    </div>
  );
}
