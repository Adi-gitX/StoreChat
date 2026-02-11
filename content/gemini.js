



(() => {
    const STRATEGIES = [
        {
            name: 'gemini-2026',
            container: [
                'conversation-container',
                '.conversation-container',
                'main [class*="conversation"]',
                'main'
            ],
            user: [
                '.query-content',
                'user-query .query-text',
                '[class*="query-content"]',
                'message-content[data-author="user"]',
                '.user-message'
            ],
            assistant: [
                '.response-container .markdown',
                'model-response .markdown',
                '[class*="response-container"] .markdown',
                'message-content[data-author="model"]',
                '.model-response-text'
            ],
            title: [
                '.conversation-title',
                'h1.title',
                '[class*="conversation"] [class*="title"]',
                'title'
            ]
        },
        {
            name: 'gemini-legacy',
            container: [
                '.chat-container',
                '[class*="chat"]',
                'main'
            ],
            user: [
                '.query-text',
                '.human-turn .text-content',
                '[data-turn-role="human"]'
            ],
            assistant: [
                '.response-text',
                '.model-turn .text-content',
                '[data-turn-role="model"]'
            ],
            title: ['title']
        },
        {
            name: 'gemini-generic',
            container: ['main'],
            user: [
                '[class*="query"]',
                '[class*="user"]'
            ],
            assistant: [
                '[class*="response"]',
                '[class*="model"]'
            ],
            title: ['title']
        }
    ];

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => StoreChat.init('gemini', STRATEGIES));
    } else {
        setTimeout(() => StoreChat.init('gemini', STRATEGIES), 2000);
    }
})();
