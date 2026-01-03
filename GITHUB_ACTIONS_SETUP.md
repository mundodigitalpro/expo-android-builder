# GitHub Actions Setup - Pasos para Activar Builds Ilimitados

## 🚨 Estado Actual

Los archivos están listos y commiteados localmente, pero necesitan ser subidos a GitHub.

**Problema**: El token OAuth actual no tiene el scope `workflow` necesario para subir archivos de GitHub Actions.

## 📋 Solución: Push Manual (2 opciones)

### Opción 1: Desde Otra Máquina (Recomendado)

Si tienes acceso a otra máquina (PC, laptop, VPS):

```bash
# 1. Clonar el repo
git clone https://github.com/mundodigitalpro/expo-android-builder.git
cd expo-android-builder

# 2. Pull para obtener el commit local
# (Los cambios ya están commiteados localmente en Termux)
git fetch origin
git log --oneline -5

# Si el commit no aparece, crear los archivos manualmente:
# - Copiar .github/workflows/gradle-build-android.yml
# - Copiar docs/PLAN_GITHUB_ACTIONS_BUILD.md
# - Actualizar .gitignore

# 3. Push a GitHub
git push origin main
```

### Opción 2: Generar Token con Scope Workflow

1. Ve a GitHub: https://github.com/settings/tokens
2. Click **Generate new token** > **Generate new token (classic)**
3. Nombre: `Termux Workflow Token`
4. Scopes necesarios:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
5. Click **Generate token**
6. **COPIA EL TOKEN** (solo se muestra una vez)

Luego en Termux:

```bash
cd /data/data/com.termux/files/home/expo-android-builder

# Configurar el token
git remote set-url origin https://TU_TOKEN@github.com/mundodigitalpro/expo-android-builder.git

# Push
git push origin main

# Opcional: Revertir a HTTPS normal después
git remote set-url origin https://github.com/mundodigitalpro/expo-android-builder.git
```

## 🔐 Después del Push: Configurar GitHub Secrets

Una vez que el workflow esté en GitHub, sigue estos pasos:

### Paso 1: Ir a Settings

1. Ve a: https://github.com/mundodigitalpro/expo-android-builder
2. Click en **Settings** (tab arriba)
3. En el sidebar izquierdo: **Secrets and variables** > **Actions**

### Paso 2: Agregar 4 Secrets

Click **New repository secret** para cada uno:

#### Secret 1: `ANDROID_KEYSTORE_BASE64`

Copiar todo el contenido del archivo `keystore.base64.txt`:

```bash
# En Termux, ejecutar:
cat /data/data/com.termux/files/home/expo-android-builder/keystore.base64.txt
```

Copiar TODA la salida (será muy largo, varias líneas). Pegarlo como valor del secret.

#### Secret 2: `ANDROID_KEY_ALIAS`

```
expo-android-builder
```

#### Secret 3: `ANDROID_STORE_PASSWORD`

```
ExpoBuilder2024Secure!
```

#### Secret 4: `ANDROID_KEY_PASSWORD`

```
ExpoBuilder2024Secure!
```

**IMPORTANTE**: Guarda estas contraseñas en un lugar seguro (password manager).

### Paso 3: Verificar Secrets

Deberías ver 4 secrets configurados:
- ✅ ANDROID_KEYSTORE_BASE64
- ✅ ANDROID_KEY_ALIAS
- ✅ ANDROID_STORE_PASSWORD
- ✅ ANDROID_KEY_PASSWORD

## 🚀 Probar el Workflow

### Primer Build de Prueba

1. Ve a: https://github.com/mundodigitalpro/expo-android-builder/actions
2. Click en **Android Native Build (Gradle)** en el sidebar
3. Click en **Run workflow** (botón verde)
4. Configurar inputs:
   - `project_path`: **app** (para compilar la app de React Native en /app)
   - `build_type`: **debug** (para la primera prueba)
5. Click **Run workflow**

### Monitorear el Build

- El workflow aparecerá en la lista
- Click en el nombre del workflow para ver el progreso
- Durará ~10-15 minutos
- Verás cada paso ejecutándose en tiempo real

### Descargar el APK

Una vez completado:

1. Scroll hasta abajo en la página del workflow
2. Sección **Artifacts**
3. Click en `android-debug-X.apk` para descargar
4. Instalar en tu dispositivo Android para probar

