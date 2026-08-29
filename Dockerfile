# --- Build stage ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_VENICE_BASE_URL=
ENV VITE_VENICE_BASE_URL=$VITE_VENICE_BASE_URL
RUN npm run build

# --- Runtime stage: tiny static server ---
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  gzip on; gzip_types text/plain application/javascript text/css application/json image/svg+xml;' \
  '  location = /index.html {' \
  '    add_header Cache-Control "public, max-age=21600, must-revalidate";' \
  '  }' \
  '  location = /manifest.webmanifest {' \
  '    add_header Cache-Control "public, max-age=21600, must-revalidate";' \
  '  }' \
  '  location / { try_files $uri $uri/ /index.html; }' \
  '  location ~* \.(?:js|css|woff2?)$ { expires 1y; add_header Cache-Control "public, immutable"; }' \
  '}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
