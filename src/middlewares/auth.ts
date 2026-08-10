import { Request, Response, NextFunction } from "express";
import {
  verifyToken,
  normalizeAuthUser,
  extractBearerToken,
  type AuthUser,
  type JWTPayload,
} from "../utils/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser & JWTPayload;
    }
  }
}

function readToken(req: Request): string | undefined {
  return (
    req.cookies?.authToken ||
    extractBearerToken(req.get("authorization") || undefined)
  );
}

function attachUser(req: Request, payload: JWTPayload): boolean {
  const authUser = normalizeAuthUser(payload);
  if (!authUser) {
    // Deal-scoped guest token without a User id (identity-only)
    if (payload.identityId) {
      req.user = {
        id: 0,
        email: null,
        trustLevel: payload.trustLevel ?? 0,
        userId: 0,
        ...payload,
      };
      return true;
    }
    return false;
  }

  req.user = { ...payload, ...authUser };
  return true;
}

/** Optional auth — attaches req.user when a valid token is present. */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const token = readToken(req);
  if (!token) return next();

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  if (!attachUser(req, payload)) {
    return res.status(401).json({ success: false, message: "Invalid token payload" });
  }

  next();
}

/** Required auth — JWT from httpOnly cookie or Authorization Bearer. */
export function protectRoute(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const authUser = normalizeAuthUser(payload);
  if (!authUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  req.user = { ...payload, ...authUser };
  next();
}
