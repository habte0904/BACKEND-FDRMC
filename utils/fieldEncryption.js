import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Get the 32-byte encryption key from the environment.
 * The key must be a 64-character hex string (32 bytes).
 */
const getKey = () => {
  const keyHex = process.env.DB_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      '[fieldEncryption] DB_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(keyHex, 'hex');
};

/**
 * Encrypt a plain-text value using AES-256-GCM.
 * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded).
 * Returns null/undefined as-is; non-string values are stringified first.
 *
 * @param {string|number|null|undefined} value
 * @returns {string|null|undefined}
 */
export const encrypt = (value) => {
  if (value === null || value === undefined) return value;
  const text = String(value);
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16-byte GCM authentication tag
  // Format: <ivHex>:<authTagHex>:<ciphertextHex>
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Decrypt a value encrypted by `encrypt()`.
 * Returns the original plain-text string.
 * If the value does not look like an encrypted string (no colons), returns it as-is (safe fallback
 * for records saved before encryption was enabled).
 *
 * @param {string|null|undefined} encryptedValue
 * @returns {string|null|undefined}
 */
export const decrypt = (encryptedValue) => {
  if (encryptedValue === null || encryptedValue === undefined) return encryptedValue;
  // Only attempt decryption if the value matches iv:authTag:ciphertext pattern
  const parts = String(encryptedValue).split(':');
  if (parts.length !== 3) return encryptedValue; // plain value — return as-is (backward compat)
  const [ivHex, authTagHex, dataHex] = parts;
  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(data) + decipher.final('utf8');
  } catch (err) {
    console.error('[fieldEncryption] Decryption failed for field value:', err.message);
    return encryptedValue; // graceful fallback — do not crash the server
  }
};

/**
 * String fields in SmsConfig that are stored encrypted in MongoDB.
 * NOTE: systemId and password are NOT here — they live in .env only.
 * port is a number but encrypt() stringifies it before encrypting;
 * decryptConfig() parses it back to an integer after decryption.
 */
const ENCRYPTED_STRING_FIELDS = [
  'protocol',
  'systemType',
  'sourceAddr',
  'host',
  'port',
  'httpEndpoint',
  'httpApiKey',
  'httpHeaders',
  'httpPayloadTemplate',
];

/**
 * Encrypt all sensitive string fields in an SmsConfig payload before saving to DB.
 *
 * @param {Object} config - raw admin-submitted config object
 * @returns {Object} - config with string fields encrypted
 */
export const encryptConfig = (config) => {
  if (!config) return config;
  const result = { ...config };
  for (const field of ENCRYPTED_STRING_FIELDS) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = encrypt(result[field]);
    }
  }
  result.isEncrypted = true;
  return result;
};

/**
 * Decrypt all sensitive string fields in an SmsConfig document read from DB.
 *
 * @param {Object} config - raw document from MongoDB
 * @returns {Object} - config with string fields decrypted
 */
export const decryptConfig = (config) => {
  if (!config) return config;
  const result = { ...config };
  for (const field of ENCRYPTED_STRING_FIELDS) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = decrypt(result[field]);
    }
  }
  // port is stored as an encrypted string — parse back to integer after decryption
  if (result.port !== null && result.port !== undefined) {
    const parsed = parseInt(result.port, 10);
    result.port = isNaN(parsed) ? result.port : parsed;
  }
  return result;
};

/**
 * Sensitive fields in EmailConfig that are stored encrypted in MongoDB.
 */
const ENCRYPTED_EMAIL_FIELDS = ['pass', 'user', 'host', 'fromEmail', 'replyTo'];

export const encryptEmailConfig = (config) => {
  if (!config) return config;
  const result = { ...config };
  for (const field of ENCRYPTED_EMAIL_FIELDS) {
    if (result[field] !== undefined && result[field] !== null && String(result[field]).trim() !== '') {
      result[field] = encrypt(result[field]);
    }
  }
  result.isEncrypted = true;
  return result;
};

export const decryptEmailConfig = (config) => {
  if (!config) return config;
  const result = { ...config };
  for (const field of ENCRYPTED_EMAIL_FIELDS) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = decrypt(result[field]);
    }
  }
  return result;
};


