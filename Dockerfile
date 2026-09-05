# --- Build stage ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_VENICE_BASE_URL=
ARG VITE_VOICETUT_BASE_URL=
ENV VITE_VENICE_BASE_URL=$VITE_VENICE_BASE_URL \
    VITE_VOICETUT_BASE_URL=$VITE_VOICETUT_BASE_URL
RUN npm run build

# --- Runtime stage: tiny static server ---
FROM nginx:1.29.1-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN printf '%s\n' \
  'map $uri $openvenice_cache_control {' \
  '  default "";' \
  '  ~*\.(?:js|css|woff2?)$ "public, max-age=31536000, immutable";' \
  '  ~^(?:/|/index\.html|/sw\.js)$ "no-store, no-cache, must-revalidate";' \
  '  /manifest.webmanifest "no-cache, must-revalidate";' \
  '}' \
  'server {' \
  '  listen 8080;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  server_tokens off;' \
  '  gzip on; gzip_types text/plain application/javascript text/css application/json image/svg+xml;' \
  '  add_header Content-Security-Policy "default-src '\''self'\''; base-uri '\''self'\''; object-src '\''none'\''; frame-ancestors '\''none'\''; form-action '\''self'\''; script-src '\''self'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: blob:; media-src '\''self'\'' blob:; connect-src '\''self'\'' https: wss:; worker-src '\''self'\'' blob:" always;' \
  '  add_header X-Content-Type-Options "nosniff" always;' \
  '  add_header X-Frame-Options "DENY" always;' \
  '  add_header Referrer-Policy "no-referrer" always;' \
  '  add_header Permissions-Policy "camera=(), geolocation=(), payment=(), usb=()" always;' \
  '  add_header Cache-Control "$openvenice_cache_control" always;' \
  '  location = /healthz { default_type text/plain; add_header Cache-Control "no-store" always; return 200 "ok"; }' \
  '  location = / { try_files /index.html =404; }' \
  '  location / { try_files $uri $uri/ /index.html; }' \
  '}' > /etc/nginx/conf.d/default.conf && \
  sed -i 's#pid[[:space:]].*;#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf && \
  chown -R nginx:nginx /var/cache/nginx /var/run /usr/share/nginx/html
EXPOSE 8080
USER nginx
CMD ["nginx", "-g", "daemon off;"]
