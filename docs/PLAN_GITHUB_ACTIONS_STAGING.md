# Plan: GitHub Actions Staging System for User-Created Projects

## Objetivo

Permitir que GitHub Actions compile **cualquier proyecto** creado por usuarios a través de la app, no solo proyectos que estén dentro del repositorio Git. Esto hace la app escalable para múltiples usuarios sin limitaciones.

## Problema Actual

- Proyectos de usuarios se almacenan en `/data/data/com.termux/files/home/app-builder-projects/` (FUERA del repositorio)
- GitHub Actions solo puede compilar código DENTRO del repositorio
- El workflow actual está hardcodeado para compilar siempre `/app`
- Cuando un usuario crea un proyecto con la app y triggera un build de GitHub Actions, se compila el proyecto incorrecto

## Solución: Sistema de Staging con Branches Temporales

### Flujo de Trabajo

1. **Usuario trigger build** → App llama a backend
2. **Backend copia proyecto** a `temp-builds/[project-name]/` en el repo
3. **Backend crea branch temporal** → `build/[project-name]-[timestamp]-[hash]`
4. **Backend hace git commit + push** → Sube a GitHub
5. **Backend trigger workflow** en esa branch con `project_path: temp-builds/[project-name]`
6. **GitHub Actions compila** el proyecto desde temp-builds
7. **Genera APK** y sube como artifact
8. **Auto-cleanup** (opcional) → Borra branch temporal después del build

### Ventajas

- ✅ Compila cualquier proyecto creado por usuarios
- ✅ Mantiene branch `main` limpia (no contamina historial)
- ✅ Escalable para múltiples usuarios
- ✅ Branches se pueden borrar después del build
- ✅ Sigue siendo gratuito (2000 min/mes)

---

## Implementación

### Fase 1: Backend - Servicio de Staging

#### 1.1 Crear GitStagingService.js

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/server/src/services/GitStagingService.js`

**Métodos principales**:

```javascript
class GitStagingService {
  async stageProject(projectName) {
    // 1. Validar proyecto existe y es válido
    // 2. Generar nombre de branch único: build/[name]-[timestamp]-[hash]
    // 3. Crear directorio temp-builds/[projectName]
    // 4. Copiar archivos del proyecto (excluir node_modules, .git, android, ios)
    // 5. Crear/checkout branch temporal
    // 6. Git add + commit
    // 7. Push a GitHub
    // 8. Retornar metadata (branchName, projectPath, commitHash)
  }

  async copyProjectFiles(sourcePath, destPath) {
    // Usar rsync para copiar eficientemente
    // Excluir: node_modules, .git, android, ios, .expo
    // Estos se regeneran con expo prebuild
  }

  async createTempBranch(branchName) {
    // Checkout main
    // Crear y checkout nueva branch
    // Manejar si branch ya existe (borrarla primero)
  }

  async commitStagedFiles(projectName) {
    // git add temp-builds/[projectName]
    // git commit con mensaje descriptivo
    // Retornar commit hash
  }

  async pushBranch(branchName) {
    // Configurar remote con GitHub token temporalmente
    // git push -u origin [branchName]
    // Restaurar remote URL original
    // Retry logic (3 intentos) para errores de red
  }

  async deleteTempBranch(branchName) {
    // Borrar remote branch via GitHub API
    // Borrar local branch
    // Manejar errores gracefully
  }

  async cleanupTempBuild(projectName) {
    // Borrar temp-builds/[projectName] localmente
    // Manejar errores (no crítico)
  }

  generateBranchName(projectName) {
    // Formato: build/[projectName]-[timestamp]-[shortHash]
    // Ejemplo: build/my-app-1704297600-a3f9c2
  }

