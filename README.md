# StoreChat — LLM Chat Archive Chrome Extension

> Automatically capture, compress, and sync your AI conversations from ChatGPT, Gemini, Grok, and Claude to GitHub.

![StoreChat](popup/icons/icon128.png)

## Features

- **🔄 Auto-Capture** — MutationObserver-based real-time detection of new messages on 4 LLM platforms
- **🗜️ Gzip Compression** — Pako-based compression achieving 90-98% size reduction
- **🔀 SHA-256 Deduplication** — Content hashing prevents re-saving the same conversation
- **📦 GitHub Batch Sync** — GraphQL API pushes up to 20 files per commit for efficiency
- **🔐 Encrypted Token Storage** — AES-GCM encryption for GitHub PAT via Web Crypto API
- **🔁 Auto-Retry** — Exponential backoff on network failures (up to 5 retries)
- **🔍 Search** — Find conversations by title or platform
- **🎨 Premium Dark UI** — Beautiful popup dashboard and settings page

## Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| ChatGPT | `chatgpt.com` / `chat.openai.com` | ✅ |
| Gemini | `gemini.google.com` | ✅ |
| Grok | `grok.com` / `x.com/i/grok` | ✅ |
| Claude | `claude.ai` | ✅ |

## Installation

1. **Clone this repo:**
   ```bash
   git clone https://github.com/<your-username>/storeChat.git
   ```

2. **Load in Chrome:**
   - Open `chrome://extensions`
   - Enable **Developer Mode** (top-right toggle)
   - Click **Load unpacked** → select the `storeChat/` directory

3. **Configure GitHub:**
   - Click the StoreChat icon → Settings ⚙️
   - Enter your [GitHub PAT](https://github.com/settings/tokens/new?scopes=repo&description=StoreChat) (needs `repo` scope)
   - Enter your repository owner and name (e.g., `your-username` / `llm-chat-archive`)
   - Click **Test Connection** to verify

4. **Create your archive repo:**
   ```bash
   # Create a new GitHub repo for your chat archives
   gh repo create llm-chat-archive --private --description "My LLM conversation archive"
   ```

## How It Works

```
LLM Web Page → Content Script (MutationObserver)
    → Extract conversation turns
    → SHA-256 dedup check
    → Pako gzip compress (~95% reduction)
    → IndexedDB local storage
    → GitHub GraphQL batch push (20 files/commit)
```

### Architecture

```
storeChat/
├── manifest.json          # Manifest V3 config
├── background.js          # Service worker orchestrator
├── content/
│   ├── common.js          # Universal extractor + multi-strategy selectors
│   ├── chatgpt.js         # ChatGPT-specific selectors
│   ├── gemini.js          # Gemini-specific selectors
│   ├── grok.js            # Grok-specific selectors (URL-gated)
│   └── claude.js          # Claude-specific selectors
├── lib/
│   ├── compress.js        # Pako gzip wrapper
│   ├── pako.min.js        # Vendored pako 2.x
│   ├── storage.js         # IndexedDB with dedup + search
│   ├── github.js          # GraphQL API + retry
│   └── crypto.js          # AES-GCM token encryption
├── popup/
│   ├── popup.html/css/js  # Dashboard UI
│   └── icons/             # Extension icons
└── options/
    └── options.html/css/js # Settings page
```

### GitHub Repo Structure

Your archive repo will look like:
```
llm-chat-archive/
├── chatgpt/
│   ├── 2026-02-10/
│   │   ├── conv-abc123.json.gz
│   │   └── conv-def456.json.gz
│   └── 2026-02-11/
│       └── ...
├── gemini/
│   └── ...
├── grok/
│   └── ...
└── claude/
    └── ...
```

### Conversation Schema

Each `.json.gz` file decompresses to:
```json
{
  "platform": "chatgpt",
  "conversationId": "abc-123",
  "title": "Help with Python sorting",
  "timestamp": "2026-02-10T13:00:00Z",
  "url": "https://chatgpt.com/c/abc-123",
  "turns": [
    {
      "role": "user",
      "content": "How do I sort a list in Python?",
      "timestamp": "2026-02-10T13:00:01Z"
    },
    {
      "role": "assistant",
      "content": "You can use `list.sort()` for in-place sorting...",
      "timestamp": "2026-02-10T13:00:05Z"
    }
  ]
}
```

## Usage

- **Auto-capture**: Just browse ChatGPT/Gemini/Grok/Claude — conversations are captured automatically
- **Manual capture**: Click the extension icon → **Capture Now**
- **Sync**: Click **Sync to GitHub** or let auto-sync handle it (default: every 30 minutes)
- **Search**: Use the search bar in the popup to find past conversations
- **Settings**: Configure platforms, sync frequency, and GitHub credentials

## Technical Highlights

| Feature | Implementation |
|---------|---------------|
| Compression | Pako gzip (25KB, zero WASM deps) |
| Deduplication | SHA-256 content hash via Web Crypto |
| GitHub API | GraphQL `createCommitOnBranch` (batch) |
| Token Storage | AES-GCM encrypted in chrome.storage |
| Retry Logic | Exponential backoff (2s → 32s, 5 max) |
| Selectors | Multi-strategy fallback per platform |
| Local Storage | IndexedDB with sync queue tracking |

## License

MIT
