// scripts/verify-redis.js
// One-off smoke test: confirms the Redis URL in .env can be used for sessions.
// Usage: REDIS_URL=<url> node scripts/verify-redis.js
require('dotenv').config();

const redis = require('redis');

async function main() {
    const url = process.env.REDIS_URL;
    if (!url) {
        console.error('REDIS_URL is not set. Set it in .env or pass it inline.');
        process.exit(1);
    }

    const client = redis.createClient({ url });
    client.on('error', err => console.error('Redis client error:', err.message));
    await client.connect();

    await client.set('pigeon:ping', 'pong', { EX: 10 });
    const value = await client.get('pigeon:ping');
    await client.del('pigeon:ping');
    await client.disconnect();

    if (value === 'pong') {
        console.log('Redis connection OK:', url.replace(/:\/\/[^:]+:([^@]+)@/, '://****:****@'));
        process.exit(0);
    }
    console.error('Unexpected response:', value);
    process.exit(1);
}

main().catch(err => {
    console.error('Redis verification failed:', err.message);
    process.exit(1);
});
