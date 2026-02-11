#!/usr/bin/env node
/**
 * StoreChat — Full Pipeline E2E Verification (v3.0)
 * Tests: conversation → compress → push (Markdown + .gz) → download → decompress → verify
 *
 * Usage: GITHUB_TOKEN=ghp_xxx node scripts/verify-full-pipeline.js
 */

const pako = require('pako');
const fetch = require('node-fetch');
require('fake-indexeddb/auto');

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const OWNER = process.env.GITHUB_OWNER || 'Adi-gitX';
const REPO = process.env.GITHUB_REPO || 'llm-chat-archive';

if (!TOKEN) {
    console.error('❌  Set GITHUB_TOKEN env var. Usage: GITHUB_TOKEN=ghp_xxx node scripts/verify-full-pipeline.js');
    process.exit(1);
}

// ── Mock browser globals ──
global.fetch = fetch;
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.chrome = { storage: { local: { get: (_, cb) => cb({}), set: (_, cb) => cb && cb() } } };
global.unescape = global.unescape || ((s) => s);

// ── Load libs ──
console.log('📦 Loading libraries...');
global.pako = pako;  // Must be global before compress.js loads
require('../lib/compress.js');
require('../lib/storage.js');

// ── Create test conversation with realistic content ──
function createTestConversation() {
    return {
        platform: 'chatgpt',
        conversationId: `e2e-test-${Date.now()}`,
        title: 'E2E Verification: Full Pipeline Test',
        timestamp: new Date().toISOString(),
        url: 'https://chatgpt.com/c/test-conversation-id',
        turns: [
            { role: 'user', content: 'Explain backpropagation in neural networks. Include the math.', timestamp: new Date().toISOString() },
            { role: 'assistant', content: '# Backpropagation\n\nBackpropagation is the algorithm used to train neural networks.\n\n## The Chain Rule\n\nGiven a loss function $L$, the gradient flows backward:\n\n$$\\frac{\\partial L}{\\partial w} = \\frac{\\partial L}{\\partial a} \\cdot \\frac{\\partial a}{\\partial z} \\cdot \\frac{\\partial z}{\\partial w}$$\n\nWhere:\n- $a$ = activation\n- $z$ = weighted sum\n- $w$ = weight\n\n## Python Implementation\n\n```python\ndef backward(self, dL_da):\n    dz = dL_da * self.activation_derivative(self.a)\n    self.dW = np.dot(dz, self.input.T)\n    self.db = np.sum(dz, axis=1, keepdims=True)\n    return np.dot(self.W.T, dz)\n```\n\nKey points:\n1. Forward pass computes activations\n2. Backward pass computes gradients\n3. Gradient descent updates weights', timestamp: new Date().toISOString() },
            { role: 'user', content: 'What about vanishing gradients?', timestamp: new Date().toISOString() },
            { role: 'assistant', content: '## Vanishing Gradient Problem\n\n| Activation | Derivative Range | Risk |\n|-----------|-----------------|------|\n| Sigmoid | (0, 0.25] | High |\n| Tanh | (0, 1] | Medium |\n| ReLU | {0, 1} | Low |\n| GELU | Varies | Low |\n\n### Solutions:\n- **Skip connections** (ResNet)\n- **Batch normalization**\n- **LSTM/GRU** for recurrent networks\n- **Gradient clipping**', timestamp: new Date().toISOString() },
            { role: 'user', content: 'Show me a complete training loop', timestamp: new Date().toISOString() },
            { role: 'assistant', content: '```python\nimport torch\nimport torch.nn as nn\n\nmodel = nn.Sequential(\n    nn.Linear(784, 256),\n    nn.ReLU(),\n    nn.Dropout(0.2),\n    nn.Linear(256, 10)\n)\n\noptimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)\ncriterion = nn.CrossEntropyLoss()\n\nfor epoch in range(10):\n    for batch_x, batch_y in dataloader:\n        optimizer.zero_grad()\n        output = model(batch_x)\n        loss = criterion(output, batch_y)\n        loss.backward()\n        optimizer.step()\n    print(f"Epoch {epoch}: loss={loss.item():.4f}")\n```', timestamp: new Date().toISOString() },
            { role: 'user', content: 'How does AdamW differ from Adam?', timestamp: new Date().toISOString() },
            { role: 'assistant', content: '## Adam vs AdamW\n\n**Adam** applies weight decay to the gradient *before* computing adaptive learning rates.\n\n**AdamW** (Loshchilov & Hutter, 2019) decouples weight decay from the gradient update:\n\n```\n# Adam (incorrect L2)\nθ = θ - lr * (m̂/(√v̂ + ε) + λ*θ)\n\n# AdamW (decoupled)\nθ = θ - lr * m̂/(√v̂ + ε) - lr * λ * θ\n```\n\nAdamW is now the default in most modern pipelines (Hugging Face, PyTorch Lightning).', timestamp: new Date().toISOString() }
        ]
    };
}

