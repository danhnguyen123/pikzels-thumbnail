# Deploy Package Studio lên Ubuntu (Oracle Cloud) bằng Docker + GitHub Actions

Repo: `git@github.com:danhnguyen123/pikzels-thumbnail.git`
Server: Oracle Cloud, Ubuntu (ARM aarch64 hoặc amd64), đã cài Docker.
Dữ liệu lưu trên **Oracle Block Volume** mount tại `/mnt/media` → subfolder `/mnt/media/package-studio`.

Kiến trúc: container **FastAPI (uvicorn) + React (dist)**. Việc tạo ảnh gọi API Pikzels bên ngoài,
nên container nhẹ, không cần máy mạnh.

---

## 0) Luồng CI/CD

```
push main ─► GitHub Actions ─► build-test (docker build + smoke /api/config)
                              ─SSH─► server: git pull → docker build → docker compose up -d → prune
```
- Build **native trên server** (không cần registry/buildx/QEMU).
- `.env` **không bao giờ** vào Git hay image — chỉ tồn tại trên server.
- Web mở ra **public IP:port** → **BẮT BUỘC bật Basic Auth** + mở firewall.

---

## 1) Chuẩn bị server (làm 1 lần) — dùng user `ubuntu` mặc định

```bash
# thêm ubuntu vào group docker (để chạy docker không cần sudo)
sudo usermod -aG docker ubuntu
# đăng xuất/đăng nhập lại (hoặc: newgrp docker), rồi test:
docker ps    # chạy được không cần sudo là OK

# thư mục app
sudo mkdir -p /opt/package-studio && sudo chown ubuntu:ubuntu /opt/package-studio

# thư mục dữ liệu bền trên Block Volume
sudo mkdir -p /mnt/media/package-studio/data /mnt/media/package-studio/output
sudo chown -R ubuntu:ubuntu /mnt/media/package-studio

# clone repo (deploy key read-only, xem mục 5)
git clone git@github.com:danhnguyen123/pikzels-thumbnail.git /opt/package-studio
```

## 2) Tạo `.env` trên server (secrets — chống rò rỉ key)

```bash
# copy từ máy bạn lên (KHÔNG commit .env)
scp .env ubuntu@<server>:/opt/package-studio/.env
ssh ubuntu@<server> 'chmod 600 /opt/package-studio/.env'
```

`.env` chỉ cần secrets + Basic Auth (mọi giá trị production đã nằm trong `.env.production` của repo):

```dotenv
PIKZELS_API_KEY=pkz_xxx
APP_BASIC_AUTH_USER=admin
APP_BASIC_AUTH_PASS=<mật-khẩu-mạnh-ngẫu-nhiên>
# (tuỳ chọn) cổng public lạ để giảm quét:
PUBLISH_PORT=8137
```

**Bảo mật (quan trọng khi mở public):**
- `.env`, `pikzels_env.py` đã nằm trong `.gitignore` **và** `.dockerignore` → không vào Git/image.
- **Bật Basic Auth**: nếu bỏ trống, ai biết IP:port cũng gọi được API → **đốt credit Pikzels của bạn**.
  Server in cảnh báo khi chưa bật.
- Toàn bộ key chỉ ở backend; **không** đặt biến bắt đầu bằng `VITE_` (sẽ lộ xuống frontend).
- `.env` để quyền `600`, thuộc user `deploy`.
- Nếu key từng lỡ commit → **rotate** ngay ở app.pikzels.com/platform.

## 3) Mở firewall + chạy lần đầu

Mở cổng (mặc định `8000`, hoặc `PUBLISH_PORT` bạn chọn) ở **2 nơi**:

1. **Oracle Cloud** → VCN → Security List/NSG của subnet → Ingress Rule:
   Source `0.0.0.0/0`, TCP, Destination Port = cổng đó.
