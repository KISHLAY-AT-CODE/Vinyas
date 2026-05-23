// Secure cryptographic services utilizing native Web Crypto API
// Provides zero-dependency, high-security AES-256-GCM encryption with PBKDF2 key derivation

// Helper to convert array buffer to hex string
const bufferToHex = (buffer) => {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

// Helper to convert hex string back to Uint8Array
const hexToBuffer = (hex) => {
    if (!hex) return new Uint8Array(0);
    const matches = hex.match(/.{1,2}/g);
    if (!matches) return new Uint8Array(0);
    return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
};

/**
 * Derives an AES-GCM 256-bit key from a plaintext passphrase and a cryptographic salt using PBKDF2.
 * @param {string} passphrase The password or sync ID to derive the key from
 * @param {Uint8Array} salt Cryptographically secure salt (16 bytes)
 * @returns {Promise<CryptoKey>} Derived key ready for AES-GCM operations
 */
async function deriveKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts standard text using AES-256-GCM and a PBKDF2 derived key.
 * @param {string} passphrase Passphrase or syncId used as the key source
 * @param {string} plaintext Text payload to encrypt
 * @returns {Promise<{salt: string, iv: string, ciphertext: string}>} Hex-encoded encrypted bundle
 */
export async function aesEncrypt(passphrase, plaintext) {
    if (!passphrase) {
        throw new Error("Encryption failed: Passphrase is required.");
    }
    
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV is 12 bytes
    
    const key = await deriveKey(passphrase, salt);
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encoder.encode(plaintext)
    );
    
    return {
        salt: bufferToHex(salt),
        iv: bufferToHex(iv),
        ciphertext: bufferToHex(ciphertextBuffer)
    };
}

/**
 * Decrypts an AES-256-GCM hex-encoded bundle using a PBKDF2 derived key.
 * @param {string} passphrase Passphrase or syncId used to encrypt the payload
 * @param {{salt: string, iv: string, ciphertext: string}} encryptedBundle Hex-encoded encrypted bundle
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function aesDecrypt(passphrase, { salt, iv, ciphertext }) {
    if (!passphrase) {
        throw new Error("Decryption failed: Passphrase is required.");
    }
    if (!salt || !iv || !ciphertext) {
        throw new Error("Decryption failed: Invalid or incomplete encrypted payload bundle.");
    }
    
    const saltBuffer = hexToBuffer(salt);
    const ivBuffer = hexToBuffer(iv);
    const ciphertextBuffer = hexToBuffer(ciphertext);
    
    const key = await deriveKey(passphrase, saltBuffer);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: ivBuffer
        },
        key,
        ciphertextBuffer
    );
    
    return new TextDecoder().decode(decryptedBuffer);
}
