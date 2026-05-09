import { Request, Response } from "express";
import { validateCreateDealPayload, prepareValidatedInput } from "./deal.validation";
import { createDeal } from "./deal.service";
import { generateToken } from "../../../utils/jwt.js";

/**
 * POST /deals
 * Create a new deal from frontend HeroSection payload
 */
export async function handleCreateDeal(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Extract client context
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get("user-agent");
    const requestPath = req.originalUrl || req.path;

    // Step 1: Validate and parse incoming payload
    const rawUserIdFromHeader = req.get("x-user-id");
    const rawUserIdFromBody = req.body?.user_id;
    const candidateUserId = rawUserIdFromBody ?? rawUserIdFromHeader;

    const normalizedUserId =
      candidateUserId !== undefined && candidateUserId !== null && `${candidateUserId}`.trim() !== ""
        ? Number(candidateUserId)
        : undefined;

    if (normalizedUserId !== undefined && (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0)) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    const payload = validateCreateDealPayload({
      ...req.body,
      user_id: normalizedUserId,
    });

    // Step 2: Prepare input for service layer
    const validatedInput = prepareValidatedInput(
      payload,
      ipAddress,
      userAgent,
      requestPath,
    );

    // Step 3: Execute business logic
    const response = await createDeal(validatedInput);

    // Step 4: Generate JWT token and set cookie
    const tokenPayload = {
      userId: normalizedUserId,
      identityId: response.identityId,
      role: response.role,
      dealId: response.dealId,
    };
    const token = generateToken(tokenPayload);
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Step 5: Return 201 Created with deal response
    res.status(201).json(response);
  } catch (error: unknown) {
    // Handle validation errors (Zod)
    if (error instanceof Error && error.name === "ZodError") {
      const zodError = error as any;
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: zodError.errors,
      });
    }

    // Handle business logic errors
    if (error instanceof Error) {
      // Fraud detection rejection
      if (error.message.includes("Fraud detected")) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      // Payment method not found
      if (error.message.includes("Payment method")) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      // Generic bad request
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Unexpected error
    console.error("Unexpected error in createDeal:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
