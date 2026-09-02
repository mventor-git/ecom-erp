/**
 * Password Validation Utility
 *
 * Enforces strong password requirements:
 * - Minimum 12 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 *
 * Created: 2026-08-24 (mventor critical security improvements)
 */

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
  const errors = [];

  // Check minimum length
  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  // Check for common weak passwords
  const commonPasswords = [
    'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
    'monkey', '1234567', 'letmein', 'trustno1', 'dragon', 'baseball',
    'iloveyou', 'master', 'sunshine', 'ashley', 'bailey', 'passw0rd',
    'shadow', '123123', '654321', 'superman', 'qazwsx', 'michael',
    'admin', 'administrator', 'root', 'toor', 'admin123', 'admin1234'
  ];

  if (commonPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('Password contains a common weak password pattern');
  }

  // Check for sequential characters (123, abc, etc.)
  const hasSequential = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password);
  if (hasSequential) {
    errors.push('Password should not contain sequential characters (abc, 123, etc.)');
  }

  // Check for repeated characters (aaa, 111, etc.)
  const hasRepeated = /(.)\1{2,}/.test(password);
  if (hasRepeated) {
    errors.push('Password should not contain repeated characters (aaa, 111, etc.)');
  }

  return {
    valid: errors.length === 0,
    errors,
    strength: calculateStrength(password, errors)
  };
}

/**
 * Calculate password strength score (0-100)
 * @param {string} password
 * @param {string[]} errors
 * @returns {Object} { score: number, label: string }
 */
function calculateStrength(password, errors) {
  if (!password) return { score: 0, label: 'No password' };

  let score = 0;

  // Length bonus (max 30 points)
  score += Math.min(30, password.length * 2);

  // Character variety bonus (max 40 points)
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) score += 10;

  // Complexity bonus (max 30 points)
  const uniqueChars = new Set(password).size;
  score += Math.min(20, uniqueChars * 1.5);
  if (password.length >= 16) score += 10;

  // Deduct points for errors
  score -= errors.length * 10;

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Label
  let label = 'Very Weak';
  if (score >= 80) label = 'Strong';
  else if (score >= 60) label = 'Good';
  else if (score >= 40) label = 'Fair';
  else if (score >= 20) label = 'Weak';

  return { score, label };
}

/**
 * Generate password requirements message
 * @returns {string} Human-readable requirements
 */
function getPasswordRequirements() {
  return 'Password must be at least 12 characters long and contain: uppercase letter, lowercase letter, number, and special character (!@#$%^&*()_+-=[]{}|;:,.<>?)';
}

/**
 * Express middleware to validate password in request body
 * Usage: router.post('/register', validatePassword('password'), ...)
 * @param {string} fieldName - Name of password field in req.body (default: 'password')
 */
function validatePassword(fieldName = 'password') {
  return (req, res, next) => {
    const password = req.body[fieldName];

    if (!password) {
      return res.status(400).json({
        error: 'Password is required',
        requirements: getPasswordRequirements()
      });
    }

    const validation = validatePasswordStrength(password);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Password does not meet strength requirements',
        errors: validation.errors,
        strength: validation.strength,
        requirements: getPasswordRequirements()
      });
    }

    // Password is valid, continue
    next();
  };
}

module.exports = {
  validatePasswordStrength,
  calculateStrength,
  getPasswordRequirements,
  validatePassword
};
