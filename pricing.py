"""Bảng giá Pikzels API (USD/request thành công).

Nguồn: https://app.pikzels.com/platform/pricing — cập nhật 2026-05-11.
Giá có thể đổi; chỉnh trực tiếp ở đây khi cần.
"""
PRICING = {
    "currency": "$",
    "updated": "2026-05-11",
    # tạo thumbnail từ text
    "thumbnail": {"pkz_2": 0.20, "pkz_3": 0.16, "pkz_4": 0.37, "pkz_4_5": 0.13},
    # tạo thumbnail từ ảnh (Recreate)
    "recreate": {"pkz_2": 0.20, "pkz_3": 0.18, "pkz_4": 0.36, "pkz_4_5": 0.13},
    "edit": 0.12,
    "score": 0.03,
    "titles": 0.08,
    "pikzonality": 0.38,  # Style / Persona Training
}
