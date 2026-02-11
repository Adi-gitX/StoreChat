


let allConversations = [];
let currentId = null;


const elements = {
    list: document.getElementById('conversationList'),
    searchInput: document.getElementById('searchInput'),
    chatView: document.getElementById('chatView'),
    emptyState: document.getElementById('emptyState'),
    chatContent: document.getElementById('chatContent'),
    chatTitle: document.getElementById('chatTitle'),
    chatPlatform: document.getElementById('chatPlatform'),
    chatDate: document.getElementById('chatDate'),
    chatLink: document.getElementById('chatLink'),
    settingsBtn: document.getElementById('settingsBtn')
};


document.addEventListener('DOMContentLoaded', async () => {

    marked.setOptions({
        highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-'
    });

    await loadList();
    setupListeners();
    handleRoute();
});


function setupListeners() {
    window.addEventListener('hashchange', handleRoute);

    elements.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        renderList(allConversations.filter(c =>
            (c.title || '').toLowerCase().includes(query) ||
            (c.platform || '').toLowerCase().includes(query)
        ));
    });

    elements.settingsBtn.addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options/options.html'));
        }
    });


    setInterval(async () => {
        const prevCount = allConversations.length;
        await loadList();
        if (allConversations.length !== prevCount && currentId) {
            loadConversation(currentId);
        }
    }, 30000);
}


async function handleRoute() {
    const hash = window.location.hash.substring(1);
    if (hash.startsWith('conversation/')) {
        const id = hash.split('/')[1];
        if (id) {
            currentId = id;
            await loadConversation(id);
            highlightSidebar(id);
        }
    } else {
        currentId = null;
        showEmptyState();
    }
}


async function loadList() {
    try {
        allConversations = await StoreChatDB.getAll({ limit: 1000 });

        allConversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        renderList(allConversations);
    } catch (e) {
        console.error('Failed to load list', e);
    }
}

function renderList(conversations) {
    elements.list.innerHTML = '';

    conversations.forEach(conv => {
        const el = document.createElement('div');
        el.className = 'conv-item';
        el.dataset.id = conv.id;
        if (conv.id === currentId) el.classList.add('active');

        el.addEventListener('click', () => {
            window.location.hash = `conversation/${conv.id}`;
        });

        const timeAgo = getTimeAgo(new Date(conv.timestamp));
        const platform = conv.platform || 'chatgpt';

        el.innerHTML = `
            <div class="conv-avatar ${platform}">${getPlatformInitial(platform)}</div>
            <div class="conv-info">
                <div class="conv-title">${escapeHtml(conv.title || 'Untitled')}</div>
                <div class="conv-meta">${conv.turnCount || 0} turns • ${timeAgo}</div>
            </div>
        `;
        elements.list.appendChild(el);
    });
}


async function loadConversation(id) {
    try {
        const data = await StoreChatDB.get(id);
        if (!data) {
            elements.chatContent.innerHTML = '<p class="error">Conversation not found</p>';
            return;
        }


        // Decompress if needed
        let fullData = data;
        if (data.compressedData) {
            try {
                // If it's a Uint8Array from storage directly
                let bytes = data.compressedData;

                // Chrome storage sometimes serializes Uint8Array as an object {0:x, 1:y...}
                if (!(bytes instanceof Uint8Array) && typeof bytes === 'object') {
                    bytes = new Uint8Array(Object.values(bytes));
                }

                fullData = StoreChatCompress.decompress(bytes);
                // Merge metadata back in just in case
                fullData = { ...data, ...fullData };
            } catch (e) {
                console.error('Decompression failed', e);
                elements.chatContent.innerHTML = '<p class="error">Failed to load content (decompression error)</p>';
                return;
            }
        }

        renderChat(fullData);
        elements.emptyState.classList.add('hidden');
        elements.chatView.classList.remove('hidden');
    } catch (e) {
        console.error('Failed to load conversation', e);
    }
}

function renderChat(data) {

    elements.chatTitle.textContent = data.title || 'Untitled';
    elements.chatPlatform.textContent = (data.platform || 'GPT').toUpperCase();
    elements.chatPlatform.className = `platform-badge ${data.platform || 'chatgpt'}`;
    elements.chatDate.textContent = new Date(data.timestamp).toLocaleString();
    elements.chatLink.href = data.url || '#';
    elements.chatLink.style.display = data.url ? 'inline' : 'none';


    elements.chatContent.innerHTML = '';

    if (data.turns && Array.isArray(data.turns)) {
        data.turns.forEach(turn => {
            const block = document.createElement('div');
            block.className = 'message-block';

            const role = turn.role === 'user' ? 'user' : 'model';
            const avatar = role === 'user' ? StoreChatIcons.user : StoreChatIcons.cpu;


            const htmlContent = marked.parse(turn.content || '');

            block.innerHTML = `
                <div class="role-avatar ${role}">${avatar}</div>
                <div class="message-content markdown-body">${htmlContent}</div>
            `;
            elements.chatContent.appendChild(block);
        });


        elements.chatContent.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
}


function highlightSidebar(id) {
    document.querySelectorAll('.conv-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === id);
    });
}

function showEmptyState() {
    elements.emptyState.classList.remove('hidden');
    elements.chatView.classList.add('hidden');
}

function getPlatformInitial(p) {
    if (p === 'chatgpt') return 'GPT';
    if (p === 'gemini') return 'G';
    if (p === 'claude') return 'C';
    if (p === 'grok') return 'Gr';
    if (p === 'perplexity') return 'P';
    return '?';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getTimeAgo(date) {
    if (!date || isNaN(date.getTime())) return '';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
    return Math.floor(seconds / 86400) + 'd';
}
