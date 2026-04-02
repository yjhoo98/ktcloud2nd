import pg from 'pg';

const { Pool } = pg;

function readTrimmedEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : value;
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function hasExplicitSslSetting() {
  return [
    process.env.DB_SSL,
    process.env.DB_SSL_MODE,
    process.env.PGSSLMODE,
    process.env.DB_SSL_REJECT_UNAUTHORIZED
  ].some((value) => value !== undefined && value !== '');
}

function createSslConfig() {
  const sslMode = (
    readTrimmedEnv('DB_SSL_MODE') ||
    readTrimmedEnv('PGSSLMODE') ||
    ''
  ).toLowerCase();
  const rejectUnauthorized = !['false', '0', 'no', 'off'].includes(
    String(readTrimmedEnv('DB_SSL_REJECT_UNAUTHORIZED') || 'true').toLowerCase()
  );
  const sslModeRequiresTls = ['require', 'verify-ca', 'verify-full', 'no-verify'].includes(sslMode);
  const sslDisabledByMode = ['', 'disable', 'allow', 'prefer'].includes(sslMode);
  const sslEnabled = isTruthy(readTrimmedEnv('DB_SSL')) || (!sslDisabledByMode && sslModeRequiresTls);

  if (!sslEnabled) {
    return undefined;
  }

  if (sslMode === 'no-verify') {
    return {
      rejectUnauthorized: false
    };
  }

  if (sslMode === 'require') {
    return {
      rejectUnauthorized
    };
  }

  return {
    rejectUnauthorized
  };
}

function createPoolConfig() {
  const ssl = createSslConfig();
  const databaseUrl = readTrimmedEnv('DATABASE_URL');
  const dbHost = readTrimmedEnv('DB_HOST');

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ...(ssl ? { ssl } : {})
    };
  }

  if (dbHost) {
    const shouldApplyDefaultSplitDbSsl = !ssl && !hasExplicitSslSetting();

    return {
      host: dbHost,
      port: Number(readTrimmedEnv('DB_PORT') || 5432),
      database: readTrimmedEnv('DB_NAME'),
      user: readTrimmedEnv('DB_USER'),
      password: readTrimmedEnv('DB_PASSWORD'),
      ...(ssl
        ? { ssl }
        : shouldApplyDefaultSplitDbSsl
          ? { ssl: { rejectUnauthorized: false } }
          : {})
    };
  }

  return {};
}

const pool = new Pool(createPoolConfig());

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}
