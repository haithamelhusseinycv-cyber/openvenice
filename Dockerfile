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
EXPOSE 8080
USER nginx
CMD ["sh", "-c", "test -n \"$VOICETUT_UPSTREAM\" && test -n \"$VOICETUT_API_KEY\" && envsubst '$VOICETUT_UPSTREAM $VOICETUT_API_KEY' < /etc/nginx/nginx.conf.template > /tmp/openvenice-nginx.conf && chmod 600 /tmp/openvenice-nginx.conf && exec nginx -c /tmp/openvenice-nginx.conf -g 'daemon off;'"]
