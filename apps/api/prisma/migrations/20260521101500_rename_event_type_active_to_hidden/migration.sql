-- Rename `EventType.isActive` to `EventType.hidden` and flip the semantics:
-- previously isActive=true was the default ("bookable"); now hidden=false is
-- the default ("listed on profile"). Both old and new defaults map to the
-- "normal" state, so existing rows with isActive=true become hidden=false.

ALTER TABLE "EventType" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
UPDATE "EventType" SET "hidden" = NOT "isActive";
ALTER TABLE "EventType" DROP COLUMN "isActive";
