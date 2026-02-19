# StoreChat — Copilot Coding Agent Instructions

## Repository Overview

StoreChat is a Chrome browser extension (Manifest V3) that automatically captures, compresses, and synchronizes AI conversations from ChatGPT, Claude, Gemini, Grok, and Perplexity to a private GitHub repository. It's built with vanilla JavaScript (no frameworks), emphasizing privacy-first architecture, local-first storage, and efficient data compression.

**Type**: Browser Extension (Chrome MV3)  
**Languages**: JavaScript (ES6+), HTML, CSS  
**Runtime**: Chrome Extension APIs, Web Crypto API  
**Storage**: IndexedDB, Chrome Storage Local  
**Build System**: No transpilation/bundling required for core functionality  
**Testing**: Vitest (unit), Puppeteer (e2e)

## Build & Test Commands

### Installing Dependencies
```bash
npm install
```
**Always run `npm install` after cloning** or when dependencies are updated in `package.json`.

### Running Tests
```bash
# Run unit tests (Vitest)
npm test

# Run tests in watch mode
npm run test:watch

# Run e2e tests (requires GITHUB_TOKEN)
npm run test:e2e

# Run all tests
npm run test:all
```

**Note**: Some unit tests in `test/unit/storage.test.js` currently fail due to mock configuration issues. These are known issues and do not indicate broken functionality. Focus on ensuring your changes don't introduce new failures.

### Loading the Extension for Testing
1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `StoreChat` directory

**There is no build step** — the extension runs directly from source files.

### End-to-End Testing
The repository includes pipeline verification scripts:
- `scripts/verify-full-pipeline.js` — Tests full conversation capture → compress → GitHub push → download → verify cycle
- `scripts/verify-github-sync.js` — Tests GitHub GraphQL API integration

These require environment variables:
```bash
GITHUB_TOKEN=ghp_xxx node scripts/verify-full-pipeline.js
```

## Project Architecture

### Directory Structure
```
StoreChat/
├── manifest.json           # Extension manifest (MV3 config)
├── background.js           # Service Worker - orchestrates sync, alarms, message routing
├── content/                # Platform-specific conversation extractors
│   ├── common.js           # Core extraction logic & utilities
│   ├── chatgpt.js          # ChatGPT DOM scraper
│   ├── claude.js           # Claude AI scraper
│   ├── gemini.js           # Google Gemini scraper
│   ├── grok.js             # Grok (X.com) scraper
│   └── perplexity.js       # Perplexity AI scraper
├── lib/                    # Core libraries
│   ├── crypto.js           # AES-GCM encryption for GitHub tokens
│   ├── compress.js         # Gzip compression (pako wrapper)
│   ├── storage.js          # IndexedDB wrapper (StoreChatDB)
│   ├── github.js           # GitHub GraphQL API client
│   ├── scraper.js          # DOM utilities
│   └── pako.min.js         # Third-party compression library
├── popup/                  # Extension popup UI
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   └── icons/
├── options/                # Settings/configuration pages
│   ├── options.html        # Main settings page
│   ├── setup.html          # First-time setup wizard
│   └── *.js, *.css
├── dashboard/              # Conversation viewer/manager
│   └── index.html, dashboard.js, dashboard.css
├── test/                   # Test suites
│   ├── unit/               # Vitest unit tests
│   ├── integration/        # Integration tests
│   └── setup.js            # Test environment setup
└── scripts/                # Verification/validation scripts
```

### Key Components

**Content Scripts** (`content/*.js`):
- Injected into AI platform pages
- Use `MutationObserver` to detect conversation changes
- Extract conversations using platform-specific DOM selectors
- Send extracted data to background service worker

**Background Service Worker** (`background.js`):
- Singleton pattern, stateless by design
- Handles message routing between content scripts, popup, and options pages
- Manages auto-sync alarms and cleanup schedules
- Validates sender origins for security
- Orchestrates GitHub sync operations

