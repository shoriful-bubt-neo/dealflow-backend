import { z } from "zod";

export const createPaymentMethodSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100),
        type: z.string().min(2).max(50),
        isActive: z.boolean().optional(),
        config: z.any().optional(),
    }),
});

export const updatePaymentMethodSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        name: z.string().min(2).max(100).optional(),
        type: z.string().min(2).max(50).optional(),
        isActive: z.boolean().optional(),
        config: z.any().optional(),
    }),
});
