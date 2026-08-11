-- This migration intentionally precedes 20260809120000_add_user_email_auth.
-- The agreement tables already existed in the development database, but their
-- original migration was missing from version control.  IF NOT EXISTS keeps
-- this safe for databases that already contain the data.

CREATE TABLE IF NOT EXISTS "agreement_templates" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "deal_agreement_acceptances" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "user_id" INTEGER,
    "identity_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "fingerprint" JSONB,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_agreement_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agreement_templates_version_key"
  ON "agreement_templates"("version");
CREATE INDEX IF NOT EXISTS "agreement_templates_is_active_created_at_idx"
  ON "agreement_templates"("is_active", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "deal_agreement_acceptances_deal_id_identity_id_template_id_key"
  ON "deal_agreement_acceptances"("deal_id", "identity_id", "template_id");
CREATE INDEX IF NOT EXISTS "deal_agreement_acceptances_deal_id_identity_id_idx"
  ON "deal_agreement_acceptances"("deal_id", "identity_id");
CREATE INDEX IF NOT EXISTS "deal_agreement_acceptances_template_id_idx"
  ON "deal_agreement_acceptances"("template_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deal_agreement_acceptances_deal_id_fkey'
  ) THEN
    ALTER TABLE "deal_agreement_acceptances"
      ADD CONSTRAINT "deal_agreement_acceptances_deal_id_fkey"
      FOREIGN KEY ("deal_id") REFERENCES "deals"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deal_agreement_acceptances_template_id_fkey'
  ) THEN
    ALTER TABLE "deal_agreement_acceptances"
      ADD CONSTRAINT "deal_agreement_acceptances_template_id_fkey"
      FOREIGN KEY ("template_id") REFERENCES "agreement_templates"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
