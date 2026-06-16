import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AppConfig } from '../../config/configuration';

export interface GoogleProfile {
  email: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Optional Google OAuth. If creds aren't configured the placeholder clientID keeps
 * boot from failing; the flow only errors if actually exercised without real creds.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const g = config.get<AppConfig['google']>('google')!;
    super({
      clientID: g.clientId || 'unconfigured',
      clientSecret: g.clientSecret || 'unconfigured',
      callbackURL: g.callbackUrl || 'http://localhost:4000/api/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback): void {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from Google'), undefined);
    const user: GoogleProfile = {
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, user);
  }
}
