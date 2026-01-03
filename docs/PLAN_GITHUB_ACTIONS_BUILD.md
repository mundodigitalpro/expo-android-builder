# Plan: Implementación de GitHub Actions para Builds de Android

**Fecha de creación**: 2026-01-03
**Propósito**: Migrar los builds de Android desde VPS local a GitHub Actions para aprovechar mejor infraestructura y evitar interrupciones por falta de recursos.

## Contexto

**Problema actual**:
- El VPS no tiene suficiente potencia para completar builds
- Los builds tardan ~20 minutos y se interrumpen
- Recursos limitados del VPS causan fallos frecuentes
- EAS Build gratuito tiene límites muy restrictivos

**Solución propuesta**:
- Usar GitHub Actions con build nativo Gradle (prácticamente ilimitado)
- Aprovechar la infraestructura gratuita de GitHub (2000 min/mes = ~133 builds)
- Almacenar APKs como artifacts (90 días de retención)
- Control total del proceso sin dependencias externas

## Opciones de Implementación

### Opción 1: Build Nativo con Gradle en GitHub Actions (⭐ RECOMENDADO - ILIMITADO)

**Descripción**:
Ejecutar el build completo de Android usando Gradle directamente en runners de GitHub. Esta es la opción **ILIMITADA** sin dependencias de servicios externos.

**Ventajas**:
- ✅ **PRÁCTICAMENTE ILIMITADO**: 2000 min/mes = ~133 builds (vs límites muy restrictivos de EAS)
- ✅ **CONTROL TOTAL** del proceso de build
- ✅ **SIN DEPENDENCIAS** de servicios externos (solo GitHub)
- ✅ Personalización completa del workflow
- ✅ **GRATIS** para repositorios públicos
- ✅ APK descargable inmediatamente como artifact
- ✅ Builds en ~10-15 minutos (más rápido que tu VPS)
- ✅ Runners con 2 CPU cores, 7GB RAM (potente)

**Desventajas**:
- ⚠️ Configuración inicial más compleja (una sola vez)
- ⚠️ Gestión manual de signing keys (seguro con GitHub Secrets)
- ⚠️ Configuración de caché (pero acelera builds subsiguientes)

**Límites GitHub Actions Free Tier**:
- **Repositorio Público**: 2000 minutos/mes (~133 builds de 15min) ✅
- **Repositorio Privado**: 500 minutos/mes (~33 builds de 15min)
- **Storage artifacts**: 500 MB (suficiente para APKs)
- **Retención**: 90 días (configurable)
- **Workflows concurrentes**: 20 (más que suficiente)

**Si necesitas más (poco probable)**:
- GitHub Actions Pro: $4/mes → 3000 minutos adicionales
- Aún así mucho más barato que EAS pago

---

### Opción 2: EAS Build con GitHub Actions (Limitado, ya lo tienes)

**Descripción**:
Usar Expo Application Services (EAS) triggerado desde GitHub Actions. EAS se encarga del build completo usando su propia infraestructura.

**Ventajas**:
- ✅ Configuración más simple
- ✅ No consume muchos minutos de GitHub Actions (solo trigger)
- ✅ Caché automático de dependencias
- ✅ Build firmado automático

**Desventajas**:
- ❌ **LÍMITES MUY RESTRICTIVOS en plan gratuito**
- ❌ Dependencia de servicio externo (Expo)
- ❌ Menos control sobre el proceso de build
- ❌ Ya lo tienes configurado y tiene límites

**Límites Expo Free Tier**:
- Builds: **MUY LIMITADO** (por eso buscas alternativa)
- Storage: 1 GB de artifacts
- Priority: Baja (builds lentos)

**Nota**: Ya tienes esto configurado, por eso buscas una solución ilimitada.

---

### Opción 3: Híbrido (Gradle Principal + EAS Fallback)

**Descripción**:
Configurar ambos métodos y elegir según necesidad.

**Ventajas**:
- ✅ Flexibilidad máxima
- ✅ Fallback si un servicio falla

**Desventajas**:
- ⚠️ Mantenimiento de dos workflows diferentes
- ⚠️ Más complejo de gestionar

