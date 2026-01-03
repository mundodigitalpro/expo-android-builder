# Instrucciones para Activar GitHub Actions - Builds Ilimitados de Android

**Fecha**: 2026-01-03
**Estado**: Configuración local completa - Falta subir a GitHub y configurar secrets

**🔐 IMPORTANTE**: Los valores sensibles (passwords, alias, etc.) están guardados en el archivo local `DATOS_SENSIBLES_LOCAL.txt` que NO debe subirse a GitHub. Consulta ese archivo para los valores reales.

---

## 📋 Resumen

Este proyecto está configurado para hacer builds de Android de forma **ilimitada y gratuita** usando GitHub Actions.

**Capacidad**: ~133 builds/mes gratis (2000 minutos) vs límites restrictivos de EAS Build.

---

## ✅ Ya Completado (en local)

1. ✅ **Keystore generado** para firmar APKs
   - Archivo: `release.keystore` (NO SUBIR A GIT)
   - Alias: `[TU_ALIAS_KEYSTORE]` (guardado en DATOS_SENSIBLES_LOCAL.txt)
   - Password: `[TU_PASSWORD_KEYSTORE]` (guardado en DATOS_SENSIBLES_LOCAL.txt)

2. ✅ **Keystore convertido a base64**
   - Archivo: `keystore.base64.txt` (NO SUBIR A GIT)

3. ✅ **Workflow creado**
   - Archivo: `.github/workflows/gradle-build-android.yml`

4. ✅ **Cambios commiteados** localmente
   - 2 commits listos para push

5. ✅ **Documentación creada**
   - `docs/PLAN_GITHUB_ACTIONS_BUILD.md` - Plan completo
   - `GITHUB_ACTIONS_SETUP.md` - Guía de setup
   - Este archivo - Instrucciones rápidas

---

## ⏳ Falta por Hacer

### Paso 1: Subir Workflow a GitHub (2 opciones)

#### Opción A: Desde GitHub Web UI (MÁS FÁCIL) ⭐

1. Ve a: https://github.com/mundodigitalpro/expo-android-builder
2. Click en **Add file** > **Create new file**
3. Nombre del archivo:
   ```
   .github/workflows/gradle-build-android.yml
   ```
4. Copiar contenido desde el archivo local en Termux:
   ```bash
   cat .github/workflows/gradle-build-android.yml
   ```
5. Scroll abajo > **Commit new file**

#### Opción B: Push desde Termux (Requiere auth)

```bash
cd [RUTA_DEL_PROYECTO]

# 1. Autenticar con scope workflow
gh auth login -h github.com -p https -s repo -s workflow -s gist --web

# Copiar código que aparece y abrir URL en navegador
# Autorizar la app en GitHub

# 2. Push
git push origin main
```

#### Opción C: Push desde Otra Máquina

```bash
# En PC/laptop/VPS con acceso git
git clone https://github.com/mundodigitalpro/expo-android-builder.git
cd expo-android-builder

# Crear manualmente los archivos del commit local
# o copiarlos desde Termux

git add .github/workflows/gradle-build-android.yml
git commit -m "feat: Add GitHub Actions workflow for unlimited Android builds"
git push origin main
```

---

### Paso 2: Configurar GitHub Secrets (CRÍTICO)

Una vez que el workflow esté en GitHub:

1. Ve a: https://github.com/mundodigitalpro/expo-android-builder/settings/secrets/actions

2. Click **New repository secret** y crear estos 4 secrets:

#### Secret 1: `ANDROID_KEYSTORE_BASE64`

```bash
# En Termux, copiar TODO el contenido del archivo keystore.base64.txt
# (Los valores reales están en DATOS_SENSIBLES_LOCAL.txt)
cat keystore.base64.txt
```

**Importante**: Es un texto MUY largo (varias líneas). Copiar TODO y pegarlo como valor del secret.

#### Secret 2: `ANDROID_KEY_ALIAS`

```
[Ver DATOS_SENSIBLES_LOCAL.txt para el valor]
```

#### Secret 3: `ANDROID_STORE_PASSWORD`

```
[Ver DATOS_SENSIBLES_LOCAL.txt para el valor]
```

#### Secret 4: `ANDROID_KEY_PASSWORD`

```
[Ver DATOS_SENSIBLES_LOCAL.txt para el valor]
```

**⚠️ IMPORTANTE**: Guarda estas contraseñas en un password manager. Si pierdes el keystore, no podrás actualizar tu app en Play Store.

