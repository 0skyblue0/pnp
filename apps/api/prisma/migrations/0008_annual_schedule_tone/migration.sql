ALTER TABLE annual_schedule
  ADD COLUMN IF NOT EXISTS tone VARCHAR(20) NOT NULL DEFAULT 'notice';

ALTER TABLE annual_schedule
  ADD CONSTRAINT annual_schedule_tone_check CHECK (tone IN ('notice', 'launch', 'close'));
