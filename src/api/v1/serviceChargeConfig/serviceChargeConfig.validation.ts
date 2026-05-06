import { z } from "zod";

const chargeTypeEnum = z.enum(["PERCENTAGE", "FIXED"]);
const chargePayerEnum = z.enum(["BUYER", "SELLER", "SPLIT"]);

export const createServiceChargeConfigSchema = z.object({
    body: z.object({
        paymentMethodId: z.number().int().positive(),
        type: chargeTypeEnum,
        percentage: z.number().min(0).max(100).optional(),
        fixedAmount: z.number().positive().optional(),
        payer: chargePayerEnum,
        isActive: z.boolean().optional(),
    }),
});

export const updateServiceChargeConfigSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        paymentMethodId: z.number().int().positive().optional(),
        type: chargeTypeEnum.optional(),
        percentage: z.number().min(0).max(100).optional(),
        fixedAmount: z.number().positive().optional(),
        payer: chargePayerEnum.optional(),
        isActive: z.boolean().optional(),
    }),
});
