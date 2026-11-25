type Environment = Record<string, string | undefined>;

export function validateEnvironment(config: Environment): Environment {
  const required = ['DATABASE_URL', 'SESSION_HASH_PEPPER'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
  if ((config.SESSION_HASH_PEPPER?.length ?? 0) < 32) {
    throw new Error('SESSION_HASH_PEPPER must contain at least 32 characters');
  }
  for (const key of ['SESSION_TTL_SECONDS', 'SESSION_IDLE_TIMEOUT_SECONDS']) {
    const value = Number(
      config[key] ?? (key === 'SESSION_TTL_SECONDS' ? 43200 : 3600),
    );
    if (!Number.isInteger(value) || value < 300 || value > 2_592_000)
      throw new Error(`${key} must be an integer between 300 and 2592000`);
  }
  if (config.NODE_ENV === 'production') {
    if ((config.METRICS_TOKEN?.length ?? 0) < 32)
      throw new Error('METRICS_TOKEN must contain at least 32 characters');
    const origins = (config.CORS_ORIGINS ?? '').split(',').filter(Boolean);
    if (!origins.length || origins.some((origin) => origin === '*'))
      throw new Error(
        'CORS_ORIGINS must be an explicit allowlist in production',
      );
    for (const origin of origins) {
      const url = new URL(origin);
      if (url.protocol !== 'https:')
        throw new Error('Production CORS origins must use HTTPS');
    }
  }

  const bunnyKeys = [
    'BUNNY_STREAM_LIBRARY_ID',
    'BUNNY_STREAM_API_KEY',
    'BUNNY_STREAM_READ_ONLY_API_KEY',
    'BUNNY_STREAM_TOKEN_AUTH_KEY',
  ];
  const configuredBunnyKeys = bunnyKeys.filter((key) => config[key]);
  if (
    configuredBunnyKeys.length > 0 &&
    configuredBunnyKeys.length !== bunnyKeys.length
  ) {
    throw new Error(
      `Bunny Stream configuration is incomplete. Required together: ${bunnyKeys.join(', ')}`,
    );
  }

  const jitsiKeys = ['JITSI_MEET_URL', 'JITSI_APP_ID', 'JITSI_APP_SECRET'];
  const configuredJitsiKeys = jitsiKeys.filter((key) => config[key]);
  if (
    configuredJitsiKeys.length > 0 &&
    configuredJitsiKeys.length !== jitsiKeys.length
  ) {
    throw new Error(
      `Jitsi configuration is incomplete. Required together: ${jitsiKeys.join(', ')}`,
    );
  }
  if (configuredJitsiKeys.length === jitsiKeys.length) {
    try {
      const meetUrl = new URL(config.JITSI_MEET_URL!);
      if (config.NODE_ENV === 'production' && meetUrl.protocol !== 'https:')
        throw new Error('JITSI_MEET_URL must use HTTPS in production');
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('JITSI_MEET_URL must be a valid URL');
    }
    if ((config.JITSI_APP_SECRET?.length ?? 0) < 32)
      throw new Error('JITSI_APP_SECRET must contain at least 32 characters');
  }
  return config;
}
