import prisma from "../../../config/prisma.js";
import {
  assertAllowedMimeType,
  assertFileSizeWithinLimit,
  buildDisputeObjectKey,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  headObject,
  isDisputeObjectKey,
  isS3ObjectKey,
} from "../../../services/storage.service.js";
import type {
  CreateUploadPresignBody,
  GetDownloadPresignQuery,
} from "./upload.validation.js";

async function assertDealParticipant(
  dealId: number,
  userId: number | null,
  identityId: string | undefined,
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
  if (!deal) {
    throw Object.assign(new Error("Deal not found"), { statusCode: 404 });
  }

  const isBuyer =
    (userId != null && userId > 0 && deal.buyerId === userId) ||
    (identityId != null && deal.buyerIdentityId === identityId);
  const isSeller =
    (userId != null && userId > 0 && deal.sellerId === userId) ||
    (identityId != null && deal.sellerIdentityId === identityId);

  if (!isBuyer && !isSeller) {
    throw Object.assign(
      new Error("Unauthorized: Not a participant in this deal"),
      { statusCode: 403 },
    );
  }

  return { deal, isBuyer, isSeller };
}

async function resolveParty(
  dealId: number,
  userId: number | null,
  identityId: string | undefined,
  sessionRole?: "BUYER" | "SELLER",
): Promise<"BUYER" | "SELLER"> {
  const { isBuyer, isSeller } = await assertDealParticipant(
    dealId,
    userId,
    identityId,
  );

  if (sessionRole === "BUYER" || sessionRole === "SELLER") {
    if (sessionRole === "BUYER" && !isBuyer) {
      throw Object.assign(new Error("Unauthorized: Not the buyer"), {
        statusCode: 403,
      });
    }
    if (sessionRole === "SELLER" && !isSeller) {
      throw Object.assign(new Error("Unauthorized: Not the seller"), {
        statusCode: 403,
      });
    }
    return sessionRole;
  }

  if (isBuyer && !isSeller) return "BUYER";
  if (isSeller && !isBuyer) return "SELLER";
  throw Object.assign(
    new Error("Unauthorized: Unable to resolve party role"),
    { statusCode: 403 },
  );
}

export async function createUploadPresignedUrl(
  body: CreateUploadPresignBody,
  userId: number | null,
  identityId: string | undefined,
  sessionRole?: "BUYER" | "SELLER",
) {
  assertAllowedMimeType(body.mimeType);
  assertFileSizeWithinLimit(body.fileSizeBytes);

  const dispute = await prisma.dispute.findUnique({
    where: { id: body.disputeId },
    select: { id: true, dealId: true, status: true },
  });
  if (!dispute || dispute.dealId !== body.dealId) {
    throw Object.assign(new Error("Dispute not found for this deal"), {
      statusCode: 404,
    });
  }

  const party = await resolveParty(
    body.dealId,
    userId,
    identityId,
    sessionRole,
  );

  const objectKey = buildDisputeObjectKey(
    body.disputeId,
    party,
    body.fileName,
  );

  const signed = await createPresignedUploadUrl({
    objectKey,
    mimeType: body.mimeType,
    fileSizeBytes: body.fileSizeBytes,
  });

  return {
    ...signed,
    dealId: body.dealId,
    disputeId: body.disputeId,
    mimeType: body.mimeType,
    fileName: body.fileName,
    fileSizeBytes: body.fileSizeBytes,
  };
}

export async function createDownloadPresignedUrl(
  query: GetDownloadPresignQuery,
  userId: number | null,
  identityId: string | undefined,
) {
  let objectKey = query.objectKey;
  let dealId = query.dealId;
  let disputeId = query.disputeId;
  let fileName: string | undefined;

  if (query.evidenceId) {
    const evidence = await prisma.disputeEvidence.findUnique({
      where: { id: query.evidenceId },
      select: {
        fileUrl: true,
        fileName: true,
        dispute: { select: { id: true, dealId: true } },
      },
    });
    if (!evidence) {
      throw Object.assign(new Error("Evidence not found"), { statusCode: 404 });
    }
    objectKey = evidence.fileUrl;
    dealId = evidence.dispute.dealId;
    disputeId = evidence.dispute.id;
    fileName = evidence.fileName;
  } else if (disputeId && !dealId) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { dealId: true },
    });
    if (!dispute) {
      throw Object.assign(new Error("Dispute not found"), { statusCode: 404 });
    }
    dealId = dispute.dealId;
  }

  if (!dealId) {
    throw Object.assign(new Error("dealId is required"), { statusCode: 400 });
  }

  await assertDealParticipant(dealId, userId, identityId);

  if (!isS3ObjectKey(objectKey)) {
    throw Object.assign(new Error("Invalid object key"), { statusCode: 400 });
  }

  if (disputeId && !isDisputeObjectKey(objectKey, disputeId)) {
    throw Object.assign(
      new Error("Unauthorized: Object does not belong to this dispute"),
      { statusCode: 403 },
    );
  }

  if (!disputeId) {
    const match = /^disputes\/(\d+)\//.exec(objectKey);
    if (!match) {
      throw Object.assign(new Error("Invalid dispute object key"), {
        statusCode: 400,
      });
    }
    const keyDisputeId = Number(match[1]);
    const dispute = await prisma.dispute.findUnique({
      where: { id: keyDisputeId },
      select: { dealId: true },
    });
    if (!dispute || dispute.dealId !== dealId) {
      throw Object.assign(
        new Error("Unauthorized: Object does not belong to this deal"),
        { statusCode: 403 },
      );
    }
  }

  return createPresignedDownloadUrl({ objectKey, fileName });
}

/** Verify an uploaded object exists and matches declared metadata. */
export async function assertUploadedEvidenceObject(params: {
  disputeId: number;
  objectKey: string;
  mimeType: string;
  fileSizeBytes?: number;
}) {
  assertAllowedMimeType(params.mimeType);
  if (!isDisputeObjectKey(params.objectKey, params.disputeId)) {
    throw Object.assign(
      new Error("Invalid evidence object key for this dispute"),
      { statusCode: 400 },
    );
  }

  const meta = await headObject(params.objectKey);
  const size = meta.contentLength ?? params.fileSizeBytes ?? 0;
  assertFileSizeWithinLimit(size);

  if (meta.contentType && meta.contentType !== params.mimeType) {
    throw Object.assign(new Error("Uploaded object Content-Type mismatch"), {
      statusCode: 400,
    });
  }

  return { fileSizeBytes: size };
}
