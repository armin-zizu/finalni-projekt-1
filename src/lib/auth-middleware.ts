import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader, JWTPayload } from './jwt';

export interface AuthRequest extends NextRequest {
  user?: JWTPayload;
}

export function withAuth(handler: (req: AuthRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Get token from Authorization header or cookie
      const authHeader = req.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader) || req.cookies.get('token')?.value;

      if (!token) {
        return NextResponse.json(
          { error: 'Unauthorized - No token provided' },
          { status: 401 }
        );
      }

      // Verify token
      const decoded = verifyToken(token);
      
      // Attach user to request
      (req as AuthRequest).user = decoded;

      // Call the handler
      return await handler(req as AuthRequest);
    } catch (error: any) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token', message: error.message },
        { status: 401 }
      );
    }
  };
}

export function optionalAuth(handler: (req: AuthRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      const authHeader = req.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader) || req.cookies.get('token')?.value;

      if (token) {
        try {
          const decoded = verifyToken(token);
          (req as AuthRequest).user = decoded;
        } catch (error) {
          // Ignore token errors for optional auth
        }
      }

      return await handler(req as AuthRequest);
    } catch (error) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}


