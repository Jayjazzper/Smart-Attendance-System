import crypto from 'crypto';

// Use environment secret or a secure fallback (in production, USER should set SESSION_SECRET)
const SESSION_SECRET = process.env.SESSION_SECRET || "smart-attendance-system-secret-key-32chars-minimum";

/**
 * Hash a password using Node.js pbkdf2Sync (zero dependency)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash value
 */
export function verifyPassword(password: string, storedValue: string): boolean {
  try {
    const [salt, originalHash] = storedValue.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  } catch (e) {
    return false;
  }
}

/**
 * Encrypt session data into an AES-256-CBC token string
 */
export function encryptSession(sessionData: any): string {
  const text = JSON.stringify(sessionData);
  const iv = crypto.randomBytes(16);
  // Derive a 32-byte key from our session secret using scrypt
  const key = crypto.scryptSync(SESSION_SECRET, 'salt-salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a session token string back into JSON object
 */
export function decryptSession(token: string): any | null {
  try {
    const [ivHex, encryptedHex] = token.split(':');
    if (!ivHex || !encryptedHex) return null;
    
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(SESSION_SECRET, 'salt-salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}
