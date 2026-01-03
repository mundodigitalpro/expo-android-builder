#!/bin/bash

echo "================================================"
echo "  Push GitHub Actions Workflow to Repository"
echo "================================================"
echo ""
echo "Paso 1: Actualizar token de GitHub CLI con scope 'workflow'"
echo ""
echo "Ejecutando: gh auth refresh -h github.com -s workflow"
echo ""

gh auth refresh -h github.com -s workflow

echo ""
echo "================================================"
echo "Paso 2: Push a GitHub"
echo "================================================"
echo ""

git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Push exitoso!"
    echo ""
    echo "================================================"
    echo "  PRÓXIMOS PASOS"
    echo "================================================"
    echo ""
    echo "1. Ve a GitHub: https://github.com/mundodigitalpro/expo-android-builder"
    echo "2. Ir a: Settings > Secrets and variables > Actions"
    echo "3. Configurar 4 secrets (ver GITHUB_ACTIONS_SETUP.md)"
    echo ""
    echo "Para obtener el contenido del keystore base64:"
    echo "  cat /data/data/com.termux/files/home/expo-android-builder/keystore.base64.txt"
    echo ""
    echo "Secrets necesarios:"
    echo "  - ANDROID_KEYSTORE_BASE64 (contenido de keystore.base64.txt)"
    echo "  - ANDROID_KEY_ALIAS = expo-android-builder"
    echo "  - ANDROID_STORE_PASSWORD = ExpoBuilder2024Secure!"
    echo "  - ANDROID_KEY_PASSWORD = ExpoBuilder2024Secure!"
    echo ""
    echo "Más info: cat GITHUB_ACTIONS_SETUP.md"
    echo ""
else
    echo ""
    echo "❌ Push falló"
    echo ""
    echo "Si el error persiste, sigue las instrucciones en:"
    echo "  cat GITHUB_ACTIONS_SETUP.md"
    echo ""
fi
