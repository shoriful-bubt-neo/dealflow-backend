import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255).transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/, "Phone must be 10–15 digits"),
    password: z.string().min(8).max(128),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/, "Phone must be 10–15 digits"),
    email: z.string().trim().email().max(255).transform((v) => v.toLowerCase()),
    password: z.string().min(8).max(128),
    code: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255).transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(128),
  }),
});

export type RegisterBody = z.infer<typeof registerSchema>["body"];
export type VerifyOtpBody = z.infer<typeof verifyOtpSchema>["body"];
export type LoginBody = z.infer<typeof loginSchema>["body"];
