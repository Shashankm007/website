/** DI token for the raw ioredis client (separate file to avoid a circular import
 * between redis.module.ts and cache.service.ts). */
export const REDIS_CLIENT = 'REDIS_CLIENT';
