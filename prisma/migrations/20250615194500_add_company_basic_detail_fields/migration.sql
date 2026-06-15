-- AlterTable
ALTER TABLE "company" ADD COLUMN     "currency" VARCHAR(5) DEFAULT 'INR',
ADD COLUMN     "email" VARCHAR(254),
ADD COLUMN     "phone" VARCHAR(15),
ADD COLUMN     "tagline" VARCHAR(300),
ADD COLUMN     "upi_id" VARCHAR(100);
