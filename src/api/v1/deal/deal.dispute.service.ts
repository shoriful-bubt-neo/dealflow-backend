import { createHash, randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import prisma from "../../../config/prisma.js";
import { emitToDealRoom } from "../../../sockets/roomEmitter.js";
import type {
  DisputeParty,
  DisputeStatus,
  MessageSenderType,
} from "../../../generated/prisma/enums.js";
import { assertAgreementAccepted } from "./deal.agreement.service.js";

const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = [
  "AWAITING_BUYER_EVIDENCE",
  "AWAITING_SELLER_RESPONSE",
  "UNDER_REVIEW",
];

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024; // 5MB each

export type DisputeEvidenceInput = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

export type ActiveDisputeDTO = {
  id: number;
  dealId: number;
  status: DisputeStatus;
  amountAtDispute: number;
  buyerStatement: string | null;
  buyerSubmittedAt: string | null;
  sellerStatement: string | null;
  sellerSubmittedAt: string | null;
  canBuyerSubmit: boolean;
  canSellerSubmit: boolean;
  chatLocked: boolean;
  evidence: Array<{
    id: number;
    party: DisputeParty;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSizeBytes: number | null;
    createdAt: string;
  }>;
  createdAt: string;
};

function toDisputeDTO(dispute: {
  id: number;
  dealId: number;
  status: DisputeStatus;
  amountAtDispute: { toString(): string };
  buyerStatement: string | null;
  buyerSubmittedAt: Date | null;
  sellerStatement: string | null;
  sellerSubmittedAt: Date | null;
  createdAt: Date;
  evidence: Array<{
    id: number;
    party: DisputeParty;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSizeBytes: number | null;
    createdAt: Date;
  }>;
}): ActiveDisputeDTO {
  return {
    id: dispute.id,
    dealId: dispute.dealId,
    status: dispute.status,
    amountAtDispute: Number(dispute.amountAtDispute.toString()),
    buyerStatement: dispute.buyerStatement,
    buyerSubmittedAt: dispute.buyerSubmittedAt?.toISOString() ?? null,
    sellerStatement: dispute.sellerStatement,
    sellerSubmittedAt: dispute.sellerSubmittedAt?.toISOString() ?? null,
    canBuyerSubmit: dispute.status === "AWAITING_BUYER_EVIDENCE",
    canSellerSubmit: dispute.status === "AWAITING_SELLER_RESPONSE",
    chatLocked:
      dispute.status === "UNDER_REVIEW" ||
      dispute.status === "RESOLVED" ||
      dispute.status === "CLOSED",
    evidence: dispute.evidence.map((e) => ({
      id: e.id,
      party: e.party,
      fileName: e.fileName,
      fileUrl: e.fileUrl,
      mimeType: e.mimeType,
      fileSizeBytes: e.fileSizeBytes,
      createdAt: e.createdAt.toISOString(),
    })),
    createdAt: dispute.createdAt.toISOString(),
  };
}

function emitDisputeChatMessage(
  dealId: number,
  message: {
    id: number;
    content: string;
    type: string;
    senderType: MessageSenderType;
    createdAt: Date | string;
  },
  senderRole: "buyer" | "seller" | "admin",
) {
  emitToDealRoom(dealId, "message:new", {
    id: message.id,
    dealId,
    content: message.content,
    type: message.type,
    senderType: message.senderType,
    senderRole,
    createdAt:
      typeof message.createdAt === "string"
        ? message.createdAt
        : message.createdAt.toISOString(),
  });
}

async function loadActiveDispute(dealId: number) {
  return prisma.dispute.findFirst({
    where: {
      dealId,
      status: { in: ACTIVE_DISPUTE_STATUSES },
    },
    include: {
      evidence: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveDispute(
  dealId: number,
  userId: number | null,
  identityId: string,
): Promise<ActiveDisputeDTO | null> {
  await assertParticipant(dealId, userId, identityId);
  const dispute = await loadActiveDispute(dealId);
  return dispute ? toDisputeDTO(dispute) : null;
}

export async function openDispute(
  dealId: number,
  userId: number | null,
  identityId: string,
): Promise<ActiveDisputeDTO> {
  await assertAgreementAccepted(dealId, identityId, userId);

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      amount: true,
      status: true,
      buyerId: true,
      sellerId: true,
      buyerIdentityId: true,
      sellerIdentityId: true,
    },
  });

  if (!deal) throw new Error("Deal not found");

  const isBuyer =
    deal.buyerId === userId || deal.buyerIdentityId === identityId;
  if (!isBuyer) {
    throw new Error("Unauthorized: Only the buyer can open a dispute");
  }

  if (!["DELIVERED", "DISPUTED", "PAID"].includes(deal.status)) {
    throw new Error("Dispute can only be opened after delivery");
  }

  const existing = await loadActiveDispute(dealId);
  if (existing) return toDisputeDTO(existing);

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({
      data: {
        dealId,
        status: "AWAITING_BUYER_EVIDENCE",
        openedByRole: "BUYER",
        openedByUserId: userId ?? undefined,
        openedByIdentityId: identityId,
        amountAtDispute: deal.amount,
      },
      include: { evidence: true },
    });

    await tx.deal.update({
      where: { id: dealId },
      data: { status: "DISPUTED" },
    });

    const openMessage = await tx.message.create({
      data: {
        dealId,
        senderId: userId ?? undefined,
        content:
          "⚠️ Buyer opened a dispute. Buyer must submit reason + evidence once, then seller responds once. Chat locks after both submissions for admin review.",
        type: "SYSTEM",
        senderType: "BUYER",
      },
    });

    await tx.auditLog.create({
      data: {
        dealId,
        userId: userId ?? undefined,
        action: "DISPUTE_OPENED",
        entityType: "dispute",
        entityId: created.id,
        deviceId: identityId,
        meta: { amountAtDispute: deal.amount.toString() },
      },
    });

    return { dispute: created, messages: [openMessage] };
  });

  const dto = toDisputeDTO(result.dispute);
  for (const message of result.messages) {
    emitDisputeChatMessage(dealId, message, "buyer");
  }
  emitToDealRoom(dealId, "status:changed", {
    dealId,
    status: "DISPUTED",
    dispute: dto,
    timestamp: new Date().toISOString(),
  });
  emitToDealRoom(dealId, "dispute:updated", {
    dealId,
    dispute: dto,
    timestamp: new Date().toISOString(),
  });

  return dto;
}

