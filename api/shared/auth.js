import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of the plaintext Sync ID.
 * @param {string} plainSyncId Plaintext Sync ID
 * @returns {string} Hex-encoded hash
 */
export function hashSyncId(plainSyncId) {
  if (!plainSyncId || typeof plainSyncId !== 'string') return '';
  return crypto.createHash('sha256').update(plainSyncId.trim()).digest('hex');
}

/**
 * Resolves a session token or plaintext Sync ID to the corresponding user document.
 * @param {object} db MongoDB database connection
 * @param {string} token Session token or plaintext Sync ID
 * @returns {Promise<object|null>} The user document or null
 */
export async function resolveUser(db, token) {
  if (!token || typeof token !== 'string') return null;
  const collection = db.collection('users');

  const trimmedToken = token.trim();
  if (trimmedToken.startsWith('vny_sess_')) {
    // Resolve by session token
    const userDoc = await collection.findOne({ 'sessions.token': trimmedToken });
    if (userDoc) {
      // Update session activity timestamp
      await collection.updateOne(
        { 'sessions.token': trimmedToken },
        { $set: { 'sessions.$.lastUsedAt': new Date().toISOString() } }
      );
    }
    return userDoc;
  }

  // Otherwise, it is a plaintext Sync ID (first-time link or register). Hash it to lookup.
  const hashed = hashSyncId(trimmedToken);
  return await collection.findOne({ syncId: hashed });
}
