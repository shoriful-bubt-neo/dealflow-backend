import type { Response } from "express";
import { KycRequiredError } from "../utils/kycRequirement.js";

export function sendKycRequiredResponse(res: Response, error: KycRequiredError) {
  return res.status(403).json(error.toPayload());
}

export function isKycRequiredError(error: unknown): error is KycRequiredError {
  return error instanceof KycRequiredError;
}
