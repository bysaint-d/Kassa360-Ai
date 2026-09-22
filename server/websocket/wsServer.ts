import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export type WsEventType =
  | 'STOCK_UPDATED'
  | 'SALE_CREATED'
  | 'SALE_UPDATED'
  | 'SALE_RETURNED'
  | 'SALE_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'SETTING_UPDATED';

export interface WsMessage {
  type: WsEventType;
  payload: any;
  timestamp: string;
  sourceDeviceId?: string;
}

class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  public init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`🔌 [WebSocket] Client connected. Total active clients: ${this.clients.size}`);

      // Send initial welcome message
      ws.send(
        JSON.stringify({
          type: 'CONNECTED',
          message: 'Kassa360 Real-Time Sync Connected',
          timestamp: new Date().toISOString(),
        })
      );

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`🔌 [WebSocket] Client disconnected. Total active clients: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.warn('🔌 [WebSocket] Client error:', err.message);
        this.clients.delete(ws);
      });
    });
  }

  public broadcast(type: WsEventType, payload: any, sourceDeviceId?: string): void {
    if (!this.wss || this.clients.size === 0) return;

    const message: WsMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      sourceDeviceId,
    };

    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (err) {
          console.warn('Failed to send WS message to client:', err);
        }
      }
    }
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }
}

export const realtimeHub = new RealtimeHub();
