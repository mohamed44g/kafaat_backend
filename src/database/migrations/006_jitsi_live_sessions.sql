ALTER TABLE live_sessions
  ALTER COLUMN zoom_meeting_id DROP NOT NULL,
  ALTER COLUMN zoom_join_url DROP NOT NULL,
  ALTER COLUMN zoom_passcode DROP NOT NULL;

ALTER TABLE live_sessions
  ADD COLUMN jitsi_room_name varchar(180);

UPDATE live_sessions
  SET jitsi_room_name = CONCAT('legacy-session-', id::text)
  WHERE jitsi_room_name IS NULL;

ALTER TABLE live_sessions
  ALTER COLUMN jitsi_room_name SET NOT NULL;

CREATE UNIQUE INDEX idx_live_sessions_jitsi_room_name
  ON live_sessions (jitsi_room_name);
