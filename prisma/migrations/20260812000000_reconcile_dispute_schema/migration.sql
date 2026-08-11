-- Reconciles schema changes that were previously applied outside Prisma Migrate.
-- This migration is baselined for the existing database; it is executed only
-- when constructing a new database from the migration history.

CREATE TYPE "DisputeParty" AS ENUM ('BUYER', 'SELLER');
CREATE TYPE "DisputeResolution" AS ENUM ('REFUND_TO_BUYER', 'RELEASE_TO_SELLER', 'PARTIAL_REFUND');

ALTER TABLE "disputes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "DisputeStatus" RENAME TO "DisputeStatus_old";
CREATE TYPE "DisputeStatus" AS ENUM ('AWAITING_BUYER_EVIDENCE', 'AWAITING_SELLER_RESPONSE', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');
ALTER TABLE "disputes"
  ALTER COLUMN "status" TYPE "DisputeStatus"
  USING (
    CASE "status"::text
      WHEN 'OPEN' THEN 'AWAITING_BUYER_EVIDENCE'
      WHEN 'REJECTED' THEN 'CLOSED'
      ELSE "status"::text
    END
  )::"DisputeStatus";
ALTER TABLE "disputes" ALTER COLUMN "status" SET DEFAULT 'AWAITING_BUYER_EVIDENCE';
DROP TYPE "DisputeStatus_old";

ALTER TABLE "disputes"
  DROP CONSTRAINT "disputes_deal_id_fkey",
  DROP COLUMN "reason",
  ADD COLUMN "opened_by_role" "DisputeParty" NOT NULL DEFAULT 'BUYER',
  ADD COLUMN "opened_by_user_id" INTEGER,
  ADD COLUMN "opened_by_identity_id" TEXT,
  ADD COLUMN "amount_at_dispute" DECIMAL(18,2) NOT NULL,
  ADD COLUMN "buyer_statement" TEXT,
  ADD COLUMN "buyer_submitted_at" TIMESTAMP(3),
  ADD COLUMN "buyer_user_id" INTEGER,
  ADD COLUMN "buyer_identity_id" TEXT,
  ADD COLUMN "seller_statement" TEXT,
  ADD COLUMN "seller_submitted_at" TIMESTAMP(3),
  ADD COLUMN "seller_user_id" INTEGER,
  ADD COLUMN "seller_identity_id" TEXT,
  ADD COLUMN "admin_notes" TEXT,
  ADD COLUMN "resolution" "DisputeResolution",
  ADD COLUMN "closed_at" TIMESTAMP(3);

ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_deal_id_fkey"
  FOREIGN KEY ("deal_id") REFERENCES "deals"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "disputes_deal_id_status_idx" ON "disputes"("deal_id", "status");
CREATE INDEX "disputes_status_created_at_idx" ON "disputes"("status", "created_at");

CREATE TABLE "dispute_evidence" (
    "id" SERIAL NOT NULL,
    "dispute_id" INTEGER NOT NULL,
    "party" "DisputeParty" NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER,
    "checksum_sha256" TEXT,
    "uploaded_by_user_id" INTEGER,
    "uploaded_by_identity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dispute_evidence_dispute_id_party_idx" ON "dispute_evidence"("dispute_id", "party");
ALTER TABLE "dispute_evidence"
  ADD CONSTRAINT "dispute_evidence_dispute_id_fkey"
  FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identities" DROP COLUMN "ip_history";
