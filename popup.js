/**
 * Adobe Auto Checkout - Popup Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const stepEl = document.getElementById('step');
    const emailEl = document.getElementById('email');
    const startBtn = document.getElementById('startBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    let isRunning = false;

    // Get current tab and check status
    const checkStatus = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url?.includes('commerce.adobe.com')) {
                statusEl.textContent = 'Not on Adobe checkout';
                statusEl.style.color = '#ff6b6b';
                startBtn.disabled = true;
                return;
            }

            chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (response) => {
                if (chrome.runtime.lastError) {
                    statusEl.textContent = 'Script not loaded';
                    statusEl.style.color = '#ffaa00';
                    return;
                }

                if (response) {
                    isRunning = response.isRunning;
                    statusEl.textContent = isRunning ? 'Running...' : 'Ready';
                    statusEl.style.color = isRunning ? '#ffaa00' : '#00ff88';
                    stepEl.textContent = response.step ? `${response.step}/4` : '-';
                    emailEl.textContent = response.email || '-';

                    startBtn.textContent = isRunning ? '⏹ Stop' : '▶ Start';
                    startBtn.classList.toggle('running', isRunning);
                }
            });
        } catch (error) {
            console.error('Error checking status:', error);
        }
    };

    // Start/Stop automation
    startBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url?.includes('commerce.adobe.com')) {
            return;
        }

        const messageType = isRunning ? 'STOP_AUTOMATION' : 'START_AUTOMATION';

        chrome.tabs.sendMessage(tab.id, { type: messageType }, (response) => {
            if (chrome.runtime.lastError) {
                // Inject script first
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['lib/cc-generator.js', 'content.js']
                }).then(() => {
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tab.id, { type: messageType });
                        checkStatus();
                    }, 500);
                });
            } else {
                checkStatus();
            }
        });
    });

    // Open settings
    settingsBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    });

    // Listen for status updates
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'STATUS_UPDATE') {
            const { step, message: status, isError } = message.data;
            statusEl.textContent = status;
            statusEl.style.color = isError ? '#ff6b6b' : '#00ff88';
            stepEl.textContent = `${step}/4`;
        }
    });

    // Initial check
    checkStatus();

    // Periodic check
    setInterval(checkStatus, 2000);
});
