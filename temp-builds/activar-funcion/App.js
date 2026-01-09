import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, AppState } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import { useState, useEffect, useRef } from 'react';

function FlashlightApp() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFlashlight, setHasFlashlight] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      // Asumimos que el flash está disponible si hay permiso de cámara
      // La mayoría de dispositivos Android tienen flash
      if (status === 'granted') {
        setHasFlashlight(true);
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        if (isFlashlightOn) {
          try {
            await Camera.setFlashlightEnabledAsync(false);
            setIsFlashlightOn(false);
          } catch (error) {
            console.log('Error al apagar linterna en background:', error);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [isFlashlightOn]);

  const toggleFlashlight = async () => {
    if (!hasFlashlight) {
      Alert.alert(
        'No disponible',
        'Tu dispositivo no tiene linterna disponible.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsLoading(true);
      const newState = !isFlashlightOn;
      await Camera.setFlashlightEnabledAsync(newState);
      setIsFlashlightOn(newState);
    } catch (error) {
      console.error('Error al activar la linterna:', error);

      // Si falla, intentamos detectar por qué
      let errorMessage = 'No se pudo activar la linterna.';

      if (error.message && error.message.includes('permission')) {
        errorMessage = 'Se necesitan permisos de cámara. Por favor, verifica la configuración.';
      } else if (error.message && error.message.includes('camera')) {
        errorMessage = 'La cámara está siendo usada por otra aplicación. Ciérrala e intenta de nuevo.';
      } else {
        errorMessage = `Error: ${error.message || 'No se pudo activar la linterna'}`;
      }

      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);

      // Si falla al encender, aseguramos que el estado esté apagado
      setIsFlashlightOn(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>Solicitando permisos de cámara...</Text>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>
          No se concedieron permisos de cámara.{'\n'}
          Por favor, habilítalos en la configuración de tu dispositivo.
        </Text>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (!hasFlashlight) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.text}>
          Tu dispositivo no tiene linterna disponible.
        </Text>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Control de Linterna</Text>

      <TouchableOpacity
        style={[
          styles.button,
          isFlashlightOn ? styles.buttonOn : styles.buttonOff,
          isLoading && styles.buttonDisabled
        ]}
        onPress={toggleFlashlight}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Text style={styles.buttonText}>
          {isLoading ? '...' : isFlashlightOn ? '💡 ENCENDIDA' : '🔦 APAGADA'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.statusText}>
        Estado: {isFlashlightOn ? 'Encendida' : 'Apagada'}
      </Text>

      <StatusBar style={isFlashlightOn ? 'light' : 'auto'} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FlashlightApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 50,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  buttonOff: {
    backgroundColor: '#333333',
  },
  buttonOn: {
    backgroundColor: '#FFD700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 18,
    color: '#ffffff',
    marginTop: 20,
  },
});
