import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || process.env.S3_REGION || "us-east-1";
const endpoint = process.env.S3_ENDPOINT || undefined;

export const S3_BUCKET = process.env.S3_BUCKET || "";
export const S3_PRESIGN_EXPIRES_SECONDS = Number(
  process.env.S3_PRESIGN_EXPIRES_SECONDS || 300,
);

if (!S3_BUCKET && process.env.NODE_ENV === "production") {
  console.warn("[s3] S3_BUCKET is not configured");
}

/**
 * Disable flexible checksums on presigned PUTs.
 * AWS SDK v3 otherwise adds x-amz-checksum-* query params that force a browser
 * CORS preflight LocalStack/S3 often fails to answer.
 */
export const s3Client = new S3Client({
  region,
  ...(endpoint
    ? {
        endpoint,
        forcePathStyle: true,
      }
    : {}),
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
