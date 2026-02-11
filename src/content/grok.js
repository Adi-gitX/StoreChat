



(() => {

    const isGrokPage = () => {
        const url = window.location.href;
        return url.includes('grok.com') ||
            url.includes('x.com/i/grok') ||
            url.includes('twitter.com/i/grok');
    };

    if (!isGrokPage()) {
        return;
    }

    const STRATEGIES = [
        {
            name: 'grok-2026',
            container: [
                '[class*="conversation"]',
                '[class*="chat-container"]',
                'main [role="main"]',
                'main'
            ],
            user: [
                '[class*="user-message"]',
                '[data-testid*="user"] [class*="message"]',
                'div[class*="human"]',
                '[class*="message-row"]:has([class*="user"]) [class*="content"]'
            ],
            assistant: [
                '[class*="grok-message"]',
                '[data-testid*="grok"] [class*="message"]',
                'div[class*="assistant"]',
                '[class*="message-row"]:has([class*="grok"]) [class*="content"]'
            ],
            title: [
                '[class*="conversation-title"]',
                'h1',
                'title'
            ]
        },
        {
            name: 'grok-legacy',
            container: [
                '[role="main"]',
                'main'
            ],
            user: [
                '[class*="tweetText"]:has(+ [class*="grok"])',
                'div[dir="ltr"][class*="user"]'
            ],
            assistant: [
                '[class*="grok"][class*="response"]',
                '[class*="markdown"][class*="grok"]'
            ],
            title: ['title']
        },
        {
            name: 'grok-generic',
            container: ['main', '[role="main"]'],
            user: [
                'div[class*="message"]:nth-child(odd)',
                '[class*="prompt"]'
            ],
            assistant: [
                'div[class*="message"]:nth-child(even)',
                '[class*="response"]'
            ],
            title: ['title']
        }
    ];

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => StoreChat.init('grok', STRATEGIES));
    } else {
        setTimeout(() => StoreChat.init('grok', STRATEGIES), 2000);
    }
})();
