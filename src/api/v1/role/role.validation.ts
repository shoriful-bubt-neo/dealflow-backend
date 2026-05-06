import { z } from "zod";

export const createRoleSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(50),
        isActive: z.boolean().optional(),
    }),
});

export const updateRoleSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        name: z.string().min(2).max(50).optional(),
        isActive: z.boolean().optional(),
    }),
});