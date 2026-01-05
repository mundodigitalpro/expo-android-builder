#!/bin/bash
# =============================================================================
# build-android.sh - Script para compilar la app Android en GitHub Actions
# =============================================================================
#
# Uso:
#   ./build-android.sh              # Build debug de /app
#   ./build-android.sh release      # Build release de /app
#   ./build-android.sh debug my-app # Build debug de /my-app
#
# Requiere: GitHub CLI (gh) instalado y autenticado
# =============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Valores por defecto
BUILD_TYPE="${1:-debug}"
PROJECT_PATH="${2:-app}"
WORKFLOW_FILE="gradle-build-android.yml"

echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  🚀 Build Android via GitHub Actions${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "  📁 Proyecto: ${GREEN}${PROJECT_PATH}${NC}"
echo -e "  📦 Tipo:     ${GREEN}${BUILD_TYPE}${NC}"
echo ""

# Verificar que gh está instalado
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI (gh) no está instalado${NC}"
    echo ""
    echo "Instalar con:"
    echo "  sudo apt install gh"
    echo "  gh auth login"
    exit 1
fi

# Verificar autenticación
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI no está autenticado${NC}"
    echo ""
    echo "Ejecutando autenticación..."
    gh auth login -h github.com -p https -s workflow
fi

# Ejecutar workflow
echo -e "${BLUE}Iniciando workflow...${NC}"
echo ""

gh workflow run "${WORKFLOW_FILE}" \
    -f project_path="${PROJECT_PATH}" \
    -f build_type="${BUILD_TYPE}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Workflow iniciado exitosamente!${NC}"
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  📊 Monitorear build:${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    echo "  1. Ver en navegador:"
    echo "     https://github.com/mundodigitalpro/expo-android-builder/actions"
    echo ""
    echo "  2. Ver en terminal (espera 5 segundos):"
    echo "     gh run watch"
    echo ""
    echo "  3. Ver lista de runs:"
    echo "     gh run list"
    echo ""
    
    # Preguntar si quiere monitorear
    read -p "¿Monitorear el build en tiempo real? (s/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo ""
        echo -e "${BLUE}Esperando 5 segundos para que el run aparezca...${NC}"
        sleep 5
        gh run watch
    fi
else
    echo -e "${RED}❌ Error al iniciar el workflow${NC}"
    exit 1
fi
