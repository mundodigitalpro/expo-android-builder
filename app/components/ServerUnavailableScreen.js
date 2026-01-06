import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Clipboard,
  Alert,
} from 'react-native';
import LoadingSpinner from './LoadingSpinner';
import { DEFAULT_SERVER_URL } from '../config';

export default function ServerUnavailableScreen({
  onRetry,
  serverUrl,
  lastError,
  onUpdateServerUrl,
}) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [customUrl, setCustomUrl] = useState(serverUrl || '');

  const STARTUP_COMMAND = 'cd ~/expo-android-builder/server && ./start-all-services.sh';
  const DEFAULT_URLS = {
    local: 'http://localhost:3001',
  };

  useEffect(() => {
    setCustomUrl(serverUrl || '');
  }, [serverUrl]);

  const handleCopyCommand = () => {
    Clipboard.setString(STARTUP_COMMAND);
    Alert.alert(
      'Comando Copiado',
      'El comando ha sido copiado al portapapeles. Pégalo en Termux para iniciar los servicios.'
    );
  };

  const handleOpenTermux = async () => {
    try {
      const canOpen = await Linking.canOpenURL('termux://');
      if (canOpen) {
        await Linking.openURL('termux://');
      } else {
        Alert.alert(
          'Termux No Encontrado',
          'Por favor, abre Termux manualmente e ejecuta el comando.'
        );
      }
    } catch (error) {
      console.error('Error opening Termux:', error);
      Alert.alert('Error', 'No se pudo abrir Termux automáticamente');
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry();
    setIsRetrying(false);
  };

  const handleApplyUrl = async (nextUrl) => {
    const trimmedUrl = (nextUrl || '').trim();
    if (!trimmedUrl) {
      Alert.alert('Error', 'Ingresa una URL valida');
      return;
    }
    if (onUpdateServerUrl) {
      await onUpdateServerUrl(trimmedUrl);
    }
    setCustomUrl(trimmedUrl);
  };

  const handleApplyAndRetry = async () => {
    await handleApplyUrl(customUrl);
    await handleRetry();
  };

  const handleUsePreset = async (presetUrl) => {
    await handleApplyUrl(presetUrl);
    await handleRetry();
  };

  const handleCopyDiagnostics = () => {
    const lines = [
      `URL: ${serverUrl || '-'}`,
      lastError?.status ? `HTTP: ${lastError.status}` : null,
      lastError?.code ? `Code: ${lastError.code}` : null,
      lastError?.message ? `Message: ${lastError.message}` : null,
      lastError?.detail ? `Detail: ${lastError.detail}` : null,
      lastError?.time ? `Time: ${lastError.time}` : null,
    ].filter(Boolean);
    Clipboard.setString(lines.join('\n'));
    Alert.alert('Diagnostico Copiado', 'Se copio el diagnostico al portapapeles.');
  };

  if (isRetrying) {
    return <LoadingSpinner message="Verificando conexión..." />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {/* Icono de Error */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⚠️</Text>
        </View>

        {/* Título */}
        <Text style={styles.title}>Servidor No Disponible</Text>

        {/* Mensaje */}
        <Text style={styles.message}>
          El servidor backend no está corriendo.{'\n'}
          Para usar la app, necesitas iniciar los servicios.
        </Text>

        {/* Instrucciones */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Instrucciones:</Text>
          <Text style={styles.instructionStep}>
            1. Abre Termux en tu dispositivo
          </Text>
          <Text style={styles.instructionStep}>
            2. Ejecuta el siguiente comando:
          </Text>

          {/* Comando en caja */}
          <View style={styles.commandBox}>
            <Text style={styles.commandText}>{STARTUP_COMMAND}</Text>
          </View>

          <Text style={styles.instructionStep}>
            3. Espera a que Expo inicie{'\n'}
            4. Presiona 'a' para abrir en Android
          </Text>
        </View>

        {/* Ajustes Rapidos */}
        <View style={styles.quickSettingsContainer}>
          <Text style={styles.instructionsTitle}>Ajustes Rapidos</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => handleUsePreset(DEFAULT_URLS.local)}
          >
            <Text style={styles.secondaryButtonText}>
              📱 Usar Local (Termux)
            </Text>
          </Pressable>

          <Text style={styles.label}>URL Personalizada</Text>
          <TextInput
            style={styles.input}
            value={customUrl}
            onChangeText={setCustomUrl}
            placeholder="https://tu-servidor.com"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={styles.secondaryButton}
            onPress={handleApplyAndRetry}
          >
            <Text style={styles.secondaryButtonText}>
              💾 Guardar URL y Reintentar
            </Text>
          </Pressable>
        </View>

        {/* Diagnostico */}
        <View style={styles.diagnosticsContainer}>
          <Text style={styles.instructionsTitle}>Diagnostico</Text>
          <Text style={styles.diagnosticLine}>
            URL actual: {serverUrl || '-'}
          </Text>
          {lastError ? (
            <>
              <Text style={styles.diagnosticLine}>
                Mensaje: {lastError.message}
              </Text>
              {!!lastError.status && (
                <Text style={styles.diagnosticLine}>
                  HTTP: {lastError.status}
                </Text>
              )}
              {!!lastError.code && (
                <Text style={styles.diagnosticLine}>
                  Code: {lastError.code}
                </Text>
              )}
              {!!lastError.detail && (
                <Text style={styles.diagnosticLine}>
                  Detail: {lastError.detail}
                </Text>
              )}
              {!!lastError.time && (
                <Text style={styles.diagnosticLine}>
                  Time: {lastError.time}
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.diagnosticLine}>
              Sin error registrado
            </Text>
          )}
        </View>

        {/* Botones de Acción */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleCopyCommand}
          >
            <Text style={styles.primaryButtonText}>
              📋 Copiar Comando
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleOpenTermux}
          >
            <Text style={styles.secondaryButtonText}>
              🔧 Abrir Termux
            </Text>
          </Pressable>

          <Pressable
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Text style={styles.retryButtonText}>
              🔄 Reintentar Conexión
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleCopyDiagnostics}
          >
            <Text style={styles.secondaryButtonText}>
              🧾 Copiar Diagnostico
            </Text>
          </Pressable>
        </View>

        {/* Ayuda adicional */}
        <Text style={styles.helpText}>
          💡 Tip: Guarda el comando en un script para acceso rápido
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    paddingVertical: 24,
  },
  content: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  instructionsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  quickSettingsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  instructionStep: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  commandBox: {
    backgroundColor: '#2d2d2d',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  commandText: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'monospace',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  diagnosticsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  diagnosticLine: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#34C759',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
