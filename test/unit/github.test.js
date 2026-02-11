import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../src/lib/storage.js'; // Needed for StoreChatDB dep
import '../../src/lib/compress.js';
import '../../src/lib/github.js';

describe('StoreChatGitHub', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset rate limit state
        StoreChatGitHub._rateLimit = { remaining: 5000, resetAt: 0, retryAfter: 0, lastChecked: 0 };
    });

    it('validateToken should check user and repo scope', async () => {
        // Mock fetch for /user
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ login: 'testuser' }),
            headers: { get: (h) => h === 'X-OAuth-Scopes' ? 'repo' : '5000' }
        }));
        // Mock fetch for /repos/owner/repo check
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ permissions: { push: true } }),
            headers: { get: () => '5000' }
        }));

        // Mock config
        chrome.storage.local.get.mockImplementation((k, cb) => cb({ github_owner: 'o', github_repo: 'r' }));

        // Mock crypto retrieval
        global.StoreChatCrypto = { retrieveToken: vi.fn(() => Promise.resolve('token')) };

        const res = await StoreChatGitHub.validateToken();
        expect(res.valid).toBe(true);
        expect(res.user).toBe('testuser');
        expect(res.hasRepoScope).toBe(true);
    });

    it('syncAll should push unsynced conversations', async () => {
        // Mock deps
        global.StoreChatCrypto = { retrieveToken: vi.fn(() => Promise.resolve('token')) };
        StoreChatGitHub.validateToken = vi.fn().mockResolvedValue({ valid: true, hasRepoScope: true });
        StoreChatDB.getUnsyncedIds = vi.fn().mockResolvedValue(['conv-1']);
        StoreChatDB.get = vi.fn().mockResolvedValue({
            id: 'conv-1', platform: 'chatgpt', title: 'Test',
            timestamp: '2023-01-01', compressedData: new Uint8Array([1])
        });

        // Mock GraphQL response for branch info
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { repository: { defaultBranchRef: { name: 'main', target: { oid: 'sha' } } } } }),
            headers: { get: () => '5000' }
        }));

        // Mock GraphQL response for commit
        fetch.mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: { createCommitOnBranch: { commit: { url: 'url', oid: 'newsha' } } } }),
            headers: { get: () => '4999' }
        }));

        StoreChatDB.markSynced = vi.fn();

        const res = await StoreChatGitHub.syncAll();

        expect(res.synced).toBe(1);
        expect(res.failed).toBe(0);
        expect(StoreChatDB.markSynced).toHaveBeenCalledWith('conv-1');
    });
});
