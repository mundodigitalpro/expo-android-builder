# GUIA_INTEGRACION_CODEX.md

Guia para la integracion de Codex CLI en Expo Android Builder.

## Resumen

La integracion de Codex permite chatear con proyectos desde la app usando el CLI de Codex instalado en Termux. El flujo es:

1. La app envia el prompt via `POST /api/codex/execute`.
2. El backend ejecuta `codex exec --json` en el directorio del proyecto.
3. El backend parsea eventos JSON y los emite por WebSocket (`codex:*`).
4. La app muestra los mensajes en tiempo real y guarda el `threadId` para continuar contexto.

## Requisitos

- Codex CLI instalado y disponible en PATH (ej: `codex --version`).
- Sesion activa (si es necesario): `codex login`.
- Servidor corriendo en Termux (`./start-all-services.sh`).

## Endpoint REST

### POST /api/codex/execute

Body:
```json
{
  "projectPath": "/ruta/al/proyecto",
  "prompt": "instruccion",
  "socketId": "<socket-id>",
  "threadId": "opcional"
}
```

Respuesta:
```json
{
  "sessionId": "codex-<timestamp>-<rand>"
}
```

### POST /api/codex/cancel

Body:
```json
{
  "sessionId": "codex-<timestamp>-<rand>"
}
```

## Eventos WebSocket

- `codex:output`: mensajes del asistente o tools.
- `codex:error`: errores de stderr o fallos del proceso.
- `codex:complete`: fin de ejecucion con exit code.
- `codex:thread`: threadId detectado para continuar contexto.

## Parsing de eventos JSON

Codex emite JSONL con tipos como:

```json
{"type":"thread.started","thread_id":"..."}
{"type":"item.completed","item":{"type":"agent_message","text":"..."}}
```

El backend:
- Captura `thread_id` cuando llega `thread.started`.
- Emite texto cuando `item.completed` o `item.delta` contiene `item.type: "agent_message"`.
- Ignora `item.type: "reasoning"` para no duplicar contenido interno.

## Archivos clave

- `server/src/services/CodexService.js`
- `server/src/routes/codex.js`
- `server/server.js` (registro del router)
- `app/screens/AICodeScreen.js` (UI y listeners)
- `app/services/api.js` (codexApi)

## Troubleshooting

1) No llegan mensajes en la app
- Verifica `codex --version`.
- Asegura que el backend este corriendo.
- Revisa logs del servidor para ver eventos `Codex process spawned`.

2) No mantiene contexto
- Confirma que llega `codex:thread` en logs.
- Asegura que el frontend guarda `threadId` y lo envia en el siguiente prompt.

3) Error de permisos
- Revisa que Codex tenga acceso al proyecto y que el proceso se ejecute en `cwd` correcto.

