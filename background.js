

importScripts('lib/vendor/pako.min.js', 'lib/compress.js', 'lib/storage.js', 'lib/crypto.js', 'lib/github.js');

const ALLOWED_ORIGINS = [
    'https://chat.openai.com',
    'https://chatgpt.com',
    'https://gemini.google.com',
    'https://x.com',
    'https://grok.com',
    'https://claude.ai',
    'https://www.perplexity.ai'
];

const VALID_PLATFORMS = ['chatgpt', 'gemini', 'grok', 'claude', 'perplexity'];


function isValidSender(sender) {

    if (!sender || sender.id !== chrome.runtime.id) return false;


    if (!sender.tab) return true;


    if (sender.url && sender.url.startsWith(`chrome-extension://${chrome.runtime.id}`)) return true;


    if (sender.tab && sender.url) {
        try {
            return ALLOWED_ORIGINS.includes(new URL(sender.url).origin);
        } catch { return false; }
    }

    return false;
}


function sanitizeConversation(data) {
    if (!data || typeof data !== 'object') return null;

    const platform = VALID_PLATFORMS.includes(data.platform) ? data.platform : null;
    if (!platform) return null;

    const title = typeof data.title === 'string'
        ? data.title.replace(/<[^>]*>/g, '').substring(0, 200).trim() : 'Untitled';

    let url = '';
    if (typeof data.url === 'string') {
        try {
            const parsed = new URL(data.url);
            if (parsed.protocol === 'https:') url = parsed.href.substring(0, 500);
        } catch { }
    }

    const turns = [];
    if (Array.isArray(data.turns)) {
        for (const turn of data.turns.slice(0, 5000)) {
            if (turn && typeof turn === 'object') {
                const role = ['user', 'assistant'].includes(turn.role) ? turn.role : 'user';
                const content = typeof turn.content === 'string' ? turn.content.substring(0, 100000) : '';
                if (content) {
                    turns.push({
                        role, content,
                        timestamp: typeof turn.timestamp === 'string' ? turn.timestamp : new Date().toISOString()
                    });
                }
            }
        }
    }

    return {
        platform,
        conversationId: typeof data.conversationId === 'string'
            ? data.conversationId.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 100) : `conv-${Date.now()}`,
        title,
        timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
        url, turns,
        contentHash: typeof data.contentHash === 'string' ? data.contentHash.substring(0, 64) : ''
    };
}



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isValidSender(sender)) { sendResponse({ error: 'Unauthorized' }); return; }
    if (!message || typeof message.type !== 'string') { sendResponse({ error: 'Invalid' }); return; }

    switch (message.type) {
        case 'CONVERSATION_CAPTURED': {
            const sanitized = sanitizeConversation(message.data);
            if (!sanitized) { sendResponse({ success: false, error: 'Invalid data' }); return; }
            handleCapture(sanitized)
                .then(r => sendResponse(r))
                .catch(() => sendResponse({ success: false, error: 'Capture failed' }));
            return true;
        }

        case 'MANUAL_CAPTURE':
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'MANUAL_CAPTURE' }, sendResponse);
                else sendResponse({ success: false, error: 'No active tab' });
            });
            return true;

        case 'SYNC_NOW':
            handleSync(sendResponse);
            return true;

        case 'GET_STATS':
            StoreChatDB.getStats()
                .then(stats => {
                    chrome.storage.local.get(['lastSyncTime'], (r) => {
                        stats.lastSyncTime = r.lastSyncTime || null;
                        stats.rateLimitStatus = StoreChatGitHub.getRateLimitStatus();
                        sendResponse(stats);
                    });
                })
                .catch(() => sendResponse({ error: 'Failed' }));
            return true;

        case 'GET_RECENT': {
            const limit = Math.min(Math.max(parseInt(message.limit) || 10, 1), 50);
            StoreChatDB.getAll({ limit })
                .then(c => sendResponse(c))
                .catch(() => sendResponse({ error: 'Failed' }));
            return true;
        }

        case 'SEARCH': {
            const q = typeof message.query === 'string' ? message.query.substring(0, 100).trim() : '';
            handleSearch(q).then(r => sendResponse(r)).catch(() => sendResponse([]));
            return true;
        }

        case 'GET_CONVERSATION': {
            const id = typeof message.id === 'string' ? message.id : null;
            if (!id) { sendResponse(null); return true; }
            StoreChatDB.get(id)
                .then(c => {
                    if (c && c.compressedData) {

                        c.compressedDataBase64 = StoreChatCompress.toBase64(c.compressedData);
                        delete c.compressedData;
                    }
                    sendResponse(c);
                })
                .catch(() => sendResponse(null));
            return true;
        }

        case 'GET_SELECTORS': {

            chrome.storage.local.get(['selectors'], (res) => {
                sendResponse(res.selectors || null);
            });
            return true;
        }

        case 'GET_CONFIG':
            StoreChatGitHub.getConfig().then(config => {
                if (config.token) {
                    config.tokenMasked = config.token.substring(0, 4) + '••••' + config.token.substring(config.token.length - 4);
                    delete config.token;
                }
                sendResponse(config);
            });
            return true;

        case 'SAVE_CONFIG': {
            const cfg = message.config || {};
            const safe = {};
            if (typeof cfg.token === 'string' && cfg.token.trim()) safe.token = cfg.token.trim();
            if (typeof cfg.owner === 'string') safe.owner = cfg.owner.replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 39);
            if (typeof cfg.repo === 'string') safe.repo = cfg.repo.replace(/[^a-zA-Z0-9_\-\.]/g, '').substring(0, 100);
            StoreChatGitHub.saveConfig(safe)
                .then(() => sendResponse({ success: true }))
                .catch(() => sendResponse({ success: false }));
            return true;
        }

        case 'VALIDATE_TOKEN':
            StoreChatGitHub.validateToken()
                .then(r => sendResponse(r))
                .catch(() => sendResponse({ valid: false, error: 'Failed' }));
            return true;

        case 'CLEAR_DATA':
            StoreChatDB.clearAll()
                .then(() => sendResponse({ success: true }))
                .catch(() => sendResponse({ success: false }));
            return true;

        case 'DELETE_CONVERSATION': {
            const id = typeof message.id === 'string' ? message.id.substring(0, 100) : '';
            if (!id) { sendResponse({ success: false }); return; }
            StoreChatDB.delete(id).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
            return true;
        }

        case 'EXPORT_DATA':
            handleExport().then(r => sendResponse(r)).catch(() => sendResponse({ error: 'Export failed' }));
            return true;

        case 'IMPORT_DATA':
            handleImport(message.data).then(r => sendResponse(r)).catch(() => sendResponse({ error: 'Import failed' }));
            return true;

        case 'GET_RATE_LIMIT':
            sendResponse(StoreChatGitHub.getRateLimitStatus());
            return;

        default:
            sendResponse({ error: 'Unknown message type' });
    }
});



