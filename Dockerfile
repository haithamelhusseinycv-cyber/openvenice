# --- Build stage ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_VENICE_BASE_URL=
ARG VITE_VOICETUT_BASE_URL=/voicetut
# Same-origin open-model gateway. Keep this relative: the browser must never
# receive an upstream host or credential.
ARG VITE_QWEN_BASE_URL=/ai/v1
ARG GIT_SHA=unknown
ENV VITE_VENICE_BASE_URL=$VITE_VENICE_BASE_URL \
    VITE_VOICETUT_BASE_URL=$VITE_VOICETUT_BASE_URL \
    VITE_QWEN_BASE_URL=$VITE_QWEN_BASE_URL
# Build provenance for the in-app diagnostics view (no secrets).
RUN printf '{"commit":"%s","builtAt":"%s"}' "$GIT_SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > public/version.json
RUN npm run build

# --- Runtime stage: static site + credential-isolating VoiceTut proxy ---
FROM nginx:1.29.1-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY nginx.voicetut.conf.template /etc/nginx/nginx.voicetut.conf.template
COPY nginx.ai.conf.template /etc/nginx/nginx.ai.conf.template
COPY scripts/openvenice-start.sh /usr/local/bin/openvenice-start
RUN chmod 0555 /usr/local/bin/openvenice-start && \
    chown -R nginx:nginx /var/cache/nginx /var/run /usr/share/nginx/html

# Keep an explicit non-privileged target port for platforms that infer from image metadata.
# Runtime still binds to Railway's injected PORT, including a legacy low port if configured.
EXPOSE 8080
CMD ["/usr/local/bin/openvenice-start"]
