import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { AppConfig } from '../config/configuration';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

export const REFRESH_COOKIE = 'refresh_token';

/** Parse durations like "15m", "7d", "900s" into milliseconds. */
function parseDurationMs(input: string): number {
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(input.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
    default:
      return n * 86_400_000;
  }
}

/**
 * Issues short-lived access JWTs and manages rotating, hashed refresh tokens
 * stored in the DB and delivered as an httpOnly cookie.
 */
@Injectable()
export class TokenService {
  private readonly jwtCfg: AppConfig['jwt'];
  private readonly isProd: boolean;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.jwtCfg = this.config.get<AppConfig['jwt']>('jwt')!;
    this.isProd = this.config.get<string>('env') === 'production';
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async signAccessToken(user: { id: string; email: string; role: Role }): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload, {
      secret: this.jwtCfg.accessSecret,
      expiresIn: this.jwtCfg.accessTtl,
    });
  }

  /** Create + persist a new refresh token, returning the raw value for the cookie. */
  async issueRefreshToken(userId: string, req?: Request): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + parseDurationMs(this.jwtCfg.refreshTtl));
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(raw),
        userAgent: req?.headers['user-agent']?.slice(0, 255),
        ip: (req?.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req?.ip,
        expiresAt,
      },
    });
    return raw;
  }

  /** Validate + rotate a refresh token. Returns the new raw token + userId. */
  async rotateRefreshToken(rawOld: string, req?: Request): Promise<{ raw: string; userId: string }> {
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(rawOld) } });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      // Reuse of a revoked token may indicate theft → revoke the whole family.
      if (existing?.userId) await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException('Refresh token invalid or expired');
    }
    const raw = await this.issueRefreshToken(existing.userId, req);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: this.hash(raw) },
    });
    return { raw, userId: existing.userId };
  }

  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken
      .updateMany({ where: { tokenHash: this.hash(rawToken), revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  setRefreshCookie(res: Response, raw: string): void {
    res.cookie(REFRESH_COOKIE, raw, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: parseDurationMs(this.jwtCfg.refreshTtl),
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }
}
