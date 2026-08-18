import { z } from "zod";

export const verifyKycSchema = z.object({
  body: z.object({
    nidNumber: z
      .string()
      .trim()
      .min(10, "NID must be at least 10 digits")
      .max(17, "NID must be at most 17 digits")
      .regex(/^\d+$/, "NID must contain digits only"),
    dateOfBirth: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD"),
    selfieS3Key: z
      .string()
      .trim()
      .min(1, "selfieS3Key is required")
      .max(512)
      .refine((v) => !v.includes("..") && !v.startsWith("/"), {
        message: "Invalid selfieS3Key",
      }),
  }),
});

export const submitKycSchema = verifyKycSchema;

export const kycSelfiePresignSchema = z.object({
  body: z.object({
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    fileSizeBytes: z.coerce
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024, "Selfie exceeds 10MB limit"),
  }),
});

export type VerifyKycBody = z.infer<typeof verifyKycSchema>["body"];
export type SubmitKycBody = z.infer<typeof submitKycSchema>["body"];
export type KycSelfiePresignBody = z.infer<typeof kycSelfiePresignSchema>["body"];
