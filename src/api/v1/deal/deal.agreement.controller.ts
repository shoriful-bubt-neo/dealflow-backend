import { Request, Response } from "express";
import { z, ZodError } from "zod";
import {
  acceptDealAgreement,
  AgreementRequiredError,
} from "./deal.agreement.service.js";
import { getClientIp } from "../../../utils/requestContext.js";

const acceptAgreementSchema = z.object({
  device_fingerprint: z
    .string()
    .trim()
    .min(20, "Device fingerprint is invalid"),
});

function validationErrorResponse(res: Response, error: ZodError) {
  return res.status(400).json({
    success: false,
    message: "Validation error",
    errors: error.issues,
  });
}

export async function handleAcceptDealAgreement(
  req: Request,
  res: Response,
): Promise<void | Response> {
  try {
    const dealId = Number(req.params.dealId);
    if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
      res.status(400).json({ success: false, message: "Invalid deal ID" });
      return;
    }

    const userId = req.user?.id ?? req.user?.userId ?? null;
    const identityId = req.user?.identityId;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const payload = acceptAgreementSchema.parse(req.body);
    const result = await acceptDealAgreement({
      dealId,
      userId,
      identityId: identityId || `user:${userId}`,
      deviceFingerprint: payload.device_fingerprint,
      ipAddress: getClientIp(req),
      userAgent: req.get("user-agent") || undefined,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return validationErrorResponse(res, error);
    }
    if (error instanceof AgreementRequiredError) {
      return res.status(403).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    if (error instanceof Error) {
      if (error.message.includes("Unauthorized")) {
        return res.status(403).json({ success: false, message: error.message });
      }
      if (error.message.includes("not found")) {
        return res.status(404).json({ success: false, message: error.message });
      }
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}