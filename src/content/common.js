



const StoreChat = {
    EXTENSION_TAG: '[StoreChat]',
    _observer: null,
    _capturedConversations: new Set(),


    waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            const observer = new MutationObserver((_, obs) => {
                const found = document.querySelector(selector);
                if (found) {
                    obs.disconnect();
                    resolve(found);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`${this.EXTENSION_TAG} Timeout waiting for: ${selector}`));
            }, timeout);
        });
    },


    trySelectors(selectors) {
        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el) return el;
            } catch { }
        }
        return null;
    },


    trySelectorsAll(selectors) {
        for (const sel of selectors) {
            try {
                const els = document.querySelectorAll(sel);
                if (els.length > 0) return els;
            } catch { }
        }
        return [];
    },


    extractText(element) {
        if (!element) return '';


        const clone = element.cloneNode(true);


        clone.querySelectorAll('pre code, pre').forEach((code) => {
            const lang = code.className?.match(/language-(\w+)/)?.[1] || '';
            code.textContent = `\n\`\`\`${lang}\n${code.textContent.trim()}\n\`\`\`\n`;
        });


        clone.querySelectorAll('code:not(pre code)').forEach((code) => {
            code.textContent = `\`${code.textContent}\``;
        });


        clone.querySelectorAll('strong, b').forEach((el) => {
            el.textContent = `**${el.textContent}**`;
        });


        clone.querySelectorAll('em, i').forEach((el) => {
            el.textContent = `*${el.textContent}*`;
        });


        clone.querySelectorAll('a').forEach((el) => {
            el.textContent = `[${el.textContent}](${el.href})`;
        });


        clone.querySelectorAll('li').forEach((el) => {
            const parent = el.parentElement;
            const prefix = parent?.tagName === 'OL'
                ? `${Array.from(parent.children).indexOf(el) + 1}. `
                : '- ';
            el.textContent = `${prefix}${el.textContent.trim()}\n`;
        });

        return clone.textContent?.trim() || '';
    },


    async generateContentHash(conversation) {
        const content = JSON.stringify({
            platform: conversation.platform,
            firstMsg: conversation.turns[0]?.content?.substring(0, 200) || '',
            lastMsg: conversation.turns[conversation.turns.length - 1]?.content?.substring(0, 200) || '',
            turnCount: conversation.turns.length
        });

        const buffer = new TextEncoder().encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },


    getConversationId() {
        const url = window.location.href;
        const pathParts = new URL(url).pathname.split('/').filter(Boolean);

        const idPart = pathParts.find(p => p.length > 8 && /[a-f0-9-]/i.test(p));
        return idPart || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    },


    getTitle(selectors = []) {

        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim()) {
                    const text = el.textContent.trim();
                    // Skip generic platform names that aren't real titles
                    if (text.length > 3 && !['ChatGPT', 'Gemini', 'Claude', 'Grok', 'New chat', 'New conversation'].includes(text)) {
                        return this._cleanTitle(text);
                    }
                }
            } catch { }
        }


        const docTitle = document.title || '';
        const cleaned = this._cleanTitle(docTitle);
        if (cleaned.length > 3 && !['ChatGPT', 'Gemini', 'Claude', 'Grok', 'New chat', 'New conversation'].includes(cleaned)) {
            return cleaned;
        }

        return null;
    },


    _cleanTitle(title) {
        return title
            .replace(/\s*[-–—|]\s*(ChatGPT|Gemini|Claude|Grok|Google|Anthropic|X|OpenAI).*$/i, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200) || 'Untitled';
    },


    debounce(fn, ms = 500) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    },


    async sendToBackground(conversation) {

        const hash = await this.generateContentHash(conversation);


        if (this._capturedConversations.has(hash)) {
            return;
        }

        conversation.contentHash = hash;
        this._capturedConversations.add(hash);

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CONVERSATION_CAPTURED',
                data: conversation
            });

        } catch {

        }
    },


    observeChat(containerSelectors, extractFn, retryCount = 0) {
        const MAX_RETRIES = 10;

        const debouncedExtract = this.debounce(async () => {
            try {
                const conversation = await extractFn();
                if (conversation && conversation.turns.length > 0) {
                    await this.sendToBackground(conversation);
                }
            } catch {

            }
        }, 3000);


        const container = this.trySelectors(containerSelectors);
        if (!container) {
            if (retryCount < MAX_RETRIES) {
                setTimeout(() => this.observeChat(containerSelectors, extractFn, retryCount + 1), 3000);
            }
            return;
        }


        if (this._observer) {
            this._observer.disconnect();
        }

        this._observer = new MutationObserver(debouncedExtract);
        this._observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true
        });


        if (!this._manualCaptureListenerAdded) {
            this._manualCaptureListenerAdded = true;
            chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
                if (msg.type === 'MANUAL_CAPTURE') {
                    extractFn().then(conv => {
                        if (conv && conv.turns.length > 0) {
                            this.sendToBackground(conv);
                            sendResponse({ success: true, turns: conv.turns.length });
                        } else {
                            sendResponse({ success: false, error: 'No conversation found' });
                        }
                    });
                    return true;
                }
            });
        }
    },


    init(platform, strategies) {
        const extractFn = async () => {

            for (const strategy of strategies) {
                const userEls = this.trySelectorsAll(strategy.user);
                const assistantEls = this.trySelectorsAll(strategy.assistant);

                if (userEls.length > 0 || assistantEls.length > 0) {
                    const turns = [];

                    const allMessages = [];
                    userEls.forEach(el => allMessages.push({ el, role: 'user' }));
                    assistantEls.forEach(el => allMessages.push({ el, role: 'assistant' }));


                    allMessages.sort((a, b) => {
                        const pos = a.el.compareDocumentPosition(b.el);
                        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
                    });

                    for (const msg of allMessages) {
                        const content = this.extractText(msg.el);
                        if (content) {
                            turns.push({
                                role: msg.role,
                                content,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }

                    if (turns.length > 0) {

                        let title = this.getTitle(strategy.title);
                        if (!title) {
                            const firstUserMsg = turns.find(t => t.role === 'user');
                            title = firstUserMsg
                                ? firstUserMsg.content.substring(0, 80).replace(/\n/g, ' ').trim()
                                : 'Untitled';
                            if (title.length >= 78) title += '…';
                        }

                        return {
                            platform,
                            conversationId: this.getConversationId(),
                            title,
                            timestamp: new Date().toISOString(),
                            url: window.location.href,
                            turns
                        };
                    }
                }
            }
            return null;
        };


        const allContainerSelectors = strategies.flatMap(s => s.container);
        this.observeChat(allContainerSelectors, extractFn);


        let lastUrl = window.location.href;
        const checkUrlChange = () => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                this._capturedConversations.clear();

                if (this._observer) this._observer.disconnect();
                setTimeout(() => {
                    this.observeChat(allContainerSelectors, extractFn);
                }, 2000);
            }
        };


        window.addEventListener('popstate', checkUrlChange);
        window.addEventListener('hashchange', checkUrlChange);


        setInterval(checkUrlChange, 5000);
    }
};

