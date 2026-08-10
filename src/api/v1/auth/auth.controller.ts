import { Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  authCookieOptions,
} from "./auth.service.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

export async function handleRegister(req: Request, res: Response): Promise<void> {
  try {
    const { body } = registerSchema.parse({ body: req.body });
    const { user, token } = await registerUser(body);
    res.cookie("authToken", token, authCookieOptions());
    res.status(201).json({ success: true, data: { user, token } });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: (error as any).issues,
      });
      return;
    }
    if (error instanceof Error && error.message.includes("already registered")) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Registration failed",
    });
  }
}

export async function handleLogin(req: Request, res: Response): Promise<void> {
  try {
    const { body } = loginSchema.parse({ body: req.body });
    const { user, token } = await loginUser(body);
    res.cookie("authToken", token, authCookieOptions());
    res.status(200).json({ success: true, data: { user, token } });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: (error as any).issues,
      });
      return;
    }
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Login failed",
    });
  }
}

export async function handleLogout(_req: Request, res: Response): Promise<void> {
  res.clearCookie("authToken", { path: "/" });
  res.status(200).json({ success: true, message: "Logged out" });
}

export async function handleGetCurrentUser(req: Request, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  const user = await getCurrentUser(req.user.id);
  if (!user) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      ...user,
      identityId: req.user.identityId,
      role: req.user.role,
      dealId: req.user.dealId,
      userId: user.id,
    },
  });
}
