import {
  CompareFacesCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import {
  KYC_FACE_MATCH_THRESHOLD,
  KYC_MOCK_FACE_PASS_SCORE,
  resolveKycProviderMode,
} from "../../config/kyc.js";
import { s3Client, S3_BUCKET } from "../../config/s3.js";
import type { FaceCompareResult } from "./types.js";

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION || process.env.S3_REGION || "us-east-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

async function streamToBuffer(
  body: AsyncIterable<Uint8Array> | undefined,
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function getS3ObjectBuffer(objectKey: string): Promise<Buffer> {
  if (!S3_BUCKET) {
    throw Object.assign(new Error("S3_BUCKET is not configured"), {
      statusCode: 503,
    });
  }
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: objectKey }),
  );
  return streamToBuffer(result.Body as AsyncIterable<Uint8Array> | undefined);
}

function decodeBase64Image(photoBase64: string): Buffer {
  const cleaned = photoBase64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(cleaned, "base64");
}

/**
 * Compare EC photo vs live selfie.
 * - Mock / local: auto-pass (>85%) when selfieS3Key is present
 * - Production: AWS Rekognition CompareFaces
 */
export async function compareFaces(params: {
  sourcePhotoBase64?: string;
  sourcePhotoS3Key?: string;
  selfieS3Key: string;
}): Promise<FaceCompareResult> {
  const useMock =
    resolveKycProviderMode() === "mock" ||
    process.env.NODE_ENV === "development" ||
    process.env.KYC_FACE_COMPARE_MODE === "mock";

  if (useMock) {
    if (!params.selfieS3Key?.trim()) {
      return { score: 0, matched: false, mode: "mock" };
    }
    const score = KYC_MOCK_FACE_PASS_SCORE;
    return {
      score,
      matched: score >= KYC_FACE_MATCH_THRESHOLD,
      mode: "mock",
    };
  }

  let sourceBytes: Buffer | null = null;
  if (params.sourcePhotoBase64) {
    sourceBytes = decodeBase64Image(params.sourcePhotoBase64);
  } else if (params.sourcePhotoS3Key) {
    sourceBytes = await getS3ObjectBuffer(params.sourcePhotoS3Key);
  }

  if (!sourceBytes?.length) {
    throw Object.assign(new Error("EC photo unavailable for face comparison"), {
      statusCode: 422,
    });
  }

  const targetBytes = await getS3ObjectBuffer(params.selfieS3Key);
  if (!targetBytes.length) {
    throw Object.assign(new Error("Selfie object is empty or missing"), {
      statusCode: 422,
    });
  }

  const response = await rekognitionClient.send(
    new CompareFacesCommand({
      SourceImage: { Bytes: sourceBytes },
      TargetImage: { Bytes: targetBytes },
      SimilarityThreshold: KYC_FACE_MATCH_THRESHOLD,
    }),
  );

  const score = Number(response.FaceMatches?.[0]?.Similarity ?? 0);
  return {
    score,
    matched: score >= KYC_FACE_MATCH_THRESHOLD,
    mode: "rekognition",
  };
}
