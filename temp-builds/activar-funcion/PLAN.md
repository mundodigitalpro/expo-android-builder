# Plan de Implementación: Botón de Linterna

## Objetivo
Implementar un botón que permita activar y desactivar la linterna del dispositivo móvil.

## Análisis Técnico

### Tecnologías y Dependencias
- **React Native**: 0.81.5
- **Expo SDK**: 54
- **Paquete necesario**: `expo-camera` (proporciona acceso a la funcionalidad de la linterna)

### Componentes a Desarrollar

1. **Interfaz de Usuario**
   - Botón principal para activar/desactivar linterna
   - Indicador visual del estado (encendido/apagado)
   - Diseño centrado y accesible
   - Manejo de estados de carga

2. **Lógica de Control**
   - Hook personalizado para gestionar el estado de la linterna
   - Manejo de permisos de cámara (requerido para acceder a la linterna)
   - Control de errores y casos edge (dispositivo sin linterna, permisos denegados)
   - Estado local para toggle on/off

## Pasos de Implementación

### Fase 1: Instalación de Dependencias
```bash
npx expo install expo-camera
```

### Fase 2: Solicitud de Permisos
- Implementar verificación de permisos de cámara
- Solicitar permisos al usuario si no están concedidos
- Manejar casos de permisos denegados con mensajes informativos

### Fase 3: Implementación del Componente
- Crear estado para controlar encendido/apagado
- Implementar funciones para toggle de linterna usando `expo-camera`
- Diseñar UI responsive y accesible
- Agregar feedback visual para el usuario

### Fase 4: Manejo de Errores
- Validar disponibilidad de linterna en el dispositivo
- Capturar y mostrar errores de manera amigable
- Implementar fallbacks para dispositivos sin soporte

### Fase 5: Pruebas
- Probar en dispositivos Android
- Probar en dispositivos iOS
- Validar comportamiento con permisos denegados
- Probar en dispositivos sin linterna

## Estructura de Archivos

```
/app-builder-projects/activar-funcion/
├── App.js (modificado - componente principal con funcionalidad de linterna)
├── package.json (actualizado con expo-camera)
└── PLAN.md (este archivo)
```

## Consideraciones Técnicas

### Permisos
- **Android**: `CAMERA` permission (automáticamente manejado por expo-camera)
- **iOS**: `NSCameraUsageDescription` (ya configurado en app.json si es necesario)

### Limitaciones Conocidas
- La funcionalidad de linterna no está disponible en simuladores/emuladores
- Requiere dispositivo físico para pruebas reales
- No disponible en web (plataforma no soportada para esta funcionalidad)

### Compatibilidad
- Android: API 21+ (configurado en app.json)
- iOS: iOS 13.4+ (configurado en app.json)
- Web: No soportado (la API de linterna no existe en navegadores)

## API Principal Utilizada

```javascript
import { Camera } from 'expo-camera';

// Solicitar permisos
const { status } = await Camera.requestCameraPermissionsAsync();

// Activar linterna
await Camera.setFlashlightEnabledAsync(true);

// Desactivar linterna
await Camera.setFlashlightEnabledAsync(false);

// Verificar si el dispositivo tiene linterna
const hasFlashlight = await Camera.isAvailableAsync();
```

## Mejoras Futuras (Opcional)

1. **Intensidad de luz**: Implementar control de intensidad si el dispositivo lo soporta
2. **Modo SOS**: Patrón de parpadeo para emergencias
3. **Widget de acceso rápido**: Acceso desde la pantalla de inicio
4. **Temporizador**: Apagado automático después de X minutos
5. **Modo estroboscópico**: Diferentes patrones de parpadeo

## Criterios de Aceptación

- ✓ El botón activa la linterna correctamente
- ✓ El botón desactiva la linterna correctamente
- ✓ Se solicitan permisos de cámara adecuadamente
- ✓ Se manejan errores y casos edge de forma amigable
- ✓ La UI es clara e intuitiva
- ✓ Funciona en dispositivos Android e iOS
- ✓ El estado visual refleja el estado real de la linterna

## Notas para el Equipo

- Probar siempre en dispositivos físicos (no funciona en emuladores)
- Verificar que los permisos de cámara están configurados correctamente
- Considerar el impacto en la batería del dispositivo
- La linterna se apaga automáticamente cuando la app pasa a segundo plano (comportamiento del sistema)
