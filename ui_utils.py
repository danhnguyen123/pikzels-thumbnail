"""Tiện ích dùng chung cho app Streamlit."""
import base64
import mimetypes
from io import BytesIO

import requests


def fetch_bytes(url: str) -> bytes:
    """Tải bytes ảnh từ URL (dùng cho preview + download)."""
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.content


def strip_metadata(data: bytes) -> bytes:
    """Loại bỏ toàn bộ metadata lạ (EXIF/XMP/ICC — vd 'Software: Pikzels',
    'AI-generated image...') bằng cách copy pixel sang ảnh mới rồi lưu PNG sạch."""
    try:
        from PIL import Image
        src = Image.open(BytesIO(data))
        src.load()
        clean = Image.new(src.mode, src.size)
        clean.paste(src)  # chỉ copy pixel, KHÔNG mang theo info/exif/xmp
        out = BytesIO()
        clean.save(out, format="PNG")  # PNG không có EXIF/XMP
        return out.getvalue()
    except Exception:
        # nếu Pillow lỗi, trả nguyên bản để không chặn tải
        return data


def bytes_to_data_url(data: bytes, mime: str = "image/jpeg") -> str:
    b64 = base64.b64encode(data).decode()
    return f"data:{mime};base64,{b64}"


def uploaded_to_data_url(uploaded_file) -> str:
    """st.file_uploader trả về UploadedFile -> data URL base64."""
    mime = uploaded_file.type or mimetypes.guess_type(uploaded_file.name)[0] or "image/jpeg"
    return bytes_to_data_url(uploaded_file.getvalue(), mime)


def resolve_image(uploaded=None, url=None):
    """Trả về dict kwargs cho helper: {'image_url': ...} hoặc {'image_base64': ...}.
    Ưu tiên upload; nếu không có thì dùng url. Trả {} nếu không có gì."""
    if uploaded is not None:
        return {"image_base64": uploaded_to_data_url(uploaded)}
    if url:
        return {"image_url": url.strip()}
    return {}


def resolve_support(uploaded=None, url=None):
    """Tương tự nhưng cho support_image_*."""
    if uploaded is not None:
        return {"support_image_base64": uploaded_to_data_url(uploaded)}
    if url:
        return {"support_image_url": url.strip()}
    return {}


def resolve_mask(uploaded=None, url=None):
    if uploaded is not None:
        return {"mask_base64": uploaded_to_data_url(uploaded)}
    if url:
        return {"mask_url": url.strip()}
    return {}


def mask_key(api_key: str) -> str:
    if not api_key or len(api_key) < 12:
        return "****"
    return f"{api_key[:8]}…{api_key[-4:]}"
