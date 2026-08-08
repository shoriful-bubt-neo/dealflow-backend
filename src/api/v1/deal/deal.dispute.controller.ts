import { Request, Response } from "express";
import { z, ZodError } from "zod";
import * as disputeService from "./deal.dispute.service.js";
import { AgreementRequiredError } from "./deal.agreement.service.js";

const evidenceSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  dataBase64: z.string().min(1),
});

const submitStatementSchema = z.object({
  statement: z.string().trim().min(1, "Statement is required").max(5000),
  evidence: z.array(evidenceSchema).max(5).optional().default([]),
});

function validationErrorResponse(res: Response, error: ZodError) {
  return res.status(400).json({
    success: false,
    message: "Validation error",
    errors: error.issues,
  });
}

function handleKnownErrors(res: Response, error: unknown) {
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
    if (error.message.includes("not found") || error.message.includes("No active")) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: "Internal server error" });
}

export async function handleOpenDispute(
  req: Request,
  res: Response,
): Promise<void | Response> {
  try {
    const dealId = Number(req.params.dealId);
    if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid deal ID" });
    }
    const identityId = req.user?.identityId;
    if (!identityId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const dispute = await disputeService.openDispute(
      dealId,
      req.user?.userId || null,
      identityId,
    );

    res.status(201).json({ success: true, data: dispute });
  } catch (error: unknown) {
    return handleKnownErrors(res, error);
  }
}

export async function handleGetActiveDispute(
  req: Request,
  res: Response,
): Promise<void | Response> {
  try {
    const dealId = Number(req.params.dealId);
    if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid deal ID" });
    }
    const identityId = req.user?.identityId;
    if (!identityId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const dispute = await disputeService.getActiveDispute(
      dealId,
      req.user?.userId || null,
      identityId,
    );

    res.status(200).json({ success: true, data: dispute });
  } catch (error: unknown) {
    return handleKnownErrors(res, error);
  }
}

export async function handleSubmitDisputeStatement(
  req: Request,
  res: Response,
): Promise<void | Response> {
  try {
    const dealId = Number(req.params.dealId);
    if (!dealId || !Number.isInteger(dealId) || dealId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid deal ID" });
    }
    const identityId = req.user?.identityId;
    if (!identityId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const payload = submitStatementSchema.parse(req.body);
    const sessionRole =
      req.user?.role === "BUYER" || req.user?.role === "SELLER"
        ? req.user.role
        : undefined;

    if (req.user?.dealId && req.user.dealId !== dealId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Token is for a different deal",
      });
    }

    const dispute = await disputeService.submitDisputeStatement(
      dealId,
      req.user?.userId || null,
      identityId,
      payload.statement,
      payload.evidence,
      sessionRole,
    );

    res.status(200).json({ success: true, data: dispute });
  } catch (error: unknown) {
    return handleKnownErrors(res, error);
  }
}
