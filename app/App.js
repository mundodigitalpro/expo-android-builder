import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Alert } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import NewProjectScreen from './screens/NewProjectScreen';
import SettingsScreen from './screens/SettingsScreen';
import ClaudeCodeScreen from './screens/ClaudeCodeScreen';
import BuildStatusScreen from './screens/BuildStatusScreen';
import LoadingSpinner from './components/LoadingSpinner';
import ServerUnavailableScreen from './components/ServerUnavailableScreen';

import { storage } from './utils/storage';
import { healthCheck } from './services/api';

const Stack = createStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(null); // null = checking
  const [startupMessage, setStartupMessage] = useState('Inicializando...');
  const [startupDetails, setStartupDetails] = useState('');
  const [currentServerUrl, setCurrentServerUrl] = useState(null);
  const [lastHealthError, setLastHealthError] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const buildHealthError = (error, url) => {
    const status = error?.response?.status || null;
    const code = error?.code || null;
    const data = error?.response?.data;
    let detail = '';
    if (data) {
      detail = typeof data === 'string' ? data : JSON.stringify(data);
    }
    return {
      url,
      message: error?.message || 'Error desconocido',
      status,
      code,
      detail,
      time: new Date().toISOString(),
    };
  };

  const initializeApp = async () => {
    try {
      setStartupMessage('Cargando configuracion...');
      setStartupDetails('');
      setLastHealthError(null);
      // 1. Configuración inicial - Forzar actualización de token
      const currentToken = await storage.getAuthToken();
      const correctToken = 'expo-builder-vps-2024-secure-token-MTc2NzIwNjIwMwo=';

      // Actualizar si no existe o si es el token viejo
      if (!currentToken || currentToken === 'expo-builder-token-2024-secure') {
        await storage.setAuthToken(correctToken);
      }

      const serverUrl = await storage.getServerUrl();
      if (!serverUrl) {
        await storage.setServerUrl('https://builder.josejordan.dev');
      }
      const resolvedServerUrl = serverUrl || 'https://builder.josejordan.dev';
      setCurrentServerUrl(resolvedServerUrl);
      setStartupDetails(`URL: ${resolvedServerUrl}`);

      // 2. Verificar disponibilidad del servidor
      setStartupMessage('Verificando servidor...');
      await checkServerAvailability(resolvedServerUrl);

      setIsReady(true);
    } catch (error) {
      console.error('Error initializing app:', error);
      setStartupMessage('Error al inicializar');
      setStartupDetails(error?.message || 'Error desconocido');
      setLastHealthError(buildHealthError(error, currentServerUrl || ''));
      setServerAvailable(false);
      Alert.alert('Error', 'No se pudo inicializar la aplicación');
      setIsReady(true); // Permitir que la app se muestre incluso si hay error
    }
  };

  const checkServerAvailability = async (serverUrl, retries = 3) => {
    if (!serverUrl) {
      setServerAvailable(false);
      return;
    }
    setServerAvailable(null);
    setCurrentServerUrl(serverUrl);
    for (let i = 0; i < retries; i++) {
      try {
        setStartupMessage(`Verificando servidor (${i + 1}/${retries})...`);
        setStartupDetails(`URL: ${serverUrl}`);
        await healthCheck(serverUrl);
        setServerAvailable(true);
        setLastHealthError(null);
        console.log('✅ Server is available');
        return;
      } catch (error) {
        setLastHealthError(buildHealthError(error, serverUrl));
        if (i < retries - 1) {
          console.log(`❌ Retry ${i + 1}/${retries - 1}...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos entre intentos
        }
      }
    }
    if (serverUrl === 'http://46.62.214.102:3001') {
      try {
        const httpsUrl = 'https://builder.josejordan.dev';
        setStartupMessage('Intentando servidor HTTPS...');
        setStartupDetails(`URL: ${httpsUrl}`);
        await healthCheck(httpsUrl);
        await storage.setServerUrl(httpsUrl);
        setCurrentServerUrl(httpsUrl);
        setLastHealthError(null);
        setServerAvailable(true);
        console.log('✅ Server is available (migrated to HTTPS)');
        return;
      } catch (error) {
        setLastHealthError(buildHealthError(error, 'https://builder.josejordan.dev'));
      }
    }
    setServerAvailable(false);
    console.log('❌ Server is not available after retries');
  };

  const handleRetry = async () => {
    const serverUrl = await storage.getServerUrl();
    const resolvedServerUrl = serverUrl || 'https://builder.josejordan.dev';
    setCurrentServerUrl(resolvedServerUrl);
    await checkServerAvailability(resolvedServerUrl);
  };

  const handleUpdateServerUrl = async (nextUrl) => {
    const trimmedUrl = (nextUrl || '').trim();
    if (!trimmedUrl) {
      return;
    }
    await storage.setServerUrl(trimmedUrl);
    setCurrentServerUrl(trimmedUrl);
  };

  if (!isReady) {
    return <LoadingSpinner message={startupMessage} details={startupDetails} />;
  }

  if (serverAvailable === false) {
    return (
      <ServerUnavailableScreen
        onRetry={handleRetry}
        serverUrl={currentServerUrl}
        lastError={lastHealthError}
        onUpdateServerUrl={handleUpdateServerUrl}
      />
    );
  }

  if (serverAvailable === null) {
    return <LoadingSpinner message={startupMessage} details={startupDetails} />;
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#007AFF',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="NewProject"
            component={NewProjectScreen}
            options={{
              title: 'Nuevo Proyecto',
              headerBackTitle: 'Atrás',
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Configuración',
              headerBackTitle: 'Atrás',
            }}
          />
          <Stack.Screen
            name="ClaudeCode"
            component={ClaudeCodeScreen}
            options={{
              title: 'Chat con Claude',
              headerBackTitle: 'Atrás',
            }}
          />
          <Stack.Screen
            name="BuildStatus"
            component={BuildStatusScreen}
            options={{
              title: 'Builds',
              headerBackTitle: 'Atrás',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </>
  );
}
