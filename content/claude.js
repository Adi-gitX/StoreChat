



(() => {
    const STRATEGIES = [
        {
            name: 'claude-2026',
            container: [
                '[class*="conversation-content"]',
                '.flex-1.flex.flex-col',
                'main [class*="thread"]',
                'main'
            ],
            user: [
                '[data-testid*="human"] [class*="message"]',
                '[class*="human-turn"] [class*="content"]',
                '.font-user-message',
                'div[data-is-streaming="false"][class*="human"]'
            ],
            assistant: [
                '[data-testid*="assistant"] [class*="message"]',
                '[class*="claude-turn"] [class*="content"]',
                '.font-claude-message',
                'div[data-is-streaming="false"][class*="assistant"]',
                '[class*="response"] .markdown'
            ],
            title: [
                '[class*="conversation-header"] button span',
                'button[class*="truncate"]',
                'h1',
                'title'
            ]
        },
        {
            name: 'claude-legacy',
            container: [
                '.flex-col.items-center',
                'main'
            ],
            user: [
                '.whitespace-pre-wrap.break-words[class*="human"]',
                'div[class*="human"] p'
            ],
            assistant: [
                '.whitespace-pre-wrap.break-words[class*="assistant"]',
                'div[class*="assistant"] .prose'
            ],
            title: ['title']
        },
        {
            name: 'claude-generic',
            container: ['main'],
            user: [
                '[class*="human"]',
                '[class*="user"]'
            ],
            assistant: [
                '[class*="assistant"]',
                '[class*="claude"]',
                '[class*="bot"]'
            ],
            title: ['title']
        }
    ];

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => StoreChat.init('claude', STRATEGIES));
    } else {
        setTimeout(() => StoreChat.init('claude', STRATEGIES), 2000);
    }
})();
