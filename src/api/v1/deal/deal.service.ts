import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import prisma from "../../../config/prisma.js";
import type {
  ValidatedDealInput,
  CreateDealResponse,
  FraudCheckResult,
  ChargeCalculation,
  GetDealByCodeResponse,
  JoinDealPayload,
  JoinDealResponse,
} from "./deal.types.js";
import { Prisma } from "../../../generated/prisma/client.js";

interface IdentityResult {
  id: string;
  deviceId: string;
  userId: number | null;
}

/**
 * Generate a unique payment reference (deal code)
 */
function generatePaymentRef(): string {
  return `DEAL-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Generate an invite token for the opposite party
 */
function generateInviteToken(): string {
  return uuidv4();
}

/**
 * Resolve or create an Identity record from device fingerprint
 * DEVICE TRACKING: Map device_fingerprint to persistent identity
 */
async function resolveOrCreateIdentity(
  deviceFingerprint: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<IdentityResult> {
  // Parse the fingerprint JSON string
  let fingerprintData;
  try {
    fingerprintData = JSON.parse(deviceFingerprint);
  } catch {
    fingerprintData = { raw: deviceFingerprint };
  }

  const deviceId = crypto
    .createHash("sha256")
    .update(deviceFingerprint)
    .digest("hex");

  const identity = await prisma.identity.upsert({
    where: { deviceId },
    update: {
      ip: ipAddress || null,
      userAgent: userAgent || null,
      fingerprint: fingerprintData,
    },
    create: {
      deviceId,
      ip: ipAddress,
      fingerprint: fingerprintData,
      userAgent,
      trustLevel: 0,
    },
  });

  return {
    id: identity.id,
    deviceId: identity.deviceId,
    userId: identity.userId ?? null,
  };
}

async function getAuthenticatedUser(userId?: number) {
  if (!userId) return null;
  return prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      phone: true,
    },
  });
}

/**
 * Load and validate payment method + service charge config
 * CONFIG SOURCE OF TRUTH: All charge calculations come from backend config
 */
async function loadPaymentConfig(paymentMethodId: number | string, amount: number | string) {
  const resolvedPaymentMethodId = Number(paymentMethodId);
  const resolvedAmount = Number(amount);

  if (
    !Number.isFinite(resolvedPaymentMethodId) ||
    !Number.isInteger(resolvedPaymentMethodId) ||
    resolvedPaymentMethodId <= 0 ||
    !Number.isFinite(resolvedAmount) ||
    resolvedAmount <= 0
  ) {
    throw new Error("Invalid deal payload: valid payment method and amount are required.");
  }

  const dealAmount = new Prisma.Decimal(resolvedAmount);

  const config = await prisma.serviceChargeConfig.findFirst({
    where: {
      paymentMethodId: resolvedPaymentMethodId,
      isActive: true,
      minAmount: { lte: dealAmount },
      OR: [
        { maxAmount: null },
        { maxAmount: { gte: dealAmount } },
      ],
    },
    orderBy: [{ minAmount: "desc" }, { maxAmount: "asc" }],
    include: {
      method: true,
    },
  });

  if (!config) {
    throw new Error(`Payment method ${paymentMethodId} not found or inactive`);
  }

  if (config.type === "FIXED" && config.fixedAmount === null) {
    throw new Error("Invalid service charge configuration: FIXED amount is required.");
  }

  if (config.type === "PERCENTAGE" && config.percentage === null) {
    throw new Error("Invalid service charge configuration: PERCENTAGE value is required.");
  }

  return config;
}

/**
 * Calculate service charge and deal economics server-side
 * PRICE AUTHORITY: Frontend suggestions are validated and recalculated here
 */
function calculateCharges(
  baseAmount: Prisma.Decimal,
  chargeType: "FIXED" | "PERCENTAGE",
  chargeValue: Prisma.Decimal,
  chargeBearer: "BUYER" | "SELLER" | "SPLIT",
): ChargeCalculation {
  const totalCharge =
    chargeType === "FIXED"
      ? chargeValue
      : baseAmount
        .mul(chargeValue)
        .div(new Prisma.Decimal(100))
        .toDecimalPlaces(2);

  let buyerPays = new Prisma.Decimal(0);
  let sellerPays = new Prisma.Decimal(0);

  if (chargeBearer === "BUYER") {
    buyerPays = totalCharge;
  } else if (chargeBearer === "SELLER") {
    sellerPays = totalCharge;
  } else {
    // Split equally, round up for buyer to avoid loss
    buyerPays = totalCharge
      .div(new Prisma.Decimal(2))
      .ceil();
    sellerPays = totalCharge.minus(buyerPays);
  }

  const buyerTotal = baseAmount.plus(buyerPays);
  const sellerReceives = baseAmount.minus(sellerPays);

  return {
    chargeType,
    chargeValue: Number(chargeValue.toFixed(2)),
    totalCharge: Number(totalCharge.toFixed(2)),
    buyerPays: Number(buyerPays.toFixed(2)),
    sellerPays: Number(sellerPays.toFixed(2)),
    buyerTotal: Number(buyerTotal.toFixed(2)),
    sellerReceives: Number(sellerReceives.toFixed(2)),
  };
}

/**
 * Fraud detection: check for suspicious patterns
 * FRAUD DETECTION: Multiple risk signals
 */
async function checkFraud(
  deviceId: string,
  phone: string,
  type: "BUYER" | "SELLER",
  ipAddress?: string,
): Promise<FraudCheckResult> {
  const recentDealsCount = await prisma.deal.count({
    where: {
      OR: [{ buyerDeviceId: deviceId }, { sellerDeviceId: deviceId }],
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000),
      },
    },
  });

  if (recentDealsCount > 5) {
    return {
      isFraudulent: true,
      riskLevel: "HIGH",
      reason: "Device creating deals too rapidly",
    };
  }

  const conflictingRole = await prisma.deal.findFirst({
    where: {
      buyerDeviceId: deviceId,
      sellerDeviceId: deviceId,
    },
  });

  if (conflictingRole) {
    return {
      isFraudulent: true,
      riskLevel: "HIGH",
      reason: "Device cannot be both buyer and seller",
    };
  }

  const devicesForPhone = await prisma.deal.findMany({
    where: {
      OR: [{ buyerPhone: phone }, { sellerPhone: phone }],
    },
    select: {
      buyerDeviceId: true,
      sellerDeviceId: true,
    },
  });

  const uniqueDevices = new Set([
    ...devicesForPhone.map((deal) => deal.buyerDeviceId).filter(Boolean),
    ...devicesForPhone.map((deal) => deal.sellerDeviceId).filter(Boolean),
  ]);

  if (uniqueDevices.size > 10) {
    return {
      isFraudulent: false,
      riskLevel: "MEDIUM",
      reason: "Phone associated with many distinct devices",
    };
  }

  if (
    ipAddress &&
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ipAddress)
  ) {
    return {
      isFraudulent: false,
      riskLevel: "MEDIUM",
      reason: "Private or local network IP detected",
    };
  }

  return {
    isFraudulent: false,
    riskLevel: "LOW",
  };
}

/**
 * Create deal with all related records in a transaction
 * ATOMIC TRANSACTION: All-or-nothing consistency
 */
async function createDealTransaction(
  input: ValidatedDealInput,
  identity: IdentityResult,
  authenticatedUserId: number | null,
  chargeCalculation: ChargeCalculation,
  payer: "BUYER" | "SELLER" | "SPLIT",
  fraudCheck: FraudCheckResult,
): Promise<{ dealId: number; paymentRef: string; inviteToken: string; inviteExpiresAt: Date }> {
  const paymentRef = generatePaymentRef();
  const inviteToken = generateInviteToken();
  const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const dealCreatePayload: Prisma.DealCreateInput = {
      item: input.item,
      amount: new Prisma.Decimal(input.amount),
      status: "CREATED",
      paymentRef,
      inviteToken,
      inviteExpiresAt,
      ...(input.type === "BUYER"
        ? {
          buyerPhone: input.phone,
          buyerDeviceId: identity.deviceId,
          buyerIdentity: {
            connect: { id: identity.id },
          },
          ...(authenticatedUserId
            ? {
              buyer: {
                connect: { id: authenticatedUserId },
              },
            }
            : {}),
        }
        : {
          sellerPhone: input.phone,
          sellerDeviceId: identity.deviceId,
          sellerIdentity: {
            connect: { id: identity.id },
          },
          ...(authenticatedUserId
            ? {
              seller: {
                connect: { id: authenticatedUserId },
              },
            }
            : {}),
        }),
    };

    const deal = await tx.deal.create({ data: dealCreatePayload });

    const combinedContent = `Welcome to Deal Room ${paymentRef}. I'm your admin and will supervise this transaction.\n\n` +
      `Deal: ${input.item} - ${input.amount} BDT\n\n` +
      `Please use the payment numbers on the left panel to send funds. Once confirmed, I'll update the status.`;

    await tx.message.create({
      data: {
        dealId: deal.id,
        type: "SYSTEM",
        senderType: "ADMIN",
        content: combinedContent,
        createdAt: new Date(),
      },
    });


    await tx.dealCharge.create({
      data: {
        dealId: deal.id,
        baseAmount: new Prisma.Decimal(input.amount),
        chargeType: chargeCalculation.chargeType,
        chargeValue: new Prisma.Decimal(chargeCalculation.chargeValue),
        totalCharge: new Prisma.Decimal(chargeCalculation.totalCharge),
        payer,
        buyerPays: new Prisma.Decimal(chargeCalculation.buyerPays),
        sellerPays: new Prisma.Decimal(chargeCalculation.sellerPays),
        buyerTotal: new Prisma.Decimal(chargeCalculation.buyerTotal),
        sellerReceives: new Prisma.Decimal(chargeCalculation.sellerReceives),
      },
    });

    await tx.auditLog.create({
      data: {
        dealId: deal.id,
        action: "DEAL_CREATED",
        entityType: "deal",
        entityId: deal.id,
        userId: authenticatedUserId ?? undefined,
        deviceId: identity.deviceId,
        ipAddress: input.ipAddress,
        meta: {
          actorMode: authenticatedUserId ? "AUTHENTICATED" : "GUEST",
          initiatorType: input.type,
          phone: input.phone,
          paymentMethodId: input.paymentMethodId,
          chargeBearer: payer,
          identityId: identity.id,
          fraudRiskLevel: fraudCheck.riskLevel,
          fraudReason: fraudCheck.reason,
          requestPath: input.requestPath,
        },
      },
    });

    if (fraudCheck.riskLevel !== "LOW") {
      await tx.auditLog.create({
        data: {
          dealId: deal.id,
          userId: authenticatedUserId ?? undefined,
          action: "DEAL_RISK_SIGNAL",
          entityType: "deal",
          entityId: deal.id,
          deviceId: identity.deviceId,
          ipAddress: input.ipAddress,
          meta: {
            riskLevel: fraudCheck.riskLevel,
            reason: fraudCheck.reason || "No reason provided",
            phone: input.phone,
            identityId: identity.id,
          },
        },
      });
    }

    await tx.requestLog.create({
      data: {
        ip: input.ipAddress || "unknown",
        deviceId: identity.deviceId,
        path: input.requestPath || "/deals",
      },
    });

    return {
      dealId: deal.id,
      paymentRef,
      inviteToken,
      inviteExpiresAt,
    };
  });
}

