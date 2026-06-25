import { Request, Response, NextFunction } from "express";
import { verifyToken, JWTPayload } from "../utils/jwt.js";

declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): Response | void {
    const token = req.cookies?.authToken;

    if (!token) {
        // For optional auth, proceed without user
        return next();
    }

    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ success: false, message: "Invalid token" });
    }

    req.user = payload;
    next();
}