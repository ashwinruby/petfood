import { createApp } from './app.js';
const app = createApp();
await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: '127.0.0.1' });
console.log('GoodBowl API listening on loopback; live payments are disabled.');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
