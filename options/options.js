

function sendMessage(msg) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(msg, (response) => resolve(response || {}));
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupListeners();
    loadStorageStats();
});


async function loadSettings() {

    const config = await sendMessage({ type: 'GET_CONFIG' });
    if (config.tokenMasked) {
        document.getElementById('githubToken').placeholder = config.tokenMasked;
    }
    document.getElementById('githubOwner').value = config.owner || '';
    document.getElementById('githubRepo').value = config.repo || '';


    chrome.storage.local.get([
        'autoSyncEnabled', 'syncFrequency', 'platforms',
        'autoCleanupEnabled', 'cleanupDays'
    ], (settings) => {
        document.getElementById('autoSync').checked = settings.autoSyncEnabled !== false;

        const freq = settings.syncFrequency || 30;
        document.getElementById('syncFrequency').value = freq;
        document.getElementById('syncFrequencyValue').textContent = formatFrequency(freq);

        const platforms = settings.platforms || { chatgpt: true, gemini: true, grok: true, claude: true };
        document.getElementById('platformChatgpt').checked = platforms.chatgpt !== false;
        document.getElementById('platformGemini').checked = platforms.gemini !== false;
        document.getElementById('platformGrok').checked = platforms.grok !== false;
        document.getElementById('platformClaude').checked = platforms.claude !== false;


        const cleanupEnabled = settings.autoCleanupEnabled || false;
        document.getElementById('autoCleanup').checked = cleanupEnabled;
        document.getElementById('cleanupDaysGroup').classList.toggle('hidden', !cleanupEnabled);

        const days = settings.cleanupDays || 30;
        document.getElementById('cleanupDays').value = days;
        document.getElementById('cleanupDaysValue').textContent = `${days} days`;
    });
}

function formatFrequency(minutes) {
    if (minutes < 60) return `${minutes} min`;
    if (minutes === 60) return '1 hour';
    if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hrs`;
    return '24 hrs';
}


async function loadStorageStats() {
    const stats = await sendMessage({ type: 'GET_STATS' });
    if (stats && !stats.error) {
        document.getElementById('storageUsed').textContent = formatBytes(stats.totalSize || 0);
        document.getElementById('totalConvs').textContent = stats.totalConversations || 0;
    }
}


function setupListeners() {

    const tokenInput = document.getElementById('githubToken');
    document.getElementById('toggleToken')?.addEventListener('click', () => {
        tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
    });


    document.getElementById('syncFrequency')?.addEventListener('input', (e) => {
        document.getElementById('syncFrequencyValue').textContent = formatFrequency(parseInt(e.target.value));
    });


    document.getElementById('autoCleanup')?.addEventListener('change', (e) => {
        document.getElementById('cleanupDaysGroup').classList.toggle('hidden', !e.target.checked);
    });


    document.getElementById('cleanupDays')?.addEventListener('input', (e) => {
        document.getElementById('cleanupDaysValue').textContent = `${e.target.value} days`;
    });


    document.getElementById('testConnection')?.addEventListener('click', async () => {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.textContent = 'Testing...';
        statusEl.className = 'connection-status';

        await saveSettings();

        const result = await sendMessage({ type: 'VALIDATE_TOKEN' });

        if (result.valid) {
            statusEl.innerHTML = StoreChatIcons.check + ` Connected as ${result.user}`;
            statusEl.className = 'connection-status success';

            if (result.repoError) {
                statusEl.textContent += ` — ${result.repoError}`;
                statusEl.className = 'connection-status error';
            } else if (!result.hasRepoScope) {
                statusEl.textContent += ' ⚠ Missing repo scope!';
                statusEl.className = 'connection-status warning';
            }
        } else {
            statusEl.innerHTML = StoreChatIcons.x + ` ${result.error || 'Connection failed'}`;
            statusEl.className = 'connection-status error';
        }
    });


    document.getElementById('saveBtn')?.addEventListener('click', saveSettings);


    document.getElementById('setupWizardBtn')?.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('options/setup.html') });
    });


    document.getElementById('clearData')?.addEventListener('click', async () => {
        if (confirm('Delete ALL local conversation data? This cannot be undone.')) {
            await sendMessage({ type: 'CLEAR_DATA' });
            loadStorageStats();
            showSaveStatus('Data cleared', 'success');
        }
    });


    document.getElementById('exportData')?.addEventListener('click', async () => {
        const btn = document.getElementById('exportData');
        btn.disabled = true;
        btn.textContent = 'Exporting...';

        const data = await sendMessage({ type: 'EXPORT_DATA' });
        if (data && data.conversations) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `storechat-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showSaveStatus(`Exported ${data.count} conversations`, 'success');
        } else {
            showSaveStatus('Export failed', 'error');
        }

        btn.disabled = false;
        btn.innerHTML = StoreChatIcons.download + ' Export Backup';
    });


    document.getElementById('importFile')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.conversations || !Array.isArray(data.conversations)) {
                showSaveStatus('Invalid backup file', 'error');
                return;
            }

            const result = await sendMessage({ type: 'IMPORT_DATA', data });
            showSaveStatus(`Imported ${result.imported} of ${result.total} conversations`, 'success');
            loadStorageStats();
        } catch {
            showSaveStatus('Failed to read backup file', 'error');
        }


        e.target.value = '';
    });
}


async function saveSettings() {
    const token = document.getElementById('githubToken').value.trim();
    const owner = document.getElementById('githubOwner').value.trim()
        .replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 39);
    const repo = document.getElementById('githubRepo').value.trim()
        .replace(/[^a-zA-Z0-9_\-\.]/g, '').substring(0, 100);


    const config = { owner, repo };
    if (token) config.token = token;
    await sendMessage({ type: 'SAVE_CONFIG', config });


    const syncSettings = {
        autoSyncEnabled: document.getElementById('autoSync').checked,
        syncFrequency: parseInt(document.getElementById('syncFrequency').value) || 30,
        platforms: {
            chatgpt: document.getElementById('platformChatgpt').checked,
            gemini: document.getElementById('platformGemini').checked,
            grok: document.getElementById('platformGrok').checked,
            claude: document.getElementById('platformClaude').checked
        },
        autoCleanupEnabled: document.getElementById('autoCleanup').checked,
        cleanupDays: parseInt(document.getElementById('cleanupDays').value) || 30
    };

    chrome.storage.local.set(syncSettings, () => {
        chrome.alarms.create('autoSync', { periodInMinutes: syncSettings.syncFrequency });
        showSaveStatus('Settings saved', 'success');
    });


    if (token) {
        document.getElementById('githubToken').value = '';
        document.getElementById('githubToken').placeholder = token.substring(0, 4) + '••••' + token.substring(token.length - 4);
    }
}

function showSaveStatus(message, type) {
    const el = document.getElementById('saveStatus');
    el.textContent = message;
    el.className = `save-status ${type}`;
    setTimeout(() => { el.textContent = ''; el.className = 'save-status'; }, 3000);
}
