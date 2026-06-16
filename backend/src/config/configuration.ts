/**
 * Typed application configuration loaded from environment variables.
 * Access via `ConfigService.get<AppConfig['jwt']>('jwt')` etc.
 */
export interface AppConfig {
  env: string;
  port: number;
  frontendUrl: string;
  databaseUrl: string;
  redisUrl?: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  cookieSecret: string;
  encryptionKey?: string;
  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  };
  smtp: {
    host: string;
    port: number;
    user?: string;
    pass?: string;
    from: string;
  };
  s3: {
    endpoint?: string;
    region: string;
    bucket: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicUrl: string;
  };
  google: {
    clientId?: string;
    clientSecret?: string;
    callbackUrl?: string;
  };
  shiprocket: {
    email?: string;
    password?: string;
    pickupLocation?: string;
    channelId?: string;
    webhookToken?: string;
  };
  chatbot: {
    // Optional OpenAI-compatible endpoints for open-source models (Ollama/Groq/Together/HF…).
    apiUrl?: string; // chat completions base url
    apiKey?: string;
    model?: string;
    embedUrl?: string; // embeddings base url (defaults to apiUrl)
    embedModel?: string; // e.g. nomic-embed-text
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  cookieSecret: process.env.COOKIE_SECRET ?? 'dev-cookie-secret',
  encryptionKey: process.env.ENCRYPTION_KEY,
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  },
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'HashTag Creations <no-reply@hashtagcreations.in>',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'forge3d-assets',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    publicUrl: process.env.S3_PUBLIC_URL ?? '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  shiprocket: {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
    pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION,
    channelId: process.env.SHIPROCKET_CHANNEL_ID,
    webhookToken: process.env.SHIPROCKET_WEBHOOK_TOKEN,
  },
  chatbot: {
    apiUrl: process.env.CHATBOT_API_URL,
    apiKey: process.env.CHATBOT_API_KEY,
    model: process.env.CHATBOT_MODEL,
    embedUrl: process.env.CHATBOT_EMBED_URL,
    embedModel: process.env.CHATBOT_EMBED_MODEL,
  },
});
