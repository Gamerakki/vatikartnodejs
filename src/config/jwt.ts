import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'changeme_super_secret_key';
const tokenHourLifespan = process.env.TOKEN_HOUR_LIFESPAN || '1';

export interface TokenClaims {
  user_id: number;
  [key: string]: any;
}

export function generateToken(jwtClaimData: Record<string, any>, tokenLife?: string): string {
  const lifespanHours = tokenLife && tokenLife !== '0' ? tokenLife : tokenHourLifespan;
  const expiresIn = `${lifespanHours}h`;

  const payload = {
    Authorized: true,
    ...jwtClaimData,
  };

  return jwt.sign(payload, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: expiresIn as any,
  });
}

export function isTokenValid(tokenString: string): TokenClaims {
  try {
    const decoded = jwt.verify(tokenString, jwtSecret, {
      algorithms: ['HS256'],
    }) as TokenClaims;
    return decoded;
  } catch (err) {
    throw new Error(`Invalid token: ${(err as Error).message}`);
  }
}

export function extractToken(tokenAuthString: string): string {
  if (!tokenAuthString) {
    throw new Error('missing authorization header');
  }

  const parts = tokenAuthString.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new Error('invalid authorization header format');
  }

  return parts[1];
}

export function extractJWTDetails(tokenString: string): TokenClaims {
  return isTokenValid(tokenString);
}
