# StoreChat — Frequently Asked Questions

Quick answers to common questions about StoreChat.

---

## 🚀 Getting Started

### What is StoreChat?
StoreChat is a free, open-source Chrome extension that automatically backs up your AI conversations from ChatGPT, Claude, Gemini, Grok, and Perplexity to your private GitHub repository.

### Is StoreChat really free?
Yes! 100% free, forever. No premium tiers, no subscriptions, no hidden costs. It's open source under the MIT License.

### Which platforms are supported?
- **ChatGPT** (chatgpt.com)
- **Claude** (claude.ai)
- **Gemini** (gemini.google.com)
- **Grok** (x.com, grok.com)
- **Perplexity** (perplexity.ai)

More platforms coming based on community requests!

### How do I install StoreChat?
1. Clone the repository: `git clone https://github.com/Adi-gitX/StoreChat.git`
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the StoreChat folder
5. Configure with your GitHub token

*(Chrome Web Store listing coming soon for one-click install)*

---

## 🔧 Setup & Configuration

### What is a GitHub Personal Access Token (PAT)?
A PAT is like a password that lets StoreChat push files to your GitHub repository. It's more secure than using your actual password.

### How do I create a GitHub PAT?
1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "StoreChat"
4. Select the `repo` scope (full control of private repositories)
5. Set expiration (recommend "No expiration" for convenience)
6. Click "Generate token"
7. Copy the token immediately (you won't see it again!)

### Why do I need the `repo` scope?
StoreChat needs permission to create and update files in your repository. The `repo` scope allows this for private repos.

### Can I use an existing GitHub repository?
Yes! StoreChat will create files in a structured format. Recommended: create a dedicated repo like `my-ai-archives`.

### What if I don't have a GitHub repository?
Create one:
1. Go to [GitHub](https://github.com/new)
2. Name it (e.g., "ai-conversations")
3. Make it **Private** (recommended)
4. Click "Create repository"
5. Use the repo name in StoreChat settings

---

## 🔐 Privacy & Security

### Is my data private?
Absolutely! 
- Your GitHub PAT is **encrypted** with AES-GCM before storage
- Conversations stored **locally** in your browser until you sync
- Data goes **directly** from your browser to GitHub
- **No intermediary servers** — we never see your data

### Can StoreChat developers access my conversations?
No. Zero access. Your data goes directly from your browser to your GitHub repository. StoreChat is open source — you can audit the code yourself.

### Is my GitHub token safe?
Yes. Your token is encrypted using **AES-GCM** (military-grade encryption) via the Web Crypto API. It's stored encrypted in Chrome's local storage and only decrypted when syncing.

### What if I want to change my GitHub token?
Simply go to Settings in the extension and update it. The old token will be securely replaced.

### Can I use StoreChat at work/school?
Check your organization's policies. Since data goes to **your** GitHub repo and the extension is open source, many organizations allow it. When in doubt, ask your IT department.

---

## 💾 Data Storage & Management

### Where are conversations stored?
1. **Locally**: In your browser's IndexedDB (until synced)
2. **Remotely**: In your private GitHub repository (after syncing)

### What format are conversations stored in?
JSON format, compressed with gzip. Each conversation is a separate file with metadata.

### How much storage do I need?
Very little! Conversations are compressed by **90-95%**. A year of heavy ChatGPT use typically takes less than 100MB.

### Can I export conversations to other formats?
Currently JSON only. Markdown and PDF export are planned for v2.1. Vote on [GitHub Discussions](https://github.com/Adi-gitX/StoreChat/discussions) for features you want!

### What happens if I delete a conversation from ChatGPT?
If you've already synced it, it's safe in your GitHub repo forever. StoreChat captures conversations independently of the platform.

### Can I recover deleted conversations?
If they were synced to GitHub before deletion, yes! Just check your GitHub repository.

---

## ⚙️ Features & Usage

### Does StoreChat work automatically?
Yes! Once configured, it captures conversations in the background. You can manually sync anytime or let it auto-sync (coming soon).

### Can I search my archived conversations?
Currently, you can search within the extension popup. Full-text search and semantic search are planned for future versions.

### Does StoreChat capture conversations in real-time?
Yes, conversations are captured as they happen. You choose when to sync them to GitHub.

### What if I'm in the middle of a conversation?
StoreChat captures the current state. When you continue the conversation later, it will detect changes and update.

### Does this work with ChatGPT Plus/Teams/Enterprise?
Yes! StoreChat works with all ChatGPT tiers, Claude Pro, and premium versions of other platforms.

### Can I backup old conversations?
StoreChat captures conversations as you visit them. For old conversations, simply visit the conversation page and it will be captured.

---

## 🌐 Platform-Specific Questions

### Does StoreChat work on mobile?
Not yet. StoreChat is currently a Chrome extension (desktop only). Mobile support is on the roadmap.

### Will this work on other browsers (Firefox, Safari)?
Not currently. StoreChat is Chrome/Chromium-only. Firefox and Safari ports are planned based on demand.

### Does this work with ChatGPT mobile app conversations?
No, only conversations in the web browser. Mobile app integration would require a different approach.

---

## 🛠️ Troubleshooting

### StoreChat isn't capturing conversations. What's wrong?
1. Make sure the extension is enabled (`chrome://extensions`)
2. Refresh the AI platform page
3. Check browser console for errors (F12 → Console)
4. Report issue on [GitHub](https://github.com/Adi-gitX/StoreChat/issues)

### Sync is failing. What should I do?
1. Verify your GitHub PAT is valid and has `repo` scope
2. Check that your repository exists and the name is correct
3. Ensure you have internet connection
4. Check GitHub status: [githubstatus.com](https://www.githubstatus.com/)
5. Review error message in extension popup

### Why am I seeing "Rate Limited"?
GitHub API has rate limits. StoreChat will auto-retry after the limit resets (usually 1 hour). For heavy usage, consider batch syncing.

### The extension icon doesn't appear in my toolbar.
Pin it: Click the puzzle piece icon in Chrome toolbar → Pin StoreChat

### Conversations are duplicated in my GitHub repo.
This shouldn't happen due to SHA-256 deduplication. If it does, please report this bug with details.

---

## 🤝 Contributing & Community

### How can I contribute?
- **Code**: Submit PRs on [GitHub](https://github.com/Adi-gitX/StoreChat)
- **Bug reports**: Open issues
- **Feature requests**: Start a discussion
- **Documentation**: Improve docs
- **Spread the word**: Star the repo, share on social media

### I found a bug. Where do I report it?
[GitHub Issues](https://github.com/Adi-gitX/StoreChat/issues) — Please include:
- Chrome version
- Extension version
- Steps to reproduce
- Error messages (if any)
- Screenshots (if relevant)

### Can I request a feature?
Absolutely! Use [GitHub Discussions](https://github.com/Adi-gitX/StoreChat/discussions) to propose features. Popular requests get prioritized.

### How can I support the project?
- ⭐ Star the repository
- 🐦 Share on social media
- 📝 Write a blog post or tutorial
- 🤝 Contribute code or docs
- 💬 Help answer questions in Discussions

### Is there a Discord/community chat?
Not yet. Once we reach 500+ GitHub stars, we'll create a Discord server. For now, use GitHub Discussions.

---

## 🔮 Future Plans

### What features are coming next?
Check the [FUTURE_SCOPE.md](FUTURE_SCOPE.md) document for the full roadmap. Highlights:
- Markdown/PDF export
- Semantic search
- Mobile support
- More platforms (DeepSeek, Copilot, Mistral)
- Analytics dashboard
- Cross-device sync

### When will StoreChat be on the Chrome Web Store?
We're preparing the listing now. Target: within 2-4 weeks. Follow the repo for updates!

### Will there ever be a paid version?
Current plan: Keep 100% of features free forever. Possible future: optional GitHub Sponsors for sustainability, but no paywalled features.

---

## 📊 Technical Questions

### How does StoreChat capture conversations?
Using DOM mutation observers to detect conversation changes, then extracting content via platform-specific selectors. Zero impact on platform performance.

### How is compression achieved?
Using the Pako library for gzip compression. Typical 90-95% size reduction on text-heavy conversations.

### What encryption algorithm is used?
AES-GCM (256-bit) via the Web Crypto API for encrypting your GitHub token.

### Does StoreChat slow down my browser?
No. Lightweight background operation with minimal CPU/memory usage. Designed for efficiency.

### How does deduplication work?
SHA-256 hashing of conversation content. Identical conversations are automatically skipped during sync.

### What's the GitHub API rate limit?
5,000 requests/hour for authenticated users. StoreChat batches commits (up to 20 files per commit) to minimize API usage.

---

## 📱 Comparison Questions

### How is this different from ChatGPT's "Export data" feature?
| Feature | StoreChat | ChatGPT Export |
|---------|-----------|----------------|
| Automatic | ✅ Real-time | ❌ Manual |
| Multi-platform | ✅ 5 platforms | ❌ ChatGPT only |
| Compression | ✅ 95% smaller | ❌ No compression |
| Version control | ✅ Git history | ❌ One-time download |
| Privacy | ✅ Your GitHub | ✅ Download to device |

### Are there other similar extensions?
There are ChatGPT-specific exporters, but StoreChat is unique in:
- Supporting 5 platforms (not just ChatGPT)
- GitHub integration with version control
- Automatic compression and deduplication
- Privacy-first, open-source architecture

### Why use GitHub instead of Google Drive/Dropbox?
- **Free**: Unlimited private repos
- **Version control**: Track changes over time
- **Developer-friendly**: Already use it
- **Future-proof**: Plain JSON files
- **API**: Easy automation
- **No vendor lock-in**: Export anytime

---

## 💡 Use Cases

### Who is StoreChat for?
- **Developers**: Reference past debugging sessions, code snippets
- **Researchers**: Maintain searchable archive for papers
- **Students**: Preserve study materials and explanations
- **Writers**: Archive creative brainstorming sessions
- **Professionals**: Protect intellectual property
- **Anyone**: Never lose important conversations!

### Can teams use StoreChat?
Individual use only currently. Team features (shared repositories, collaboration) are on the long-term roadmap.

---

## 🆘 Still Have Questions?

- 📖 **Documentation**: [GitHub Wiki](https://github.com/Adi-gitX/StoreChat/wiki)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Adi-gitX/StoreChat/discussions)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Adi-gitX/StoreChat/issues)
- 📧 **Email**: [Create an issue for urgent matters]

---

<div align="center">

**Can't find your answer?**  
[Ask on GitHub Discussions →](https://github.com/Adi-gitX/StoreChat/discussions)

**Found this helpful?**  
⭐ [Star the repository](https://github.com/Adi-gitX/StoreChat) to show your support!

</div>
