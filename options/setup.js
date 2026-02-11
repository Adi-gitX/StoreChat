

const DOM = {
    steps: {
        welcome: document.getElementById('step-welcome'),
        connect: document.getElementById('step-connect'),
        repo: document.getElementById('step-repo'),
        success: document.getElementById('step-success')
    },
    indicators: {
        connect: document.getElementById('ind-connect'),
        repo: document.getElementById('ind-repo')
    },
    inputs: {
        token: document.getElementById('tokenInput'),
        repoName: document.getElementById('repoNameInput'),
        repoSelect: document.getElementById('repoSelect'),
        newRepoGroup: document.getElementById('newRepoInput'),
        existingRepoGroup: document.getElementById('existingRepoSelect')
    },
    buttons: {
        start: document.getElementById('btn-start'),
        back1: document.getElementById('btn-back-1'),
        verify: document.getElementById('btn-verify'),
        back2: document.getElementById('btn-back-2'),
        finish: document.getElementById('btn-finish'),
        close: document.getElementById('btn-close')
    },
    error: document.getElementById('tokenError')
};

let state = {
    token: '',
    user: '',
    repoType: 'new'
};


DOM.buttons.start.addEventListener('click', () => showStep('connect'));
DOM.buttons.back1.addEventListener('click', () => showStep('welcome'));
DOM.buttons.back2.addEventListener('click', () => showStep('connect'));
DOM.buttons.close.addEventListener('click', () => window.close());

function showStep(stepId) {
    Object.values(DOM.steps).forEach(el => el.classList.add('hidden'));
    DOM.steps[stepId].classList.remove('hidden');


    if (stepId === 'connect') DOM.indicators.connect.classList.add('active');
    if (stepId === 'repo') DOM.indicators.repo.classList.add('active');
}


DOM.buttons.verify.addEventListener('click', async () => {
    const token = DOM.inputs.token.value.trim();
    if (!token) return showError('Enter a token');

    DOM.buttons.verify.textContent = 'Verifying...';
    DOM.buttons.verify.disabled = true;
    DOM.error.classList.add('hidden');

    try {

        const res = await fetch('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Invalid Token');
        const user = await res.json();
        const scopes = res.headers.get('x-oauth-scopes') || '';

        if (!scopes.includes('repo')) {
            throw new Error('Token missing "repo" scope');
        }


        state.token = token;
        state.user = user.login;

        await StoreChatCrypto.storeToken(token);

        DOM.buttons.verify.textContent = 'Success!';
        setTimeout(() => {
            loadRepos();
            showStep('repo');
            DOM.buttons.verify.disabled = false;
            DOM.buttons.verify.textContent = 'Verify & Next →';
        }, 500);

    } catch (e) {
        showError(e.message);
        DOM.buttons.verify.disabled = false;
        DOM.buttons.verify.textContent = 'Verify & Next →';
    }
});

function showError(msg) {
    DOM.error.textContent = msg;
    DOM.error.classList.remove('hidden');
}


document.querySelectorAll('input[name="repoType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        state.repoType = e.target.value;
        if (state.repoType === 'new') {
            DOM.inputs.newRepoGroup.classList.remove('hidden');
            DOM.inputs.existingRepoGroup.classList.add('hidden');
        } else {
            DOM.inputs.newRepoGroup.classList.add('hidden');
            DOM.inputs.existingRepoGroup.classList.remove('hidden');
        }
    });
});

async function loadRepos() {

    const res = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated&type=owner`, {
        headers: { Authorization: `Bearer ${state.token}` }
    });
    const repos = await res.json();

    const select = DOM.inputs.repoSelect;
    select.innerHTML = '';
    repos.forEach(repo => {
        const opt = document.createElement('option');
        opt.value = repo.name;
        opt.textContent = repo.name;
        select.appendChild(opt);
    });


}


DOM.buttons.finish.addEventListener('click', async () => {
    DOM.buttons.finish.textContent = 'Setting up...';
    DOM.buttons.finish.disabled = true;

    try {
        let repoName = '';

        if (state.repoType === 'new') {
            repoName = DOM.inputs.repoName.value.trim();
            // Create Repo
            const createRes = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: repoName,
                    private: true,
                    description: 'Archive of AI conversations (via StoreChat)',
                    auto_init: true
                })
            });

            if (!createRes.ok && createRes.status !== 422) {
                throw new Error('Failed to create repo');
            }
        } else {
            repoName = DOM.inputs.repoSelect.value;
        }


        await new Promise(r => chrome.storage.local.set({
            github_owner: state.user,
            github_repo: repoName,
            lastSyncTime: null
        }, r));


        showStep('success');

    } catch (e) {
        alert('Setup failed: ' + e.message);
        DOM.buttons.finish.disabled = false;
        DOM.buttons.finish.textContent = 'Finish Setup';
    }
});
