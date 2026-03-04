import jwt, { Secret } from 'jsonwebtoken';

// In production, JWT_SECRET must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET as Secret;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Log warning if JWT_SECRET is not set (only log once at module load)
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
  console.error('⚠️ WARNING: JWT_SECRET is not set or using default value! This is insecure for production.');
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL: JWT_SECRET must be set in production environment!');
  }
}

export interface JWTPayload {
  userId: string;
  email: string;
  role?: string | null;
  isOwner?: boolean;
}

export function generateToken(payload: JWTPayload): string {
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET is not configured. Please set JWT_SECRET in environment variables.');
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as any);
}

export function verifyToken(token: string): JWTPayload {
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET is not configured. Please set JWT_SECRET in environment variables.');
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}