  async validateForStaging(projectName) {
    // Validar proyecto existe
    // Validar tiene package.json y app.json
    // Validar tamaño (max 50MB sin node_modules)
    // Validar repo está limpio (no uncommitted changes)
    // Validar GitHub token configurado
  }
}
```

**Manejo de errores**:
- Crear clase `StagingError` con códigos: PROJECT_NOT_FOUND, DIRTY_REPO, PUSH_FAILED, etc.
- Logging detallado en cada operación
- Cleanup automático en caso de error

#### 1.2 Actualizar GitHubActionsService.js

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/server/src/services/GitHubActionsService.js`

**Cambios**:
```javascript
// Agregar parámetro 'ref' para branch dinámica
async triggerBuild(projectPath, buildType = 'debug', ref = 'main') {
  // Cambiar de 'main' hardcoded a usar 'ref' dinámico
  const response = await this.apiClient.post(
    `/repos/.../dispatches`,
    {
      ref: ref, // Nueva línea
      inputs: { project_path: projectPath, build_type: buildType }
    }
  );
}

// Nuevo método para borrar branches
async deleteBranch(branchName) {
  await this.apiClient.delete(
    `/repos/.../git/refs/heads/${branchName}`
  );
}

// Nuevo método para listar branches
async listBranches(pattern = 'build/') {
  // GET /repos/.../branches
  // Filtrar por patrón
}
```

### Fase 2: Backend - API Routes

#### 2.1 Nuevos Endpoints en githubActions.js

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/server/src/routes/githubActions.js`

**Endpoints a crear**:

1. **POST /api/github-actions/build-user-project** (Endpoint principal)
   - Input: `{ projectName, buildType }`
   - Hace: prepare + trigger en una sola llamada
   - Output: `{ success, staging, build, viewUrl, cleanupInfo }`

2. **POST /api/github-actions/prepare-project**
   - Input: `{ projectName }`
   - Hace: Staging del proyecto
   - Output: `{ success, staging: { branchName, projectPath, commitHash } }`

3. **POST /api/github-actions/trigger-staged**
   - Input: `{ branchName, projectPath, buildType }`
   - Hace: Trigger workflow en branch temporal
   - Output: `{ success, data, viewUrl }`

4. **DELETE /api/github-actions/cleanup/:branchName**
   - Query: `?projectName=...`
   - Hace: Borra branch remota, local, y archivos temporales
   - Output: `{ success, cleaned: { branch, localPath } }`

5. **GET /api/github-actions/temp-branches**
   - Hace: Lista branches temporales
   - Output: `{ success, branches, count }`

**Seguridad**:
- Rate limiting: Max 5 staging requests por 15 minutos
- Validación estricta de project names
- Autenticación con Bearer token

### Fase 3: Configuración

#### 3.1 Actualizar constants.js

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/server/src/config/constants.js`

**Cambios**:
```javascript
ALLOWED_COMMANDS: [
  'npx create-expo-app',
  'claude code',
  'eas build',
  'git init',
  'git add',
  'git commit',
  'git push',      // NUEVO
  'git checkout',  // NUEVO
  'git branch',    // NUEVO
  'git status',    // NUEVO
  'git remote',    // NUEVO
  'rsync',         // NUEVO - para copiar archivos
  'npm install'
],

// Nuevas constantes
TEMP_BUILDS_PATH: path.join(__dirname, '../../../temp-builds'),
MAX_TEMP_BRANCH_AGE_HOURS: 24,
```

#### 3.2 Actualizar .gitignore

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/.gitignore`

**Agregar**:
```
# Temporary build staging area
temp-builds/
```

#### 3.3 Actualizar .env

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/server/.env`

**Agregar** (opcional):
```env
# Git configuration for staging
GIT_USER_NAME=Expo Android Builder
GIT_USER_EMAIL=builder@example.com

# Cleanup settings
AUTO_CLEANUP_TEMP_BRANCHES=true
TEMP_BRANCH_MAX_AGE_HOURS=24
```

### Fase 4: GitHub Actions Workflow