/**
 * Main service: Create deal from validated frontend payload
 */
export async function createDeal(
  input: ValidatedDealInput,
): Promise<CreateDealResponse> {
  try {
    const identity = await resolveOrCreateIdentity(
      input.deviceFingerprint,
      input.ipAddress,
      input.userAgent,
    );
    const authenticatedUser = await getAuthenticatedUser(input.authenticatedUserId);
    const authenticatedUserId = authenticatedUser?.id ?? null;

    const paymentConfig = await loadPaymentConfig(input.paymentMethodId, input.amount);

    const payer = input.chargeBearer;
    const chargeValue =
      paymentConfig.type === "FIXED"
        ? paymentConfig.fixedAmount!
        : paymentConfig.percentage!;

    const chargeCalculation = calculateCharges(
      new Prisma.Decimal(input.amount),
      paymentConfig.type,
      chargeValue,
      payer,
    );

    const fraudCheck = await checkFraud(
      identity.deviceId,
      input.phone,
      input.type,
      input.ipAddress,
    );

    if (fraudCheck.isFraudulent) {
      throw new Error(`Deal rejected: ${fraudCheck.reason || "Fraud detected"}`);
    }

    const dealResult = await createDealTransaction(
      input,
      identity,
      authenticatedUserId,
      chargeCalculation,
      payer,
      fraudCheck,
    );

    return {
      success: true,
      dealId: dealResult.dealId,
      paymentRef: dealResult.paymentRef,
      inviteToken: dealResult.inviteToken,
      inviteExpiresAt: dealResult.inviteExpiresAt.toISOString(),
      riskLevel: fraudCheck.riskLevel,
      buyerTotal: chargeCalculation.buyerTotal,
      sellerReceives: chargeCalculation.sellerReceives,
      role: input.type,
      identityId: identity.id,
      message: "Deal created successfully",
    };
  } catch (error) {
    console.error("Deal creation error:", error);
    throw error;
  }
}

