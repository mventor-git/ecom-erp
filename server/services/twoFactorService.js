/**
 * Two-Factor Authentication (2FA) Service
 *
 * TOTP-based 2FA using authenticator apps (Google Authenticator, Authy, etc.)
 * Features:
 * - Secret generation
 * - QR code generation for easy setup
 * - Token verification
 * - Backup codes for account recovery
 *
 * Created: 2026-08-24 (mventor high-priority security enhancements)
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Generate a new TOTP secret for a user
 * @param {string} userEmail - User's email address
 * @param {string} issuer - App name (default: 'Comfort Sign')
 * @returns {Object} { secret, otpauthUrl }
 */
function generateSecret(userEmail, issuer = 'Comfort Sign') {
  const secret = speakeasy.generateSecret({
    name: `${issuer} (${userEmail})`,
    issuer: issuer,
    length: 32 // 32 characters = 160 bits (recommended)
  });

  return {
    secret: secret.base32, // Store this in database
    otpauthUrl: secret.otpauth_url // Use this to generate QR code
  };
}

/**
 * Generate QR code image (data URL) from otpauth URL
 * @param {string} otpauthUrl - OTP auth URL from generateSecret()
 * @returns {Promise<string>} Data URL of QR code image
 */
async function generateQRCode(otpauthUrl) {
  try {
    // Generate QR code as data URL (base64 PNG)
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2
    });

    return qrCodeDataUrl;
  } catch (err) {
    console.error('QR code generation failed:', err);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP token
 * @param {string} secret - User's TOTP secret (base32)
 * @param {string} token - 6-digit token from authenticator app
 * @param {number} window - Time window (default: 1 = ±30 seconds)
 * @returns {boolean} True if token is valid
 */
function verifyToken(secret, token, window = 1) {
  try {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: window // Allow ±1 time step (±30 seconds)
    });

    return verified;
  } catch (err) {
    console.error('Token verification failed:', err);
    return false;
  }
}

/**
 * Generate backup codes for account recovery
 * @param {number} count - Number of codes to generate (default: 10)
 * @returns {string[]} Array of backup codes (8 characters each)
 */
function generateBackupCodes(count = 10) {
  const codes = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }

  return codes;
}

/**
 * Hash backup codes for secure storage
 * @param {string[]} codes - Array of backup codes
 * @returns {string} JSON string of hashed codes
 */
function hashBackupCodes(codes) {
  const hashed = codes.map(code => {
    return crypto.createHash('sha256').update(code).digest('hex');
  });

  return JSON.stringify(hashed);
}

/**
 * Verify backup code
 * @param {string} code - Backup code to verify
 * @param {string} hashedCodesJson - JSON string of hashed codes from database
 * @returns {Object} { valid: boolean, remainingCodes: string } - New JSON string with used code removed
 */
function verifyBackupCode(code, hashedCodesJson) {
  try {
    const hashedCodes = JSON.parse(hashedCodesJson || '[]');
    const codeHash = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');

    // Check if code exists
    const index = hashedCodes.indexOf(codeHash);
    if (index === -1) {
      return { valid: false, remainingCodes: hashedCodesJson };
    }

    // Remove used code
    hashedCodes.splice(index, 1);

    return {
      valid: true,
      remainingCodes: JSON.stringify(hashedCodes)
    };
  } catch (err) {
    console.error('Backup code verification failed:', err);
    return { valid: false, remainingCodes: hashedCodesJson };
  }
}

/**
 * Get current TOTP token (for testing/debugging)
 * @param {string} secret - TOTP secret (base32)
 * @returns {string} Current 6-digit token
 */
function getCurrentToken(secret) {
  return speakeasy.totp({
    secret: secret,
    encoding: 'base32'
  });
}

module.exports = {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
  getCurrentToken
};
