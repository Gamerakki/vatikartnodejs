CREATE TABLE IF NOT EXISTS "blacklisted_customers" (
    "blacklist_id" BIGSERIAL PRIMARY KEY,
    "phone" VARCHAR(20) NOT NULL UNIQUE,
    "reason" TEXT,
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT true,
    "added_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "api_access_configs" (
    "api_access_id" BIGSERIAL PRIMARY KEY,
    "company_id" BIGINT NOT NULL UNIQUE,
    "quota" VARCHAR(40) NOT NULL DEFAULT 'UNLIMITED',
    "rate_limit_per_minute" INTEGER,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "updated_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
