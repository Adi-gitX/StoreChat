



(() => {
    const STRATEGIES = [
        {
            name: 'chatgpt-2026',
            container: [
                '[data-testid*="conversation-turn"]',
                'div[class*="react-scroll-to-bottom"]',
                'main'
            ],
            user: [
                '[data-message-author-role="user"] .whitespace-pre-wrap',
                '[data-testid*="conversation-turn"] [data-message-author-role="user"]',
                '[class*="user-message"]',
                'div[data-message-author-role="user"] .markdown'
            ],
            assistant: [
                '[data-message-author-role="assistant"] .markdown',
                '[data-testid*="conversation-turn"] [data-message-author-role="assistant"]',
                '[class*="assistant-message"]',
                'div[data-message-author-role="assistant"] .whitespace-pre-wrap'
            ],
            title: [
                'nav [class*="active"] a',
                'h1',
                'title'
            ]
        },
        {
            name: 'chatgpt-legacy',
            container: [
                '.flex-1.overflow-hidden',
                'main'
            ],
            user: [
                '[data-message-author-role="user"]',
                '.text-base:has(.whitespace-pre-wrap)[class*="dark"]'
            ],
            assistant: [
                '[data-message-author-role="assistant"]',
                '.text-base .markdown'
            ],
            title: ['title']
        },
        {
            name: 'chatgpt-generic',
            container: ['main'],
            user: [
                '[class*="user"]',
                '[class*="human"]',
                '.font-user-message',
                // New generic fallbacks
                'article[data-testid*="conversation-turn"] h6', // User name?
                'article[data-testid*="conversation-turn"]:has([data-message-author-role="user"])',
                'div[data-message-author-role="user"]'
            ],
            assistant: [
                '[class*="assistant"]',
                '.markdown',
                // New generic fallbacks
                'article[data-testid*="conversation-turn"] .markdown',
                'article[data-testid*="conversation-turn"]:has([data-message-author-role="assistant"])',
                'div[data-message-author-role="assistant"]'
            ],
            title: ['title', '.text-4xl', 'h1']
        }
    ];

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => StoreChat.init('chatgpt', STRATEGIES));
    } else {
        setTimeout(() => StoreChat.init('chatgpt', STRATEGIES), 2000);
    }
})();
