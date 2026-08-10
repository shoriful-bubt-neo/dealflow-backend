import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "my-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface JWTPayload {
  /** Authenticated user id (session auth) */
  id?: number;
  email?: string | null;
  trustLevel?: number;
  /** Legacy / deal-scoped alias of id */
  userId?: number;
  identityId?: string;
  role?: "BUYER" | "SELLER";
  dealId?: number;
}

export type AuthUser = {
  id: number;
  email: string | null;
  trustLevel: number;
  userId: number;
  identityId?: string;
  role?: "BUYER" | "SELLER";
  dealId?: number;
};

export function normalizeAuthUser(payload: JWTPayload): AuthUser | null {
  const id = payload.id ?? payload.userId;
  if (!id || !Number.isInteger(id) || id <= 0) return null;

  return {
    id,
    email: payload.email ?? null,
    trustLevel: payload.trustLevel ?? 0,
    userId: payload.userId ?? id,
    identityId: payload.identityId,
    role: payload.role,
    dealId: payload.dealId,
  };
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function extractBearerToken(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token.trim() || undefined;
}
