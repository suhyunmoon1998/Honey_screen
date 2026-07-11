-- Ensure mission snapshots stay within the allowed substantive range.
ALTER TABLE "public"."Mission"
ADD CONSTRAINT "Mission_requestedSize_range_chk"
CHECK ("requestedSize" >= 1 AND "requestedSize" <= 10);

-- Ensure slot ordinals cannot exceed the maximum daily substantive budget.
ALTER TABLE "public"."MissionSlot"
ADD CONSTRAINT "MissionSlot_position_range_chk"
CHECK ("position" >= 1 AND "position" <= 10);

-- Prevent the same question definition from being allocated twice in one mission.
CREATE UNIQUE INDEX "MissionSlot_missionId_questionDefinitionId_key"
ON "public"."MissionSlot"("missionId", "questionDefinitionId");