export async function submitDisputeStatement(
  dealId: number,
  userId: number | null,
  identityId: string,
  statement: string,
  evidenceInputs: DisputeEvidenceInput[] = [],
  sessionRole?: "BUYER" | "SELLER",
): Promise<ActiveDisputeDTO> {
  await assertAgreementAccepted(dealId, identityId, userId);

  const trimmed = statement.trim();
  if (!trimmed) throw new Error("Statement / reason is required");
  if (trimmed.length > 5000) throw new Error("Statement is too long");

  if (evidenceInputs.length > MAX_EVIDENCE_FILES) {
    throw new Error(`Maximum ${MAX_EVIDENCE_FILES} attachments allowed`);
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      buyerId: true,
      sellerId: true,
      buyerIdentityId: true,
      sellerIdentityId: true,
    },
  });
  if (!deal) throw new Error("Deal not found");

  const isBuyer =
    deal.buyerId === userId || deal.buyerIdentityId === identityId;
  const isSeller =
    deal.sellerId === userId || deal.sellerIdentityId === identityId;
  if (!isBuyer && !isSeller) {
    throw new Error("Unauthorized: Not a participant in this deal");
  }

  const dispute = await loadActiveDispute(dealId);
  if (!dispute) throw new Error("No active dispute for this deal");

  // Prefer deal-scoped JWT role. Identity can match both sides on same device.
  let party: DisputeParty;
  if (sessionRole === "BUYER" || sessionRole === "SELLER") {
    party = sessionRole;
  } else if (dispute.status === "AWAITING_BUYER_EVIDENCE" && isBuyer) {
    party = "BUYER";
  } else if (dispute.status === "AWAITING_SELLER_RESPONSE" && isSeller) {
    party = "SELLER";
  } else if (isSeller && !isBuyer) {
    party = "SELLER";
  } else if (isBuyer) {
    party = "BUYER";
  } else {
    throw new Error("Unauthorized: Unable to resolve dispute party");
  }

  if (party === "BUYER" && !isBuyer) {
    throw new Error("Unauthorized: Only the buyer can submit details now");
  }
  if (party === "SELLER" && !isSeller) {
    throw new Error("Unauthorized: Only the seller can submit details now");
  }

  if (party === "BUYER") {
    if (dispute.status !== "AWAITING_BUYER_EVIDENCE") {
      throw new Error("Buyer already submitted dispute details");
    }
  } else if (dispute.status !== "AWAITING_SELLER_RESPONSE") {
    throw new Error("Seller cannot submit yet or already submitted");
  }

  const savedEvidence = await saveEvidenceFiles(
    dispute.id,
    party,
    userId,
    identityId,
    evidenceInputs,
  );

  const nextStatus: DisputeStatus =
    party === "BUYER" ? "AWAITING_SELLER_RESPONSE" : "UNDER_REVIEW";

  const updated = await prisma.$transaction(async (tx) => {
    if (savedEvidence.length) {
      await tx.disputeEvidence.createMany({
        data: savedEvidence.map((e) => ({
          disputeId: dispute.id,
          party,
          fileName: e.fileName,
          fileUrl: e.fileUrl,
          mimeType: e.mimeType,
          fileSizeBytes: e.fileSizeBytes,
          checksumSha256: e.checksumSha256,
          uploadedByUserId: userId ?? undefined,
          uploadedByIdentityId: identityId,
        })),
      });
    }

    const data =
      party === "BUYER"
        ? {
            buyerStatement: trimmed,
            buyerSubmittedAt: new Date(),
            buyerUserId: userId ?? undefined,
            buyerIdentityId: identityId,
            status: nextStatus,
          }
        : {
            sellerStatement: trimmed,
            sellerSubmittedAt: new Date(),
            sellerUserId: userId ?? undefined,
            sellerIdentityId: identityId,
            status: nextStatus,
          };

    const result = await tx.dispute.update({
      where: { id: dispute.id },
      data,
      include: { evidence: { orderBy: { createdAt: "asc" } } },
    });

    const attachmentNote =
      savedEvidence.length > 0
        ? `\n📎 Attachments: ${savedEvidence.map((e) => e.fileName).join(", ")}`
        : "";

    const senderType: MessageSenderType = party;
    const statementMessage = await tx.message.create({
      data: {
        dealId,
        senderId: userId ?? undefined,
        content:
          party === "BUYER"
            ? `🚨 Buyer dispute statement:\n${trimmed}${attachmentNote}`
            : `🧾 Seller dispute response:\n${trimmed}${attachmentNote}`,
        type: "USER",
        senderType,
      },
    });

    const messages = [statementMessage];

    if (nextStatus === "UNDER_REVIEW") {
      const lockMessage = await tx.message.create({
        data: {
          dealId,
          content:
            "🔒 Both parties submitted. Chat is locked. Admin will review this dispute.",
          type: "SYSTEM",
          senderType: "ADMIN",
        },
      });
      messages.push(lockMessage);
    }

    await tx.auditLog.create({
      data: {
        dealId,
        userId: userId ?? undefined,
        action:
          party === "BUYER"
            ? "DISPUTE_BUYER_SUBMITTED"
            : "DISPUTE_SELLER_SUBMITTED",
        entityType: "dispute",
        entityId: dispute.id,
        deviceId: identityId,
        meta: {
          nextStatus,
          evidenceCount: savedEvidence.length,
        },
      },
    });

    return { dispute: result, messages };
  });

  const dto = toDisputeDTO(updated.dispute);
  const senderRole = party === "BUYER" ? "buyer" : "seller";
  for (const message of updated.messages) {
    emitDisputeChatMessage(
      dealId,
      message,
      message.senderType === "ADMIN" ? "admin" : senderRole,
    );
  }
  emitToDealRoom(dealId, "status:changed", {
    dealId,
    status: "DISPUTED",
    dispute: dto,
    timestamp: new Date().toISOString(),
  });
  emitToDealRoom(dealId, "dispute:updated", {
    dealId,
    dispute: dto,
    timestamp: new Date().toISOString(),
  });

  return dto;
}

