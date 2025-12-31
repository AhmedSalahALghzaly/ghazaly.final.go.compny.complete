/**
 * WebSocket Service for Real-time Notifications
 */
import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';

const WS_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/^http/, 'ws') || 'ws://localhost:8001';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageHandlers: Set<(data: any) => void> = new Set();

  connect(userId?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const url = userId ? `${WS_URL}/api/ws?user_id=${userId}` : `${WS_URL}/api/ws`;
    
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] Message:', data);
          this.messageHandlers.forEach(handler => handler(data));
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.scheduleReconnect(userId);
      };
    } catch (err) {
      console.error('[WS] Connection error:', err);
      this.scheduleReconnect(userId);
    }
  }

  private scheduleReconnect(userId?: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      console.log(`[WS] Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect(userId);
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  addMessageHandler(handler: (data: any) => void) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();

// React hook for WebSocket
export const useWebSocket = () => {
  const user = useAppStore((state) => state.user);
  const addNotification = useAppStore((state) => state.addNotification);
  const setSyncStatus = useAppStore((state) => state.setSyncStatus);
  const fetchData = useAppStore((state) => state.fetchInitialData);

  useEffect(() => {
    // Connect WebSocket
    wsService.connect(user?.id);

    // Handle incoming messages
    const removeHandler = wsService.addMessageHandler((data) => {
      switch (data.type) {
        case 'notification':
          // Add notification to store
          if (data.data) {
            addNotification({
              id: data.data.id || `notif-${Date.now()}`,
              title: data.data.title,
              message: data.data.message,
              type: data.data.type || 'info',
              read: false,
              created_at: data.data.created_at || new Date().toISOString(),
            });
          }
          break;

        case 'sync':
          // Trigger data refresh
          setSyncStatus('syncing');
          fetchData?.().then(() => {
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 2000);
          }).catch(() => {
            setSyncStatus('error');
          });
          break;

        case 'ping':
          wsService.send({ type: 'pong' });
          break;

        default:
          console.log('[WS] Unknown message type:', data.type);
      }
    });

    return () => {
      removeHandler();
      wsService.disconnect();
    };
  }, [user?.id]);

  const sendMessage = useCallback((data: any) => {
    wsService.send(data);
  }, []);

  return {
    isConnected: wsService.isConnected(),
    sendMessage,
  };
};

export default wsService;
