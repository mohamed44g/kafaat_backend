DROP TABLE IF EXISTS security_audit_log;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS auth_mfa_challenges;
DROP TABLE IF EXISTS auth_sessions;
ALTER TABLE users
  DROP COLUMN IF EXISTS mfa_enabled,
  DROP COLUMN IF EXISTS mfa_secret_encrypted;

