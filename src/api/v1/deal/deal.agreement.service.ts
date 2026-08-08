import type { Prisma } from "../../../generated/prisma/client.js";
import prisma from "../../../config/prisma.js";

export class AgreementRequiredError extends Error {
  readonly code = "AGREEMENT_REQUIRED" as const;
  constructor(message = "Agreement acceptance required before using the deal room") {
    super(message);
    this.name = "AgreementRequiredError";
  }
}

export type ActiveAgreementTemplate = {
  id: number;
  version: string;
  title: string;
  content: string;
};

export type DealAgreementStatus = {
  accepted: boolean;
  template: ActiveAgreementTemplate | null;
  acceptedAt: string | null;
};

function parseFingerprint(raw: string): Prisma.InputJsonValue {
  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return { raw };
  }
}

export async function getActiveAgreementTemplate(): Promise<ActiveAgreementTemplate | null> {
  const template = await prisma.agreementTemplate.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, version: true, title: true, content: true },
  });
  return template;
}

export async function getDealAgreementStatus(
  dealId: number,
  identityId: string,
): Promise<DealAgreementStatus> {
  const template = await getActiveAgreementTemplate();
  if (!template) {
    return { accepted: true, template: null, acceptedAt: null };
  }

  const acceptance = await prisma.dealAgreementAcceptance.findUnique({
    where: {
      dealId_identityId_templateId: {
        dealId,
        identityId,
        templateId: template.id,
      },
    },
    select: { acceptedAt: true },
  });

  return {
    accepted: Boolean(acceptance),
    template,
    acceptedAt: acceptance?.acceptedAt.toISOString() ?? null,
  };
}

export async function assertAgreementAccepted(
  dealId: number,
  identityId: string,
): Promise<void> {
  const status = await getDealAgreementStatus(dealId, identityId);
  if (!status.accepted) {
    throw new AgreementRequiredError();
  }
}

export async function acceptDealAgreement(params: {
  dealId: number;
  userId: number | null;
  identityId: string;
  deviceFingerprint: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<DealAgreementStatus> {
  const { dealId, userId, identityId, deviceFingerprint, ipAddress, userAgent } =
    params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      buyerIdentityId: true,
      sellerIdentityId: true,
    },
  });

  if (!deal) {
    throw new Error("Deal not found");
  }

  const isBuyer =
    deal.buyerId === userId || deal.buyerIdentityId === identityId;
  const isSeller =
    deal.sellerId === userId || deal.sellerIdentityId === identityId;

  if (!isBuyer && !isSeller) {
    throw new Error("Unauthorized: Not a participant in this deal");
  }

  const template = await getActiveAgreementTemplate();
  if (!template) {
    throw new Error("No active agreement template configured");
  }

  const fingerprint = parseFingerprint(deviceFingerprint);

  const acceptance = await prisma.$transaction(async (tx) => {
    const row = await tx.dealAgreementAcceptance.upsert({
      where: {
        dealId_identityId_templateId: {
          dealId,
          identityId,
          templateId: template.id,
        },
      },
      update: {
        userId: userId ?? undefined,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        fingerprint,
        acceptedAt: new Date(),
        version: template.version,
      },
      create: {
        dealId,
        templateId: template.id,
        version: template.version,
        userId: userId ?? null,
        identityId,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        fingerprint,
      },
      select: { id: true, acceptedAt: true },
    });

    await tx.auditLog.create({
      data: {
        dealId,
        userId: userId ?? undefined,
        action: "AGREEMENT_ACCEPTED",
        entityType: "DealAgreementAcceptance",
        entityId: row.id,
        ipAddress: ipAddress || undefined,
        deviceId: identityId,
        meta: {
          templateId: template.id,
          version: template.version,
          identityId,
        },
      },
    });

    return row;
  });

  return {
    accepted: true,
    template,
    acceptedAt: acceptance.acceptedAt.toISOString(),
  };
}
