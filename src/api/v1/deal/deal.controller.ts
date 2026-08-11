import { Request, Response } from "express";
import { validateCreateDealPayload, validateJoinDealPayload, prepareValidatedInput } from "./deal.validation.js";
import { createDeal, getDealByCode, joinDeal } from "./deal.service.js";
import { generateToken } from "../../../utils/jwt.js";
import { authCookieOptions } from "../auth/auth.service.js";
import { getClientIp } from "../../../utils/requestContext.js";

/**
 * GET /deals/code/:paymentRef
 * Validate a deal code and return join metadata
 */
export async function handleGetDealByCode(
  req: Request,
  res: Response,
): Promise<void | Response> {
  const paymentRef = String(req.params.paymentRef || "").trim();
  if (!paymentRef) {
    res.status(400).json({ success: false, message: "Deal code is required" });
    return;
  }

  const deal = await getDealByCode(paymentRef);
  if (!deal) {
    res.status(404).json({ success: false, message: "Deal not found" });
    return;
  }

  res.status(200).json(deal);
}

/**
 * POST /deals/join
 * Join an existing deal using payment reference and device fingerprint
 */
export async function handleJoinDeal(
  req: Request,
  res: Response,
): Promise<void | Response> {
  try {
    const payload = validateJoinDealPayload({
      ...req.body,
      user_id: req.user?.id,
    });
    const ipAddress = getClientIp(req);
    const userAgent = req.get("user-agent");
    const requestPath = req.originalUrl || req.path;

    const result = await joinDeal(payload, ipAddress, userAgent, requestPath);
    const token = generateToken({
      id: req.user?.id,
      userId: req.user?.id,
      email: req.user?.email,
      trustLevel: req.user?.trustLevel ?? 0,
      identityId: result.identityId,
      role: result.role,
      dealId: result.dealId,
    });

    res.cookie("authToken", token, authCookieOptions());

    res.status(200).json(result);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as any;
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: zodError.errors,
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        res.status(404).json({ success: false, message: error.message });
        return;
      }
      if (error.message.includes("expired")) {
        res.status(410).json({ success: false, message: error.message });
        return;
      }
      if (
        error.message.includes("same device") ||
        error.message.includes("already has both sides") ||
        error.message.includes("same user")
      ) {
        res.status(403).json({ success: false, message: error.message });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
      return;
    }

    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * POST /deals
 * Create a new deal from frontend HeroSection payload
 */
export async function handleCreateDeal(
  req: Request,
  res: Response,
): Promise<void | Response> {
  try {
    const ipAddress = getClientIp(req);
    const userAgent = req.get("user-agent");
    const requestPath = req.originalUrl || req.path;

    const authenticatedUserId = req.user?.id;
    if (!authenticatedUserId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const payload = validateCreateDealPayload({
      ...req.body,
      user_id: authenticatedUserId,
    });

    const validatedInput = prepareValidatedInput(
      payload,
      ipAddress,
      userAgent,
      requestPath,
    );

    const response = await createDeal(validatedInput);

    const tokenPayload = {
      id: authenticatedUserId,
      userId: authenticatedUserId,
      email: req.user?.email,
      trustLevel: req.user?.trustLevel ?? 0,
      identityId: response.identityId,
      role: response.role,
      dealId: response.dealId,
    };
    const token = generateToken(tokenPayload);
    res.cookie("authToken", token, authCookieOptions());

    res.status(201).json(response);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as any;
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: zodError.errors,
      });
      return;
    }

    if (error instanceof Error) {
      if (error.message.includes("Fraud detected")) {
        res.status(403).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error.message.includes("Payment method")) {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Unexpected error in createDeal:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}