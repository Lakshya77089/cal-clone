-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guests" TEXT[] DEFAULT ARRAY[]::TEXT[];
