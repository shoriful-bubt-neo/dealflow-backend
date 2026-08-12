import {
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import {
  s3Client,
  S3_BUCKET,
  S3_PRESIGN_EXPIRES_SECONDS,
} from "../config/s3.js";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const;

export type AllowedMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export function assertAllowedMimeType(mimeType: string): asserts mimeType is AllowedMimeType {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    throw Object.assign(new Error(`MIME type not allowed: ${mimeType}`), {
      statusCode: 400,
    });
  }
}

export function assertFileSizeWithinLimit(fileSizeBytes: number) {
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw Object.assign(new Error("fileSizeBytes must be a positive number"), {
      statusCode: 400,
    });
  }
  if (fileSizeBytes > MAX_UPLOAD_BYTES) {
    throw Object.assign(
      new Error(`File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`),
      { statusCode: 400 },
    );
  }
}

function requireBucket() {
  if (!S3_BUCKET) {
    throw Object.assign(new Error("Object storage is not configured"), {
      statusCode: 503,
    });
  }
  return S3_BUCKET;
}

export function buildDisputeObjectKey(
  disputeId: number,
  party: "BUYER" | "SELLER",
  fileName: string,
): string {
  const safeBase = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `disputes/${disputeId}/${party.toLowerCase()}-${randomUUID()}-${safeBase}`;
}

export function isDisputeObjectKey(objectKey: string, disputeId: number): boolean {
  return objectKey.startsWith(`disputes/${disputeId}/`) && !objectKey.includes("..");
}

export function buildKycSelfieObjectKey(userId: number, fileName: string): string {
  const safeBase = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `kyc/${userId}/selfies/${randomUUID()}-${safeBase}`;
}

export function isKycSelfieObjectKey(objectKey: string, userId: number): boolean {
  return (
    objectKey.startsWith(`kyc/${userId}/selfies/`) && !objectKey.includes("..")
  );
}

export async function createPresignedUploadUrl(params: {
  objectKey: string;
  mimeType: string;
  fileSizeBytes: number;
  expiresIn?: number;
}): Promise<{ uploadUrl: string; objectKey: string; expiresIn: number }> {
  const bucket = requireBucket();
  assertAllowedMimeType(params.mimeType);
  assertFileSizeWithinLimit(params.fileSizeBytes);

  const expiresIn = params.expiresIn ?? S3_PRESIGN_EXPIRES_SECONDS;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.objectKey,
    ContentType: params.mimeType,
  });

  // Sign only Content-Type; avoid checksum query params that break browser CORS.
  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn,
    signableHeaders: new Set(["content-type"]),
  });
  return { uploadUrl, objectKey: params.objectKey, expiresIn };
}

export async function createPresignedDownloadUrl(params: {
  objectKey: string;
  expiresIn?: number;
  fileName?: string;
}): Promise<{ downloadUrl: string; objectKey: string; expiresIn: number }> {
  const bucket = requireBucket();
  const expiresIn = params.expiresIn ?? S3_PRESIGN_EXPIRES_SECONDS;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: params.objectKey,
    ...(params.fileName
      ? {
          ResponseContentDisposition: `attachment; filename="${params.fileName.replace(/"/g, "")}"`,
        }
      : {}),
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return { downloadUrl, objectKey: params.objectKey, expiresIn };
}

export async function headObject(objectKey: string): Promise<{
  contentType?: string;
  contentLength?: number;
}> {
  const bucket = requireBucket();
  const result = await s3Client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
  );
  return {
    contentType: result.ContentType,
    contentLength: result.ContentLength,
  };
}

export function isS3ObjectKey(value: string): boolean {
  return Boolean(value) && !value.startsWith("/") && !/^https?:\/\//i.test(value);
}