---

## Plan de Implementación Recomendado

### Fase 1: Configuración de Build Nativo con Gradle (PRINCIPAL)

#### 1.1. Generar Signing Keys (Solo una vez)

```bash
# En Termux o cualquier máquina con keytool
keytool -genkey -v -keystore release.keystore \
  -alias expo-android-builder \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Responder las preguntas:
# - Contraseña del keystore: [tu-password-seguro]
# - Nombre, organización, etc.
# - Contraseña de la key: [mismo password o diferente]

# Convertir keystore a base64 para GitHub Secrets
base64 release.keystore > keystore.base64.txt

# Mostrar el contenido (para copiar)
cat keystore.base64.txt
```

**IMPORTANTE**: Guarda estos datos de forma segura (password manager):
- Contraseña del keystore
- Contraseña de la key (si es diferente)
- Alias: `expo-android-builder`

#### 1.2. Configurar GitHub Secrets

En tu repositorio GitHub:
1. Ir a **Settings** > **Secrets and variables** > **Actions**
2. Click en **New repository secret**
3. Agregar los siguientes secrets:

| Secret Name | Valor |
|------------|-------|
| `ANDROID_KEYSTORE_BASE64` | Contenido completo de `keystore.base64.txt` |
| `ANDROID_KEY_ALIAS` | `expo-android-builder` |
| `ANDROID_STORE_PASSWORD` | Tu contraseña del keystore |
| `ANDROID_KEY_PASSWORD` | Tu contraseña de la key |
| `GITHUB_TOKEN` | (opcional) Para trigger desde backend |

#### 1.3. Crear Workflow de GitHub Actions

Crear directorio y archivo:
```bash
mkdir -p .github/workflows
```

Crear archivo `.github/workflows/gradle-build-android.yml`:

```yaml
name: Android Native Build (Gradle)

on:
  # Trigger manual desde GitHub UI
  workflow_dispatch:
    inputs:
      project_path:
        description: 'Ruta del proyecto a compilar (ej: my-app)'
        required: true
        type: string
      build_type:
        description: 'Tipo de build'
        required: true
        default: 'release'
        type: choice
        options:
          - debug
          - release

  # Trigger automático en push (opcional, comentado)
  # push:
  #   branches:
  #     - main
  #   paths:
  #     - 'projects/**'

jobs:
  build:
    name: Build APK con Gradle
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: 📥 Checkout repository
        uses: actions/checkout@v4

      - name: 🏗️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: ☕ Setup JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
          cache: 'gradle'

      - name: 📦 Install npm dependencies
        working-directory: ${{ github.event.inputs.project_path }}
        run: npm ci

      - name: 🔧 Expo Prebuild (generar carpeta android/)
        working-directory: ${{ github.event.inputs.project_path }}
        run: npx expo prebuild --platform android --clean

      - name: 📝 Make gradlew executable
        working-directory: ${{ github.event.inputs.project_path }}/android
        run: chmod +x gradlew

      - name: 🔑 Setup signing keys (solo para release)
        if: ${{ github.event.inputs.build_type == 'release' }}
        working-directory: ${{ github.event.inputs.project_path }}/android
        run: |
          # Crear keystore desde base64
          echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > app/release.keystore

          # Configurar gradle.properties con signing config
          cat >> gradle.properties << EOF
          MYAPP_UPLOAD_STORE_FILE=release.keystore
          MYAPP_UPLOAD_KEY_ALIAS=${{ secrets.ANDROID_KEY_ALIAS }}
          MYAPP_UPLOAD_STORE_PASSWORD=${{ secrets.ANDROID_STORE_PASSWORD }}
          MYAPP_UPLOAD_KEY_PASSWORD=${{ secrets.ANDROID_KEY_PASSWORD }}
          EOF

      - name: 🔨 Build APK
        working-directory: ${{ github.event.inputs.project_path }}/android
        run: |
          if [ "${{ github.event.inputs.build_type }}" == "release" ]; then
            ./gradlew assembleRelease --no-daemon
          else
            ./gradlew assembleDebug --no-daemon
          fi

      - name: 📤 Upload APK as artifact
        uses: actions/upload-artifact@v4
        with:
          name: android-${{ github.event.inputs.build_type }}-${{ github.run_number }}.apk
          path: ${{ github.event.inputs.project_path }}/android/app/build/outputs/apk/${{ github.event.inputs.build_type }}/*.apk
          retention-days: 90

      - name: 📊 Build Summary
        run: |
          echo "✅ Build completado exitosamente!" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Tipo**: ${{ github.event.inputs.build_type }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Proyecto**: ${{ github.event.inputs.project_path }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Run**: #${{ github.run_number }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "📥 [Descargar APK](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})" >> $GITHUB_STEP_SUMMARY

      - name: 🎉 Create GitHub Release (opcional, solo release)
        if: ${{ github.event.inputs.build_type == 'release' }}
        uses: softprops/action-gh-release@v1
        with:
          files: ${{ github.event.inputs.project_path }}/android/app/build/outputs/apk/release/*.apk
          tag_name: ${{ github.event.inputs.project_path }}-v${{ github.run_number }}
          name: ${{ github.event.inputs.project_path }} - Release v${{ github.run_number }}
          body: |
            Build automático de ${{ github.event.inputs.project_path }}

            - Tipo: Release
            - Run: #${{ github.run_number }}
            - Fecha: ${{ github.event.head_commit.timestamp }}
          draft: false
          prerelease: false
```

