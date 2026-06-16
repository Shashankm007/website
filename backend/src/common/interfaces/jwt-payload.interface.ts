import { Role } from '@prisma/client';

/** Shape encoded inside the access-token JWT. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: Role;
}

/** Authenticated principal attached to `request.user` by the JWT strategy. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}
