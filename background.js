/**
 * Adobe Auto Checkout - Background Service Worker
 * With Chrome Debugger API for iframe access
 */

// Track attached debugger sessions
const debuggerSessions = new Map();

// Open settings page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_SETTINGS') {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
        sendResponse({ success: true });
    } else if (message.type === 'STATUS_UPDATE') {
        // Broadcast to popup
        chrome.runtime.sendMessage(message).catch(() => { });
    } else if (message.type === 'FILL_IFRAME_FIELD') {
        // Handle iframe field filling via debugger
        fillIframeField(sender.tab.id, message.selector, message.value)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async response
    } else if (message.type === 'DETACH_DEBUGGER') {
        detachDebugger(sender.tab.id);
        sendResponse({ success: true });
    }
    return true;
});

// Attach debugger to tab
async function attachDebugger(tabId) {
    if (debuggerSessions.has(tabId)) {
        return true; // Already attached
    }

    try {
        await chrome.debugger.attach({ tabId }, '1.3');
        debuggerSessions.set(tabId, true);
        console.log('[Adobe Auto] Debugger attached to tab', tabId);
        return true;
    } catch (err) {
        console.error('[Adobe Auto] Failed to attach debugger:', err);
        throw err;
    }
}

// Detach debugger from tab
function detachDebugger(tabId) {
    if (debuggerSessions.has(tabId)) {
        chrome.debugger.detach({ tabId }).catch(() => { });
        debuggerSessions.delete(tabId);
        console.log('[Adobe Auto] Debugger detached from tab', tabId);
    }
}

// Send command via debugger
async function sendDebuggerCommand(tabId, method, params = {}) {
    try {
        return await chrome.debugger.sendCommand({ tabId }, method, params);
    } catch (err) {
        console.error('[Adobe Auto] Debugger command failed:', method, err);
        throw err;
    }
}

// Fill field inside iframe using debugger
async function fillIframeField(tabId, selector, value) {
    try {
        // Attach debugger
        await attachDebugger(tabId);

        // Get all frames
        const frameTree = await sendDebuggerCommand(tabId, 'Page.getFrameTree');
        console.log('[Adobe Auto] Frame tree:', frameTree);

        // Find iframe with payment fields
        const frames = getAllFrames(frameTree.frameTree);
        console.log('[Adobe Auto] Found frames:', frames.length);

        // Try to find and fill the input in each frame
        for (const frame of frames) {
            try {
                // Create isolated world in frame for script execution
                const { executionContextId } = await sendDebuggerCommand(tabId, 'Page.createIsolatedWorld', {
                    frameId: frame.id,
                    worldName: 'adobeAuto'
                });

                // Execute script to fill the input
                const script = `
                    (function() {
                        const input = document.querySelector('${selector.replace(/'/g, "\\'")}');
                        if (input) {
                            // Focus
                            input.focus();
                            
                            // Clear and set value using native setter
                            const nativeSetter = Object.getOwnPropertyDescriptor(
                                Object.getPrototypeOf(input), 'value'
                            )?.set || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                            
                            nativeSetter.call(input, '');
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            
                            // Type value
                            nativeSetter.call(input, '${value}');
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            input.dispatchEvent(new Event('blur', { bubbles: true }));
                            
                            return { found: true, value: input.value };
                        }
                        return { found: false };
                    })();
                `;

                const result = await sendDebuggerCommand(tabId, 'Runtime.evaluate', {
                    expression: script,
                    contextId: executionContextId,
                    returnByValue: true
                });

                console.log('[Adobe Auto] Frame', frame.id, 'result:', result);

                if (result.result?.value?.found) {
                    console.log('[Adobe Auto] Successfully filled field in frame:', frame.id);
                    return { success: true, frameId: frame.id, value: result.result.value.value };
                }
            } catch (frameErr) {
                console.log('[Adobe Auto] Error in frame', frame.id, ':', frameErr.message);
            }
        }

        return { success: false, error: 'Input not found in any frame' };

    } catch (err) {
        console.error('[Adobe Auto] fillIframeField error:', err);
        return { success: false, error: err.message };
    }
}

// Recursively get all frames from frame tree
function getAllFrames(frameTree) {
    const frames = [frameTree.frame];
    if (frameTree.childFrames) {
        for (const child of frameTree.childFrames) {
            frames.push(...getAllFrames(child));
        }
    }
    return frames;
}

// Clean up debugger on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
    detachDebugger(tabId);
});

// Handle debugger detach events
chrome.debugger.onDetach.addListener((source, reason) => {
    if (source.tabId) {
        debuggerSessions.delete(source.tabId);
        console.log('[Adobe Auto] Debugger detached:', reason);
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Inject content script if on Adobe
    if (tab.url && tab.url.includes('commerce.adobe.com')) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['lib/cc-generator.js', 'content.js']
        }).catch(console.error);
    }
});

// Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'openSettings',
        title: 'Open Settings',
        contexts: ['action']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'openSettings') {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
});

// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['adobeAutoSettings'], (result) => {
        if (!result.adobeAutoSettings) {
            chrome.storage.local.set({
                adobeAutoSettings: {
                    bin: '4537890000000xxx',
                    emailList: '',
                    firstName: 'John',
                    lastName: 'Smith',
                    postalCode: 'SW1A 1AA',
                    currentEmailIndex: 0
                },
                adobeAutoResults: []
            });
        }
    });
});
