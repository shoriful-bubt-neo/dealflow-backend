import { z } from "zod";

const userTypeEnum = z.enum(["ADMIN", "BUYER", "SELLER"]);
const userStatusEnum = z.enum([
    "PENDING_VERIFICATION",
    "VERIFIED",
    "SUSPENDED",
    "CLOSED",
]);

export const createUserSchema = z.object({
    body: z.object({
        name: z.string().min(2).max(100).optional(),
        phone: z.string().min(6),
        password: z.string().min(6).optional(),
        isVerified: z.boolean().optional(),
        type: userTypeEnum.optional(),
        status: userStatusEnum.optional(),
        isActive: z.boolean().optional(),
    }),
});

export const updateUserSchema = z.object({
    params: z.object({
        id: z.string(),
    }),
    body: z.object({
        name: z.string().min(2).max(100).optional(),
        phone: z.string().min(6).optional(),
        password: z.string().min(6).optional(),
        isVerified: z.boolean().optional(),
        type: userTypeEnum.optional(),
        status: userStatusEnum.optional(),
        isActive: z.boolean().optional(),
    }),
});
