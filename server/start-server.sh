#!/data/data/com.termux/files/usr/bin/bash

echo "🚀 Starting Expo App Builder Server..."

cd /data/data/com.termux/files/home/expo-app-builder-server

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

mkdir -p /data/data/com.termux/files/home/app-builder-projects

node server.js &

echo $! > server.pid

echo "✅ Server started! PID saved to server.pid"
echo "📝 To stop: kill \$(cat server.pid)"