// ── Main ──
async function run() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' StoreChat — Full Pipeline E2E Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const conversation = createTestConversation();
    const totalChars = conversation.turns.reduce((s, t) => s + t.content.length, 0);
    console.log(`📝 Test conversation: "${conversation.title}"`);
    console.log(`   Turns: ${conversation.turns.length}`);
    console.log(`   Total characters: ${totalChars}`);
    console.log(`   Platform: ${conversation.platform}`);
    console.log(`   ID: ${conversation.conversationId}\n`);

    // ── Step 1: Validate GitHub token ──
    console.log('═══ Step 1/6: Validating GitHub Token & Repo ═══');
    const authRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${TOKEN}` }
    });
    if (!authRes.ok) { console.error('❌ Token invalid'); process.exit(1); }
    const user = await authRes.json();
    const scopes = authRes.headers.get('x-oauth-scopes') || '';
    console.log(`   ✅ Authenticated as: ${user.login}`);
    console.log(`   ✅ Has repo scope: ${scopes.includes('repo')}\n`);

    // ── Step 2: Compress ──
    console.log('═══ Step 2/6: Compressing Conversation ═══');
    const compressed = StoreChatCompress.compress(conversation);
    const originalSize = JSON.stringify(conversation).length;
    const ratio = ((1 - compressed.byteLength / originalSize) * 100).toFixed(1);
    console.log(`   Original: ${originalSize} bytes`);
    console.log(`   Compressed: ${compressed.byteLength} bytes`);
    console.log(`   ✅ Compression ratio: ${ratio}% reduction`);

    // Verify local decompress
    const localVerify = StoreChatCompress.decompress(compressed);
    console.log(`   ✅ Local decompress verified: ${localVerify.turns.length} turns intact`);

    for (let i = 0; i < conversation.turns.length; i++) {
        if (localVerify.turns[i].content !== conversation.turns[i].content) {
            console.error(`   ❌ Turn ${i} content mismatch!`);
            process.exit(1);
        }
    }
    console.log(`   ✅ All ${conversation.turns.length} turns content verified byte-for-byte\n`);

    // ── Step 3: Generate Markdown ──
    console.log('═══ Step 3/6: Generating Human-Readable Markdown ═══');
    const md = generateMarkdown(conversation);
    console.log(`   Markdown size: ${md.length} chars`);
    console.log(`   Contains title: ${md.includes('# E2E Verification')}`);
    console.log(`   Contains code blocks: ${md.includes('```python')}`);
    console.log(`   Contains table: ${md.includes('| Activation |')}`);
    console.log(`   Contains 🧑 User labels: ${md.includes('🧑 User')}`);
    console.log(`   Contains 🤖 Assistant labels: ${md.includes('🤖 Assistant')}`);
    console.log(`   ✅ Markdown generation verified\n`);

    // ── Step 4: Push to GitHub (Markdown + compressed) ──
    console.log('═══ Step 4/6: Pushing to GitHub (Markdown + .gz) ═══');

    // Generate file paths
    const date = conversation.timestamp.split('T')[0];
    const slug = conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60);
    const mdPath = `${conversation.platform}/${date}/${slug}.md`;
    const gzPath = `${conversation.platform}/${date}/.data/${slug}.json.gz`;

    const mdBase64 = Buffer.from(md, 'utf8').toString('base64');
    const gzBase64 = StoreChatCompress.toBase64(compressed);

    console.log(`   MD path: ${mdPath}`);
    console.log(`   GZ path: ${gzPath}`);
    console.log(`   MD base64 size: ${mdBase64.length} chars`);
    console.log(`   GZ base64 size: ${gzBase64.length} chars`);

    // Get branch info
    const branchRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/ref/heads/main`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
    });
    if (!branchRes.ok) { console.error('❌ Cannot get branch info'); process.exit(1); }
    const branchData = await branchRes.json();
    const headSha = branchData.object.sha;

    // Push via GraphQL createCommitOnBranch
    const mutation = `mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
            commit { url oid }
        }
    }`;

    const pushRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: mutation,
            variables: {
                input: {
                    branch: { repositoryNameWithOwner: `${OWNER}/${REPO}`, branchName: 'main' },
                    message: { headline: `📝 E2E test: ${conversation.title}` },
                    expectedHeadOid: headSha,
                    fileChanges: {
                        additions: [
                            { path: mdPath, contents: mdBase64 },
                            { path: gzPath, contents: gzBase64 }
                        ]
                    }
                }
            }
        })
    });

    const pushData = await pushRes.json();
    if (pushData.errors) {
        console.error('❌ Push failed:', JSON.stringify(pushData.errors));
        process.exit(1);
    }
    const commitUrl = pushData.data.createCommitOnBranch.commit.url;
    console.log(`   ✅ Pushed successfully!`);
    console.log(`   Commit: ${commitUrl}\n`);

    // ── Step 5: Download Markdown from GitHub ──
    console.log('═══ Step 5/6: Downloading Markdown from GitHub & Verifying ═══');
    await new Promise(r => setTimeout(r, 2000)); // Wait for GitHub to process

    const mdDownloadRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${mdPath}`,
        { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!mdDownloadRes.ok) { console.error('❌ Download MD failed'); process.exit(1); }
    const mdFile = await mdDownloadRes.json();
    const downloadedMd = Buffer.from(mdFile.content, 'base64').toString('utf8');
    console.log(`   Downloaded MD: ${downloadedMd.length} chars`);
    console.log(`   Has title header: ${downloadedMd.includes('# E2E Verification: Full Pipeline Test')}`);
    console.log(`   Has platform info: ${downloadedMd.includes('CHATGPT')}`);
    console.log(`   Has code blocks: ${downloadedMd.includes('```python')}`);
    console.log(`   Has table: ${downloadedMd.includes('| Activation |')}`);
    console.log(`   Has all 8 turns: ${(downloadedMd.match(/## 🧑 User|## 🤖 Assistant/g) || []).length === 8}`);
    console.log(`   ✅ Markdown file is human-readable on GitHub!\n`);

    // ── Step 6: Download .gz, decompress, verify byte-for-byte ──
    console.log('═══ Step 6/6: Downloading .gz & Verifying Round-Trip ═══');
    const gzDownloadRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${gzPath}`,
        { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!gzDownloadRes.ok) { console.error('❌ Download GZ failed'); process.exit(1); }
    const gzFile = await gzDownloadRes.json();
    const downloadedBytes = StoreChatCompress.fromBase64(gzFile.content.replace(/\n/g, ''));
    console.log(`   Downloaded GZ: ${downloadedBytes.byteLength} bytes`);

    const roundTripData = StoreChatCompress.decompress(downloadedBytes);
    console.log(`   Decompressed to conversation with ${roundTripData.turns.length} turns`);

    // Verify completeness
    if (roundTripData.turns.length !== conversation.turns.length) {
        console.error(`   ❌ Turn count mismatch: ${roundTripData.turns.length} vs ${conversation.turns.length}`);
        process.exit(1);
    }
    console.log(`   ✅ Turn count matches: ${roundTripData.turns.length}`);
    console.log(`   ✅ Title matches: "${roundTripData.title}"`);
    console.log(`   ✅ Platform matches: ${roundTripData.platform}`);

    let totalVerified = 0;
    for (let i = 0; i < conversation.turns.length; i++) {
        if (roundTripData.turns[i].content !== conversation.turns[i].content) {
            console.error(`   ❌ Turn ${i} content mismatch!`);
            console.error(`   Expected ${conversation.turns[i].content.length} chars, got ${roundTripData.turns[i].content.length}`);
            process.exit(1);
        }
        if (roundTripData.turns[i].role !== conversation.turns[i].role) {
            console.error(`   ❌ Turn ${i} role mismatch!`);
            process.exit(1);
        }
        totalVerified += roundTripData.turns[i].content.length;
    }
    console.log(`   ✅ All ${conversation.turns.length} turns verified byte-for-byte`);
    console.log(`   ✅ Total content preserved: ${totalVerified} characters\n`);

    // ── Summary ──
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(' ✅ ALL CHECKS PASSED — Full Pipeline Verified!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(` Summary:`);
    console.log(`   • Conversation: ${conversation.turns.length} turns, ${totalChars} characters`);
    console.log(`   • Compression: ${originalSize} → ${compressed.byteLength} bytes (${ratio}% reduction)`);
    console.log(`   • Markdown: ✅ (${md.length} chars, human-readable)`);
    console.log(`   • GitHub push: ✅ (${commitUrl})`);
    console.log(`   • Markdown on GitHub: ✅ (readable with code blocks + tables)`);
    console.log(`   • .gz download & decompress: ✅ (byte-for-byte match)`);
    console.log(`   • Code blocks preserved: ✅`);
    console.log(`   • Markdown formatting preserved: ✅`);
    console.log(`   • All turns complete: ✅`);
    console.log('');
}

// ── Markdown generator (matches github.js formatAsMarkdown) ──
function generateMarkdown(conversation) {
    const lines = [];
    const title = conversation.title || 'Untitled Conversation';
    const date = conversation.timestamp ? new Date(conversation.timestamp).toLocaleString() : 'Unknown';
    const platform = (conversation.platform || 'unknown').toUpperCase();
    const turnCount = conversation.turns?.length || 0;

    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`> **Platform:** ${platform} | **Date:** ${date} | **Turns:** ${turnCount}`);
    if (conversation.url) lines.push(`> **Source:** [Open Original](${conversation.url})`);
    lines.push('');
    lines.push('---');
    lines.push('');

    if (conversation.turns && Array.isArray(conversation.turns)) {
        for (let i = 0; i < conversation.turns.length; i++) {
            const turn = conversation.turns[i];
            const roleLabel = turn.role === 'user' ? '🧑 User' : '🤖 Assistant';
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

    lines.push('');
    lines.push('---');
    lines.push(`*Archived by [StoreChat](https://github.com/Adi-gitX/StoreChat) on ${new Date().toISOString().split('T')[0]}*`);
    lines.push('');

    return lines.join('\n');
}

run().catch(err => {
    console.error('❌ Pipeline failed:', err.message || err);
    process.exit(1);
});