#### 4.1 Modificar gradle-build-android.yml

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/.github/workflows/gradle-build-android.yml`

**Cambios**:

1. **Agregar step de verificación** (después de checkout):
```yaml
- name: 🔍 Verify project exists
  run: |
    if [ ! -d "${{ github.event.inputs.project_path }}" ]; then
      echo "❌ Error: Project path not found"
      exit 1
    fi
    echo "✅ Project found at ${{ github.event.inputs.project_path }}"
```

2. **Actualizar Build Summary** (agregar branch info):
```yaml
- name: 📊 Build Summary
  run: |
    echo "- **Branch**: ${{ github.ref_name }}" >> $GITHUB_STEP_SUMMARY
```

3. **Condicionar GitHub Release** (solo en main):
```yaml
- name: 🎉 Create GitHub Release
  if: ${{ github.event.inputs.build_type == 'release' && github.ref == 'refs/heads/main' }}
```

**Nota**: El workflow YA acepta `project_path` dinámico, solo necesita estos pequeños ajustes.

### Fase 5: Frontend - Actualizar BuildStatusScreen

#### 5.1 Modificar startBuild()

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/app/screens/BuildStatusScreen.js`

**Cambios en línea ~407**:
```javascript
if (buildType === 'GITHUB') {
  const buildTypeGH = profile === 'preview' ? 'debug' : 'release';

  // CAMBIAR DE:
  // const result = await githubActionsApi.trigger('app', buildTypeGH);

  // A:
  const result = await githubActionsApi.buildUserProject(
    project.name,  // Usar nombre del proyecto actual
    buildTypeGH
  );

  // ... resto del código
}
```

#### 5.2 Actualizar githubActionsApi

**Archivo**: `/data/data/com.termux/files/home/expo-android-builder/app/services/api.js`

**Agregar método**:
```javascript
export const githubActionsApi = {
  trigger: (projectPath, buildType) =>
    api.post('/github-actions/trigger', { projectPath, buildType }),
  getRuns: (limit = 10) =>
    api.get('/github-actions/runs', { params: { limit } }),
  getArtifacts: (runId) =>
    api.get(`/github-actions/runs/${runId}/artifacts`),
  getStatus: () =>
    api.get('/github-actions/status'),

  // NUEVO
  buildUserProject: (projectName, buildType) =>
    api.post('/github-actions/build-user-project', { projectName, buildType }),

  // NUEVO (opcional para UI avanzada)
  prepareProject: (projectName) =>
    api.post('/github-actions/prepare-project', { projectName }),
  cleanupBranch: (branchName, projectName) =>
    api.delete(`/github-actions/cleanup/${branchName}`, { params: { projectName } }),
};
```

---

## Manejo de Edge Cases

### 1. Branch ya existe
- Detectar con `git branch` y GitHub API
- Borrar branch existente (local y remota)
- Crear branch fresca

### 2. Push falla (red/auth)
- Retry logic: 3 intentos con delays incrementales
- Logging detallado del error
- Limpiar estado local si falla

### 3. Proyecto muy grande
- Validar tamaño antes de staging (max 50MB sin node_modules)
- Retornar error claro: PROJECT_TOO_LARGE

### 4. Builds concurrentes del mismo proyecto
- Map de `activeStagings` en memoria
- Rechazar si proyecto ya está en staging
- Error: STAGING_IN_PROGRESS

### 5. Repo con uncommitted changes
- Validar con `git status --porcelain`
- Rechazar si hay cambios
- Error: DIRTY_REPO

### 6. Cleanup falla
- Non-critical: No detener operación
- Logging para limpieza manual posterior
- Crear `.failed-cleanups.json` para trackear

---

## Estrategia de Cleanup

### Opción 1: Manual (Inicial)
- Usuario puede ver temp branches en UI
- Botón para borrar branches manualmente
- Endpoint: `DELETE /api/github-actions/cleanup/:branchName`

### Opción 2: Auto-cleanup (Futuro)
- Webhook de GitHub cuando workflow completa
- Auto-borrar branch si build exitoso
- Mantener branch si build falló (para debugging)

### Opción 3: Scheduled (Futuro - VPS)
- Cron job: Cada 24 horas
- Borrar branches con más de 24 horas de antigüedad
- Endpoint: `POST /api/github-actions/cleanup-old-branches`

