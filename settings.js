/**
 * Adobe Auto Checkout - Settings Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const binInput = document.getElementById('bin');
    const emailListInput = document.getElementById('emailList');
    const emailCountEl = document.getElementById('emailCount');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const postalCodeInput = document.getElementById('postalCode');
    const previewCardEl = document.getElementById('previewCard');
    const generatePreviewBtn = document.getElementById('generatePreview');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const saveStatusEl = document.getElementById('saveStatus');
    const clearResultsBtn = document.getElementById('clearResults');
    const resultsContainer = document.getElementById('resultsContainer');
    const exportBtn = document.getElementById('exportSettings');
    const importBtn = document.getElementById('importSettings');
    const importFile = document.getElementById('importFile');

    // Load settings
    const loadSettings = () => {
        chrome.storage.local.get(['adobeAutoSettings', 'adobeAutoResults'], (data) => {
            const settings = data.adobeAutoSettings || {};

            binInput.value = settings.bin || '';
            emailListInput.value = settings.emailList || '';
            firstNameInput.value = settings.firstName || '';
            lastNameInput.value = settings.lastName || '';
            postalCodeInput.value = settings.postalCode || '';

            updateEmailCount();
            renderResults(data.adobeAutoResults || []);
        });
    };

    // Save settings
    const saveSettings = () => {
        const settings = {
            bin: binInput.value.trim(),
            emailList: emailListInput.value,
            firstName: firstNameInput.value.trim(),
            lastName: lastNameInput.value.trim(),
            postalCode: postalCodeInput.value.trim(),
            currentEmailIndex: 0
        };

        chrome.storage.local.set({ adobeAutoSettings: settings }, () => {
            saveStatusEl.textContent = '✓ Settings saved successfully!';
            saveStatusEl.style.color = '#00ff88';

            setTimeout(() => {
                saveStatusEl.textContent = '';
            }, 3000);
        });
    };

    // Update email count
    const updateEmailCount = () => {
        const emails = emailListInput.value.split('\n').filter(e => e.trim());
        emailCountEl.textContent = `${emails.length} email${emails.length !== 1 ? 's' : ''} configured`;
    };

    // Generate preview card
    const generatePreview = () => {
        const bin = binInput.value.trim() || '4537890000000xxx';

        try {
            const card = CCGenerator.generate(bin);
            previewCardEl.textContent = `${card.formatted.cardNumber} | ${card.formatted.expiry} | ${card.cvv}`;
            previewCardEl.style.color = '#00ff88';
        } catch (error) {
            previewCardEl.textContent = 'Invalid BIN pattern';
            previewCardEl.style.color = '#ff4d4d';
        }
    };

    // Render results
    const renderResults = (results) => {
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No results yet</p>';
            return;
        }

        resultsContainer.innerHTML = results.map(result => `
      <div class="result-item">
        <div class="result-status ${result.success ? 'success' : 'failed'}"></div>
        <div class="result-info">
          <div class="result-email">${escapeHtml(result.email)}</div>
          <div class="result-card">Card ending: ****${result.cardNumber}</div>
        </div>
        <div class="result-time">${formatTime(result.timestamp)}</div>
      </div>
    `).join('');
    };

    // Clear results
    const clearResults = () => {
        if (confirm('Are you sure you want to clear all results?')) {
            chrome.storage.local.set({ adobeAutoResults: [] }, () => {
                renderResults([]);
            });
        }
    };

    // Export settings
    const exportSettings = () => {
        chrome.storage.local.get(['adobeAutoSettings'], (data) => {
            const json = JSON.stringify(data.adobeAutoSettings, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = 'adobe-auto-settings.json';
            a.click();

            URL.revokeObjectURL(url);
        });
    };

    // Import settings
    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                chrome.storage.local.set({ adobeAutoSettings: settings }, () => {
                    loadSettings();
                    saveStatusEl.textContent = '✓ Settings imported successfully!';
                    saveStatusEl.style.color = '#00ff88';
                    setTimeout(() => saveStatusEl.textContent = '', 3000);
                });
            } catch (error) {
                saveStatusEl.textContent = '✗ Invalid settings file';
                saveStatusEl.style.color = '#ff4d4d';
            }
        };
        reader.readAsText(file);
    };

    // Helpers
    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    // Event listeners
    emailListInput.addEventListener('input', updateEmailCount);
    generatePreviewBtn.addEventListener('click', generatePreview);
    saveSettingsBtn.addEventListener('click', saveSettings);
    clearResultsBtn.addEventListener('click', clearResults);
    exportBtn.addEventListener('click', exportSettings);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveSettings();
        }
    });

    // Initialize
    loadSettings();
});
