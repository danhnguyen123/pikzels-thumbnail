# ---- Build stage: dựng frontend (Vite -> webui/dist) ----
FROM node:20-bookworm-slim AS build
WORKDIR /app/webui
COPY webui/package.json webui/package-lock.json ./
RUN npm ci
COPY webui/ ./
RUN npm run build

# ---- Runtime stage: FastAPI (uvicorn) + serve dist ----
FROM python:3.12-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 \
    APP_HOST=0.0.0.0 \
    APP_PORT=8000 \
    DATA_DIR=/app/data \
    OUTPUT_DIR=/app/output
WORKDIR /app

# Python deps (pillow/uvicorn có wheel sẵn cho amd64 & arm64 -> không cần apt build-deps).
COPY requirements-web.txt ./
RUN pip install --no-cache-dir -r requirements-web.txt

# Mã nguồn backend
COPY server.py registry.py pikzels_helper.py ui_utils.py pricing.py ./
# Bản build frontend từ stage trước
COPY --from=build /app/webui/dist ./webui/dist

# Thư mục ghi runtime (mount volume ra host trong compose)
RUN mkdir -p /app/data /app/output

EXPOSE 8000
CMD ["python", "server.py"]