#### 1.4. Configurar app.json para Signing (en cada proyecto)

Cuando crees un proyecto, o en proyectos existentes, configura `app.json`:

```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.yourapp",
      "versionCode": 1
    }
  }
}
```

#### 1.5. Configurar Gradle para Signing (se hace automáticamente)

El workflow se encarga de configurar el signing, pero si quieres verificar manualmente:

`android/app/build.gradle` debe tener:

```gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

#### 1.6. Integrar con Expo Android Builder App

**Backend**: Agregar endpoint para trigger de GitHub Actions build

```javascript
// server/src/services/GithubActionsService.js
class GithubActionsService {
  async triggerBuild(projectName, profile = 'preview') {
    // Usar GitHub API para disparar workflow_dispatch
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    await octokit.rest.actions.createWorkflowDispatch({
      owner: 'your-github-username',
      repo: 'expo-android-builder',
      workflow_id: 'eas-build-android.yml',
      ref: 'main',
      inputs: {
        profile: profile
      }
    });
  }

  async getBuildStatus(runId) {
    // Consultar status del workflow
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    const { data } = await octokit.rest.actions.getWorkflowRun({
      owner: 'your-github-username',
      repo: 'expo-android-builder',
      run_id: runId
    });

    return data;
  }
}
```

**Frontend**: Agregar UI en BuildStatusScreen para triggerar GitHub Actions

```javascript
// app/screens/BuildStatusScreen.js - Agregar botón
<Button
  mode="contained"
  onPress={() => triggerGithubActionsBuild()}
  loading={buildLoading}
>
  🚀 Build con GitHub Actions
</Button>
```

---

### Fase 2: Optimizaciones del Workflow (Opcional)

Una vez que tengas el workflow básico funcionando, puedes agregar estas optimizaciones:

#### 2.1. Mejorar Caché de Gradle

El workflow ya incluye caché de Gradle con `cache: 'gradle'`. Para optimizar aún más:

```yaml
- name: 📦 Cache Gradle wrapper
  uses: actions/cache@v4
  with:
    path: |
      ~/.gradle/caches
      ~/.gradle/wrapper
    key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
    restore-keys: |
      ${{ runner.os }}-gradle-
```

#### 2.2. Notificaciones por Webhook

Notificar a tu app móvil cuando el build termine:

```yaml
- name: 📧 Notify app via webhook
  if: always()
  run: |
    curl -X POST https://tu-vps.com/api/build-notifications \
      -H "Authorization: Bearer ${{ secrets.API_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{
        "status": "${{ job.status }}",
        "run_id": "${{ github.run_id }}",
        "build_type": "${{ github.event.inputs.build_type }}"
      }'
