

const StoreChatGitHub = {
    API_BASE: 'https://api.github.com',
    GRAPHQL_URL: 'https://api.github.com/graphql',
    _rateLimit: { remaining: 100, resetAt: 0, retryAfter: 0, lastChecked: 0 },
    _batchSize: 5,
    _consecutiveFailures: 0,

    async getConfig() {
        const token = await StoreChatCrypto.retrieveToken();
        return new Promise((resolve) => {
            chrome.storage.local.get(['github_owner', 'github_repo'], (result) => {
                resolve({
                    token: token || '',
                    owner: result.github_owner || '',
                    repo: result.github_repo || ''
                });
            });
        });
    },

    async saveConfig(config) {
        if (config.token) {
            await StoreChatCrypto.storeToken(config.token);
        }
        return new Promise((resolve) => {
            chrome.storage.local.set({
                github_owner: config.owner,
                github_repo: config.repo
            }, resolve);
        });
    },

    async validateToken() {
        const config = await this.getConfig();
        if (!config.token) return { valid: false, error: 'No token configured' };

        try {
            const response = await fetch(`${this.API_BASE}/user`, {
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            this._updateRateLimit(response);

            if (response.ok) {
                const user = await response.json();
                const scopes = response.headers.get('X-OAuth-Scopes') || '';
                const hasRepoScope = scopes.includes('repo');


                if (hasRepoScope) {
                    const repoCheck = await this.validateRepo(config);
                    if (!repoCheck.valid) {
                        return { valid: true, user: user.login, scopes, hasRepoScope, repoError: repoCheck.error };
                    }
                }

                return { valid: true, user: user.login, scopes, hasRepoScope };
            }
            return { valid: false, error: `HTTP ${response.status}` };
        } catch (err) {
            return { valid: false, error: err.message };
        }
    },

    async validateRepo(config) {
        if (!config.owner || !config.repo) return { valid: true };

        try {
            const response = await fetch(`${this.API_BASE}/repos/${config.owner}/${config.repo}`, {
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.status === 404) {
                return { valid: false, error: `Repository ${config.owner}/${config.repo} not found` };
            }

            if (response.ok) {
                const data = await response.json();
                if (!data.permissions?.push) {
                    return { valid: false, error: `No write access to ${config.owner}/${config.repo}` };
                }
                return { valid: true };
            }

            return { valid: false, error: `Repo check failed: HTTP ${response.status}` };
        } catch (err) {
            return { valid: false, error: `Repo check failed: ${err.message}` };
        }
    },

    _updateRateLimit(response) {
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = response.headers.get('X-RateLimit-Reset');
        const retryAfter = response.headers.get('Retry-After');

        if (remaining !== null) {
            this._rateLimit.remaining = parseInt(remaining, 10);
        }
        if (reset !== null) {
            this._rateLimit.resetAt = parseInt(reset, 10);
        }
        if (retryAfter !== null) {
            this._rateLimit.retryAfter = parseInt(retryAfter, 10);
        }
        this._rateLimit.lastChecked = Date.now();
    },

    getRateLimitStatus() {
        const now = Math.floor(Date.now() / 1000);

        if (this._rateLimit.retryAfter > 0) {
            const waitMs = this._rateLimit.retryAfter * 1000;
            return { limited: true, waitMs, remaining: 0 };
        }

        if (this._rateLimit.remaining <= 5) {
            const waitMs = Math.max(0, (this._rateLimit.resetAt - now) * 1000);
            if (waitMs > 0) {
                return { limited: true, waitMs, remaining: this._rateLimit.remaining };
            }
        }

        return {
            limited: false,
            waitMs: 0,
            remaining: this._rateLimit.remaining
        };
    },

    async _waitIfRateLimited() {
        const status = this.getRateLimitStatus();
        if (!status.limited) return false;

        const waitMs = Math.min(status.waitMs, 5 * 60 * 1000);
        if (waitMs > 0) {
            await new Promise(r => setTimeout(r, waitMs));
        }

        this._rateLimit.retryAfter = 0;
        return true;
    },

    getCurrentBatchSize() {
        return this._batchSize;
    },

    _onSyncSuccess() {
        this._consecutiveFailures = 0;
        this._batchSize = Math.min(20, this._batchSize + 5);
    },

    _onSyncFailure() {
        this._consecutiveFailures++;
        this._batchSize = Math.max(1, Math.floor(this._batchSize / 2));
    },

    async getBranchInfo() {
        const config = await this.getConfig();
        const query = `query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        defaultBranchRef {
          name
          target { oid }
        }
      }
    }`;

        const response = await this._graphql(config.token, query, {
            owner: config.owner,
            repo: config.repo
        });

        const ref = response.data.repository.defaultBranchRef;

        if (!ref) {
            await this._initializeEmptyRepo(config);
            const retryResponse = await this._graphql(config.token, query, {
                owner: config.owner,
                repo: config.repo
            });
            const retryRef = retryResponse.data.repository.defaultBranchRef;
            if (!retryRef) {
                throw new Error('Repository could not be initialized. Please add an initial commit.');
            }
            return { branch: retryRef.name, oid: retryRef.target.oid };
        }

        return { branch: ref.name, oid: ref.target.oid };
    },

    async _initializeEmptyRepo(config) {
        const response = await fetch(
            `${this.API_BASE}/repos/${config.owner}/${config.repo}/contents/README.md`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Initialize StoreChat repository',
                    content: btoa('# StoreChat Archive\n\nThis repository stores your AI conversation history, compressed and organized by platform.\n')
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to initialize repository: HTTP ${response.status}`);
        }
    },

    async pushBatch(files, commitMessage) {
        const config = await this.getConfig();
        if (!config.token || !config.owner || !config.repo) {
            return { success: false, error: 'GitHub not configured' };
        }

        await this._waitIfRateLimited();

        try {
            const branchInfo = await this.getBranchInfo();

            const mutation = `mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit {
            oid
            url
          }
        }
      }`;

            const fileChanges = files.map(f => ({
                path: f.path,
                contents: f.base64Content
            }));

            const variables = {
                input: {
                    branch: {
                        repositoryNameWithOwner: `${config.owner}/${config.repo}`,
                        branchName: branchInfo.branch
                    },
                    message: { headline: commitMessage },
                    fileChanges: { additions: fileChanges },
                    expectedHeadOid: branchInfo.oid
                }
            };

            const response = await this._graphql(config.token, mutation, variables);

            if (response.data?.createCommitOnBranch?.commit) {
                const commit = response.data.createCommitOnBranch.commit;
                this._onSyncSuccess();
                return { success: true, commitUrl: commit.url, commitOid: commit.oid };
            }

            const errors = response.errors?.map(e => e.message).join(', ') || 'Unknown error';
            this._onSyncFailure();
            return { success: false, error: errors };
        } catch (err) {
            this._onSyncFailure();
            return { success: false, error: err.message };
        }
    },

    async pushFile(path, base64Content, commitMessage) {
        return this.pushBatch([{ path, base64Content }], commitMessage);
    },

    async _graphql(token, query, variables) {
        const response = await fetch(this.GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, variables })
        });

        this._updateRateLimit(response);

        if (response.status === 403 || response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            if (retryAfter) {
                this._rateLimit.retryAfter = parseInt(retryAfter, 10);
            }
            await response.text();
            throw new Error(`Rate limited (${response.status})`);
        }

        if (!response.ok) {
            await response.text();
            throw new Error(`GraphQL request failed (${response.status})`);
        }

        return response.json();
    },

    async pushWithRetry(files, commitMessage, attempt = 1) {
        const MAX_RETRIES = 5;

        try {
            const result = await this.pushBatch(files, commitMessage);

            if (result.success) return result;


            if (result.error?.includes('Rate limited')) {
                if (attempt < MAX_RETRIES) {
                    await this._waitIfRateLimited();
                    return this.pushWithRetry(files, commitMessage, attempt + 1);
                }
            }


            if (result.error?.includes('422') || result.error?.includes('expectedHeadOid')) {
                if (attempt < MAX_RETRIES) {
                    const backoff = Math.pow(2, attempt) * 1000;
                    await new Promise(r => setTimeout(r, backoff));
                    return this.pushWithRetry(files, commitMessage, attempt + 1);
                }
            }

            return result;
        } catch (err) {
            if (attempt < MAX_RETRIES) {
                const backoff = Math.pow(2, attempt) * 1000;
                await new Promise(r => setTimeout(r, backoff));
                return this.pushWithRetry(files, commitMessage, attempt + 1);
            }
            return { success: false, error: `Max retries exceeded` };
        }
    },

    getFilePath(platform, conversationId, timestamp, title, ext = '.md') {
        const date = timestamp ? timestamp.split('T')[0] : new Date().toISOString().split('T')[0];

        let slug = (title || conversationId)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 60);
        if (!slug) slug = conversationId.replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${platform}/${date}/${slug}${ext}`;
    },

    formatAsMarkdown(conversation) {
        const lines = [];
        const title = conversation.title || 'Untitled Conversation';
        const date = conversation.timestamp ? new Date(conversation.timestamp).toLocaleString() : 'Unknown';
        const platform = (conversation.platform || 'unknown').toUpperCase();
        const turnCount = conversation.turns?.length || 0;


        lines.push(`# ${title}`);
        lines.push('');
        lines.push(`> **Platform:** ${platform} | **Date:** ${date} | **Turns:** ${turnCount}`);
        if (conversation.url) {
            lines.push(`> **Source:** [Open Original](${conversation.url})`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');


        if (conversation.turns && Array.isArray(conversation.turns)) {
            for (let i = 0; i < conversation.turns.length; i++) {
                const turn = conversation.turns[i];
                const roleLabel = turn.role === 'user' ? 'USER' : 'ASSISTANT';

                lines.push(`## ${roleLabel}`);
                lines.push('');
                lines.push(turn.content || '*(empty)*');
                lines.push('');

                if (i < conversation.turns.length - 1) {
                    lines.push('---');
                    lines.push('');
                }
            }
        }

        ;
        lines.push('');
        lines.push('---');
        lines.push(`*Archived by [StoreChat](https://github.com/Adi-gitX/StoreChat) on ${new Date().toISOString().split('T')[0]}*`);
        lines.push('');

        return lines.join('\n');
    },

    async syncAll(onProgress) {
        const result = { synced: 0, failed: 0, errors: [], rateLimited: false };

        const rlStatus = this.getRateLimitStatus();
        if (rlStatus.limited) {
            result.rateLimited = true;
            result.errors.push(`Rate limited — resets in ${Math.ceil(rlStatus.waitMs / 1000)}s`);

            const resetMinutes = Math.ceil(rlStatus.waitMs / 60000) + 1;
            chrome.alarms.create('rateLimitRetry', { delayInMinutes: resetMinutes });
            return result;
        }

        const validation = await this.validateToken();
        if (!validation.valid) {
            result.errors.push(`Token invalid: ${validation.error}`);
            return result;
        }

        if (!validation.hasRepoScope) {
            result.errors.push('Token missing "repo" scope — cannot push to repository');
            return result;
        }

        const unsyncedIds = await StoreChatDB.getUnsyncedIds();
        const total = unsyncedIds.length;

        if (total === 0) return result;


        const batchSize = this.getCurrentBatchSize();

        for (let i = 0; i < unsyncedIds.length; i += batchSize) {
            const midStatus = this.getRateLimitStatus();
            if (midStatus.limited) {
                result.rateLimited = true;
                result.errors.push('Paused — rate limit approaching');
                const resetMinutes = Math.ceil(midStatus.waitMs / 60000) + 1;
                chrome.alarms.create('rateLimitRetry', { delayInMinutes: resetMinutes });
                break;
            }

            const batchIds = unsyncedIds.slice(i, i + batchSize);
            const files = [];
            const batchConversations = [];

            for (const id of batchIds) {
                try {
                    const conversation = await StoreChatDB.get(id);
                    if (!conversation || !conversation.compressedData) continue;


                    let decompressed;
                    try {
                        decompressed = StoreChatCompress.decompress(conversation.compressedData);
                    } catch {
                        decompressed = { turns: [], title: conversation.title };
                    }


                    const mdPath = this.getFilePath(
                        conversation.platform,
                        conversation.id,
                        conversation.timestamp,
                        conversation.title || decompressed.title,
                        '.md'
                    );
                    const mdContent = this.formatAsMarkdown({
                        ...conversation,
                        turns: decompressed.turns
                    });

                    const mdBase64 = btoa(unescape(encodeURIComponent(mdContent)));


                    const gzPath = this.getFilePath(
                        conversation.platform,
                        conversation.id,
                        conversation.timestamp,
                        conversation.title || decompressed.title,
                        '.json.gz'
                    ).replace(/\/([^/]+)$/, '/.data/$1');
                    const gzBase64 = StoreChatCompress.toBase64(conversation.compressedData);

                    files.push({ path: mdPath, base64Content: mdBase64 });
                    files.push({ path: gzPath, base64Content: gzBase64 });
                    batchConversations.push(conversation);
                } catch {
                    result.failed++;
                }
            }

            if (files.length === 0) continue;

            const commitMsg = files.length === 1
                ? `CONFIRMED ${batchConversations[0].platform}: ${batchConversations[0].title}`
                : `SYNC ${files.length} conversations (${[...new Set(batchConversations.map(c => c.platform))].join(', ')})`;

            const pushResult = await this.pushWithRetry(files, commitMsg);

            if (pushResult.success) {
                for (const conv of batchConversations) {
                    await StoreChatDB.markSynced(conv.id);
                    result.synced++;
                }
            } else {
                result.failed += files.length;
                result.errors.push(pushResult.error);


                if (pushResult.error?.includes('Rate limited')) {
                    result.rateLimited = true;
                    break;
                }
            }

            if (onProgress) {
                onProgress({
                    synced: result.synced,
                    failed: result.failed,
                    total,
                    rateLimited: result.rateLimited
                });
            }

            if (i + batchSize < unsyncedIds.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }


        chrome.storage.local.set({ lastSyncTime: new Date().toISOString() });

        return result;
    }
};

if (typeof globalThis !== 'undefined') {
    globalThis.StoreChatGitHub = StoreChatGitHub;
}
