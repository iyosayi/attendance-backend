import Redis from 'ioredis';
import logger from '../utils/logger';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('reconnecting', () => {
  logger.warn('Redis reconnecting...');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await redis.quit();
    logger.info('Redis connection closed through app termination');
  } catch (err) {
    logger.error('Error during Redis connection closure:', err);
  }
});

export default redis;
