-- The daily question cap was raised from 10 to 12 so clients can finish all
-- real screening questions in one day, but this check constraint was never
-- updated, so every FULL (12-question) mission failed with a 500 error.
ALTER TABLE "Mission"
DROP CONSTRAINT "Mission_requestedSize_range_chk";

ALTER TABLE "Mission"
ADD CONSTRAINT "Mission_requestedSize_range_chk"
CHECK ("requestedSize" >= 1 AND "requestedSize" <= 12);
