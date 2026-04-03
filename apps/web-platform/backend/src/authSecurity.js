import crypto from 'crypto';

const PASSWORD_SCHEME = 'scrypt';
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_BYTES = 16;

export function readTrimmedEnv(name, fallback = '') {
  const value = process.env[name];

  if (typeof value === 'string') {
    return value.trim();
  }

  return fallback;
}

function derivePasswordHash(password, salt) {
  return crypto
    .scryptSync(String(password), salt, PASSWORD_KEY_LENGTH)
    .toString('hex');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES).toString('hex');
  const digest = derivePasswordHash(password, salt);
  return `${PASSWORD_SCHEME}$${salt}$${digest}`;
}

export function verifyPassword(password, storedHash) {
  const normalizedHash = String(storedHash || '');

  if (!normalizedHash) {
    return false;
  }

  if (!normalizedHash.startsWith(`${PASSWORD_SCHEME}$`)) {
    return normalizedHash === String(password);
  }

  const [, salt, expectedDigest] = normalizedHash.split('$');

  if (!salt || !expectedDigest) {
    return false;
  }

  const actualDigest = derivePasswordHash(password, salt);
  const expectedBuffer = Buffer.from(expectedDigest, 'hex');
  const actualBuffer = Buffer.from(actualDigest, 'hex');

  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function needsPasswordRehash(storedHash) {
  return !String(storedHash || '').startsWith(`${PASSWORD_SCHEME}$`);
}

export function getSessionSecret() {
  const configuredSecret = readTrimmedEnv('SESSION_SECRET');

  if (configuredSecret) {
    return configuredSecret;
  }

  const nodeEnv = readTrimmedEnv('NODE_ENV', 'development').toLowerCase();

  if (nodeEnv === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production.');
  }

  return 'dev-session-secret-change-me';
}
