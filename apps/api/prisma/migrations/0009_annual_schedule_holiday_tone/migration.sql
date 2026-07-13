ALTER TABLE annual_schedule
  DROP CONSTRAINT IF EXISTS annual_schedule_tone_check;

ALTER TABLE annual_schedule
  ADD CONSTRAINT annual_schedule_tone_check CHECK (tone IN ('notice', 'launch', 'close', 'holiday'));