---

### Paso 3: Hacer Primer Build de Prueba

1. Ve a: https://github.com/mundodigitalpro/expo-android-builder/actions

2. Click en **Android Native Build (Gradle)** en el sidebar

3. Click en **Run workflow** (botón verde arriba a la derecha)

4. Configurar inputs:
   - **project_path**: `app` (compila la app en /app del repo)
   - **build_type**: `debug` (para primera prueba)

5. Click **Run workflow**

6. El build tomará ~10-15 minutos

7. Una vez completado, ir a la página del workflow

8. Scroll abajo a la sección **Artifacts**

9. Click en el APK para descargar

10. Instalar en Android para verificar

---

## 🚀 Uso Diario

### Build Debug (para testing)

```
GitHub > Actions > Android Native Build > Run workflow
- project_path: app
- build_type: debug
```

### Build Release (para producción)

```
GitHub > Actions > Android Native Build > Run workflow
- project_path: app
- build_type: release
```

El build release:
- Está firmado con tu keystore
- Listo para subir a Play Store
- Crea un Release automático en GitHub

---

## 📊 Capacidades y Límites

### Plan Gratuito (Repo Público)

| Recurso | Límite | Equivalente |
|---------|--------|-------------|
| Minutos/mes | 2000 | ~133 builds (15 min cada uno) |
| Storage | 500 MB | ~50 APKs de 10MB |
| Retención | 90 días | Automático |
| Builds concurrentes | 20 | Más que suficiente |
| Costo | $0 | Gratis |

**Comparación**:
- ✅ GitHub Actions: ~133 builds/mes
- ❌ EAS Build gratis: ~10-20 builds/mes (muy limitado)
- ❌ VPS actual: 0 builds completos (se interrumpe por RAM)

### Si Necesitas Más (poco probable)

GitHub Actions Pro: $4/mes
- 3000 minutos adicionales
- Total: ~200 builds/mes

---

## 🗂️ Estructura de Archivos

```
expo-android-builder/
├── .github/
│   └── workflows/
│       └── gradle-build-android.yml    ← Workflow (SUBIR A GITHUB)
├── docs/
│   └── PLAN_GITHUB_ACTIONS_BUILD.md    ← Plan completo y técnico
├── GITHUB_ACTIONS_SETUP.md             ← Guía detallada de setup
├── INSTRUCCIONES_GITHUB_ACTIONS.md     ← Este archivo
├── release.keystore                     ← NO SUBIR (en .gitignore)
└── keystore.base64.txt                  ← NO SUBIR (en .gitignore)
```

---

## 🔒 Seguridad

### Archivos Sensibles (NUNCA commitear)

- ❌ `release.keystore`
- ❌ `keystore.base64.txt`

Estos archivos están en `.gitignore` y NO deben ir al repositorio.

### Backup del Keystore

**CRÍTICO**: Si pierdes el keystore, no podrás actualizar tu app en Play Store. Tendrás que crear una nueva app con nuevo package name.

**Guardar en**:
1. Password manager (1Password, Bitwarden, LastPass)
2. Google Drive cifrado
3. USB/disco externo cifrado
4. Email cifrado a ti mismo
5. Múltiples ubicaciones seguras

**Verificar backup**:
```bash
# Verificar que el keystore funciona
keytool -list -v -keystore release.keystore -alias [TU_ALIAS_KEYSTORE]
# Password: [Ver DATOS_SENSIBLES_LOCAL.txt]
```

---

## 📝 Notas Técnicas

### ¿Qué Proyectos Puedo Compilar?

El workflow puede compilar cualquier proyecto Expo que esté **dentro del repositorio Git**:

- ✅ `/app` - La app principal de Expo Android Builder
- ✅ Cualquier proyecto que agregues al repo en carpetas como `/projects/`
- ❌ Proyectos en `/data/data/com.termux/files/home/app-builder-projects/` (están fuera del repo)

**Para compilar proyectos externos**:
1. Copiar proyecto al repo
2. Git add + commit
3. Push a GitHub
4. Ejecutar workflow con la ruta del proyecto

### Cómo Funciona el Workflow

