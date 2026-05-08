import { Router } from "express";
import { handleCreateDeal } from "./deal.controller.js";

const router = Router();

/**
 * POST /api/v1/deals
 * Create a new deal with guest or authenticated participant
 *
 * Request body:
 * {
 *   type: "BUYER" | "SELLER",
 *   item: string,
 *   amount: number,
 *   phone: string,
 *   payment_method_id: number,
 *   chargeBearer: "BUYER" | "SELLER" | "SPLIT",
 *   device_fingerprint: string
 * }
 *
 * Response 201:
 * {
 *   success: true,
 *   dealId: number,
 *   paymentRef: string,
 *   inviteToken: string,
 *   inviteExpiresAt: string (ISO),
 *   buyerTotal: number,
 *   sellerReceives: number,
 *   message: string
 * }
 */
router.post("/", handleCreateDeal);

export default router;
