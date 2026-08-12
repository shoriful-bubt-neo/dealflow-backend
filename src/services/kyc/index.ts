export type {
  FaceCompareResult,
  IKycProvider,
  NidVerifyResult,
} from "./types.js";
export { getKycProvider, resetKycProviderCache } from "./providers/index.js";
export { compareFaces } from "./faceCompare.service.js";
export { verifyKyc } from "./kyc.service.js";
