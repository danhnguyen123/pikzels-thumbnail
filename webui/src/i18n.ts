import { makeStore } from "./store";

export type Lang = "en" | "vi";

const dict: Record<Lang, Record<string, string>> = {
  en: {
    // nav / common
    "nav.create": "Create", "nav.edit": "Edit", "nav.score": "Score",
    "nav.titles": "Titles", "nav.personas": "Personas/Styles", "nav.api": "API Management",
    "nav.gallery": "Gallery",
    "gal.title": "Gallery", "gal.all": "All", "gal.style": "Style", "gal.persona": "Persona",
    "gal.reference": "Reference", "gal.loaded": "Loaded {n}/{total}", "gal.loading": "Loading...",
    "gal.empty": "No saved images yet — save images from the Create/Edit tabs.",
    "gal.refUsed": "Image set as reference in Create.",
    "gal.favOnly": "Favorites", "gal.from": "From", "gal.to": "To", "gal.clear": "Clear",
    "gal.score": "Score", "gal.missing": "image missing",
    "gal.delete": "Delete", "gal.deleteN": "Delete ({n})", "gal.confirmDel": "Delete {n} image(s)?",
    "gal.selectAll": "Select all", "gal.clearSel": "Clear", "gal.cancel": "Cancel",
    "common.docs": "Docs",
    "common.noKeyWarn": "API key not configured — open the API Management tab.",
    "common.upload": "Upload image", "common.download": "Download", "common.copy": "Copy",
    "common.delete": "Delete", "common.refresh": "Refresh", "common.preview": "Preview",
    "common.promptCompacted": "prompt was shortened",
    // create
    "create.title": "Create thumbnail", "create.model": "Model", "create.format": "Format",
    "create.count": "Quantity", "create.prompt": "Prompt", "create.promptPh": "Describe the thumbnail...",
    "create.chars": "{n} characters", "create.willTrim": " — will be shortened (>750)!",
    "create.psOnly": "Persona/Style only for pkz_4 / pkz_4_5.",
    "create.persona": "Persona", "create.style": "Style",
    "create.support": "Reference image (support image, pkz_4/4_5)",
    "create.supportUrlPh": "Support image URL (YouTube watch OK)",
    "create.srcImage": "Source image (URL)", "create.srcImagePh": "https://... or a YouTube watch URL",
    "create.generate": "Create {n} image(s)", "create.generating": "Generating...",
    "create.results": "Results ({done}/{total})",
    "create.folder": "Save folder (Windows, empty = output/)", "create.saveAll": "Save all",
    "create.genItem": "Generating #{n}",
    "create.savedN": "Saved {n} image(s).",
    "create.needPrompt": "Prompt required.", "create.needSource": "Source image required (upload or URL).",
    "create.wsError": "WebSocket error.",
    "create.resultsN": "Today's images ({n})", "create.clear": "Clear list", "create.generatingCount": "generating",
    // edit
    "edit.title": "Edit / inpaint", "edit.srcUrl": "Source image (URL)", "edit.srcImage": "Source image",
    "edit.promptEdit": "Edit prompt",
    "edit.maskSupport": "Mask (inpaint) + support image (optional)",
    "edit.maskUrlPh": "Mask URL", "edit.supportUrlPh": "Support image URL",
    "edit.run": "Edit", "edit.running": "Editing...", "edit.needSource": "Source image required.",
    // score
    "score.title": "Score thumbnail", "score.imageUrl": "Image (URL)", "score.image": "Image",
    "score.titleOpt": "Title (optional)", "score.run": "Score", "score.running": "Scoring...",
    "score.needImage": "Image required (URL or upload).",
    // titles
    "titles.title": "Generate titles", "titles.promptLabel": "Prompt / video description",
    "titles.refImage": "Reference image (URL, YouTube OK)", "titles.run": "Generate titles",
    "titles.running": "Generating...", "titles.reasoning": "Reasoning", "titles.copied": "Copied.",
    "titles.needInput": "Prompt or image required.",
    // personas
    "pk.title": "Persona / Style", "pk.createNew": "Create new (exactly 3 images)",
    "pk.name": "Name (1-25 chars)", "pk.urls": "3 image URLs (one per line)",
    "pk.upload3": "Upload 3 images", "pk.nSelected": "{n} images selected",
    "pk.instr": "Special instructions (optional)", "pk.train": "Train", "pk.sending": "Sending...",
    "pk.list": "List", "pk.empty": "No persona/style yet.",
    "pk.instrLabel": "Special instructions", "pk.saveVersion": "Save (new version)",
    "pk.history": "History ({n})", "pk.restore": "Restore this version",
    "pk.restoredFrom": "restored from v{n}", "pk.empty2": "(empty)",
    "pk.need3": "Exactly 3 images required (upload or URL).", "pk.needName": "Name required.",
    "pk.created": "Created — click Refresh to update.", "pk.updated": "Updated + version saved.",
    "pk.restored": "Restored.",
    // api
    "api.title": "API Management", "api.loaded": "API key loaded", "api.key": "API key",
    "api.baseUrl": "Base URL", "api.test": "Test connection", "api.testing": "Testing...",
    "api.ok": "Connection OK.", "api.noKey": "API key not configured",
    "api.help": "Create a pikzels_env.py file with API_KEY = \"pkz_...\" or set the PIKZELS_API_KEY environment variable, then restart the server.",
  },
  vi: {
    "nav.create": "Tạo", "nav.edit": "Chỉnh sửa", "nav.score": "Chấm điểm",
    "nav.titles": "Tiêu đề", "nav.personas": "Persona/Style", "nav.api": "Quản lý API",
    "nav.gallery": "Thư viện",
    "gal.title": "Thư viện", "gal.all": "Tất cả", "gal.style": "Style", "gal.persona": "Persona",
    "gal.reference": "Tham chiếu", "gal.loaded": "Đã tải {n}/{total}", "gal.loading": "Đang tải...",
    "gal.empty": "Chưa có ảnh đã lưu — hãy lưu ảnh ở tab Tạo/Chỉnh sửa.",
    "gal.refUsed": "Đã đặt ảnh làm reference ở tab Tạo.",
    "gal.favOnly": "Yêu thích", "gal.from": "Từ", "gal.to": "Đến", "gal.clear": "Xoá",
    "gal.score": "Điểm", "gal.missing": "ảnh không còn",
    "gal.delete": "Xoá", "gal.deleteN": "Xoá ({n})", "gal.confirmDel": "Xoá {n} ảnh?",
    "gal.selectAll": "Chọn hết", "gal.clearSel": "Bỏ chọn", "gal.cancel": "Huỷ",
    "common.docs": "Tài liệu",
    "common.noKeyWarn": "Chưa nạp API key — vào tab Quản lý API.",
    "common.upload": "Upload ảnh", "common.download": "Tải", "common.copy": "Copy",
    "common.delete": "Xoá", "common.refresh": "Làm mới", "common.preview": "Xem",
    "common.promptCompacted": "prompt bị rút gọn",
    "create.title": "Tạo thumbnail", "create.model": "Model", "create.format": "Format",
    "create.count": "Số lượng", "create.prompt": "Prompt", "create.promptPh": "Mô tả thumbnail...",
    "create.chars": "{n} ký tự", "create.willTrim": " — sẽ bị rút gọn (>750)!",
    "create.psOnly": "Persona/Style chỉ dùng với pkz_4 / pkz_4_5.",
    "create.persona": "Persona", "create.style": "Style",
    "create.support": "Ảnh tham chiếu (support image, pkz_4/4_5)",
    "create.supportUrlPh": "Support image URL (YouTube watch cũng được)",
    "create.srcImage": "Ảnh gốc (URL)", "create.srcImagePh": "https://... hoặc YouTube watch URL",
    "create.generate": "Tạo {n} ảnh", "create.generating": "Đang tạo...",
    "create.results": "Kết quả ({done}/{total})",
    "create.folder": "Folder lưu (Windows, để trống = output/)", "create.saveAll": "Lưu tất cả",
    "create.genItem": "Đang tạo #{n}",
    "create.savedN": "Đã lưu {n} ảnh.",
    "create.needPrompt": "Cần prompt.", "create.needSource": "Cần ảnh gốc (upload hoặc URL).",
    "create.wsError": "WebSocket lỗi.",
    "create.resultsN": "Ảnh hôm nay ({n})", "create.clear": "Xoá danh sách", "create.generatingCount": "đang tạo",
    "edit.title": "Chỉnh sửa / inpaint", "edit.srcUrl": "Ảnh gốc (URL)", "edit.srcImage": "Ảnh nguồn",
    "edit.promptEdit": "Prompt sửa",
    "edit.maskSupport": "Mask (inpaint) + support image (tùy chọn)",
    "edit.maskUrlPh": "Mask URL", "edit.supportUrlPh": "Support image URL",
    "edit.run": "Sửa", "edit.running": "Đang sửa...", "edit.needSource": "Cần ảnh gốc.",
    "score.title": "Chấm điểm thumbnail", "score.imageUrl": "Ảnh (URL)", "score.image": "Ảnh",
    "score.titleOpt": "Title (tùy chọn)", "score.run": "Chấm điểm", "score.running": "Đang chấm...",
    "score.needImage": "Cần ảnh (URL hoặc upload).",
    "titles.title": "Sinh tiêu đề", "titles.promptLabel": "Prompt / mô tả video",
    "titles.refImage": "Ảnh tham chiếu (URL, YouTube được)", "titles.run": "Sinh titles",
    "titles.running": "Đang sinh...", "titles.reasoning": "Reasoning", "titles.copied": "Đã copy.",
    "titles.needInput": "Cần prompt hoặc ảnh.",
    "pk.title": "Persona / Style", "pk.createNew": "Tạo mới (cần đúng 3 ảnh)",
    "pk.name": "Tên (1-25 ký tự)", "pk.urls": "3 URL ảnh (mỗi dòng 1)",
    "pk.upload3": "Upload 3 ảnh", "pk.nSelected": "{n} ảnh đã chọn",
    "pk.instr": "Special instructions (tùy chọn)", "pk.train": "Train", "pk.sending": "Đang gửi...",
    "pk.list": "Danh sách", "pk.empty": "Chưa có persona/style.",
    "pk.instrLabel": "Special instructions", "pk.saveVersion": "Lưu (tạo version)",
    "pk.history": "Lịch sử ({n})", "pk.restore": "Khôi phục bản này",
    "pk.restoredFrom": "khôi phục từ v{n}", "pk.empty2": "(trống)",
    "pk.need3": "Cần đúng 3 ảnh (upload hoặc URL).", "pk.needName": "Cần tên.",
    "pk.created": "Đã tạo — bấm Làm mới để cập nhật.", "pk.updated": "Đã cập nhật + lưu version.",
    "pk.restored": "Đã khôi phục.",
    "api.title": "Quản lý API", "api.loaded": "Đã nạp API key", "api.key": "API key",
    "api.baseUrl": "Base URL", "api.test": "Test kết nối", "api.testing": "Đang kiểm tra...",
    "api.ok": "Kết nối OK.", "api.noKey": "Chưa nạp API key",
    "api.help": "Tạo file pikzels_env.py với API_KEY = \"pkz_...\" hoặc đặt biến môi trường PIKZELS_API_KEY, rồi khởi động lại server.",
  },
};

const saved = (localStorage.getItem("lang") as Lang) || "vi";
export const langStore = makeStore<{ lang: Lang }>({ lang: saved });

export function setLang(l: Lang) {
  localStorage.setItem("lang", l);
  langStore.set({ lang: l });
}

export function useI18n() {
  const { lang } = langStore.use();
  const t = (key: string, vars?: Record<string, string | number>) => {
    let str = dict[lang][key] ?? dict.en[key] ?? key;
    if (vars) for (const k in vars) str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    return str;
  };
  return { t, lang, setLang };
}
