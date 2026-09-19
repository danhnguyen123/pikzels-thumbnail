# Pikzels Studio

Công cụ tạo thumbnail YouTube qua [Pikzels API v2](https://docs.pikzels.com/): tạo từ text/image,
edit/inpaint, score, sinh titles, huấn luyện + quản lý persona/style.

Có **2 giao diện** (dùng chung backend `pikzels_helper.py` + `registry.py`):
- **Web app (khuyên dùng)** — FastAPI + React (Vite), UI đẹp, tạo ảnh real-time qua WebSocket, không khóa UI.
- App Streamlit cũ (`app.py`) — đơn giản hơn.

## Cài đặt
```bash
pip install -r requirements.txt
```
API key: tạo `pikzels_env.py` với `API_KEY = "pkz_..."` (đã .gitignore) hoặc đặt env `PIKZELS_API_KEY`.

Frontend (chỉ cần khi build lại giao diện):
```bash
cd webui
npm install
npm run build     # tạo webui/dist để FastAPI serve
```

## Chạy web app (1 tiến trình)
```bash
python server.py
```
Mở http://localhost:8000 — FastAPI vừa chạy API vừa serve bản build React.

### Dev mode (hot-reload frontend)
```bash
python -m uvicorn server:app --reload --port 8000
cd webui; npm run dev        # cửa sổ khác → http://localhost:5173 (proxy /api, /ws sang :8000)
```

## Kiến trúc
```
server.py         FastAPI: REST /api/* + WebSocket /ws/generate (batch, stream tiến trình)
pikzels_helper.py PikzelsClient — bọc toàn bộ Pikzels API v2
registry.py       Lưu local persona/style (+ versioning instructions) & lịch sử ảnh
ui_utils.py       Tiện ích (base64, fetch bytes, mask key)
webui/            React + Vite + Tailwind (SPA) → build ra webui/dist
app.py            (tùy chọn) app Streamlit cũ
```

## Tính năng
- **Create**: text/image → thumbnail, chọn model/format/persona/style, **tạo 1–10 ảnh** với lưới
  loading real-time, Download + Score mỗi ảnh, lưu tất cả vào folder Windows.
- **Edit**: sửa/inpaint (mask + support image).
- **Score**: main_score + 5 subscores + gợi ý.
- **Titles**: sinh tiêu đề từ prompt và/hoặc ảnh (YouTube URL được).
- **Personas/Styles**: train từ 3 ảnh (upload/URL), poll trạng thái, **versioning** special
  instructions (lịch sử + khôi phục), delete.

## Lưu trữ local (SQLite)
- `output/` — ảnh đã lưu (link Pikzels hết hạn sau 24h).
- `data/pikzels.db` — **SQLite** (WAL): bảng `pikzonalities`, `instruction_versions`, `history`.
  Cột `TEXT` cho prompt/instructions dài (không giới hạn thực tế). An toàn ghi đồng thời (ACID).
- `data/pikzonalities.json`, `data/history.json` — file JSON cũ, chỉ giữ làm **backup**; lần đầu
  chạy `registry.py` tự import sang `.db` (không mất dữ liệu). Có thể xoá sau khi đã kiểm tra.
