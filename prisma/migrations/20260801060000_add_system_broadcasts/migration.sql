CREATE TABLE IF NOT EXISTS "system_broadcasts" (
    "broadcast_id" BIGSERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "target_role" VARCHAR(40) NOT NULL DEFAULT 'ALL',
    "expiry_date" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_broadcasts_pkey" PRIMARY KEY ("broadcast_id")
);
