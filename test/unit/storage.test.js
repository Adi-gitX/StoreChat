import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../../lib/storage.js'; // Loads StoreChatDB into global

describe('StoreChatDB', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should save conversation and compress data', async () => {
        const mockData = { id: '123', title: 'Test' };

        await StoreChatDB.save({ id: '123' }, mockData);

        expect(chrome.storage.local.set).toHaveBeenCalled();
        const callArg = chrome.storage.local.set.mock.calls[0][0];
        expect(callArg['conv-123']).toBeDefined();
        expect(callArg['conv-123'].compressedData).toBeDefined();
    });

    it('should retrieve conversation', async () => {
        const mockCompressed = new Uint8Array([1, 2, 3]);

        // Mock get implementation
        chrome.storage.local.get.mockImplementation((keys, cb) => {
            const id = Array.isArray(keys) ? keys[0] : keys;
            const res = {};
            if (id === 'conv-123') {
                res['conv-123'] = { id: '123', compressedData: mockCompressed };
            }
            cb(res);
        });

        const result = await StoreChatDB.get('123');
        expect(result).toBeDefined();
        expect(result.id).toBe('123');
    });

    it('should cleanup old conversations', async () => {
        // Mock getting all keys
        chrome.storage.local.get.mockImplementation((keys, cb) => {
            // Return simplified structure
            if (keys === null) {
                cb({
                    'conv-old': { id: 'old', timestamp: new Date('2020-01-01').toISOString(), syncStatus: 'synced' },
                    'conv-new': { id: 'new', timestamp: new Date().toISOString(), syncStatus: 'synced' }
                });
            }
        });

        await StoreChatDB.cleanupOld(30);

        expect(chrome.storage.local.remove).toHaveBeenCalledWith(['conv-old'], expect.any(Function));
    });
});