async function findDealByPaymentRef(paymentRef: string) {
  return prisma.deal.findFirst({
    where: { paymentRef },
    include: {
      charge: true,
    },
  });
}

function resolveJoinRole(deal: { buyerPhone: string | null; sellerPhone: string | null }) {
  if (deal.buyerPhone && !deal.sellerPhone) return "SELLER" as const;
  if (deal.sellerPhone && !deal.buyerPhone) return "BUYER" as const;
  throw new Error("Deal already has both sides or is not joinable");
}

export async function getDealByCode(
  paymentRef: string,
): Promise<GetDealByCodeResponse | null> {
  const deal = await findDealByPaymentRef(paymentRef);
  if (!deal) return null;

  const now = new Date();
  const isExpired = deal.inviteExpiresAt ? deal.inviteExpiresAt < now : false;
  const joinRole = resolveJoinRole(deal);

  return {
    success: true,
    dealId: deal.id,
    paymentRef: deal.paymentRef,
    item: deal.item || "",
    amount: Number(deal.amount.toString()),
    joinRole,
    isJoinable: !isExpired,
    inviteExpiresAt: deal.inviteExpiresAt?.toISOString() ?? new Date().toISOString(),
    message: isExpired ? "Deal invite has expired" : "Deal code is valid",
  };
}

