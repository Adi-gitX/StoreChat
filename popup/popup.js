


function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function getTimeAgo(date) {
    if (!date || isNaN(date.getTime())) return 'Unknown';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

function sendMessage(msg) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, (response) => {
            resolve(response || {});
        });
    });
}


const elements = {};
document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'totalConversations', 'totalSize', 'unsyncedCount', 'lastSync',
        'platformBar', 'platformsSection', 'searchInput', 'conversationsList',
        'emptyState', 'captureBtn', 'syncBtn', 'syncBtnText', 'settingsBtn',
        'progressBar', 'progressFill', 'progressText', 'statusDot', 'exportBtn',
        'rateLimitBanner', 'rateLimitIndicator', 'dashboardBtn'
    ];
    ids.forEach(id => { elements[id] = document.getElementById(id); });

    init();
});


async function init() {
    loadStats();
    loadConversations();
    setupListeners();
    listenForProgress();
}


async function loadStats() {
    const stats = await sendMessage({ type: 'GET_STATS' });
    if (stats.error) return;

    elements.totalConversations.textContent = stats.totalConversations || 0;
    elements.totalSize.textContent = formatBytes(stats.totalSize || 0);
    elements.unsyncedCount.textContent = stats.unsyncedCount || 0;

    if (stats.lastSyncTime) {
        elements.lastSync.textContent = getTimeAgo(new Date(stats.lastSyncTime));
    }


    if (stats.unsyncedCount === 0 && stats.totalConversations > 0) {
        elements.statusDot.className = 'status-dot connected';
    } else if (stats.unsyncedCount > 0) {
        elements.statusDot.className = 'status-dot warning';
    }


    if (stats.rateLimitStatus?.limited) {
        elements.rateLimitBanner.classList.remove('hidden');
        elements.rateLimitIndicator.classList.remove('hidden');
    } else {
        elements.rateLimitBanner.classList.add('hidden');
        elements.rateLimitIndicator.classList.add('hidden');
    }


    updatePlatformBar(stats.platformCounts || {}, stats.totalConversations || 0);
}

function updatePlatformBar(counts, total) {
    if (!elements.platformBar || total === 0) {
        if (elements.platformsSection) elements.platformsSection.classList.add('hidden');
        return;
    }
    elements.platformsSection.classList.remove('hidden');
    elements.platformBar.innerHTML = '';

    const platforms = ['chatgpt', 'gemini', 'grok', 'claude', 'perplexity'];
    for (const p of platforms) {
        if (counts[p]) {
            const seg = document.createElement('div');
            seg.className = `platform-segment ${p}`;
            seg.style.width = `${(counts[p] / total) * 100}%`;
            seg.title = `${p}: ${counts[p]}`;
            elements.platformBar.appendChild(seg);
        }
    }
}


async function loadConversations() {
    const conversations = await sendMessage({ type: 'GET_RECENT', limit: 20 });
    renderConversations(Array.isArray(conversations) ? conversations : []);
}

function renderConversations(conversations) {
    if (!elements.conversationsList) return;


    const items = elements.conversationsList.querySelectorAll('.conv-item');
    items.forEach(i => i.remove());

    if (conversations.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    }

    elements.emptyState.classList.add('hidden');

    for (const conv of conversations) {
        elements.conversationsList.appendChild(createConversationItem(conv));
    }
}

function createConversationItem(conv) {
    const item = document.createElement('div');
    item.className = 'conv-item';

    const platformLabels = { chatgpt: 'GPT', gemini: 'GEM', grok: 'GRK', claude: 'CLD', perplexity: 'PPX' };

    const safePlatform = ['chatgpt', 'gemini', 'grok', 'claude', 'perplexity'].includes(conv.platform)
        ? conv.platform : 'chatgpt';
    const safeLabel = platformLabels[safePlatform] || 'UNK';
    const safeSyncStatus = conv.syncStatus === 'synced' ? 'synced' : 'pending';
    const safeTurnCount = parseInt(conv.turnCount) || 0;
    const timeAgo = getTimeAgo(new Date(conv.timestamp));

    const icon = document.createElement('div');
    icon.className = `conv-platform-icon ${safePlatform}`;
    icon.textContent = safeLabel;

    const info = document.createElement('div');
    info.className = 'conv-info';

    const titleEl = document.createElement('div');
    titleEl.className = 'conv-title';
    titleEl.textContent = conv.title || 'Untitled';

    const meta = document.createElement('div');
    meta.className = 'conv-meta';
    meta.innerHTML = `<span>${safeTurnCount} turns</span><span>${escapeHtml(timeAgo)}</span>`;

    info.appendChild(titleEl);
    info.appendChild(meta);

    const badge = document.createElement('span');
    badge.className = `conv-sync-badge ${safeSyncStatus}`;
    badge.textContent = safeSyncStatus === 'synced' ? '' : '';
    if (safeSyncStatus === 'synced') badge.innerHTML = StoreChatIcons.check;
    else badge.innerHTML = StoreChatIcons.activity;

    const actions = document.createElement('div');
    actions.className = 'conv-actions';

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'action-btn download-btn';
    downloadBtn.innerHTML = StoreChatIcons.download;
    downloadBtn.title = 'Download Markdown';
    downloadBtn.dataset.id = conv.id;
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDownload(conv.id, conv.title || 'conversation', downloadBtn);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.innerHTML = StoreChatIcons.trash2;
    deleteBtn.title = 'Delete conversation';
    deleteBtn.dataset.id = conv.id;
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const result = await sendMessage({ type: 'DELETE_CONVERSATION', id: conv.id });
        if (result.success) {
            item.remove();
            loadStats();

            const remaining = elements.conversationsList.querySelectorAll('.conv-item');
            if (remaining.length === 0) elements.emptyState.classList.remove('hidden');
        }
    });

    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(badge);
    item.appendChild(actions);

    return item;
}


