#!/data/data/com.termux/files/usr/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$WORKSPACE_DIR/server"

echo "🛑 Deteniendo servicios..."

# Detener backend
if [ -f "$SERVER_DIR/server.pid" ]; then
  PID=$(cat "$SERVER_DIR/server.pid")
  if kill -0 $PID 2>/dev/null; then
    kill $PID
    echo "✅ Backend detenido (PID: $PID)"
  else
    echo "⚠️  Backend no estaba corriendo"
  fi
  rm "$SERVER_DIR/server.pid"
else
  echo "⚠️  No se encontró archivo PID del servidor"
fi

# Detener Expo (buscar procesos)
if pgrep -f "expo start" > /dev/null; then
  pkill -f "expo start"
  echo "✅ Expo detenido"
else
  echo "⚠️  Expo no estaba corriendo"
fi

echo "✅ Todos los servicios detenidos"
