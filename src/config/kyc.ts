/** Progressive KYC threshold in BDT (base currency). Overridable via env. */
export const KYC_THRESHOLD_AMOUNT = Number(
  process.env.KYC_THRESHOLD_AMOUNT ?? 5000,
);

/** Minimum face-match confidence (%) required to mark user verified. */
export const KYC_FACE_MATCH_THRESHOLD = Number(
  process.env.KYC_FACE_MATCH_THRESHOLD ?? 80,
);

/** Auto-pass score used by mock/local face comparison when selfie key exists. */
export const KYC_MOCK_FACE_PASS_SCORE = Number(
  process.env.KYC_MOCK_FACE_PASS_SCORE ?? 92,
);

export type KycProviderMode = "mock" | "porichoy";

export function resolveKycProviderMode(): KycProviderMode {
  const explicit = (process.env.KYC_PROVIDER || "").toLowerCase().trim();
  if (explicit === "mock" || explicit === "porichoy") return explicit;
  if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
    return "mock";
  }
  return "porichoy";
}

export const PORICHOY_API_KEY = process.env.PORICHOY_API_KEY || "";
export const PORICHOY_BASE_URL = (
  process.env.PORICHOY_BASE_URL || "https://api.porichoybd.com"
).replace(/\/$/, "");