async function handleCapture(conversation) {

    const settings = await new Promise(r => chrome.storage.local.get(['platforms'], r));
    const platforms = settings.platforms || {};
    if (platforms[conversation.platform] === false) {
        return { success: false, error: 'Platform disabled' };
    }


    if (conversation.contentHash) {
        const isDup = await StoreChatDB.isDuplicate(conversation.contentHash);
        if (isDup) return { success: true, duplicate: true };
    }


    const compressed = StoreChatCompress.compress(conversation);
    const metadata = {
        id: conversation.conversationId || `conv-${Date.now()}`,
        platform: conversation.platform,
        title: conversation.title || 'Untitled',
        timestamp: conversation.timestamp || new Date().toISOString(),
        turnCount: conversation.turns?.length || 0,
        contentHash: conversation.contentHash || '',
        url: conversation.url || ''
    };

    await StoreChatDB.save(metadata, compressed);
    updateBadge();


    chrome.alarms.create('progressiveSync', { delayInMinutes: 0.5 });

    return { success: true, id: metadata.id, compressed: compressed.byteLength };
}



let _syncInProgress = false;

async function handleSync(sendResponse) {
    if (_syncInProgress) {
        sendResponse({ synced: 0, failed: 0, errors: ['Sync already in progress'] });
        return;
    }
    _syncInProgress = true;

    try {
        const result = await StoreChatGitHub.syncAll((progress) => {

            chrome.runtime.sendMessage({
                type: 'SYNC_PROGRESS',
                ...progress
            }).catch(() => { });
        });
        updateBadge();
        sendResponse(result);
    } catch (err) {
        sendResponse({ synced: 0, failed: 0, errors: ['Sync failed'] });
    } finally {
        _syncInProgress = false;
    }
}



