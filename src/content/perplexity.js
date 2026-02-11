(() => {
    const STRATEGIES = [
        {
            name: 'perplexity-2026',
            container: [
                'main',
                '.col-span-8',
                '[class*="ConversationMessages"]',
                '[class*="thread"]'
            ],
            user: [
                // Perplexity user queries — the question heading
                'h1.font-display',
                '.super.font-sans',
                '[class*="Query"] h1',
                '[class*="query-text"]',
                '.prose h1',
                // Follow-up questions
                '[class*="FollowupQuery"]',
                'textarea[class*="ask"]'
            ],
            assistant: [
                // Perplexity AI answers
                '[class*="Answer"] .prose',
                '[class*="AnswerText"]',
                '.prose.dark\\:prose-invert',
                'div[dir="auto"].markdown',
                '.break-words .markdown',
                '[class*="response"] .prose',
                '.prose:not(h1)',
                '[class*="ResultContent"]'
            ],
            title: [
                'h1.font-display',
                '.super.font-sans',
                'title',
                'h1'
            ]
        },
        {
            name: 'perplexity-generic',
            container: ['main'],
            user: [
                'h1',
                '[class*="query"]',
                '[class*="question"]',
                '[class*="user"]'
            ],
            assistant: [
                '.prose',
                '[class*="answer"]',
                '[class*="response"]',
                '[class*="result"]',
                '.markdown'
            ],
            title: ['title', 'h1']
        }
    ];

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => StoreChat.init('perplexity', STRATEGIES));
    } else {
        setTimeout(() => StoreChat.init('perplexity', STRATEGIES), 2000);
    }
})();