1. **Checkout**: Descarga el código del repo
2. **Setup Node.js**: Instala Node 20 con caché
3. **Setup JDK 17**: Instala Java para Gradle
4. **Install dependencies**: `npm ci` en el proyecto
5. **Expo Prebuild**: Genera carpeta `android/` nativa
6. **Setup signing**: Configura keystore (solo release)
7. **Build APK**: Ejecuta Gradle (assembleDebug o assembleRelease)
8. **Upload artifact**: Sube APK para descargar
9. **Create release**: Crea release en GitHub (solo builds release)

### Modificar el Workflow

Si necesitas personalizar el workflow:

1. Editar `.github/workflows/gradle-build-android.yml` en GitHub
2. O editar localmente y hacer push
3. Los cambios se aplican automáticamente

**Ejemplos de modificaciones**:
- Cambiar versión de Node.js (línea 40-44)
- Cambiar versión de JDK (línea 46-51)
- Agregar tests antes del build
- Cambiar retención de artifacts (línea 94)
- Notificaciones por email/webhook
- Build automático en push (descomentar líneas 22-27)

---

## ❓ Troubleshooting

### Problema: "refusing to allow OAuth App to create or update workflow"

**Causa**: Token sin scope `workflow`

**Solución**: Usar Opción A (GitHub Web UI) del Paso 1

### Problema: Build falla en "Expo Prebuild"

**Causas posibles**:
- `app.json` mal configurado
- Dependencias incompatibles en `package.json`

**Solución**:
1. Verificar que el proyecto compile localmente primero
2. Ver logs del step en GitHub Actions
3. Corregir errores y hacer nuevo build

### Problema: Build falla en "Setup signing keys"

**Causas posibles**:
- Secrets no configurados correctamente
- `ANDROID_KEYSTORE_BASE64` incompleto

**Solución**:
1. Verificar que los 4 secrets existan en GitHub
2. Verificar que `ANDROID_KEYSTORE_BASE64` tenga el contenido COMPLETO
3. Regenerar y resubir si es necesario

### Problema: Build falla en "Build APK"

**Causas posibles**:
- Error de compilación en código
- Dependencias faltantes
- Configuración de Gradle incorrecta

**Solución**:
1. Ver logs completos del step
2. Compilar localmente para reproducir error
3. Corregir código/dependencias
4. Push y reintentar

### Problema: No aparece APK en Artifacts

**Causas posibles**:
- Build no completó exitosamente
- Artifacts expirados (90 días)

**Solución**:
1. Verificar que el workflow tenga status "Success" (verde)
2. Los artifacts aparecen al final de la página del workflow
3. Si pasaron 90 días, hacer nuevo build

### Problema: APK no instala en Android

**Causas posibles**:
- APK debug en Android que requiere release
- Signature mismatch si ya instalaste versión anterior
- Configuración incorrecta en app.json

**Solución**:
1. Desinstalar versión anterior
2. Habilitar "Instalar apps desconocidas" en Settings
3. Para producción, usar build release firmado

---

## 🎯 Checklist Final

- [ ] Workflow subido a GitHub (`.github/workflows/gradle-build-android.yml`)
- [ ] 4 secrets configurados en GitHub Settings
- [ ] Primer build de prueba ejecutado (debug)
- [ ] APK descargado e instalado exitosamente
- [ ] Build release ejecutado y verificado
- [ ] Keystore guardado en lugar seguro (backup)
- [ ] Contraseñas guardadas en password manager
- [ ] Documentación leída y comprendida

---

## 📚 Recursos Adicionales

- **Plan completo**: `docs/PLAN_GITHUB_ACTIONS_BUILD.md`
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Expo Prebuild Docs**: https://docs.expo.dev/workflow/prebuild/
- **Android Signing Docs**: https://developer.android.com/studio/publish/app-signing

---

## 🆘 Soporte

Si encuentras problemas:

1. Revisar este documento completamente
2. Revisar `GITHUB_ACTIONS_SETUP.md` para detalles adicionales
3. Ver logs del workflow en GitHub Actions
4. Abrir issue en GitHub con logs y descripción del problema

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tendrás:

- ✅ Builds ilimitados de Android (133/mes gratis)
- ✅ APKs firmados listos para Play Store
- ✅ Infraestructura potente (2 CPU, 7GB RAM)
- ✅ Builds en 10-15 minutos
- ✅ Sin dependencia de VPS o EAS Build limitado
- ✅ Control total del proceso

**¡Disfruta de tus builds ilimitados!** 🚀

---

**Última actualización**: 2026-01-03
**Autor**: Claude Code (Anthropic)
