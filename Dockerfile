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
COPY nginx.voicetut.conf.template /etc/nginx/nginx.voicetut.conf.template
COPY nginx.connectors.conf.template /etc/nginx/nginx.connectors.conf.template
COPY scripts/openvenice-start.sh /usr/local/bin/openvenice-start
RUN chmod 0555 /usr/local/bin/openvenice-start && \
    chown -R nginx:nginx /var/cache/nginx /var/run /usr/share/nginx/html

# Keep an explicit non-privileged target port for platforms that infer from image metadata.
# Runtime still binds to Railway's injected PORT, including a legacy low port if configured.
EXPOSE 8080
CMD ["/usr/local/bin/openvenice-start"]
