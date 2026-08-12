import { z } from "zod";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
} from "../../../services/storage.service.js";

const mimeEnum = z.enum(ALLOWED_UPLOAD_MIME_TYPES);

export const createUploadPresignSchema = z.object({
  body: z.object({
    dealId: z.coerce.number().int().positive(),
    disputeId: z.coerce.number().int().positive(),
    fileName: z.string().trim().min(1).max(255),
    mimeType: mimeEnum,
    fileSizeBytes: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_UPLOAD_BYTES, `File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit`),
  }),
});

export const getDownloadPresignSchema = z.object({
  query: z
    .object({
      objectKey: z.string().trim().min(1).max(512),
      dealId: z.coerce.number().int().positive().optional(),
      disputeId: z.coerce.number().int().positive().optional(),
      evidenceId: z.coerce.number().int().positive().optional(),
    })
    .superRefine((q, ctx) => {
      if (!q.evidenceId && !q.disputeId && !q.dealId) {
        ctx.addIssue({
          code: "custom",
          message: "dealId, disputeId, or evidenceId is required",
          path: ["dealId"],
        });
      }
    }),
});

export type CreateUploadPresignBody = z.infer<
  typeof createUploadPresignSchema
>["body"];
export type GetDownloadPresignQuery = z.infer<
  typeof getDownloadPresignSchema
>["query"];
