import { z } from "zod";
import type { CreateDealPayload, ValidatedDealInput, JoinDealPayload } from "./deal.types.js";

// Zod schema for incoming payload validation
const createDealPayloadSchema = z.object({
  type: z.enum(["BUYER", "SELLER"], {
    message: "Type must be BUYER or SELLER",
  }),
  item: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(255, "Item name must be less than 255 characters"),
  amount: z
    .coerce.number()
    .positive("Amount must be greater than 0")
    .finite("Amount must be a valid number")
    .max(99999999, "Amount exceeds maximum limit"),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Phone must be valid (10-15 digits)"),
  payment_method_id: z.coerce.number().int().positive("Payment method ID must be valid"),
  chargeBearer: z.enum(["BUYER", "SELLER", "SPLIT"], {
    message: "Charge bearer must be BUYER, SELLER, or SPLIT",
  }),
  device_fingerprint: z
    .string()
    .trim()
    .min(20, "Device fingerprint is invalid"),
  user_id: z.coerce.number().int().positive("User ID must be valid").optional(),
});

const joinDealPayloadSchema = z.object({
  payment_ref: z
    .string()
    .trim()
    .min(5, "Deal code is required"),
  device_fingerprint: z
    .string()
    .trim()
    .min(20, "Device fingerprint is invalid"),
  user_id: z.coerce.number().int().positive("User ID must be valid").optional(),
});

/**
 * Validate incoming deal creation payload from frontend
 * @returns parsed payload or throws validation error
 */
export function validateCreateDealPayload(
  data: unknown,
): CreateDealPayload {
  return createDealPayloadSchema.parse(data);
}

export function validateJoinDealPayload(data: unknown): JoinDealPayload {
  return joinDealPayloadSchema.parse(data);
}

/**
 * Convert and prepare validated payload for service layer
 * @param payload validated frontend payload
 * @param ipAddress client IP
 * @param userAgent client user agent
 * @returns ValidatedDealInput ready for business logic
 */
export function prepareValidatedInput(
  payload: CreateDealPayload,
  ipAddress?: string,
  userAgent?: string,
  requestPath?: string,
): ValidatedDealInput {
  return {
    type: payload.type,
    item: payload.item,
    amount: Number(payload.amount),
    phone: payload.phone,
    paymentMethodId: Number(payload.payment_method_id),
    chargeBearer: payload.chargeBearer,
    deviceFingerprint: payload.device_fingerprint,
    authenticatedUserId: payload.user_id !== undefined ? Number(payload.user_id) : undefined,
    ipAddress,
    userAgent,
    requestPath,
  };
}
