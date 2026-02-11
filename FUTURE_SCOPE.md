# StoreChat — Future Scope

## v2.1 — Near Term

### Multi-format Export
- Export conversations as **Markdown**, **PDF**, or **CSV** in addition to JSON
- Folder-level export (by platform or date range)

### Conversation Viewer
- Full conversation viewer in the popup (click to expand)
- Syntax-highlighted code blocks within conversations
- Copy individual turns to clipboard

### Smart Deduplication
- Content-diff based dedup — detect partial updates to existing conversations
- Merge instead of skip when conversation has grown since last capture

---

## v2.5 — Medium Term

### Additional Platforms
- **Perplexity** (`perplexity.ai`)
- **DeepSeek** (`chat.deepseek.com`)
- **Copilot** (`copilot.microsoft.com`)
- **Mistral** (`chat.mistral.ai`)
- Community-contributed platform adapters via config

### Semantic Search
- Local vector embeddings using TF-IDF or a lightweight model
- Search by concept, not just keyword matching
- "Find similar conversations" feature

### GitHub Integration Enhancements
- Branch selection (sync to non-default branches)
- Commit signing (GPG)
- Repository auto-creation on first sync
- README auto-generation with conversation index
- Conflict resolution for concurrent syncs

---

## v3.0 — Long Term

### Cross-Device Sync
- Use GitHub as the sync backend — pull on new devices
- Merge conflict handling for conversations captured on multiple devices

### Analytics Dashboard
- Usage patterns: conversations per day, platform distribution over time
- Token usage estimation per conversation
- Heatmap of conversation activity

### Privacy Features
- Client-side redaction rules (auto-strip PII before sync)
- Selective sync — choose which conversations to push
- End-to-end encryption of repository contents (encrypted at rest on GitHub)

### Research Tooling (AIML Focus)
- Conversation annotation / tagging system
- Export to HuggingFace Datasets format
- Prompt template extraction from conversation history
- Response quality scoring and comparison across models
- A/B comparison view between model responses

### Browser Support
- Firefox extension port (WebExtension API compatibility)
- Safari extension (Swift bridge)

---

## Architecture Improvements

| Area | Improvement |
|------|-------------|
| **Storage** | Migrate to OPFS (Origin Private File System) for larger storage quota |
| **Compression** | Evaluate Brotli vs gzip for better ratios on text |
| **Networking** | Service Worker fetch with streams for large conversation batches |
| **Test Suite** | Jest/Vitest unit tests for compress, crypto, and storage modules |
| **CI/CD** | GitHub Actions for automated linting, testing, and CRX packaging |
