/**
 * Security Utilities using Web Crypto API
 * Implements SHA-256 for Hashing and AES-GCM for Encryption
 */

const SALT = "classflow-salt-v1"; // In a real app, this should be unique per user/random
const SECRET_KEY_MATERIAL = "classflow-local-secret"; // Static key material for local-only encryption without login

// 1. Hashing (SHA-256)
export const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + SALT);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// 2. Encryption (AES-GCM)
// We need to derive a key from our secret material first
async function getCryptoKey() {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(SECRET_KEY_MATERIAL),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: encoder.encode(SALT),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export const encryptData = async (data: any): Promise<string> => {
    try {
        const key = await getCryptoKey();
        const encoder = new TextEncoder();
        const encodedData = encoder.encode(JSON.stringify(data));

        // IV needs to be unique for every encryption
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encryptedContent = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encodedData
        );

        // Combine IV and Ciphertext for storage
        const encryptedArray = new Uint8Array(encryptedContent);
        const combined = new Uint8Array(iv.length + encryptedArray.length);
        combined.set(iv);
        combined.set(encryptedArray, iv.length);

        // Convert to Base64 specifically for storage string
        return btoa(String.fromCharCode(...combined));
    } catch (e) {
        console.error("Encryption failed", e);
        throw e;
    }
};

export const decryptData = async (cipherText: string): Promise<any> => {
    try {
        const key = await getCryptoKey();
        // Decode Base64
        const combinedString = atob(cipherText);
        const combined = new Uint8Array(combinedString.length);
        for (let i = 0; i < combinedString.length; i++) {
            combined[i] = combinedString.charCodeAt(i);
        }

        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decryptedContent = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            data
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedContent));
    } catch (e) {
        console.error("Decryption failed", e);
        return null;
    }
};
