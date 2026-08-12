import type { Request, Response } from "express";
import { ZodError } from "zod";
import { verifyKyc } from "../../../services/kyc/kyc.service.js";
import {
  buildKycSelfieObjectKey,
  createPresignedUploadUrl,
} from "../../../services/storage.service.js";
import {
  kycSelfiePresignSchema,
  verifyKycSchema,
} from "./kyc.validation.js";

function statusFromError(error: Error): number {
  const code = (error as unknown as { statusCode?: number }).statusCode;
  return typeof code === "number" ? code : 400;
}

export async function handleKycSelfiePresign(
  req: Request,
  res: Response,
): Promise<void | Response> {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { body } = kycSelfiePresignSchema.parse({ body: req.body });
    const objectKey = buildKycSelfieObjectKey(userId, body.fileName);
    const signed = await createPresignedUploadUrl({
      objectKey,
      mimeType: body.mimeType,
      fileSizeBytes: body.fileSizeBytes,
    });

    return res.status(200).json({
      success: true,
      data: {
        ...signed,
        mimeType: body.mimeType,
        fileName: body.fileName,
        fileSizeBytes: body.fileSizeBytes,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }
    if (error instanceof Error) {
      return res.status(statusFromError(error)).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to create selfie upload URL",
    });
  }
}

export async function handleVerifyKyc(
  req: Request,
  res: Response,
): Promise<void | Response> {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId || userId <= 0) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { body } = verifyKycSchema.parse({ body: req.body });
    const result = await verifyKyc({
      userId,
      nidNumber: body.nidNumber,
      dateOfBirth: body.dateOfBirth,
      selfieS3Key: body.selfieS3Key,
    });

    const status = result.verified ? 200 : 422;
    return res.status(status).json({
      success: result.success,
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    }

    if (error instanceof Error) {
      return res.status(statusFromError(error)).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "KYC verification failed",
    });
  }
}
