# Adobe Auto Checkout Extension

🚀 Chrome extension to automate Adobe checkout process with BIN-based credit card generation.

## Features

- **Auto-fill Email**: Automatically fills email from your list
- **Payment Form Automation**: Fills card details, name, and postal code
- **BIN Generator**: Generate valid credit card numbers using Luhn algorithm
- **Floating Popup**: Draggable mini popup showing real-time status
- **Settings Page**: Full configuration for BIN, emails, and form data

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this extension folder

## Usage

1. Open Settings (click ⚙ in popup) and configure:
   - BIN pattern (e.g., `453789xxxxxxxxxx`)
   - Email list (one per line)
   - First/Last name
   - Postal code

2. Navigate to Adobe checkout page
3. Click Start in the floating popup or extension popup

## BIN Format

Use `x` for random digits:
- `453789xxxxxxxxxx` - Random card with BIN 453789
- `4537890000000000` - Fixed card number

## File Structure

```
├── manifest.json       # Extension manifest
├── popup.html/js/css   # Extension popup
├── settings.html/js/css # Settings page
├── content.js          # Page automation
├── background.js       # Service worker
├── floating-popup.css  # In-page popup styles
├── lib/
│   └── cc-generator.js # Luhn algorithm CC generator
└── icons/              # Extension icons
```

## ⚠️ Disclaimer

This extension is for educational and testing purposes only. Use responsibly.
