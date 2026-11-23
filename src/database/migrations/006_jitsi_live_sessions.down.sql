DROP INDEX IF EXISTS idx_live_sessions_jitsi_room_name;

UPDATE live_sessions
  SET zoom_meeting_id = COALESCE(zoom_meeting_id, CONCAT('legacy-', id::text)),
      zoom_join_url = COALESCE(zoom_join_url, 'https://invalid.local/legacy'),
      zoom_passcode = COALESCE(zoom_passcode, 'legacy');

ALTER TABLE live_sessions
  DROP COLUMN IF EXISTS jitsi_room_name;

ALTER TABLE live_sessions
  ALTER COLUMN zoom_meeting_id SET NOT NULL,
  ALTER COLUMN zoom_join_url SET NOT NULL,
  ALTER COLUMN zoom_passcode SET NOT NULL;
