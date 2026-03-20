import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

interface WSClient {
  id: string;
  orgId: string;
  ws: any;
  channels: Set<string>;
}

const clients = new Map<string, WSClient>();

async function websocketPlugin(fastify: FastifyInstance) {
  // Register @fastify/websocket
  await fastify.register(import('@fastify/websocket'));

  // WebSocket route for real-time events
  fastify.get('/api/v4/ws', { websocket: true }, (socket, req) => {
    const clientId = crypto.randomUUID();
    const client: WSClient = {
      id: clientId,
      orgId: (req as any).orgId || 'default',
      ws: socket,
      channels: new Set(['notifications']),
    };

    clients.set(clientId, client);

    socket.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe') {
          msg.channels?.forEach((ch: string) => client.channels.add(ch));
        }
        if (msg.type === 'unsubscribe') {
          msg.channels?.forEach((ch: string) => client.channels.delete(ch));
        }
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch {}
    });

    socket.on('close', () => clients.delete(clientId));

    // Welcome message
    socket.send(JSON.stringify({
      type: 'connected',
      clientId,
      channels: Array.from(client.channels)
    }));
  });

  // Broadcast helper
  fastify.decorate('broadcast', (channel: string, event: string, data: any) => {
    const message = JSON.stringify({ channel, event, data, ts: Date.now() });
    for (const client of clients.values()) {
      if (client.channels.has(channel) && client.ws.readyState === 1) {
        client.ws.send(message);
      }
    }
  });
}

export default fp(websocketPlugin, { name: 'websocket' });
