# AuraBeat: phone app + backend in one image. The backend serves the built app, so phones need one
# address and the live connection is same-origin (wss:// behind HTTPS).

# 1. Build the phone app
FROM node:22-alpine AS web
WORKDIR /web
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . ./
RUN npm run build

# 2. Backend
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=web /web/dist ./frontend_dist
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8001/health',timeout=2)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "*"]
