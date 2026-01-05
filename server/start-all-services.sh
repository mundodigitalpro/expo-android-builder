#!/data/data/com.termux/files/usr/bin/bash

# Script maestro para iniciar backend + frontend
# Uso: ./start-all-services.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$WORKSPACE_DIR/server"
APP_DIR="$WORKSPACE_DIR/app"

echo "🚀 Iniciando Expo Android Builder Services..."

# 1. Iniciar Backend
echo ""
echo "📡 Iniciando Backend Server..."
cd "$SERVER_DIR"

if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependencias del servidor..."
  npm install
fi

# Crear directorio de proyectos si no existe
mkdir -p /data/data/com.termux/files/home/app-builder-projects

# Iniciar servidor en background
node server.js > server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > server.pid

echo "✅ Backend iniciado (PID: $SERVER_PID)"
echo "   Log: $SERVER_DIR/server.log"

# Esperar a que el servidor esté listo
echo ""
echo "⏳ Esperando a que el servidor esté listo..."
MAX_RETRIES=10
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Servidor respondiendo correctamente"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Intento $RETRY_COUNT/$MAX_RETRIES..."
  sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Error: El servidor no respondió después de $MAX_RETRIES intentos"
  echo "   Verifica el log: $SERVER_DIR/server.log"
  exit 1
fi

# 2. Iniciar Frontend
echo ""
echo "📱 Iniciando Frontend App..."
cd "$APP_DIR"

if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependencias de la app..."
  npm install
fi

# Iniciar Expo (no en background, este será el proceso principal)
echo ""
echo "✨ Iniciando Expo Dev Server..."
echo "   Presiona 'a' para abrir en Android"
echo ""
npx expo start

# Si Expo se cierra, matar el servidor también
echo ""
echo "🛑 Cerrando servicios..."
if [ -f "$SERVER_DIR/server.pid" ]; then
  kill $(cat "$SERVER_DIR/server.pid") 2>/dev/null
  rm "$SERVER_DIR/server.pid"
fi
echo "✅ Servicios detenidos"
