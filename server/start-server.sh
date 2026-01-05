#!/data/data/com.termux/files/usr/bin/bash

echo "🚀 Starting Expo Android Builder Server..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$SERVER_DIR"

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

mkdir -p /data/data/com.termux/files/home/app-builder-projects

node server.js &

echo $! > server.pid

echo "✅ Server started! PID saved to server.pid"
echo "📝 To stop: kill \$(cat server.pid)"
