# --- Build stage ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_VENICE_BASE_URL=
ARG VITE_VOICETUT_BASE_URL=/voicetut
ENV VITE_VENICE_BASE_URL=$VITE_VENICE_BASE_URL \
    VITE_VOICETUT_BASE_URL=$VITE_VOICETUT_BASE_URL
RUN npm run build

# --- Runtime stage: static site + credential-isolating VoiceTut proxy ---
FROM nginx:1.29.1-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/nginx.conf.template
RUN sed -i 's#pid[[:space:]].*;#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /var/cache/nginx /var/run /usr/share/nginx/html
USER nginx
CMD ["sh", "-c", "PORT_VALUE=$(printf '%s' \"${PORT:-8080}\" | tr -d '[:space:]'); case \"$PORT_VALUE\" in ''|*[!0-9]*) echo 'PORT must resolve to a numeric TCP port' >&2; exit 1;; esac; VOICE_KEY=$(printf '%s' \"$VOICETUT_API_KEY\" | tr -d '[:space:]'); VOICE_KEY=${VOICE_KEY#VOICETUT_API_KEYS=}; VOICE_KEY=${VOICE_KEY#VOICETUT_API_KEY=}; VOICE_KEY=$(printf '%s' \"$VOICE_KEY\" | sed 's/^\"//;s/\"$//'); case \"$VOICE_KEY\" in ''|*[!A-Za-z0-9_-]*) echo 'VOICETUT_API_KEY must resolve to a non-empty URL-safe token' >&2; exit 1;; esac; case \"$VOICETUT_UPSTREAM\" in https://*.api.runpod.ai) ;; *) echo 'VOICETUT_UPSTREAM must be an HTTPS RunPod API host' >&2; exit 1;; esac; sed -e \"s|__PORT__|$PORT_VALUE|g\" -e \"s|__VOICETUT_UPSTREAM__|$VOICETUT_UPSTREAM|g\" -e \"s|__VOICETUT_API_KEY__|$VOICE_KEY|g\" /etc/nginx/nginx.conf.template > /tmp/openvenice-nginx.conf && chmod 600 /tmp/openvenice-nginx.conf && exec nginx -c /tmp/openvenice-nginx.conf -g 'daemon off;'"]
