CREATE TABLE "domain" (
  "domain_id" UUID NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" VARCHAR(500),
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" TIMESTAMPTZ(6),
  "last_checked_at" TIMESTAMPTZ(6),
  "user_id" UUID,
  "team_id" UUID,
  "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "domain_pkey" PRIMARY KEY ("domain_id")
);

CREATE UNIQUE INDEX "domain_name_key" ON "domain"("name");

CREATE INDEX "domain_name_idx" ON "domain"("name");
CREATE INDEX "domain_user_id_idx" ON "domain"("user_id");
CREATE INDEX "domain_team_id_idx" ON "domain"("team_id");
CREATE INDEX "domain_verified_idx" ON "domain"("verified");
CREATE INDEX "domain_is_primary_idx" ON "domain"("is_primary");
CREATE INDEX "domain_created_at_idx" ON "domain"("created_at");

ALTER TABLE "link" ADD COLUMN "domain_id" UUID;
CREATE INDEX "link_domain_id_idx" ON "link"("domain_id");

ALTER TABLE "pixel" ADD COLUMN "domain_id" UUID;
CREATE INDEX "pixel_domain_id_idx" ON "pixel"("domain_id");
