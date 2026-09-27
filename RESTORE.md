# Khôi phục dữ liệu (Personas/Styles + Gallery) sang server bằng copy DB

DB SQLite là **nguồn dữ liệu duy nhất** (không dùng JSON). Chỉ cần copy file `pikzels.db` từ
local lên server là khôi phục xong Personas/Styles; copy thêm ảnh để có Gallery.

## 1) Tạo bản DB cho server (chạy LOCAL)

Đóng app local trước (cho DB "sạch"), rồi:

```powershell
python scripts/prepare_server_db.py
```

Script sẽ tạo:
- `backup/server/data/pikzels.db` — DB đã **sửa `local_path` sang đường dẫn server**
  (`/mnt/media/package-studio/output/<file>`).
- `backup/server/output/*.png` — các ảnh Gallery để đẩy lên.

> Nếu đường dẫn output trên server khác, truyền vào:
> `python scripts/prepare_server_db.py /duong/dan/output/khac`

## 2) Copy lên Oracle Volume

```bash
# DB (đủ để khôi phục Personas/Styles)
scp backup/server/data/pikzels.db  ubuntu@<server>:/mnt/media/package-studio/data/pikzels.db

# (tuỳ chọn) ảnh Gallery — copy thì Gallery mới có ảnh, không copy thì rows vẫn còn nhưng ảnh "missing"
scp -r backup/server/output/.      ubuntu@<server>:/mnt/media/package-studio/output/
```

Nên **dừng container trước khi ghi đè DB** để tránh xung đột:
```bash
ssh ubuntu@<server> 'cd /opt/package-studio && docker compose down'
# ... chạy 2 lệnh scp ở trên ...
ssh ubuntu@<server> 'cd /opt/package-studio && docker compose up -d'
```

## 3) Xong
Mở web → Personas/Styles có lại, Gallery có lại ảnh (nếu đã copy output).

---

⚠️ **Copy DB = GHI ĐÈ toàn bộ** DB trên server (mất dữ liệu đã tạo trên server, nếu có).
Chỉ dùng khi server đang trống hoặc bạn muốn thay hẳn bằng dữ liệu local.
Muốn **gộp** (giữ cả hai) thì cần cách khác — hỏi để mình hỗ trợ.
