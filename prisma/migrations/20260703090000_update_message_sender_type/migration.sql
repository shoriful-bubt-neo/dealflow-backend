-- Replace MessageSenderType values USER/SYSTEM with BUYER/SELLER/ADMIN.
-- Existing USER messages are classified from the related deal participant.

ALTER TABLE "messages" ALTER COLUMN "senderType" TYPE text;

UPDATE "messages" AS m
SET "senderType" = CASE
  WHEN m."senderType" = 'USER' AND m."sender_id" IS NOT NULL AND d."buyer_id" = m."sender_id" THEN 'BUYER'
  WHEN m."senderType" = 'USER' AND m."sender_id" IS NOT NULL AND d."seller_id" = m."sender_id" THEN 'SELLER'
  WHEN m."senderType" = 'USER' THEN 'BUYER'
  WHEN m."senderType" = 'SYSTEM' THEN 'ADMIN'
  ELSE m."senderType"
END
FROM "deals" AS d
WHERE m."deal_id" = d."id"
  AND m."senderType" IN ('USER', 'SYSTEM');

ALTER TYPE "MessageSenderType" RENAME TO "MessageSenderType_old";
CREATE TYPE "MessageSenderType" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

ALTER TABLE "messages"
ALTER COLUMN "senderType" TYPE "MessageSenderType"
USING "senderType"::"MessageSenderType";

DROP TYPE "MessageSenderType_old";