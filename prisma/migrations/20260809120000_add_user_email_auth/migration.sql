-- AlterTable: add email to users (password column already exists, mapped as passwordHash)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "deal_agreement_acceptances_deal_id_user_id_template_id_key"
  ON "deal_agreement_acceptances"("deal_id", "user_id", "template_id");

CREATE INDEX IF NOT EXISTS "deal_agreement_acceptances_deal_id_user_id_idx"
  ON "deal_agreement_acceptances"("deal_id", "user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deal_agreement_acceptances_user_id_fkey'
  ) THEN
    ALTER TABLE "deal_agreement_acceptances"
      ADD CONSTRAINT "deal_agreement_acceptances_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
