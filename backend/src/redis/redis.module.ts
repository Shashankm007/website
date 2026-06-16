import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT };

/**
 * Global Redis client (used for caching + throttler storage).
 * If REDIS_URL is unset, a null client is provided and CacheService degrades to a no-op.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>('redisUrl');
        if (!url) return null;
        const client = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
        client.on('error', (e) => console.error('[redis]', e.message));
        return client;
      },
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule {}
