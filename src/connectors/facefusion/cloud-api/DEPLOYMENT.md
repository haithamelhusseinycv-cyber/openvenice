# FaceFusion Cloud API Deployment Guide

## Overview
This guide deploys FaceFusion as a cloud API service for the Chilli app, replacing the casual Venice-based face swap with high-precision ONNX-based face swapping.

## Architecture
```
Chilli App (Swap Button)
    ↓
Cloud FaceFusion Bridge (HTTP)
    ↓
FaceFusion Cloud API (:8081)
    ↓
ONNX Models (SCRFD + ArcFace + INSwapper)
    ↓
Return swapped image
```

## Deployment Steps

### 1. Provision Cloud GPU
```bash
# On Vast AI or similar GPU cloud
# Recommended: RTX 3090/4090 or A10G (24GB VRAM)
# Ubuntu 22.04 + CUDA 12.x
```

### 2. Install Dependencies
```bash
# SSH into your GPU instance
ssh root@your-gpu-instance

# Install Python 3.10+ and CUDA
apt update && apt install -y python3.10 python3.10-venv python3-pip

# Clone FaceFusion
git clone https://github.com/facefusion/facefusion.git
cd facefusion

# Install FaceFusion
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install facefusion

# Install API dependencies
pip install fastapi uvicorn python-multipart pydantic
```

### 3. Deploy API Service
```bash
# Copy the API code to the instance
scp -r src/connectors/facefusion/cloud-api/ root@your-gpu-instance:/opt/facefusion-api/

# Start the API
cd /opt/facefusion-api
nohup python3.10 main.py > api.log 2>&1 &

# Verify it's running
curl http://localhost:8081/health
```

### 4. Configure Firewall
```bash
# Allow port 8081 from Chilli app
ufw allow 8081/tcp
```

### 5. Update Chilli App Configuration
Edit `src/connectors/facefusion/cloud-facefusion-bridge.ts`:
```typescript
const FACEFUSION_API_URL = 'http://your-gpu-instance-ip:8081'
```

### 6. Rebuild Chilli APK
```bash
cd /data/data/com.termux/files/home/projects/localdream-unified
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vite/bin/vite.js build
node node_modules/@capacitor/cli/bin/capacitor sync android
cd android && ./gradlew assembleDebug
```

## API Endpoints

### GET /health
Health check endpoint.
```json
{
  "status": "healthy",
  "service": "facefusion-cloud-api",
  "models_loaded": true
}
```

### GET /models
List available FaceFusion models.
```json
{
  "detectors": ["scrfd", "retinaface"],
  "recognizers": ["arcface", "insightface"],
  "swappers": ["inswapper_128", "hyperswap_1a"],
  "faceEnhancers": ["gfpgan", "codeformer"],
  "frameEnhancers": ["realesrgan-x4"]
}
```

### POST /detect
Detect faces in an image.
```json
// Request (form-data)
image: "base64-encoded-image"

// Response
[
  {
    "index": 0,
    "confidence": 0.98,
    "bounds": {"left": 100, "top": 100, "right": 300, "bottom": 300}
  }
]
```

### POST /swap
Swap faces between source and target images.
```json
// Request
{
  "sourceImage": "base64-source-face",
  "targetImage": "base64-target-image",
  "targetFaceIndices": [0],
  "swapper": "inswapper_128",
  "faceEnhancer": "gfpgan"
}

// Response
{
  "outputImage": "base64-result",
  "elapsedMs": 1250,
  "format": "jpeg",
  "mimeType": "image/jpeg",
  "metadata": {
    "swapper": "inswapper_128",
    "detector": "scrfd",
    "mode": "cloud"
  }
}
```

### POST /enhance
Enhance face quality.
```json
// Request
{
  "image": "base64-image",
  "faceEnhancer": "gfpgan",
  "frameEnhancer": "realesrgan-x4"
}

// Response
{
  "outputImage": "base64-enhanced",
  "elapsedMs": 800,
  "format": "jpeg",
  "mimeType": "image/jpeg"
}
```

## Performance Expectations

| Operation | Time (RTX 3090) | Time (A10G) |
|-----------|----------------|-------------|
| Face Detection | ~50ms | ~80ms |
| Face Swap | ~1.2s | ~2.0s |
| Face Enhancement | ~800ms | ~1.5s |

## Cost Estimate

- **Vast AI RTX 3090**: ~$0.30/hour
- **Vast AI A10G**: ~$0.50/hour
- **Monthly (8h/day)**: ~$72-120/month

## Monitoring

```bash
# Check API logs
tail -f /opt/facefusion-api/api.log

# Check GPU usage
nvidia-smi

# Check API health
curl http://localhost:8081/health
```

## Troubleshooting

### API not responding
```bash
# Check if process is running
ps aux | grep main.py

# Check logs
cat /opt/facefusion-api/api.log

# Restart API
pkill -f main.py
cd /opt/facefusion-api && nohup python3.10 main.py > api.log 2>&1 &
```

### GPU out of memory
```bash
# Reduce batch size or use smaller models
# Edit main.py and use inswapper_128 instead of hyperswap
```

### Slow performance
```bash
# Check GPU utilization
nvidia-smi

# Ensure CUDA is properly installed
python3.10 -c "import torch; print(torch.cuda.is_available())"
```

## Security Notes

- Add API key authentication for production
- Use HTTPS (nginx reverse proxy with Let's Encrypt)
- Rate limit requests to prevent abuse
- Monitor GPU usage and costs

## Next Steps

1. Deploy to your cloud GPU instance
2. Test with sample images
3. Update Chilli app with your GPU instance URL
4. Rebuild and install APK
5. Test face swap in Chilli app
