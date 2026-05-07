import { z } from "zod";

const chargeTypeEnum = z.enum(["PERCENTAGE", "FIXED"]);
const chargePayerEnum = z.enum(["BUYER", "SELLER", "SPLIT"]);

export const createServiceChargeConfigSchema = z.object({
    body: z
        .object({
            paymentMethodId: z.coerce.number().int().positive(),

            type: chargeTypeEnum,

            percentage: z.coerce.number().min(0).max(100).optional(),

            fixedAmount: z.coerce.number().positive().optional(),

            payer: chargePayerEnum,

            isActive: z.boolean().optional(),
        })
        .superRefine((data, ctx) => {
            // Percentage validation
            if (data.type === "PERCENTAGE") {
                if (data.percentage == null) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["percentage"],
                        message: "Percentage is required",
                    });
                }
            }

            // Fixed validation
            if (data.type === "FIXED") {
                if (data.fixedAmount == null) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["fixedAmount"],
                        message: "Fixed amount is required",
                    });
                }
            }
        }),
});

export const updateServiceChargeConfigSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z
        .object({
            paymentMethodId: z.coerce.number().int().positive(),

            type: chargeTypeEnum,

            percentage: z.coerce.number().min(0).max(100).optional(),

            fixedAmount: z.coerce.number().positive().optional(),

            payer: chargePayerEnum,

            isActive: z.boolean().optional(),
        })
        .superRefine((data, ctx) => {
            // Percentage validation
            if (data.type === "PERCENTAGE") {
                if (data.percentage == null) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["percentage"],
                        message: "Percentage is required",
                    });
                }
            }

            // Fixed validation
            if (data.type === "FIXED") {
                if (data.fixedAmount == null) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["fixedAmount"],
                        message: "Fixed amount is required",
                    });
                }
            }
        }),
});