---

## Secuencia de Implementación

### Día 1-2: Backend Core
1. Crear `GitStagingService.js` con todos los métodos
2. Agregar comandos git a `ALLOWED_COMMANDS`
3. Crear clases de error custom
4. Testing manual de cada método

### Día 3: API Endpoints
1. Modificar `GitHubActionsService.js` (agregar ref, deleteBranch)
2. Crear nuevos endpoints en `githubActions.js`
3. Testing con Postman/curl

### Día 4: Workflow & Config
1. Modificar `.github/workflows/gradle-build-android.yml`
2. Actualizar `.gitignore`
3. Testing manual con trigger desde GitHub UI

### Día 5: Frontend
1. Actualizar `BuildStatusScreen.js`
2. Actualizar `api.js`
3. Testing end-to-end desde la app

### Día 6: Testing & Polish
1. Testing de edge cases
2. Testing de errores y retry logic
3. Verificar cleanup funciona
4. Documentación

---

## Archivos Críticos a Modificar

### Nuevos archivos:
1. `/server/src/services/GitStagingService.js` - **NUEVO** (Core del sistema)

### Archivos a modificar:
2. `/server/src/services/GitHubActionsService.js` - Agregar parámetro ref, deleteBranch, listBranches
3. `/server/src/routes/githubActions.js` - Agregar 5 nuevos endpoints
4. `/server/src/config/constants.js` - Agregar comandos git y constantes
5. `/.github/workflows/gradle-build-android.yml` - Agregar verificación y condicionales
6. `/.gitignore` - Agregar temp-builds/
7. `/app/screens/BuildStatusScreen.js` - Cambiar de hardcoded 'app' a project.name
8. `/app/services/api.js` - Agregar buildUserProject()

### Archivos opcionales:
9. `/server/.env` - Agregar variables de git config (opcional)
10. `/server/src/middleware/rateLimit.js` - Rate limiting para staging (recomendado)

---

## Validación del Plan

### ¿Resuelve el problema?
✅ Sí. Permite compilar cualquier proyecto creado por usuarios, no solo `/app`

### ¿Es escalable?
✅ Sí. Funciona para múltiples usuarios y proyectos

### ¿Mantiene main limpia?
✅ Sí. Usa branches temporales que se pueden borrar

### ¿Es eficiente?
✅ Sí. Solo copia archivos necesarios (excluye node_modules)

### ¿Es seguro?
✅ Sí. Validación estricta, rate limiting, sanitización de paths

### ¿Usa recursos gratuitos?
✅ Sí. GitHub Actions free tier: 2000 min/mes (~133 builds)

---

## Rollback Plan

Si algo sale mal:

1. **Deshabilitar staging**: `ENABLE_STAGING=false` en .env
2. **Workflow original sigue funcionando**: Puede compilar `/app` normalmente
3. **Limpieza manual**:
   ```bash
   # Borrar branches locales
   git branch | grep 'build/' | xargs git branch -D

   # Borrar branches remotas
   git branch -r | grep 'build/' | sed 's/origin\///' | xargs -I {} git push origin --delete {}

   # Limpiar temp-builds
   rm -rf temp-builds/*
   ```

---

## Próximos Pasos Después de Implementar

1. **Monitoreo**: Trackear uso de GitHub Actions minutes
2. **Optimización**: Reducir tiempo de build si es necesario
3. **UI Mejorada**: Pantalla de cleanup de branches en la app
4. **Webhooks**: Auto-cleanup cuando build completa
5. **Documentación**: Guía para usuarios finales

---

## Notas Importantes

- **GitHub Token**: Ya está configurado
- **Scopes necesarios**: `repo` y `workflow` (ya configurados)
- **Tiempo estimado total**: ~6 días de desarrollo
- **Complejidad**: Media-Alta
- **Riesgo**: Bajo (rollback fácil, no afecta funcionalidad existente)
