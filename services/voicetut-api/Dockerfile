FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/data/huggingface \
    PORT=80

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --upgrade pip==25.1.1 && \
    python3 -m pip install torch==2.6.0 --index-url https://download.pytorch.org/whl/cu124

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN python3 -m pip install -r requirements.txt

COPY app.py security.py ./
RUN useradd --system --uid 10001 --home-dir /app voicetut && \
    mkdir -p /data/huggingface && \
    chown -R voicetut:voicetut /app /data/huggingface

USER 10001
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:' + __import__('os').getenv('PORT', '80') + '/live', timeout=3)"
CMD ["sh", "-c", "python3 -m uvicorn app:app --host 0.0.0.0 --port ${PORT:-80} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
