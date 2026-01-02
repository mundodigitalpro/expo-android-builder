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

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 1. Configuración inicial
      const token = await storage.getAuthToken();
      if (!token) {
        await storage.setAuthToken('expo-builder-vps-2024-secure-token-MTc2NzIwNjIwMwo=');
      }

      const serverUrl = await storage.getServerUrl();
      if (!serverUrl) {
        await storage.setServerUrl('https://builder.josejordan.dev');
      }

      // 2. Verificar disponibilidad del servidor
      await checkServerAvailability();

      setIsReady(true);
    } catch (error) {
      console.error('Error initializing app:', error);
      Alert.alert('Error', 'No se pudo inicializar la aplicación');
      setIsReady(true); // Permitir que la app se muestre incluso si hay error
    }
  };

  const checkServerAvailability = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await healthCheck();
        setServerAvailable(true);
        console.log('✅ Server is available');
        return;
      } catch (error) {
        if (i < retries - 1) {
          console.log(`❌ Retry ${i + 1}/${retries - 1}...`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos entre intentos
        }
      }
    }
    setServerAvailable(false);
    console.log('❌ Server is not available after retries');
  };

  if (!isReady) {
    return <LoadingSpinner message="Inicializando..." />;
  }

  if (serverAvailable === false) {
    return <ServerUnavailableScreen onRetry={checkServerAvailability} />;
  }

  if (serverAvailable === null) {
    return <LoadingSpinner message="Verificando servidor..." />;
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
