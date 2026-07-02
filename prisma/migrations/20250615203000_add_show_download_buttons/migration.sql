-- AlterTable
ALTER TABLE "company" ADD COLUMN IF NOT EXISTS "show_download_buttons" BOOLEAN NOT NULL DEFAULT true;
