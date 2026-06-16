import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthProvider, User, VerificationTokenType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { AuthUser } from '../common/interfaces/jwt-payload.interface';
import { sanitizePlain } from '../common/utils/sanitize';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/auth.dto';
import { GoogleProfile } from './strategies/google.strategy';
import { REFRESH_COOKIE, TokenService } from './token.service';

const BCRYPT_ROUNDS = 12;
const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

type PublicUser = Pick<User, 'id' | 'email' | 'name' | 'role' | 'emailVerified' | 'avatarUrl'>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  private toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
    };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  // --- Registration & email verification -----------------------------------

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Avoid user enumeration nuance: still 409 since registration is a deliberate action.
      throw new BadRequestException('An account with this email already exists');
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name ? sanitizePlain(dto.name) : undefined,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        provider: AuthProvider.CREDENTIALS,
      },
    });
    await this.issueEmailVerification(user);
    return this.toPublic(user);
  }

  private async issueEmailVerification(user: User): Promise<void> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: VerificationTokenType.EMAIL_VERIFICATION,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    await this.mail.sendVerificationEmail(user.email, raw);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user && !user.emailVerified) await this.issueEmailVerification(user);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash: this.hashToken(rawToken) } });
    if (
      !record ||
      record.type !== VerificationTokenType.EMAIL_VERIFICATION ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } }),
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
  }

  // --- Login / logout / refresh --------------------------------------------

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid email or password');
    if (user.status === 'BLOCKED') throw new UnauthorizedException('Account is blocked');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    return user;
  }

  async login(user: User, req: Request, res: Response): Promise<{ accessToken: string; user: PublicUser }> {
    const accessToken = await this.tokens.signAccessToken(user);
    const refresh = await this.tokens.issueRefreshToken(user.id, req);
    this.tokens.setRefreshCookie(res, refresh);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { accessToken, user: this.toPublic(user) };
  }

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('No refresh token');
    const { raw: newRaw, userId } = await this.tokens.rotateRefreshToken(raw, req);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'BLOCKED') throw new UnauthorizedException('Account unavailable');
    this.tokens.setRefreshCookie(res, newRaw);
    const accessToken = await this.tokens.signAccessToken(user);
    return { accessToken };
  }

  async logout(req: Request, res: Response): Promise<void> {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) await this.tokens.revoke(raw);
    this.tokens.clearRefreshCookie(res);
  }

  // --- Password reset ------------------------------------------------------

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Always return success to prevent account enumeration.
    if (!user) return;
    const raw = randomBytes(32).toString('hex');
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: VerificationTokenType.PASSWORD_RESET,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    await this.mail.sendPasswordReset(user.email, raw);
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    const record = await this.prisma.verificationToken.findUnique({ where: { tokenHash: this.hashToken(rawToken) } });
    if (
      !record ||
      record.type !== VerificationTokenType.PASSWORD_RESET ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    // Invalidate all sessions after a password change.
    await this.tokens.revokeAllForUser(record.userId);
  }

  // --- OAuth ---------------------------------------------------------------

  async loginWithGoogle(profile: GoogleProfile, req: Request, res: Response): Promise<string> {
    const email = profile.email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          name: profile.name ? sanitizePlain(profile.name) : undefined,
          avatarUrl: profile.avatarUrl,
          provider: AuthProvider.GOOGLE,
          emailVerified: new Date(),
        },
      });
    }
    if (user.status === 'BLOCKED') throw new UnauthorizedException('Account is blocked');
    const accessToken = await this.tokens.signAccessToken(user);
    const refresh = await this.tokens.issueRefreshToken(user.id, req);
    this.tokens.setRefreshCookie(res, refresh);
    return accessToken;
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.toPublic(user);
  }

  asAuthUser(user: User): AuthUser {
    return { id: user.id, email: user.email, role: user.role };
  }
}
