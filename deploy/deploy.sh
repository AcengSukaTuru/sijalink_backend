#!/usr/bin/env bash
set -euo pipefail

# Script deploy remote ke home server via SSH & Docker Compose
# Penggunaan:
#   ./deploy/deploy.sh user@ip-server [port-ssh] [remote-dir]
# Contoh:
#   ./deploy/deploy.sh vito@192.168.1.100

TARGET="${1:-}"
SSH_PORT="${2:-22}"
REMOTE_DIR="${3:-/opt/sijalink_backend}"

if [ -z "$TARGET" ]; then
  echo "Usage: $0 <user@host> [ssh_port] [remote_dir]"
  echo "Example: $0 user@192.168.1.50"
  exit 1
fi

echo "🚀 Memulai deploy ke $TARGET (port $SSH_PORT)..."

# 1. Pastikan folder tujuan di server ada
ssh -p "$SSH_PORT" "$TARGET" "mkdir -p $REMOTE_DIR"

# 2. Sync file project (abaikan node_modules, dist, cache, .git lokal)
echo "📦 Mengirim file ke server..."
rsync -avz --delete \
  -e "ssh -p $SSH_PORT" \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude 'coverage' \
  --exclude '.cache' \
  --exclude '.vitest' \
  --exclude '*.tsbuildinfo' \
  --exclude 'private-uploads' \
  --exclude '.env' \
  ./ "$TARGET:$REMOTE_DIR/"

# 3. Setup .env di server jika belum ada
echo "⚙️  Memeriksa konfigurasi server..."
ssh -p "$SSH_PORT" "$TARGET" "
  if [ ! -f $REMOTE_DIR/deploy/.env ]; then
    echo 'Membuat deploy/.env dari deploy/.env.example...'
    cp $REMOTE_DIR/deploy/.env.example $REMOTE_DIR/deploy/.env
  fi
"

# 4. Build dan restart container di server
echo "🐳 Menjalankan Docker Compose di server..."
ssh -p "$SSH_PORT" "$TARGET" "
  cd $REMOTE_DIR/deploy
  docker compose pull minio postgres || true
  docker compose up -d --build
  echo 'Status container:'
  docker compose ps
"

echo "✔ Deploy selesai!"
