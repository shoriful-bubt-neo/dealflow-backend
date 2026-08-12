import prisma from "../config/prisma.js";
import { KYC_THRESHOLD_AMOUNT } from "../config/kyc.js";

export const KYC_REQUIRED_CODE = "KYC_REQUIRED" as const;
export const KYC_REQUIRED_ACTION = "OPEN_KYC_MODAL" as const;

export type KycRequiredReason =
  | "HIGH_VALUE_DEAL"
  | "DISPUTE_ACTION";

export type KycCheckResult =
  | { kycRequired: false }
  | {
      kycRequired: true;
      reason: string;
      reasonCode: KycRequiredReason;
      threshold: number;
      action: typeof KYC_REQUIRED_ACTION;
    };

export class KycRequiredError extends Error {
  readonly code = KYC_REQUIRED_CODE;
  readonly action = KYC_REQUIRED_ACTION;
  readonly threshold = KYC_THRESHOLD_AMOUNT;
  readonly reason: string;
  readonly reasonCode: KycRequiredReason;

  constructor(reason: string, reasonCode: KycRequiredReason) {
    super(reason);
    this.name = "KycRequiredError";
    this.reason = reason;
    this.reasonCode = reasonCode;
  }

  toPayload() {
    return {
      code: this.code,
      reason: this.reason,
      threshold: this.threshold,
      action: this.action,
      reasonCode: this.reasonCode,
    };
  }
}

const HIGH_VALUE_REASON = `Your deal amount is ৳${KYC_THRESHOLD_AMOUNT.toLocaleString("en-BD")} or higher. Identity verification is required for security.`;
const DISPUTE_REASON =
  "KYC & Face Verification is mandatory to participate in dispute resolution.";

/**
 * Progressive threshold KYC check.
 * - Bypasses when user.isVerified is true
 * - Requires KYC when deal.amount >= threshold OR isDisputeAction
 */
export async function checkKycRequirement(
  userId: number | null | undefined,
  dealId: number | null | undefined,
  isDisputeAction = false,
  amountOverride?: number | null,
): Promise<KycCheckResult> {
  if (userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      select: { isVerified: true },
    });
    if (user?.isVerified) {
      return { kycRequired: false };
    }
  }

  if (isDisputeAction) {
    return {
      kycRequired: true,
      reason: DISPUTE_REASON,
      reasonCode: "DISPUTE_ACTION",
      threshold: KYC_THRESHOLD_AMOUNT,
      action: KYC_REQUIRED_ACTION,
    };
  }

  let amount = amountOverride != null ? Number(amountOverride) : null;

  if (amount == null && dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { amount: true },
    });
    if (!deal) {
      return { kycRequired: false };
    }
    amount = Number(deal.amount.toString());
  }

  if (amount != null && Number.isFinite(amount) && amount >= KYC_THRESHOLD_AMOUNT) {
    return {
      kycRequired: true,
      reason: HIGH_VALUE_REASON,
      reasonCode: "HIGH_VALUE_DEAL",
      threshold: KYC_THRESHOLD_AMOUNT,
      action: KYC_REQUIRED_ACTION,
    };
  }

  return { kycRequired: false };
}

/** Throws KycRequiredError when verification is required. */
export async function assertKycAllowed(
  userId: number | null | undefined,
  dealId: number | null | undefined,
  isDisputeAction = false,
  amountOverride?: number | null,
): Promise<void> {
  const result = await checkKycRequirement(
    userId,
    dealId,
    isDisputeAction,
    amountOverride,
  );
  if (result.kycRequired) {
    throw new KycRequiredError(result.reason, result.reasonCode);
  }
}