async function handleSearch(query) {
    if (!query || query.trim().length < 2) return [];
    const all = await StoreChatDB.getAll({ limit: 500 });
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return all
        .filter(c => {
            const s = `${c.title} ${c.platform}`.toLowerCase();
            return tokens.every(t => s.includes(t));
        })
        .slice(0, 20);
}



async function handleExport() {
    const conversations = await StoreChatDB.getAll({ limit: 10000 });
    const fullData = [];
    for (const conv of conversations) {
        const full = await StoreChatDB.get(conv.id);
        if (full && full.compressedData) {
            try {

                const decompressed = StoreChatCompress.decompress(full.compressedData);

                const base64 = StoreChatCompress.toBase64(full.compressedData);
                fullData.push({
                    id: conv.id,
                    platform: conv.platform,
                    title: conv.title || decompressed.title || 'Untitled',
                    timestamp: conv.timestamp,
                    url: conv.url || decompressed.url || '',
                    turnCount: decompressed.turns?.length || conv.turnCount || 0,
                    turns: decompressed.turns || [],
                    compressedDataBase64: base64
                });
            } catch {

                fullData.push({ ...conv, turns: [], error: 'decompression_failed' });
            }
        }
    }
    return {
        version: '3.0',
        exportedAt: new Date().toISOString(),
        count: fullData.length,
        conversations: fullData
    };
}

async function handleImport(data) {
    if (!data || !Array.isArray(data.conversations)) {
        return { imported: 0, error: 'Invalid format' };
    }

    let imported = 0;
    for (const conv of data.conversations) {
        if (!conv.id || !conv.platform) continue;


        const existing = await StoreChatDB.get(conv.id);
        if (existing) continue;


        if (conv.compressedDataBase64) {
            const compressedData = StoreChatCompress.fromBase64(conv.compressedDataBase64);
            const metadata = {
                id: conv.id,
                platform: conv.platform,
                title: conv.title || 'Untitled',
                timestamp: conv.timestamp,
                turnCount: conv.turnCount || 0,
                contentHash: conv.contentHash || '',
                url: conv.url || ''
            };
            await StoreChatDB.save(metadata, compressedData);
            imported++;
        }
    }

    updateBadge();
    return { imported, total: data.conversations.length };
}



async function updateBadge() {
    try {
        const stats = await StoreChatDB.getStats();
        if (stats.unsyncedCount > 0) {
            chrome.action.setBadgeText({ text: String(stats.unsyncedCount) });
            chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    } catch { }
}



chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'autoSync' || alarm.name === 'progressiveSync' || alarm.name === 'rateLimitRetry') {

        if (alarm.name !== 'rateLimitRetry') {
            const settings = await new Promise(r => chrome.storage.local.get(['autoSyncEnabled'], r));
            if (settings.autoSyncEnabled === false) return;
        }

        if (_syncInProgress) return;
        _syncInProgress = true;
        try {
            await StoreChatGitHub.syncAll();
            updateBadge();
        } catch { }
        finally { _syncInProgress = false; }
    }

    if (alarm.name === 'autoCleanup') {
        try {
            const settings = await new Promise(r =>
                chrome.storage.local.get(['autoCleanupEnabled', 'cleanupDays'], r)
            );
            if (settings.autoCleanupEnabled) {
                const days = settings.cleanupDays || 30;
                await StoreChatDB.cleanupOld(days);
                updateBadge();
            }
        } catch { }
    }
});




chrome.runtime.onInstalled.addListener((details) => {

    if (details.reason === 'install') {
        chrome.storage.local.set({
            autoSyncEnabled: true,
            syncFrequency: 30,
            autoCleanupEnabled: false,
            cleanupDays: 30,
            platforms: { chatgpt: true, gemini: true, grok: true, claude: true }
        });

        chrome.tabs.create({ url: chrome.runtime.getURL('options/setup.html') });
    }


    chrome.storage.local.get(['syncFrequency'], (r) => {
        const freq = r.syncFrequency || 30;
        chrome.alarms.create('autoSync', { periodInMinutes: freq });
    });


    chrome.alarms.create('autoCleanup', { periodInMinutes: 1440 });

    updateBadge();
});


updateBadge();