export async function joinDeal(
  payload: JoinDealPayload,
  ipAddress?: string,
  userAgent?: string,
  requestPath?: string,
): Promise<JoinDealResponse> {
  const deal = await findDealByPaymentRef(payload.payment_ref);
  if (!deal) {
    throw new Error("Deal not found");
  }

  if (deal.inviteExpiresAt && deal.inviteExpiresAt < new Date()) {
    throw new Error("Deal invite has expired");
  }

  const joinRole = resolveJoinRole(deal);
  const identity = await resolveOrCreateIdentity(
    payload.device_fingerprint,
    ipAddress,
    userAgent,
  );

  if (joinRole === "SELLER") {
    if (deal.buyerDeviceId === identity.deviceId || deal.buyerIdentityId === identity.id) {
      throw new Error("Opposite role cannot join from same device or identity");
    }
  } else {
    if (deal.sellerDeviceId === identity.deviceId || deal.sellerIdentityId === identity.id) {
      throw new Error("Opposite role cannot join from same device or identity");
    }
  }

  const authenticatedUser = await getAuthenticatedUser(payload.user_id);
  const authenticatedUserId = authenticatedUser?.id ?? null;

  const updateData: Prisma.DealUpdateInput = {
    status: deal.status,
    ...(joinRole === "SELLER"
      ? {
        sellerDeviceId: identity.deviceId,
        sellerIdentity: {
          connect: { id: identity.id },
        },
        ...(authenticatedUserId
          ? {
            seller: {
              connect: { id: authenticatedUserId },
            },
          }
          : {}),
      }
      : {
        buyerDeviceId: identity.deviceId,
        buyerIdentity: {
          connect: { id: identity.id },
        },
        ...(authenticatedUserId
          ? {
            buyer: {
              connect: { id: authenticatedUserId },
            },
          }
          : {}),
      }),
  };

  const updatedDeal = await prisma.deal.update({
    where: { id: deal.id },
    data: updateData,
  });

  const joinMessage = joinRole === "SELLER"
    ? "Seller has joined the deal."
    : "Buyer has joined the deal.";

  await prisma.message.create({
    data: {
      dealId: updatedDeal.id,
      type: "SYSTEM",
      senderType: "ADMIN",
      content: joinMessage,
      createdAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      dealId: updatedDeal.id,
      action: "DEAL_JOINED",
      entityType: "deal",
      entityId: updatedDeal.id,
      userId: authenticatedUserId ?? undefined,
      deviceId: identity.deviceId,
      ipAddress,
      meta: {
        role: joinRole,
        identityId: identity.id,
        requestPath,
        paymentRef: updatedDeal.paymentRef,
      },
    },
  });

  await prisma.requestLog.create({
    data: {
      ip: ipAddress || "unknown",
      deviceId: identity.deviceId,
      path: requestPath || "/deals/join",
    },
  });

  return {
    success: true,
    dealId: updatedDeal.id,
    paymentRef: updatedDeal.paymentRef,
    role: joinRole,
    identityId: identity.id,
    inviteExpiresAt: updatedDeal.inviteExpiresAt?.toISOString() ?? new Date().toISOString(),
    message: "Joined deal successfully",
  };
}
