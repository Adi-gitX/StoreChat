
class ScraperEngine {
    constructor(platform) {
        this.platform = platform;
        this.selectors = null;
        this.config = {};
    }


    init(config) {
        this.config = config || {};
        this.selectors = this.config[this.platform] || null;
    }


    scrape() {
        let result = null;


        if (this.selectors) {
            try {
                result = this.scrapeBySelectors(this.selectors);
                if (result && result.turns.length > 0) {

                    return result;
                }
            } catch (e) {
            }
        }


        try {
            result = this.scrapeByHeuristics();
            if (result && result.turns.length > 0) {

                result.heuristic = true;
                return result;
            }
        } catch (e) {
        }

        return null;
    }


    scrapeBySelectors(sel) {
        const turns = [];
        const turnEls = document.querySelectorAll(sel.turn);

        turnEls.forEach(el => {
            let role = 'model';
            let content = '';


            if (sel.roleAttr) {
                const attrVal = el.getAttribute(sel.roleAttr);
                if (attrVal === sel.userRoleVal) role = 'user';
            } else if (sel.userSelector && el.querySelector(sel.userSelector)) {
                role = 'user';
            }


            const contentEl = sel.content ? el.querySelector(sel.content) : el;
            if (contentEl) {

                content = this.cleanText(contentEl);
            }

            if (content) {
                turns.push({ role, content });
            }
        });


        const titleEl = document.querySelector(sel.title);
        const title = titleEl ? titleEl.textContent.trim() : document.title;

        return {
            platform: this.platform,
            conversationId: this._getConversationId(),
            title,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            turns
        };
    }


    scrapeByHeuristics() {
        let blocks = Array.from(document.querySelectorAll('article'));

        if (blocks.length === 0) {
            return null;
        }

        const turns = [];
        blocks.forEach(el => {
            let role = 'model';
            const text = el.innerText;

            if (el.querySelector('[data-testid="user-icon"]') || text.startsWith('You\n')) {
                role = 'user';
            }

            const content = this.cleanText(el);
            turns.push({ role, content });
        });

        return {
            platform: this.platform,
            conversationId: this._getConversationId(),
            title: document.title,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            turns
        };
    }

    cleanText(el) {
        const clone = el.cloneNode(true);
        const noise = clone.querySelectorAll('button, .sr-only');
        noise.forEach(n => n.remove());
        return clone.textContent.trim();
    }


    _getConversationId() {
        try {
            const pathParts = new URL(window.location.href).pathname.split('/').filter(Boolean);
            const idPart = pathParts.find(p => p.length > 8 && /[a-f0-9-]/i.test(p));
            return idPart || `conv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        } catch {
            return `conv-${Date.now()}`;
        }
    }
}


window.ScraperEngine = ScraperEngine;
