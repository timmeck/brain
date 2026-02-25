import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();
import type { IpcMessage } from '../types/ipc.types.js';
import { encodeMessage, MessageDecoder } from './protocol.js';
import type { IpcRouter } from './router.js';

export class IpcServer {
  private server: net.Server | null = null;
  private clients = new Map<string, net.Socket>();

  constructor(
    private router: IpcRouter,
    private pipeName: string,
  ) {}

  start(): void {
    this.server = net.createServer((socket) => {
      const clientId = randomUUID();
      this.clients.set(clientId, socket);
      const decoder = new MessageDecoder();

      logger.info(`IPC client connected: ${clientId}`);

      socket.on('data', (chunk) => {
        const messages = decoder.feed(chunk);
        for (const msg of messages) {
          this.handleMessage(clientId, msg, socket);
        }
      });

      socket.on('close', () => {
        logger.info(`IPC client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      socket.on('error', (err) => {
        logger.error(`IPC client ${clientId} error:`, err);
        this.clients.delete(clientId);
      });
    });

    this.server.on('error', (err) => {
      logger.error('IPC server error:', err);
    });

    this.server.listen(this.pipeName, () => {
      logger.info(`IPC server listening on ${this.pipeName}`);
    });
  }

  private handleMessage(clientId: string, msg: IpcMessage, socket: net.Socket): void {
    if (msg.type !== 'request' || !msg.method) return;

    try {
      const result = this.router.handle(msg.method, msg.params);
      const response: IpcMessage = {
        id: msg.id,
        type: 'response',
        result,
      };
      socket.write(encodeMessage(response));
    } catch (err) {
      const response: IpcMessage = {
        id: msg.id,
        type: 'response',
        error: { code: -1, message: err instanceof Error ? err.message : String(err) },
      };
      socket.write(encodeMessage(response));
    }
  }

  notify(clientId: string | null, notification: Omit<IpcMessage, 'id' | 'type'>): void {
    const msg: IpcMessage = {
      id: randomUUID(),
      type: 'notification',
      ...notification,
    };
    const encoded = encodeMessage(msg);

    if (clientId) {
      const socket = this.clients.get(clientId);
      if (socket && !socket.destroyed) {
        socket.write(encoded);
      }
    } else {
      for (const socket of this.clients.values()) {
        if (!socket.destroyed) {
          socket.write(encoded);
        }
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  stop(): void {
    for (const socket of this.clients.values()) {
      socket.destroy();
    }
    this.clients.clear();
    this.server?.close();
    this.server = null;
    logger.info('IPC server stopped');
  }
}
