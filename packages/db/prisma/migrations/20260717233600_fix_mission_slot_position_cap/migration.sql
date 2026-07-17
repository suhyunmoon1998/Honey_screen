-- Same stale-cap issue as Mission_requestedSize_range_chk: slot positions
-- were capped at 10, blocking the 12-question FULL mission.
ALTER TABLE "MissionSlot"
DROP CONSTRAINT "MissionSlot_position_range_chk";

ALTER TABLE "MissionSlot"
ADD CONSTRAINT "MissionSlot_position_range_chk"
CHECK ("position" >= 1 AND "position" <= 12);