## 📊 Capacidad de GitHub Actions

### Plan Gratuito (Repo Público)

- **Minutos/mes**: 2000
- **Builds/mes**: ~133 (a 15 min por build)
- **Storage**: 500 MB artifacts
- **Retención**: 90 días
- **Costo**: $0

### Si Necesitas Más (poco probable)

- **GitHub Actions Pro**: $4/mes
- **Minutos adicionales**: 3000
- **Total builds/mes**: ~200+

## 🔄 Uso Diario

### Build Debug (para testing)

```
Actions > Android Native Build > Run workflow
- project_path: app
- build_type: debug
```

### Build Release (para producción)

```
Actions > Android Native Build > Run workflow
- project_path: app
- build_type: release
```

El build release:
- Está firmado con tu keystore
- Listo para Play Store
- Se crea un Release en GitHub automáticamente

## 📱 Integración con tu App (Opcional - Futuro)

Puedes agregar un botón en BuildStatusScreen para triggear builds desde la app:

```javascript
// Usar GitHub API para disparar workflow
POST https://api.github.com/repos/mundodigitalpro/expo-android-builder/actions/workflows/gradle-build-android.yml/dispatches
```

Esto requeriría:
- Un token de GitHub en el backend
- Endpoint en tu server para hacer el trigger
- UI en la app para seleccionar proyecto y tipo de build

## 🔒 Seguridad

### Archivos Sensibles (NO COMMITEAR)

Estos archivos están en `.gitignore` y nunca deben ir al repo:

- ❌ `release.keystore`
- ❌ `keystore.base64.txt`

### Backup del Keystore

**MUY IMPORTANTE**: Si pierdes el keystore, no podrás actualizar tu app en Play Store.

Guardar en:
1. Password manager (1Password, Bitwarden, etc.)
2. Drive cifrado (Google Drive con cifrado)
3. USB cifrado
4. Email cifrado a ti mismo

## 📝 Notas Importantes

### Proyectos que Puedes Compilar

El workflow puede compilar cualquier proyecto Expo que esté **dentro del repositorio**:

- `/app` - La app principal de Expo Android Builder
- Cualquier proyecto que agregues al repo en el futuro

**Nota**: Los proyectos creados por la app están en `/data/data/com.termux/files/home/app-builder-projects/` y NO están en el repo. Si quieres compilarlos con GitHub Actions, necesitarías:
1. Copiarlos al repo
2. Commitearlos
3. Hacer build

### Alternativa para Proyectos Externos

Si quieres compilar proyectos que no están en el repo, tendrías que:
- Crear un repo separado para cada proyecto
- Configurar el mismo workflow en cada repo
- O modificar el workflow para clonar proyectos desde otras ubicaciones

## ❓ Troubleshooting

### Build falla en "Expo Prebuild"

- Verificar que `app.json` esté configurado correctamente
- Verificar que `package.json` tenga todas las dependencias

### Build falla en "Setup signing keys"

- Verificar que los 4 secrets estén configurados correctamente
- Verificar que `ANDROID_KEYSTORE_BASE64` tenga el contenido completo

### Build falla en "Build APK"

- Ver los logs del step para identificar el error
- Verificar que el proyecto compile localmente primero

### No aparece el APK en Artifacts

- Verificar que el build haya completado exitosamente
- Los artifacts se borran después de 90 días

## 📚 Recursos

- **Plan Completo**: `/docs/PLAN_GITHUB_ACTIONS_BUILD.md`
- **Workflow**: `/.github/workflows/gradle-build-android.yml`
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Expo Prebuild**: https://docs.expo.dev/workflow/prebuild/

## ✅ Checklist Final

- [ ] Push del workflow a GitHub (usando una de las 2 opciones)
- [ ] Configurar 4 GitHub Secrets
- [ ] Ejecutar primer build de prueba (debug)
- [ ] Descargar y probar APK
- [ ] Ejecutar build release
- [ ] Verificar firma del APK release
- [ ] Guardar backup del keystore
- [ ] Celebrar builds ilimitados! 🎉

---

**¿Problemas o preguntas?**

Revisa el plan completo en `docs/PLAN_GITHUB_ACTIONS_BUILD.md` o abre un issue en GitHub.
