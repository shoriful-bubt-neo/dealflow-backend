import prisma from "../../config/prisma.js";
import {
  KYC_FACE_MATCH_THRESHOLD,
} from "../../config/kyc.js";
import { Prisma } from "../../generated/prisma/client.js";
import { compareFaces } from "./faceCompare.service.js";
import { getKycProvider } from "./providers/index.js";

export type VerifyKycInput = {
  userId: number;
  nidNumber: string;
  dateOfBirth: string;
  selfieS3Key: string;
};

export type VerifyKycResponse = {
  success: boolean;
  verified: boolean;
  vendor: string;
  faceMatchScore: number;
  faceMatchThreshold: number;
  matchedName: string | null;
  failureCode: string | null;
  message: string;
  submissionId: number;
  user: {
    id: number;
    isVerified: boolean;
    trustLevel: number;
    status: string;
  };
};

export async function verifyKyc(input: VerifyKycInput): Promise<VerifyKycResponse> {
  const provider = getKycProvider();
  const nidResult = await provider.verifyNid(input.nidNumber, input.dateOfBirth);

  if (!nidResult.success) {
    const submission = await prisma.kycSubmission.create({
      data: {
        userId: input.userId,
        nidNumber: input.nidNumber.replace(/\D/g, ""),
        dateOfBirth: input.dateOfBirth,
        selfieS3Key: input.selfieS3Key,
        vendor: nidResult.vendor,
        status: "FAILED",
        failureCode: nidResult.code,
        vendorPayload: (nidResult.raw ?? { message: nidResult.message }) as Prisma.InputJsonValue,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { id: true, isVerified: true, trustLevel: true, status: true },
    });

    return {
      success: false,
      verified: false,
      vendor: nidResult.vendor,
      faceMatchScore: 0,
      faceMatchThreshold: KYC_FACE_MATCH_THRESHOLD,
      matchedName: null,
      failureCode: nidResult.code,
      message: nidResult.message,
      submissionId: submission.id,
      user,
    };
  }

  const face = await compareFaces({
    sourcePhotoBase64: nidResult.photoBase64,
    sourcePhotoS3Key: nidResult.photoS3Key,
    selfieS3Key: input.selfieS3Key,
  });

  const passed = face.matched && face.score >= KYC_FACE_MATCH_THRESHOLD;

  if (!passed) {
    const submission = await prisma.kycSubmission.create({
      data: {
        userId: input.userId,
        nidNumber: input.nidNumber.replace(/\D/g, ""),
        dateOfBirth: input.dateOfBirth,
        selfieS3Key: input.selfieS3Key,
        vendor: nidResult.vendor,
        status: "FAILED",
        faceMatchScore: new Prisma.Decimal(face.score.toFixed(2)),
        matchedName: nidResult.name,
        failureCode: "FACE_MISMATCH",
        vendorPayload: {
          nid: nidResult.raw ?? null,
          face,
        } as Prisma.InputJsonValue,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { id: true, isVerified: true, trustLevel: true, status: true },
    });

    return {
      success: false,
      verified: false,
      vendor: nidResult.vendor,
      faceMatchScore: face.score,
      faceMatchThreshold: KYC_FACE_MATCH_THRESHOLD,
      matchedName: nidResult.name,
      failureCode: "FACE_MISMATCH",
      message: `Face match score ${face.score.toFixed(1)}% is below required ${KYC_FACE_MATCH_THRESHOLD}%`,
      submissionId: submission.id,
      user,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const submission = await tx.kycSubmission.create({
      data: {
        userId: input.userId,
        nidNumber: input.nidNumber.replace(/\D/g, ""),
        dateOfBirth: input.dateOfBirth,
        selfieS3Key: input.selfieS3Key,
        vendor: nidResult.vendor,
        status: "VERIFIED",
        faceMatchScore: new Prisma.Decimal(face.score.toFixed(2)),
        matchedName: nidResult.name,
        vendorPayload: {
          nid: nidResult.raw ?? null,
          face,
        } as Prisma.InputJsonValue,
      },
    });

    const user = await tx.user.update({
      where: { id: input.userId },
      data: {
        isVerified: true,
        trustLevel: 100,
        status: "VERIFIED",
        name: nidResult.name,
      },
      select: { id: true, isVerified: true, trustLevel: true, status: true },
    });

    await tx.identity.updateMany({
      where: { userId: input.userId },
      data: { trustLevel: 2 },
    });

    return { submission, user };
  });

  return {
    success: true,
    verified: true,
    vendor: nidResult.vendor,
    faceMatchScore: face.score,
    faceMatchThreshold: KYC_FACE_MATCH_THRESHOLD,
    matchedName: nidResult.name,
    failureCode: null,
    message: "KYC verification successful",
    submissionId: result.submission.id,
    user: result.user,
  };
}
