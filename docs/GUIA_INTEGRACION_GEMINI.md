# Guía de Integración Gemini CLI

**Fecha:** 10 de Enero, 2026
**Estado:** ✅ Completado
**Mantenido por:** Gemini

---

## 🎯 Objetivo
Proporcionar una alternativa a Claude Code y Amp Code mediante la integración directa de la CLI de Gemini (`gemini`) en el ecosistema de Expo Android Builder. Esto permite a los usuarios elegir entre múltiples proveedores de IA para la generación y modificación de código.

## 🏗 Arquitectura

La integración sigue el mismo patrón establecido por Claude y Amp:

1.  **Frontend (App):**
    *   `AICodeScreen.js`: Pantalla unificada que maneja la selección del proveedor (Claude, Gemini, Amp).
    *   `geminiApi`: Servicio en `api.js` para comunicación HTTP con el backend.
    *   WebSocket events: `gemini:output`, `gemini:error`, `gemini:thread` para streaming en tiempo real.

2.  **Backend (Server):**
    *   `GeminiService.js`: Wrapper alrededor del proceso `spawn('gemini')`.
    *   `routes/gemini.js`: Endpoints REST (`/execute`, `/cancel`).
    *   Gestión de procesos: Control de sesiones activas y PID.

3.  **CLI (Termux/System):**
    *   Uso directo del comando `gemini`.
    *   Argumentos clave: `--output-format stream-json`, `--yolo` (para evitar confirmaciones interactivas).

---

## 🛠 Componentes Implementados

### 1. Servicio Backend (`GeminiService.js`)
Ubicación: `server/src/services/GeminiService.js`

Este servicio es el núcleo de la integración. Sus responsabilidades son:
*   **Verificación:** Comprueba si `gemini --version` retorna éxito al iniciar.
*   **Ejecución:** Lanza procesos hijos con `spawn`.
*   **Streaming JSON:** Parsea la salida de Gemini que viene en formato `stream-json`.
*   **Manejo de Contexto:** Captura el `session_id` del mensaje `init` para permitir conversaciones continuas (hilos).
*   **Sanitización:** Filtra mensajes de eco del usuario (`role: user`) para no duplicarlos en la UI.

**Snippet clave de parsing:**
```javascript
case 'init':
    if (message.session_id) {
        socket.emit('gemini:thread', { sessionId, threadId: message.session_id });
    }
    break;
```

### 2. API REST (`routes/gemini.js`)
Ubicación: `server/src/routes/gemini.js`

*   `POST /api/gemini/execute`: Inicia una sesión o continúa un hilo existente.
    *   Body: `{ projectPath, prompt, socketId, threadId }`
*   `POST /api/gemini/cancel`: Detiene una sesión activa vía `SIGTERM`.

### 3. Frontend (`AICodeScreen.js`)
Ubicación: `app/screens/AICodeScreen.js`

*   **Selector de Proveedor:** Toggle de 3 estados (Claude / Gemini / Amp).
*   **Estilos Visuales:** Tema púrpura (`#f3e5f5` fondo, `#9c27b0` borde) para distinguir mensajes de Gemini.
*   **Persistencia de Hilo:** Almacena `threadId` en el estado del componente para enviarlo en siguientes mensajes.

---

## 🚀 Cómo Usar

### Requisitos Previos
1.  Tener instalado Gemini CLI en el sistema (Termux o VPS).
    ```bash
    npm install -g @google/gemini-cli  # (Comando hipotético, asumiendo instalación previa)
    # O asegurar que el binario 'gemini' está en el PATH
    ```
2.  Estar autenticado (si la CLI lo requiere).

### Flujo de Usuario
1.  Abrir la app y navegar a un proyecto.
2.  Seleccionar "AI Chat" (o navegar a la pantalla de código).
3.  En el selector superior, elegir **✨ Gemini**.
4.  Escribir un prompt (ej: "Crea un componente de botón").
5.  Gemini procesará la solicitud y responderá en tiempo real.
6.  El contexto se mantiene: puedes decir "Cambia el color a rojo" y entenderá a qué te refieres.

---

## 🐛 Solución de Problemas Comunes

**1. El chat repite mi pregunta**
*   **Causa:** La CLI de Gemini devuelve el mensaje del usuario en el stream JSON.
*   **Solución:** `GeminiService.js` filtra los mensajes con `role: 'user'`. Asegúrate de tener la última versión del servicio.

**2. No mantiene el contexto (olvida lo anterior)**
*   **Causa:** No se está enviando el `threadId` o `--resume`.
*   **Verificación:** Revisa los logs del servidor para ver `Resuming Gemini thread`. Asegúrate de que el frontend recibe el evento `gemini:thread`.

**3. Error "Gemini CLI not available"**
*   **Causa:** El servidor no encuentra el comando `gemini` en el PATH.
*   **Solución:** Verifica `gemini --version` en la terminal donde corre el servidor. Reinicia el servidor si acabas de instalar la CLI.

---

## 🔮 Futuras Mejoras
*   [ ] Soporte para cancelación más robusta (asegurar limpieza de procesos hijos).
*   [ ] Visualización de uso de tokens (si la API lo provee en `stats`).
*   [ ] Configuración de modelo (actualmente usa el default de la CLI).
