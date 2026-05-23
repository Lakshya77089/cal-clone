-- AlterTable
ALTER TABLE "EventType" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "EventType_userId_position_idx" ON "EventType"("userId", "position");
