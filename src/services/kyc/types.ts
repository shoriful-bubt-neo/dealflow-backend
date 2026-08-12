import type { KycVendor } from "../../generated/prisma/enums.js";

export type NidVerifySuccess = {
  success: true;
  name: string;
  dateOfBirth: string;
  /** Raw base64 image bytes (no data-URI prefix) or empty when only S3 key is set */
  photoBase64?: string;
  /** Optional S3 object key for EC photo */
  photoS3Key?: string;
  vendor: KycVendor;
  raw?: unknown;
};

export type NidVerifyFailure = {
  success: false;
  code: "NID_NOT_FOUND" | "NID_MISMATCH" | "VENDOR_ERROR" | "INVALID_INPUT";
  message: string;
  vendor: KycVendor;
  raw?: unknown;
};

export type NidVerifyResult = NidVerifySuccess | NidVerifyFailure;

export interface IKycProvider {
  readonly vendor: KycVendor;
  verifyNid(nidNumber: string, dateOfBirth: string): Promise<NidVerifyResult>;
}

export type FaceCompareResult = {
  score: number;
  matched: boolean;
  mode: "rekognition" | "mock";
};
