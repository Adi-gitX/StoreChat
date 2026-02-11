

const StoreChatCrypto = {
    ALGO: 'AES-GCM',
    PBKDF2_ITERATIONS: 100000,


    async _deriveKey(salt) {

        const passphrase = chrome.runtime.id || 'storechat-fallback-key';
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: this.PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: this.ALGO, length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },


    async encrypt(plaintext) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this._deriveKey(salt);
        const encoded = new TextEncoder().encode(plaintext);

        const encrypted = await crypto.subtle.encrypt(
            { name: this.ALGO, iv },
            key,
            encoded
        );

        return {
            encrypted: Array.from(new Uint8Array(encrypted)),
            salt: Array.from(salt),
            iv: Array.from(iv)

        };
    },


    async decrypt(encryptedData) {
        const salt = new Uint8Array(encryptedData.salt);
        const iv = new Uint8Array(encryptedData.iv);
        const key = await this._deriveKey(salt);

        const decrypted = await crypto.subtle.decrypt(
            { name: this.ALGO, iv },
            key,
            new Uint8Array(encryptedData.encrypted)
        );

        return new TextDecoder().decode(decrypted);
    },


    async storeToken(token) {
        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            throw new Error('Invalid token');
        }
        const encryptedData = await this.encrypt(token.trim());
        return new Promise((resolve) => {
            chrome.storage.local.set({ github_token_encrypted: encryptedData }, resolve);
        });
    },


    async retrieveToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['github_token_encrypted'], async (result) => {
                if (result.github_token_encrypted) {
                    try {
                        const token = await this.decrypt(result.github_token_encrypted);
                        resolve(token);
                    } catch {

                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            });
        });
    },


    async hasToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['github_token_encrypted'], (result) => {
                resolve(!!result.github_token_encrypted);
            });
        });
    },


    async clearToken() {
        return new Promise((resolve) => {
            chrome.storage.local.remove(['github_token_encrypted'], resolve);
        });
    }
};

if (typeof globalThis !== 'undefined') {
    globalThis.StoreChatCrypto = StoreChatCrypto;
}
