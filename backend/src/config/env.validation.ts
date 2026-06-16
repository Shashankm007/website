import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

/**
 * Fail fast at boot if required env vars are missing/weak.
 * Wired into ConfigModule via `validate`.
 */
class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  @IsString()
  DATABASE_URL!: string;

  @IsNotEmpty()
  @MinLength(16, { message: 'JWT_ACCESS_SECRET must be at least 16 chars' })
  JWT_ACCESS_SECRET!: string;

  @IsNotEmpty()
  @MinLength(16, { message: 'JWT_REFRESH_SECRET must be at least 16 chars' })
  JWT_REFRESH_SECRET!: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  RAZORPAY_KEY_ID?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const msg = errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n');
    throw new Error(`❌ Invalid environment configuration:\n${msg}`);
  }
  return config;
}