2. **ufw trên VM** (nếu bật):
   ```bash
   sudo ufw allow 8137/tcp
   ```
   > Oracle Ubuntu còn iptables mặc định — nếu vẫn không vào được:
   > `sudo iptables -I INPUT -p tcp --dport 8137 -j ACCEPT && sudo netfilter-persistent save`

Chạy:
```bash
ssh ubuntu@<server>
cd /opt/package-studio
docker build --network=host -t package-studio:latest .
docker compose up -d
docker compose logs -f
```

Mở trình duyệt: `http://<PUBLIC_IP>:<PUBLISH_PORT>` → nhập user/mật khẩu Basic Auth.

## 4) Bật CI/CD tự động

GitHub repo → **Settings → Secrets and variables → Actions** thêm:

| Secret | Giá trị |
|---|---|
| `SSH_HOST` | IP/hostname server |
| `SSH_USER` | `ubuntu` |
| `SSH_KEY`  | private key SSH bạn đang dùng để đăng nhập server (khớp `~/.ssh/authorized_keys` của ubuntu) |
| `SSH_PORT` | (tuỳ chọn) mặc định 22 |

Server cần **deploy key read-only** để `git pull` từ GitHub (khác với key đăng nhập server):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""    # chạy dưới user ubuntu
cat ~/.ssh/id_ed25519.pub
# thêm nội dung .pub vào GitHub repo → Settings → Deploy keys (Read only)
```

Từ đó, mỗi lần `push` lên `main`/`master`: `.github/workflows/deploy.yml` tự SSH vào server,
`git pull` → `docker build` → `docker compose up -d` → dọn image cũ.

---

## 5) Test Docker ở LOCAL trước (tuỳ chọn, cần Docker Desktop)

```powershell
Copy-Item docker-compose.override.yml.example docker-compose.override.yml
# tạo .env với PIKZELS_API_KEY (Basic Auth có thể để trống khi test local)
docker compose up --build
# mở http://localhost:8000
```
`docker-compose.override.yml` ghi đè volume sang `./data-host` (khỏi cần /mnt/media).

---

## 6) Dọn dẹp, tránh phình disk

- `node_modules` chỉ nằm trong **build stage** (không vào image runtime).
- Multi-stage: image runtime chỉ có Python deps + `dist`.
- `.dockerignore` không copy `node_modules`/`dist`/`data`/`output` vào build context.
- Log container giới hạn 10MB×3.

```bash
docker image prune -f          # xoá image dangling (CI tự chạy)
docker builder prune -af       # xoá build cache
docker system df               # xem dung lượng
```
Ảnh Gallery cũ nằm ở `/mnt/media/package-studio/output` — xoá trong app (nút Delete) hoặc thủ công.

Cron dọn hằng tuần:
```bash
( crontab -l 2>/dev/null; echo '0 3 * * 0 docker image prune -f; docker builder prune -af' ) | crontab -
```
> Tránh `docker system prune --volumes` khi container đang chạy.

---

## Xử lý sự cố

**Build lỗi DNS** (`Temporary failure resolving 'deb.debian.org'` / `registry-1.docker.io`):
`RUN` không phân giải được DNS. Đã xử lý bằng `docker build --network=host`. Hoặc set DNS daemon:
```bash
echo '{ "dns": ["8.8.8.8"] }' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

**`docker compose up` lỗi iptables** (`Failed to Setup IP tables ...`):
```bash
sudo systemctl restart docker && cd /opt/package-studio && docker compose up -d
# vẫn lỗi: sudo reboot
```

**Vào web không được qua public IP:**
- App phải nghe `0.0.0.0` (đã set `APP_HOST=0.0.0.0` trong `.env.production`).
- Mở cổng ở **cả** Oracle Security List **và** `ufw`/iptables.
- `docker compose ps` / `docker compose logs` để xem lỗi.

**Mất dữ liệu sau rebuild:** kiểm tra volume `/mnt/media/package-studio/{data,output}` có tồn tại và
đúng quyền `deploy`; `docker compose config` xem mount có đúng không.
