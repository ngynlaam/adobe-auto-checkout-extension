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

    // Wait for element using MutationObserver (instant detection)
    const waitForElement = (selector, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            // Check if already exists
            const existing = document.querySelector(selector);
            if (existing && existing.offsetParent !== null) {
                return resolve(existing);
            }

            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Element not found: ${selector}`));
            }, timeout);

            const observer = new MutationObserver(() => {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    observer.disconnect();
                    clearTimeout(timeoutId);
                    resolve(element);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });
        });
    };

    // Wait for condition using MutationObserver
    const waitForCondition = (conditionFn, targetElement = document.body, timeout = 10000) => {
        return new Promise((resolve, reject) => {
            // Check if condition already met
            if (conditionFn()) {
                return resolve(true);
            }

            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error('Timeout waiting for condition'));
            }, timeout);

            const observer = new MutationObserver(() => {
                if (conditionFn()) {
                    observer.disconnect();
                    clearTimeout(timeoutId);
                    resolve(true);
                }
            });

            observer.observe(targetElement, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });
        });
    };

    // React-compatible: Get native input value setter
    const getNativeInputValueSetter = (element) => {
        const prototype = Object.getPrototypeOf(element);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        return descriptor.set;
    };

    // Simulate human-like typing with React support
    const typeText = async (element, text) => {
        element.focus();

        // Clear first
        const nativeInputValueSetter = getNativeInputValueSetter(element);
        nativeInputValueSetter.call(element, '');
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Type character by character
        for (let i = 0; i < text.length; i++) {
            const currentValue = text.substring(0, i + 1);
            nativeInputValueSetter.call(element, currentValue);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(Math.floor(Math.random() * 50) + 20);
        }

        // Dispatch change
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Click outside to trigger real blur/validation (Adobe needs this)
        const outsideElement = document.body;
        outsideElement.click();
        element.blur();

        // Also dispatch blur event for React
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

        // Wait for validation
        await delay(300);

        // Log result
        console.log(`[Adobe Auto] Typed: "${text}" | Current value: "${element.value}"`);

        // React might format/transform the value, so we just check if it's not empty
        return element.value.length > 0;
    };

    // Set input value with React support (faster, for non-sensitive fields)
    const setInputValue = async (element, value) => {
        element.focus();

        const nativeInputValueSetter = getNativeInputValueSetter(element);
        nativeInputValueSetter.call(element, value);

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        // Wait for React to process
        await delay(200);

        console.log(`[Adobe Auto] Set: "${value}" | Current value: "${element.value}"`);

        // React might format the value, so we just check if it's not empty
        return element.value.length > 0;
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

            const success = await typeText(emailInput, email);
            await randomDelay();

            if (!success) {
                updateStatus(1, 'Failed to fill email - value not set', true);
                return false;
            }

            updateStatus(1, 'Email filled ✓');
            return true;
        } catch (error) {
            updateStatus(1, `Error: ${error.message}`, true);
            return false;
        }
    };

    // Step 2: Click Continue - Wait for validation using MutationObserver
    const stepClickContinue = async () => {
        updateStatus(2, 'Waiting for email validation...');

        try {
            const continueBtn = await waitForElement(SELECTORS.continueButton);

            // Check if button is enabled
            const isButtonEnabled = () => {
                const btn = document.querySelector(SELECTORS.continueButton);
                return btn && !btn.disabled &&
                    btn.getAttribute('aria-disabled') !== 'true' &&
                    !btn.classList.contains('disabled');
            };

            // Wait for button to be enabled (instant detection)
            await waitForCondition(isButtonEnabled, continueBtn.parentElement || document.body, 10000);
            updateStatus(2, 'Email validated ✓ - Clicking Continue...');

            // Small delay before clicking
            await delay(200);

            // Re-get button in case it was replaced
            const btn = document.querySelector(SELECTORS.continueButton);
            await clickElement(btn || continueBtn);
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
        let iframeFieldsBlocked = false;

        try {
            // Wait for payment panel to be active
            await waitForElement(SELECTORS.paymentPanel + '.CheckoutWizardStep__active__YuSs3', 15000);
            await delay(1000);

            // Check if card fields are in iframe (cross-origin blocked)
            const cardInput = document.querySelector(SELECTORS.cardNumberInput);
            const expiryInput = document.querySelector(SELECTORS.expiryInput);

            if (!cardInput || !expiryInput) {
                // Card fields are in iframe - copy to clipboard instead
                iframeFieldsBlocked = true;

                const cardInfo = `${cardData.cardNumber}`;
                const expiryInfo = cardData.formatted.expiry;

                // Copy card number to clipboard
                try {
                    await navigator.clipboard.writeText(cardInfo);
                    updateStatus(3, `Card copied! Paste: ${cardInfo.slice(-8)}... | Exp: ${expiryInfo}`);
                    console.log('[Adobe Auto] Card copied to clipboard:', cardInfo);
                    console.log('[Adobe Auto] Expiry:', expiryInfo);
                } catch (clipErr) {
                    console.log('[Adobe Auto] Clipboard error:', clipErr);
                }

                // Show card info in floating popup prominently
                showCardInfoOverlay(cardData);

                await delay(500);
            } else {
                // Card fields accessible - fill them
                updateStatus(3, 'Filling card number...');
                await typeText(cardInput, cardData.cardNumber);
                await randomDelay();

                updateStatus(3, 'Filling expiry...');
                await typeText(expiryInput, cardData.formatted.expiry);
                await randomDelay();
            }

            // Fill first name
            updateStatus(3, 'Filling first name...');
            const firstNameInput = await waitForElement(SELECTORS.firstNameInput, 5000).catch(() => null);
            if (firstNameInput) {
                await setInputValue(firstNameInput, formData.firstName);
                await randomDelay(100, 300);
            }

            // Fill last name
            updateStatus(3, 'Filling last name...');
            const lastNameInput = await waitForElement(SELECTORS.lastNameInput, 5000).catch(() => null);
            if (lastNameInput) {
                await setInputValue(lastNameInput, formData.lastName);
                await randomDelay(100, 300);
            }

            // Fill postal code
            updateStatus(3, 'Filling postal code...');
            const postalInput = await waitForElement(SELECTORS.postalCodeInput, 5000).catch(() => null);
            if (postalInput) {
                await setInputValue(postalInput, formData.postalCode);
                await randomDelay();
            }

            if (iframeFieldsBlocked) {
                updateStatus(3, `Paste card: ${cardData.cardNumber} | ${cardData.formatted.expiry}`);
                return 'partial'; // Indicate partial success
            }

            updateStatus(3, 'Payment info filled ✓');
            return true;
        } catch (error) {
            updateStatus(3, `Error: ${error.message}`, true);
            return false;
        }
    };

    // Show card info overlay for manual input
    const showCardInfoOverlay = (cardData) => {
        // Remove existing overlay
        const existing = document.getElementById('adobe-auto-card-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'adobe-auto-card-overlay';
        overlay.innerHTML = `
            <div style="
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #1a1a2e;
                border: 2px solid #8ab4f8;
                border-radius: 12px;
                padding: 16px 24px;
                z-index: 2147483647;
                font-family: 'Google Sans', 'Roboto', sans-serif;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            ">
                <div style="color: #8ab4f8; font-size: 12px; margin-bottom: 8px;">
                    📋 Card copied - Paste in card field:
                </div>
                <div style="display: flex; gap: 16px; align-items: center;">
                    <div style="color: #fff; font-family: monospace; font-size: 18px; letter-spacing: 2px;">
                        ${cardData.cardNumber}
                    </div>
                    <div style="color: #81c995; font-size: 16px;">
                        ${cardData.formatted.expiry}
                    </div>
                    <div style="color: #fdd663; font-size: 14px;">
                        CVV: ${cardData.cvv}
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: #5f6368;
                    cursor: pointer;
                    font-size: 16px;
                ">×</button>
            </div>
        `;
        document.body.appendChild(overlay);
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