async function assertParticipant(
  dealId: number,
  userId: number | null,
  identityId: string,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      buyerId: true,
      sellerId: true,
      buyerIdentityId: true,
      sellerIdentityId: true,
    },
  });
  if (!deal) throw new Error("Deal not found");

  const isBuyer =
    deal.buyerId === userId || deal.buyerIdentityId === identityId;
  const isSeller =
    deal.sellerId === userId || deal.sellerIdentityId === identityId;
  if (!isBuyer && !isSeller) {
    throw new Error("Unauthorized: Not a participant in this deal");
  }
}

async function saveEvidenceFiles(
  disputeId: number,
  party: DisputeParty,
  _userId: number | null,
  _identityId: string,
  inputs: DisputeEvidenceInput[],
) {
  const uploadDir = path.join(
    process.cwd(),
    "uploads",
    "disputes",
    String(disputeId),
  );
  await fs.mkdir(uploadDir, { recursive: true });

  const saved: Array<{
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSizeBytes: number;
    checksumSha256: string;
  }> = [];

  for (const input of inputs) {
    const fileName = input.fileName?.trim();
    const mimeType = input.mimeType?.trim() || "application/octet-stream";
    if (!fileName) throw new Error("Evidence fileName is required");
    if (!input.dataBase64) throw new Error("Evidence data is required");

    const raw = input.dataBase64.includes(",")
      ? input.dataBase64.split(",")[1]
      : input.dataBase64;
    const buffer = Buffer.from(raw, "base64");
    if (!buffer.length) throw new Error(`Empty evidence file: ${fileName}`);
    if (buffer.length > MAX_EVIDENCE_BYTES) {
      throw new Error(`File too large (max 5MB): ${fileName}`);
    }

    const safeBase = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const storedName = `${party.toLowerCase()}-${randomUUID()}-${safeBase}`;
    const absPath = path.join(uploadDir, storedName);
    await fs.writeFile(absPath, buffer);

    saved.push({
      fileName,
      fileUrl: `/uploads/disputes/${disputeId}/${storedName}`,
      mimeType,
      fileSizeBytes: buffer.length,
      checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    });
  }

  return saved;
}
