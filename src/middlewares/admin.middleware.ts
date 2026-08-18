import type { NextFunction, Request, Response } from "express";

const ADMIN_ROLE_ID = 1;

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  if (req.user?.roleId !== ADMIN_ROLE_ID) {
    return res.status(403).json({
      error: "Access denied. Admin privileges required.",
    });
  }

  next();
}