```

#### 2.3. Versionado Automático (Opcional)

Incrementar versión en app.json antes del build:

```yaml
- name: 📈 Bump version
  working-directory: ${{ github.event.inputs.project_path }}
  run: |
    # Incrementar versionCode en app.json
    node -e "
      const fs = require('fs');
      const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
      appJson.expo.android.versionCode = (appJson.expo.android.versionCode || 0) + 1;
      fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2));
    "
```

#### 2.4. Múltiples Proyectos en Paralelo

Si quieres compilar varios proyectos a la vez:

```yaml
strategy:
  matrix:
    project: [project1, project2, project3]
```

---

## Configuración de Seguridad

### Secrets Requeridos en GitHub

| Secret Name | Descripción | Requerido | Notas |
|------------|-------------|-----------|-------|
| `ANDROID_KEYSTORE_BASE64` | Keystore en base64 | ✅ Sí | Para builds release firmados |
| `ANDROID_KEY_ALIAS` | Alias de la key | ✅ Sí | Ej: `expo-android-builder` |
| `ANDROID_STORE_PASSWORD` | Password del keystore | ✅ Sí | Guardarlo seguro |
| `ANDROID_KEY_PASSWORD` | Password de la key | ✅ Sí | Puede ser igual al anterior |
| `GITHUB_TOKEN` | Token para API de GitHub | ⚠️ Opcional | Solo si triggeas desde backend |

### Variables de Entorno en .env (Server)

```bash
# Backend - server/.env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=expo-android-builder
```

---

## Integración con la App Actual

### Modificaciones en Backend

1. **Nuevo servicio**: `server/src/services/GithubActionsService.js`
2. **Nuevo endpoint**: `POST /api/builds/github-actions/trigger`
3. **Nuevo endpoint**: `GET /api/builds/github-actions/status/:runId`

### Modificaciones en Frontend

1. **BuildStatusScreen**: Agregar botón "Build con GitHub Actions"
2. **Nueva screen** (opcional): `GithubActionsBuildScreen.js` para monitorear builds
3. **Notificaciones**: Push notifications cuando build termine

---

## Costos y Límites

### GitHub Actions (Plan Gratuito - Repositorio Público)

| Recurso | Límite | Notas |
|---------|--------|-------|
| Minutos de ejecución | 2000/mes | ~133 builds de 15min |
| Storage artifacts | 500 MB | Artifacts se borran a los 90 días |
| Workflows concurrentes | 20 | Más que suficiente |

### Expo EAS (Plan Gratuito)

| Recurso | Límite | Notas |
|---------|--------|-------|
| Builds Android | Limitado | Verificar en expo.dev/pricing |
| Storage | 1 GB | Para artifacts |
| Build concurrentes | 1 | Uno a la vez |

### Recomendación de Uso

- **SIEMPRE**: Usar Gradle Build en GitHub Actions (ilimitado, gratis, rápido)
- **Desarrollo**: Build debug para testing rápido
- **Releases**: Build release firmado para producción
- **Fallback** (solo si agotaste 2000 min/mes): EAS Build que ya tienes configurado

---

## Cronograma de Implementación

### Día 1-2: Setup Básico
- [ ] Generar signing keystore con keytool
- [ ] Convertir a base64
- [ ] Configurar GitHub Secrets (keystore, passwords, alias)
- [ ] Crear directorio `.github/workflows/`
- [ ] Crear workflow `gradle-build-android.yml`
- [ ] Commit y push a GitHub

### Día 3: Primer Build de Prueba
- [ ] Ir a GitHub Actions > Android Native Build
- [ ] Trigger manual con un proyecto de prueba
- [ ] Verificar que build completa exitosamente
- [ ] Descargar APK desde artifacts
- [ ] Instalar APK en dispositivo para verificar

### Semana 2: Optimizaciones
- [ ] Agregar caché de Gradle
- [ ] Agregar caché de npm/node_modules
- [ ] Optimizar tiempos de build
- [ ] Configurar retención de artifacts

### Semana 3: Integración Backend (Opcional)
- [ ] Implementar GithubActionsService
- [ ] Crear endpoints API para trigger
- [ ] Endpoint para consultar status
- [ ] Endpoint para descargar APK
- [ ] Probar trigger desde Postman/curl

### Semana 4: Integración Frontend (Opcional)
- [ ] Modificar BuildStatusScreen
- [ ] Agregar botón "Build con GitHub Actions"
- [ ] Implementar polling de estado
- [ ] Mostrar progreso del build
- [ ] Permitir descargar APK directamente
- [ ] Testing end-to-end

**Nota**: Las semanas 3-4 son opcionales. Puedes usar GitHub Actions desde la UI directamente sin integrar con tu app.

---

## Testing Plan

### Tests Manuales

1. **Trigger desde GitHub UI**:
   - Actions > EAS Build Android > Run workflow
   - Verificar que build inicia en Expo
   - Confirmar que APK se genera

2. **Trigger desde Backend**:
   - POST /api/builds/github-actions/trigger
   - Verificar workflow_dispatch en GitHub
   - Verificar build en Expo

3. **Trigger desde App Móvil**:
   - Abrir BuildStatusScreen
   - Tap en "Build con GitHub Actions"
   - Monitorear progreso

### Tests de Límites

- Verificar comportamiento al alcanzar límite de minutos
- Verificar límite de storage de artifacts
- Probar con múltiples builds concurrentes

---

## Rollback Plan

Si GitHub Actions no funciona como esperado:

1. **Mantener VPS build** como fallback (aunque sea lento)
2. **Documentar problemas** encontrados
3. **Evaluar opciones pagas**:
   - GitHub Actions Pro ($4/mes, 3000 minutos)
   - Expo EAS pago (builds ilimitados)
   - Otros CI/CD (CircleCI, Travis, etc.)

---

## Recursos y Referencias

### Documentación Oficial

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Expo GitHub Action](https://github.com/expo/expo-github-action)

### Ejemplos de Workflows

- [Expo GitHub Actions Examples](https://github.com/expo/expo-github-action/tree/main/examples)
- [React Native CI/CD Examples](https://reactnative.dev/docs/running-on-device)

### Comunidad

- [Expo Discord](https://discord.gg/expo)
- [GitHub Community Forum](https://github.community)

---

## Conclusión

**Recomendación Final**: Implementar **Opción 1 (Build Nativo con Gradle en GitHub Actions)** como solución principal.

**Razones**:
1. ✅ **PRÁCTICAMENTE ILIMITADO**: 133 builds/mes vs límites muy restrictivos de EAS
2. ✅ **GRATIS** para repositorios públicos (2000 min/mes)
3. ✅ **CONTROL TOTAL** sin dependencias externas
4. ✅ **MÁS RÁPIDO** que tu VPS (10-15 min vs 20+ min interrumpidos)
5. ✅ **INFRAESTRUCTURA POTENTE**: 2 CPU cores, 7GB RAM
6. ✅ APK disponible inmediatamente como artifact
7. ✅ Sin límites arbitrarios de servicios externos

**Plan B**: EAS Build ya lo tienes configurado, puedes usarlo ocasionalmente si se agotan los 2000 min/mes (muy improbable).

**Comparación de Capacidades**:
- **EAS Free**: ~10-20 builds/mes (límites restrictivos) ❌
- **GitHub Actions Free**: ~133 builds/mes (2000 minutos) ✅
- **Tu VPS**: Interrupciones por falta de recursos ❌
- **GitHub Actions Pro** ($4/mes): ~200 builds/mes (si lo necesitas)

---

**Próximos Pasos**:
1. ✅ Revisar y aprobar este plan
2. 🔑 Generar signing keystore (una sola vez)
3. 🔐 Configurar GitHub Secrets
4. 📝 Crear workflow `.github/workflows/gradle-build-android.yml`
5. 🧪 Probar primer build desde GitHub UI
6. 🔌 Integrar con tu app móvil (opcional, para trigger automático)
7. 🚀 Disfrutar de builds ilimitados

