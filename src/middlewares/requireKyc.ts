import type { NextFunction, Request, Response } from "express";
import {
  assertKycAllowed,
  KycRequiredError,
} from "../utils/kycRequirement.js";
import { sendKycRequiredResponse } from "../utils/kycHttp.js";

type RequireKycOptions = {
  /** Force dispute-mode KYC regardless of amount */
  isDisputeAction?: boolean;
  /** Read amount from body field when no dealId yet (create deal) */
  amountFromBody?: string;
};

/**
 * Express middleware wrapper around checkKycRequirement / assertKycAllowed.
 * Prefer service-level asserts for dealId-bound actions; use this for route-level gates.
 */
export function requireKyc(options: RequireKycOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id ?? req.user?.userId ?? null;
      const dealId = Number(req.params.dealId) || null;
      const amountRaw = options.amountFromBody
        ? Number(req.body?.[options.amountFromBody])
        : null;
      const amount =
        amountRaw != null && Number.isFinite(amountRaw) ? amountRaw : null;

      await assertKycAllowed(
        userId,
        dealId,
        options.isDisputeAction === true,
        amount,
      );
      next();
    } catch (error) {
      if (error instanceof KycRequiredError) {
        return sendKycRequiredResponse(res, error);
      }
      next(error);
    }
  };
}
