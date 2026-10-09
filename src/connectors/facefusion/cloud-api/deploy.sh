#!/bin/bash
# FaceFusion Cloud API - Deployment Script
# Run this on your Vast AI GPU instance (Ubuntu 22.04 + CUDA 12.x)
set -euo pipefail

echo "=== FaceFusion Cloud API Deployment ==="
echo ""

# 1. System dependencies
echo "[1/6] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq python3.11 python3.11-venv python3-pip git ffmpeg libgl1-mesa-glx libglib2.0-0 > /dev/null 2>&1

# 2. Create app directory
echo "[2/6] Setting up application directory..."
mkdir -p /opt/facefusion-api
cd /opt/facefusion-api

# 3. Clone FaceFusion
echo "[3/6] Installing FaceFusion..."
if [ ! -d "facefusion" ]; then
    git clone --depth 1 https://github.com/facefusion/facefusion.git
fi
cd facefusion
python3.11 -m venv venv
source venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
pip install --quiet facefusion
cd ..

# 4. Install API dependencies
echo "[4/6] Installing API dependencies..."
pip install --quiet fastapi uvicorn[standard] python-multipart pydantic

# 5. Copy API files
echo "[5/6] Copying API service files..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/main.py" /opt/facefusion-api/
cp "$SCRIPT_DIR/requirements.txt" /opt/facefusion-api/

# 6. Create systemd service
echo "[6/6] Creating systemd service..."
cat > /etc/systemd/system/facefusion-api.service << 'SERVICE'
[Unit]
Description=FaceFusion Cloud API for Chilli
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/facefusion-api
ExecStart=/opt/facefusion-api/venv/bin/python main.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable facefusion-api
systemctl start facefusion-api

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Check status:  systemctl status facefusion-api"
echo "View logs:     journalctl -u facefusion-api -f"
echo "Health check:  curl http://localhost:8081/health"
echo ""
echo "API is running on port 8081"
echo "Make sure to open port 8081 in your firewall:"
echo "  ufw allow 8081/tcp"
