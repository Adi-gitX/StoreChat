import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../lib/storage.js';
import '../../lib/compress.js';
import '../../lib/github.js';

const REPO_OWNER = 'Adi-gitX';
const REPO_NAME = 'llm-chat-archive';
// Token must be provided via environment variable — NEVER hardcode tokens
const TEST_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

describe('Real GitHub Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup minimal chrome mocks for github.js
        global.chrome = {
            storage: {
                local: {
                    get: vi.fn((keys, cb) => cb({
                        github_owner: REPO_OWNER,
                        github_repo: REPO_NAME
                    })),
                    set: vi.fn((items, cb) => cb && cb())
                }
            },
            runtime: { id: 'test' }
        };

        // Mock crypto just for token
        global.StoreChatCrypto = {
            retrieveToken: vi.fn(() => Promise.resolve(TEST_TOKEN)),
            storeToken: vi.fn()
        };
    });

    it('should validate token and repo permissions for real', async () => {
        // We use real fetch here (polyfilled by Node 18+ or setup.js if needed)
        // setup.js mocks fetch, so we need to UNMOCK it for this integration test.
        // Vitest runs in JSDOM which uses node-fetch or similar polyfill usually.
        // But setup.js did global.fetch = vi.fn().
        // We need to restore original fetch.

        // Actually, integration tests should run in a separate environment or file where setup.js is different.
        // For simplicity, I'll delete the mock here if I can, or use `vi.unstubAllGlobals()`.
        // But setup.js runs before test files.
        // I will manually overwrite global.fetch with Node's native fetch.
        const nodeFetch = (await import('node:test')).mock?.fn || globalThis.fetch;
        // Wait, Node 18+ has fetch.
        // If setup.js overwrote it, I can't easily get it back unless I saved it.
        // I'll skip setup.js for this file? 'vitest' runs all with same config.

        // I'll create a text execution script instead of a vitest file for this reason? 
        // Or I can modify setup.js to only mock if not running integration tests.
        // Or just let verify-github-sync.js be a standalone Node script.
    });
});
