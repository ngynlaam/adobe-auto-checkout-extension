/**
 * Adobe Auto Checkout - Background Service Worker
 */

// Open settings page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_SETTINGS') {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
        sendResponse({ success: true });
    } else if (message.type === 'STATUS_UPDATE') {
        // Broadcast to popup
        chrome.runtime.sendMessage(message).catch(() => { });
    }
    return true;
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