**Storage Engine** (`lib/storage.js`):
- `StoreChatDB` global object
- Wraps `chrome.storage.local`
- Stores conversations as compressed JSON blobs
- Key format: `conv-{conversationId}`
- Includes cleanup logic for old synced conversations

**GitHub Sync** (`lib/github.js`):
- `StoreChatGitHub` class
- Uses GitHub GraphQL API (not REST)
- Adaptive batch syncing (1-20 files per commit)
- Respects rate limits with exponential backoff
- Stores files as: `{platform}/{YYYY-MM-DD}/{conversationId}.json.gz`
- Includes markdown preview: `{platform}/{YYYY-MM-DD}/{conversationId}.md`

## Code Standards & Conventions

### JavaScript Style
- **ES6+ syntax required** (classes, arrow functions, async/await, template literals)
- **No frameworks** — Vanilla JS only (no React/Vue/Angular)
- **No build step** — Code must run natively in Chrome (no JSX, no TypeScript compilation)
- Use descriptive variable names: `conversationId`, `compressedData`, not `cid`, `cd`
- Prefer `const` over `let`; avoid `var`

### Security Best Practices
- **Never commit API keys or tokens**
- All user tokens are encrypted at rest using AES-GCM (Web Crypto API)
- Validate all message senders in `background.js` using `isValidSender()`
- Sanitize user input before storage or DOM insertion
- Use `textContent` instead of `innerHTML` when displaying user data

### Error Handling
- Always wrap async operations in try/catch
- Log errors with context: `console.error('[StoreChatDB] Failed to save:', error)`
- Show user-friendly error messages in UI (not raw stack traces)

### CSS
- Use CSS custom properties (variables) defined in `:root`
- Follow existing naming conventions (e.g., `.card`, `.button-primary`)
- Avoid inline styles
- Maintain dark/light theme support where applicable

## Common Pitfalls & Known Issues

### DOM Selector Fragility
Content scripts rely on platform-specific CSS selectors that **frequently break** when AI platforms update their UI. When a platform scraper stops working:
1. Inspect the platform's current DOM structure
2. Update selectors in the corresponding `content/{platform}.js` file
3. Test extraction in the live platform
4. Consider adding fallback selectors

### Chrome Storage Quota
`chrome.storage.local` has a ~5MB soft quota. Large conversation archives hit this limit:
- The extension includes auto-cleanup of synced conversations (default: 30 days)
- Users can configure retention in options page
- Future work includes migration to IndexedDB for unlimited storage

### Service Worker Lifecycle
Chrome may terminate the background service worker at any time:
- Avoid storing state in global variables
- Use `chrome.storage` or alarms for persistence
- Keep message handlers lightweight

### Test Failures
Current known test failures in `test/unit/storage.test.js`:
- `should save conversation and compress data` — Mock timing issue
- `should cleanup old conversations` — Mock implementation incomplete

**These do NOT indicate broken code**. When making changes:
- Run tests before and after your changes
- Only address test failures if they're **new** and caused by your changes
- Don't spend time fixing pre-existing test issues unless explicitly asked

## Validation Checklist

Before submitting changes, verify:

1. **No build errors** — Extension should load in `chrome://extensions` without errors
2. **Manual testing** — Load extension and test affected functionality in browser
3. **Tests pass** — Run `npm test` and ensure no new failures introduced
4. **No secrets** — Check `git diff` for accidentally committed tokens/keys
5. **Code style** — Follows existing conventions (ES6+, no frameworks, descriptive names)
6. **Error handling** — All async operations have try/catch blocks
7. **Security** — Input is validated, output is sanitized

## Additional Notes

- The extension is **production-ready** but actively evolving
- See `FUTURE_SCOPE.md` for planned features (don't implement these unless asked)
- See `adddev.md` for deep technical analysis and architectural insights
- When in doubt about a platform's scraping logic, refer to `content/common.js` for shared utilities
- GitHub sync uses GraphQL mutations — see `lib/github.js` for query structure

**Trust these instructions first**. Only search the codebase if information here is incomplete or appears incorrect.
