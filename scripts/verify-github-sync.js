const fs = require('fs');
const path = require('path');
const vm = require('vm');
const pako = require('pako');
const fetch = require('node-fetch');
require('fake-indexeddb/auto');

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const OWNER = process.env.GITHUB_OWNER || 'Adi-gitX';
const REPO = process.env.GITHUB_REPO || 'llm-chat-archive';

if (!TOKEN) {
    console.error('❌ Set GITHUB_TOKEN env var. Usage: GITHUB_TOKEN=ghp_xxx node scripts/verify-github-sync.js');
    process.exit(1);
}

// 1. Setup Global Environment
global.fetch = fetch;
global.pako = pako;
global.chrome = {
    runtime: { id: 'test-id' },
    storage: {
        local: {
            get: (keys, cb) => {
                cb({
                    github_owner: OWNER,
                    github_repo: REPO
                });
            },
            set: (items, cb) => cb && cb()
        }
    },
    alarms: { create: () => { } }
};

// Mock StoreChatCrypto
global.StoreChatCrypto = {
    retrieveToken: async () => TOKEN,
    storeToken: async () => { }
};

// 2. Load Libraries
const load = (file) => {
    const filePath = path.join(__dirname, '..', 'lib', file);
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInThisContext(code);
};

console.log('Loading libraries...');
load('compress.js');
load('storage.js');
load('github.js');

// 3. Run Verification
async function run() {
    try {
        console.log('Validating Token & Repo Access...');
        const validation = await StoreChatGitHub.validateToken();
        console.log('Validation Result:', JSON.stringify(validation, null, 2));

        if (!validation.valid) {
            console.error('❌ Token invalid or API error.');
            process.exit(1);
        }

        if (validation.repoError) {
            console.error(`❌ Repo Error: ${validation.repoError}`);
            process.exit(1);
        }

        // Check/Init Repo
        try {
            console.log('Checking repository state...');
            await StoreChatGitHub.getBranchInfo();
        } catch (e) {
            console.log('Repo check error:', e.message);
            if (e.message.includes("Cannot read properties of null") || e.message.includes("defaultBranchRef")) {
                console.log("⚠️  Empty repo detected (no default branch). Initializing via REST API...");
                await initRepo();
            } else {
                throw e;
            }
        }

        console.log('Attempting to push verification file...');
        const result = await StoreChatGitHub.pushFile(
            `tests/verification-${Date.now()}.txt`,
            Buffer.from(`High-end verification script run at ${new Date().toISOString()}`).toString('base64'),
            '🤖 Automated Verification'
        );

        console.log('Push Result:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ SUCCESS: Automated High-End Script verified core functionality.');
            console.log(`   Commit: ${result.commitUrl}`);
            process.exit(0);
        } else {
            console.error('\n❌ FAILURE: Push failed.');
            process.exit(1);
        }

    } catch (err) {
        console.error('Script Error:', err);
        process.exit(1);
    }
}

async function initRepo() {
    // REST API call to create README.md
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/README.md`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'StoreChat-Test'
        },
        body: JSON.stringify({
            message: 'Initialize repo via StoreChat Test',
            content: Buffer.from('# StoreChat Archive\n\nInitialized by automated verification script.').toString('base64')
        })
    });

    if (res.ok) {
        console.log("README.md created successfully.");
        // Wait a moment for consistency
        await new Promise(r => setTimeout(r, 2000));
        return;
    }

    if (res.status === 422) {
        console.log("README.md might already exist or branch issue. Continuing...");
        return;
    }

    console.error("Failed to init repo:", await res.text());
    process.exit(1);
}

run();
