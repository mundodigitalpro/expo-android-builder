import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SERVER_URL } from '../config';

export const storage = {
  async setAuthToken(token) {
    try {
      await AsyncStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Error saving auth token:', error);
    }
  },

  async getAuthToken() {
    try {
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  },

  async clearAuthToken() {
    try {
      await AsyncStorage.removeItem('auth_token');
    } catch (error) {
      console.error('Error clearing auth token:', error);
    }
  },

  async setServerUrl(url) {
    try {
      await AsyncStorage.setItem('server_url', url);
    } catch (error) {
      console.error('Error saving server URL:', error);
    }
  },

  async getServerUrl() {
    try {
      return await AsyncStorage.getItem('server_url') || DEFAULT_SERVER_URL;
    } catch (error) {
      console.error('Error getting server URL:', error);
      return DEFAULT_SERVER_URL;
    }
  },

  async setDefaultAIProvider(provider) {
    try {
      await AsyncStorage.setItem('default_ai_provider', provider);
    } catch (error) {
      console.error('Error saving AI provider:', error);
    }
  },

  async getDefaultAIProvider() {
    try {
      return await AsyncStorage.getItem('default_ai_provider') || 'CLAUDE';
    } catch (error) {
      console.error('Error getting AI provider:', error);
      return 'CLAUDE';
    }
  },
};
