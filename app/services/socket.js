import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.connectionPromise = null;
  }

  async connect(url) {
    // Si ya hay una conexión en proceso, esperar a que termine
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Si ya está conectado, retornar el socket existente
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Crear una nueva promesa de conexión
    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        // Obtener URL del servidor desde AsyncStorage si no se proporciona
        if (!url) {
          url = await AsyncStorage.getItem('server_url');
          if (!url) {
            url = 'https://builder.josejordan.dev';
          }
        }

        console.log('Connecting to WebSocket:', url);

        // Crear socket si no existe
        if (!this.socket) {
          this.socket = io(url, {
            transports: ['websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
          });

          this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
            this.connectionPromise = null;
            resolve(this.socket);
          });

          this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
          });

          this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.connectionPromise = null;
            reject(error);
          });

          this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
            this.connectionPromise = null;
            reject(error);
          });
        } else {
          // Si el socket existe pero no está conectado, reconectar
          this.socket.connect();

          // Esperar a que se conecte
          this.socket.once('connect', () => {
            console.log('Socket reconnected:', this.socket.id);
            this.connectionPromise = null;
            resolve(this.socket);
          });
        }

        // Timeout de 10 segundos para la conexión
        setTimeout(() => {
          if (this.connectionPromise) {
            this.connectionPromise = null;
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('Error in connect:', error);
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      this.listeners.set(event, callback);
    }
  }

  off(event) {
    if (this.socket && this.listeners.has(event)) {
      const callback = this.listeners.get(event);
      this.socket.off(event, callback);
      this.listeners.delete(event);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  getSocketId() {
    return this.socket?.id;
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export default new SocketService();
