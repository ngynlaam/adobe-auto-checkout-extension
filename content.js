/**
 * Adobe Auto Checkout - Content Script
 * Automates the 4-step checkout process
 */

(function () {
    'use strict';

    // State management
    const state = {
        isRunning: false,
        currentStep: 0,
        currentEmail: null,
        settings: null,
        results: []
    };

    // Selectors based on web-element.md
    const SELECTORS = {
        // Step 1: Email
        emailInput: 'input[data-testid="email-input"], #email-input-field',

        // Step 2: Continue button
        continueButton: 'button[data-testid="action-container-cta"]',

        // Step 3: Payment form
        paymentPanel: '[data-testid="checkout-wizard-step-panel-payment"]',
        cardNumberIframe: 'iframe[title="Card information"]',
        cardNumberInput: 'input[data-testid="credit-card-number"], #card-number',
        expiryInput: 'input[data-testid="expiry-date"], #expiry-date',
        firstNameInput: 'input[data-testid="first-name-field"], #firstName',
        lastNameInput: 'input[data-testid="last-name-field"], #lastName',
        postalCodeInput: 'input[data-testid="postal-code-field"], #postalCode',

        // Step 4: Submit
        startTrialButton: 'button[data-daa-ll="Start free trial"]'
    };

    // Delay helper
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Random delay between actions (human-like)
    const randomDelay = (min = 300, max = 800) => {
        return delay(Math.floor(Math.random() * (max - min + 1)) + min);
    };

    // Wait for element to appear
    const waitForElement = async (selector, timeout = 10000) => {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                return element;
            }
            await delay(200);
        }

        throw new Error(`Element not found: ${selector}`);
    };

    // Simulate human-like typing
    const typeText = async (element, text) => {
        element.focus();
        element.value = '';

        // Dispatch focus event
        element.dispatchEvent(new Event('focus', { bubbles: true }));

        for (const char of text) {
            element.value += char;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(Math.floor(Math.random() * 50) + 20);
        }

        // Dispatch change and blur
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    // Set input value (faster, for non-sensitive fields)
    const setInputValue = (element, value) => {
        element.focus();
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    // Click element with human-like behavior
    const clickElement = async (element) => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(200);

        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await delay(50);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    };

    // Update floating popup status
    const updateStatus = (step, message, isError = false) => {
        state.currentStep = step;

        const popup = document.getElementById('adobe-auto-popup');
        if (popup) {
            const statusEl = popup.querySelector('.auto-status');
            const stepEl = popup.querySelector('.auto-step');

            if (statusEl) {
                statusEl.textContent = message;
                statusEl.style.color = isError ? '#f28b82' : '#81c995';
            }
            if (stepEl) {
                stepEl.textContent = `Step ${step}/4`;
            }
        }

        // Send to background
        chrome.runtime.sendMessage({
            type: 'STATUS_UPDATE',
            data: { step, message, isError }
        });
    };

    // Step 1: Fill Email
    const stepFillEmail = async (email) => {
        updateStatus(1, 'Finding email field...');

        try {
            const emailInput = await waitForElement(SELECTORS.emailInput);
            updateStatus(1, 'Filling email...');

            await typeText(emailInput, email);
            await randomDelay();

            updateStatus(1, 'Email filled ✓');
            return true;
        } catch (error) {
            updateStatus(1, `Error: ${error.message}`, true);
            return false;
        }
    };

    // Step 2: Click Continue
    const stepClickContinue = async () => {
        updateStatus(2, 'Finding Continue button...');

        try {
            const continueBtn = await waitForElement(SELECTORS.continueButton);
            updateStatus(2, 'Clicking Continue...');

            await clickElement(continueBtn);
            await delay(2000); // Wait for page transition

            updateStatus(2, 'Continue clicked ✓');
            return true;
        } catch (error) {
            updateStatus(2, `Error: ${error.message}`, true);
            return false;
        }
    };

    // Step 3: Fill Payment Info
    const stepFillPayment = async (cardData, formData) => {
        updateStatus(3, 'Waiting for payment form...');

        try {
            // Wait for payment panel to be active
            await waitForElement(SELECTORS.paymentPanel + '.CheckoutWizardStep__active__YuSs3', 15000);
            await delay(1500);

            // Try to fill card number (may fail due to iframe)
            try {
                updateStatus(3, 'Filling card number...');
                const cardInput = document.querySelector(SELECTORS.cardNumberInput);
                if (cardInput) {
                    await typeText(cardInput, cardData.cardNumber);
                    await randomDelay();
                } else {
                    // Card is in iframe - try to access
                    const iframe = document.querySelector(SELECTORS.cardNumberIframe);
                    if (iframe && iframe.contentDocument) {
                        const iframeCardInput = iframe.contentDocument.querySelector(SELECTORS.cardNumberInput);
                        if (iframeCardInput) {
                            await typeText(iframeCardInput, cardData.cardNumber);
                        }
                    } else {
                        updateStatus(3, 'Card field in iframe (manual input needed)');
                        console.log('[Adobe Auto] Card number needs manual input:', cardData.cardNumber);
                    }
                }
            } catch (e) {
                console.log('[Adobe Auto] Card iframe access blocked:', e);
            }

            // Fill expiry
            updateStatus(3, 'Filling expiry date...');
            const expiryInput = await waitForElement(SELECTORS.expiryInput, 5000).catch(() => null);
            if (expiryInput) {
                await typeText(expiryInput, cardData.formatted.expiry);
                await randomDelay();
            }

            // Fill first name
            updateStatus(3, 'Filling name...');
            const firstNameInput = await waitForElement(SELECTORS.firstNameInput, 5000).catch(() => null);
            if (firstNameInput) {
                setInputValue(firstNameInput, formData.firstName);
                await randomDelay(100, 300);
            }

            // Fill last name
            const lastNameInput = await waitForElement(SELECTORS.lastNameInput, 5000).catch(() => null);
            if (lastNameInput) {
                setInputValue(lastNameInput, formData.lastName);
                await randomDelay(100, 300);
            }

            // Fill postal code
            updateStatus(3, 'Filling postal code...');
            const postalInput = await waitForElement(SELECTORS.postalCodeInput, 5000).catch(() => null);
            if (postalInput) {
                setInputValue(postalInput, formData.postalCode);
                await randomDelay();
            }

            updateStatus(3, 'Payment info filled ✓');
            return true;
        } catch (error) {
            updateStatus(3, `Error: ${error.message}`, true);
            return false;
        }
    };

    // Step 4: Click Start Free Trial
    const stepStartTrial = async () => {
        updateStatus(4, 'Finding Start Trial button...');

        try {
            const startBtn = await waitForElement(SELECTORS.startTrialButton, 5000);
            updateStatus(4, 'Clicking Start Free Trial...');

            await clickElement(startBtn);

            updateStatus(4, 'Start Trial clicked ✓');
            return true;
        } catch (error) {
            updateStatus(4, `Error: ${error.message}`, true);
            return false;
        }
    };

    // Main automation flow
    const runAutomation = async () => {
        if (state.isRunning) {
            console.log('[Adobe Auto] Already running');
            return;
        }

        state.isRunning = true;

        // Load settings
        const settings = await new Promise(resolve => {
            chrome.storage.local.get(['adobeAutoSettings'], (result) => {
                resolve(result.adobeAutoSettings || {});
            });
        });

        const emails = (settings.emailList || '').split('\n').filter(e => e.trim());
        const bin = settings.bin || '4537890000000000';
        const formData = {
            firstName: settings.firstName || 'John',
            lastName: settings.lastName || 'Smith',
            postalCode: settings.postalCode || 'SW1A 1AA'
        };

        if (emails.length === 0) {
            updateStatus(0, 'No emails configured!', true);
            state.isRunning = false;
            return;
        }

        // Get next email
        const currentEmailIndex = settings.currentEmailIndex || 0;
        const email = emails[currentEmailIndex % emails.length];
        state.currentEmail = email;

        console.log('[Adobe Auto] Starting automation with email:', email);

        // Generate card
        const cardData = CCGenerator.generate(bin);
        console.log('[Adobe Auto] Generated card:', cardData);

        // Run steps
        let success = true;

        // Check current page state
        const emailPanel = document.querySelector('[data-testid="checkout-wizard-step-panel-email"].CheckoutWizardStep__active__YuSs3');
        const paymentPanel = document.querySelector('[data-testid="checkout-wizard-step-panel-payment"].CheckoutWizardStep__active__YuSs3');

        if (emailPanel) {
            // Start from step 1
            success = await stepFillEmail(email);
            if (success) {
                await delay(500);
                success = await stepClickContinue();
            }
        }

        if (paymentPanel || success) {
            await delay(1000);
            success = await stepFillPayment(cardData, formData);

            if (success) {
                await delay(500);
                // Don't auto-click Start Trial for safety
                updateStatus(4, 'Ready - Click Start Trial manually');
            }
        }

        // Save result
        const result = {
            email,
            cardNumber: cardData.cardNumber.slice(-4),
            timestamp: new Date().toISOString(),
            success
        };

        chrome.storage.local.get(['adobeAutoResults'], (data) => {
            const results = data.adobeAutoResults || [];
            results.unshift(result);
            chrome.storage.local.set({
                adobeAutoResults: results.slice(0, 100),
                adobeAutoSettings: { ...settings, currentEmailIndex: currentEmailIndex + 1 }
            });
        });

        state.isRunning = false;
    };

    // Create floating popup
    const createFloatingPopup = () => {
        if (document.getElementById('adobe-auto-popup')) return;

        const popup = document.createElement('div');
        popup.id = 'adobe-auto-popup';
        popup.innerHTML = `
      <div class="auto-header">
        <span class="auto-title">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
          Adobe Auto
        </span>
        <button class="auto-close">
          <svg class="icon" viewBox="0 0 24 24" style="width:16px;height:16px;fill:#9aa0a6"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        </button>
      </div>
      <div class="auto-body">
        <div class="auto-step">Step 0/4</div>
        <div class="auto-status">Ready to start</div>
        <div class="auto-email"></div>
      </div>
      <div class="auto-actions">
        <button class="auto-start">
          <svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          Start
        </button>
        <button class="auto-settings">
          <svg class="icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
        </button>
      </div>
    `;

        document.body.appendChild(popup);

        // Position management - save as percentage ratio from edges
        const POSITION_KEY = 'adobeAutoPopupPosition';

        // Load saved position
        const loadPosition = () => {
            try {
                const saved = localStorage.getItem(POSITION_KEY);
                if (saved) {
                    const { xRatio, yRatio } = JSON.parse(saved);
                    applyPositionFromRatio(xRatio, yRatio);
                }
            } catch (e) {
                console.log('[Adobe Auto] Could not load position:', e);
            }
        };

        // Apply position from percentage ratio
        const applyPositionFromRatio = (xRatio, yRatio) => {
            const maxX = window.innerWidth - popup.offsetWidth;
            const maxY = window.innerHeight - popup.offsetHeight;

            const x = Math.max(0, Math.min(maxX, xRatio * window.innerWidth));
            const y = Math.max(0, Math.min(maxY, yRatio * window.innerHeight));

            popup.style.left = x + 'px';
            popup.style.top = y + 'px';
            popup.style.right = 'auto';
        };

        // Save current position as ratio
        const savePositionAsRatio = () => {
            const x = popup.offsetLeft;
            const y = popup.offsetTop;

            const xRatio = x / window.innerWidth;
            const yRatio = y / window.innerHeight;

            localStorage.setItem(POSITION_KEY, JSON.stringify({ xRatio, yRatio }));
        };

        // Handle window resize - maintain ratio position
        window.addEventListener('resize', () => {
            try {
                const saved = localStorage.getItem(POSITION_KEY);
                if (saved) {
                    const { xRatio, yRatio } = JSON.parse(saved);
                    applyPositionFromRatio(xRatio, yRatio);
                }
            } catch (e) { }
        });

        // Make draggable
        let isDragging = false;
        let offsetX, offsetY;

        const header = popup.querySelector('.auto-header');
        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - popup.offsetLeft;
            offsetY = e.clientY - popup.offsetTop;
            popup.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            popup.style.left = (e.clientX - offsetX) + 'px';
            popup.style.top = (e.clientY - offsetY) + 'px';
            popup.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.style.cursor = 'grab';
                // Save position when drag ends
                savePositionAsRatio();
            }
        });

        // Load position after popup is added to DOM
        setTimeout(loadPosition, 50);

        // Event handlers
        popup.querySelector('.auto-close').addEventListener('click', () => {
            popup.remove();
        });

        popup.querySelector('.auto-start').addEventListener('click', () => {
            runAutomation();
        });

        popup.querySelector('.auto-settings').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
        });
    };

    // Initialize
    const init = () => {
        // Only run on Adobe checkout
        if (!window.location.href.includes('commerce.adobe.com')) return;

        console.log('[Adobe Auto] Content script loaded');
        createFloatingPopup();
    };

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'START_AUTOMATION') {
            runAutomation();
            sendResponse({ success: true });
        } else if (message.type === 'STOP_AUTOMATION') {
            state.isRunning = false;
            updateStatus(0, 'Stopped');
            sendResponse({ success: true });
        } else if (message.type === 'GET_STATUS') {
            sendResponse({
                isRunning: state.isRunning,
                step: state.currentStep,
                email: state.currentEmail
            });
        }
        return true;
    });

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
