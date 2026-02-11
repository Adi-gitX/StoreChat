# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2026-02-11

### Added
- **Perplexity AI Support**: Full capturing and archiving capabilities for Perplexity.ai.
- **Heroicons**: Replaced all emoji-based icons with professional SVG Heroicons (v2).
- **Dashboard Redesign**: Complete UI/UX overhaul with premium dark theme, improved typography, and better spacing.
- **GitHub Integration**: Robust sync with rate limiting, exponential backoff, and batching.

### Changed
- **Architecture**: Migrated to a modular structure (`lib/vendor`, `assets/`, `.github/`).
- **Storage**: Implemented indexedDB with Pako gzip compression for 95% storage efficiency.
- **Security**: Hardened token storage with AES-GCM encryption.
- **Documentation**: Professional README with architecture diagrams and technical specs.

### Fixed
- Fixed critical bugs in GitHub sync pipeline.
- Resolved layout shifting in popup during loading states.
- Corrected CSP violations for inline styles.
