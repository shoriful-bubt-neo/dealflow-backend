// Request payload from frontend HeroSection
export interface CreateDealPayload {
  type: "BUYER" | "SELLER";
  item: string;
  amount: number;
  phone: string;
  payment_method_id: number;
  chargeBearer: "BUYER" | "SELLER" | "SPLIT";
  device_fingerprint: string;
  user_id?: number;
}

// Deal creation response
export interface CreateDealResponse {
  success: boolean;
  dealId: number;
  paymentRef: string;
  inviteToken: string;
  inviteExpiresAt: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  buyerTotal?: number;
  sellerReceives?: number;
  role: "BUYER" | "SELLER";
  identityId: string;
  message: string;
}

// Internal service request after validation
export interface ValidatedDealInput {
  type: "BUYER" | "SELLER";
  item: string;
  amount: number;
  phone: string;
  paymentMethodId: number;
  chargeBearer: "BUYER" | "SELLER" | "SPLIT";
  deviceFingerprint: string;
  authenticatedUserId?: number;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
}

// Fraud check result
export interface FraudCheckResult {
  isFraudulent: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reason?: string;
}

// Charge calculation result
export interface ChargeCalculation {
  chargeType: "FIXED" | "PERCENTAGE";
  chargeValue: number;
  totalCharge: number;
  buyerPays: number;
  sellerPays: number;
  buyerTotal: number;
  sellerReceives: number;
}