let searchTimeout = null;
function setupListeners() {

    elements.searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        searchTimeout = setTimeout(async () => {
            if (query.length >= 2) {
                const results = await sendMessage({ type: 'SEARCH', query });
                renderConversations(Array.isArray(results) ? results : []);
            } else {
                loadConversations();
            }
        }, 300);
    });


    elements.settingsBtn?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });


    elements.dashboardBtn?.addEventListener('click', () => {
        chrome.tabs.create({ url: 'dashboard/index.html' });
    });


    elements.captureBtn?.addEventListener('click', async () => {
        elements.captureBtn.disabled = true;
        elements.captureBtn.textContent = 'Capturing...';
        const result = await sendMessage({ type: 'MANUAL_CAPTURE' });
        if (result?.success) {
            elements.captureBtn.innerHTML = result.duplicate ? (StoreChatIcons.check + ' Already captured') : (StoreChatIcons.check + ' Captured!');
            if (!result.duplicate) {
                setTimeout(() => { loadStats(); loadConversations(); }, 500);
            }
        } else {
            elements.captureBtn.innerHTML = StoreChatIcons.x + ' No conversation found';
        }
        setTimeout(() => {
            elements.captureBtn.disabled = false;
            elements.captureBtn.innerHTML = StoreChatIcons.zap + ' Capture Now';
        }, 2000);
    });


    elements.syncBtn?.addEventListener('click', async () => {
        elements.syncBtn.disabled = true;
        elements.syncBtnText.textContent = 'Syncing...';
        document.body.classList.add('syncing');
        showProgress(0, 'Starting sync...');

        const result = await sendMessage({ type: 'SYNC_NOW' });


        document.body.classList.remove('syncing');

        if (result.rateLimited) {
            hideProgress();
            elements.syncBtnText.innerHTML = StoreChatIcons.loader + ' Rate limited';
            elements.rateLimitBanner.classList.remove('hidden');
        } else if (result.synced > 0) {
            hideProgress();
            elements.syncBtnText.innerHTML = StoreChatIcons.check + ` ${result.synced} synced`;
        } else if (result.errors?.length > 0) {
            showProgress(100, `Error: ${result.errors[0]}`);
            elements.syncBtnText.innerHTML = StoreChatIcons.x + ' Sync failed';

            setTimeout(() => { hideProgress(); }, 5000);
        } else {
            hideProgress();
            elements.syncBtnText.innerHTML = StoreChatIcons.check + ' All synced';
        }

        loadStats();
        loadConversations();

        setTimeout(() => {
            if (result.errors?.length === 0) {
                elements.syncBtn.disabled = false;
                elements.syncBtnText.textContent = 'Sync to GitHub';
            } else {
                elements.syncBtn.disabled = false;
                setTimeout(() => { elements.syncBtnText.textContent = 'Sync to GitHub'; }, 3000);
            }
        }, 3000);
    });


    elements.exportBtn?.addEventListener('click', async () => {
        elements.exportBtn.disabled = true;
        const data = await sendMessage({ type: 'EXPORT_DATA' });
        if (data && data.conversations) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `storechat-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
        elements.exportBtn.disabled = false;
    });
}


function showProgress(percent, text) {
    elements.progressBar.classList.remove('hidden');
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = text || 'Syncing...';
}

function hideProgress() {
    elements.progressBar.classList.add('hidden');
    elements.progressFill.style.width = '0%';
}


function listenForProgress() {
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'SYNC_PROGRESS') {
            const { synced, total, rateLimited } = msg;
            const percent = total > 0 ? Math.round((synced / total) * 100) : 0;
            showProgress(percent, `Syncing ${synced}/${total}...`);

            if (rateLimited) {
                elements.rateLimitBanner.classList.remove('hidden');
                elements.rateLimitIndicator.classList.remove('hidden');
            }
        }
    });
}


async function handleDownload(id, title, btn) {
    btn.disabled = true;
    try {
        const data = await sendMessage({ type: 'GET_CONVERSATION', id });
        if (!data) { btn.disabled = false; return; }

        let fullData = data;
        if (data.compressedDataBase64) {
            try {
                const binary = atob(data.compressedDataBase64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const jsonStr = pako.ungzip(bytes, { to: 'string' });
                fullData = JSON.parse(jsonStr);
            } catch {

            }
        }


        const convTitle = fullData.title || title || 'Conversation';
        const platform = (fullData.platform || 'Unknown').toUpperCase();
        const date = fullData.timestamp ? new Date(fullData.timestamp).toLocaleString() : 'Unknown';
        const turnCount = fullData.turns?.length || 0;

        let md = `# ${convTitle}\n\n`;
        md += `> **Platform:** ${platform} | **Date:** ${date} | **Turns:** ${turnCount}\n`;
        if (fullData.url) md += `> **Source:** [Open Original](${fullData.url})\n`;
        md += `\n---\n\n`;

        if (fullData.turns && Array.isArray(fullData.turns)) {
            for (let i = 0; i < fullData.turns.length; i++) {
                const turn = fullData.turns[i];
                const roleLabel = turn.role === 'user' ? 'USER' : 'ASSISTANT';
                md += `## ${roleLabel}\n\n${turn.content || '*(empty)*'}\n\n`;
                if (i < fullData.turns.length - 1) md += `---\n\n`;
            }
        }

        md += `\n---\n*Exported via StoreChat on ${new Date().toISOString().split('T')[0]}*\n`;

        // Download
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = (convTitle).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);
        a.download = `${safeTitle}.md`;
        a.click();
        URL.revokeObjectURL(url);
    } catch {

    }
    btn.disabled = false;
}

