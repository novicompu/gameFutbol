const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('connect', () => {
  console.log('Conectado a Redis');
});

client.on('error', (err) => {
  console.error('Error de Redis:', err);
});

client.connect().catch(console.error);

module.exports = client;
