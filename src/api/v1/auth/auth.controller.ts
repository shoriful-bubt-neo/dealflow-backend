import { Request, Response } from "express";
import {
  startRegistration,
  completeRegistration,
  loginUser,
  getCurrentUser,
  authCookieOptions,
} from "./auth.service.js";
import { loginSchema, registerSchema, verifyOtpSchema } from "./auth.validation.js";

export async function handleRegister(req: Request, res: Response): Promise<void> {
  try {
    const { body } = registerSchema.parse({ body: req.body });
    const { channelSent } = await startRegistration(body);
    res.status(200).json({ success: true, data: { channelSent } });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: (error as unknown as { issues: unknown }).issues,
      });
      return;
    }
    if (error instanceof Error && error.message.includes("already registered")) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error && error.message.includes("rate limit")) {
      res.status(429).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Registration failed",
    });
  }
}

export async function handleVerifyOtp(req: Request, res: Response): Promise<void> {
  try {
    const { body } = verifyOtpSchema.parse({ body: req.body });
    const { user, token, redirectTo } = await completeRegistration(body);
    res.cookie("authToken", token, authCookieOptions());
    res.status(201).json({ success: true, token, user, redirectTo });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: (error as unknown as { issues: unknown }).issues,
      });
      return;
    }
    if (error instanceof Error && error.message.includes("already registered")) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "OTP verification failed",
    });
  }
}

export async function handleLogin(req: Request, res: Response): Promise<void> {
  try {
    const { body } = loginSchema.parse({ body: req.body });
    const { user, token, redirectTo } = await loginUser(body);
    res.cookie("authToken", token, authCookieOptions());
    res.status(200).json({ success: true, data: { user, token, redirectTo } });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: (error as unknown as { issues: unknown }).issues,
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
  const opts = authCookieOptions();
  res.clearCookie("authToken", {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
  });
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
