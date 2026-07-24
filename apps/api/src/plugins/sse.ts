import { FastifyInstance, FastifyReply } from "fastify";
import fp from "fastify-plugin";

const sseClients = new Map<
  string,
  { reply: FastifyReply; channels: Set<string> }
>();

async function ssePlugin(fastify: FastifyInstance) {
  fastify.get("/api/v4/events", async (req, reply) => {
    const clientId = crypto.randomUUID();

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const channels = new Set<string>(["notifications", "orders"]);
    sseClients.set(clientId, { reply, channels });

    reply.raw.write(
      `data: ${JSON.stringify({ type: "connected", clientId })}\n\n`,
    );

    // Keep-alive
    const keepAlive = setInterval(() => {
      reply.raw.write(": keep-alive\n\n");
    }, 30000);

    req.raw.on("close", () => {
      clearInterval(keepAlive);
      sseClients.delete(clientId);
    });
  });

  fastify.decorate(
    "broadcastSSE",
    (channel: string, event: string, data: any) => {
      const payload = `event: ${event}\ndata: ${JSON.stringify({ channel, ...data })}\n\n`;
      for (const client of sseClients.values()) {
        if (client.channels.has(channel)) {
          client.reply.raw.write(payload);
        }
      }
    },
  );
}

export default fp(ssePlugin, { name: "sse" });
