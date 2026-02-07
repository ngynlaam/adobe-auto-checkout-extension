/**
 * CC Generator - BIN-based Credit Card Generator with Luhn Algorithm
 * Generates mathematically valid credit card numbers for testing purposes
 */

const CCGenerator = {
    /**
     * Luhn Algorithm - Calculate check digit
     * @param {string} cardNumberWithoutCheck - Card number without last digit
     * @returns {number} - Valid check digit (0-9)
     */
    calculateLuhnCheckDigit(cardNumberWithoutCheck) {
        let sum = 0;
        let isOdd = true;

        for (let i = cardNumberWithoutCheck.length - 1; i >= 0; i--) {
            let digit = parseInt(cardNumberWithoutCheck[i], 10);

            if (isOdd) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }

            sum += digit;
            isOdd = !isOdd;
        }

        return (10 - (sum % 10)) % 10;
    },

    /**
     * Validate card number using Luhn Algorithm
     * @param {string} cardNumber - Full card number
     * @returns {boolean} - True if valid
     */
    validateLuhn(cardNumber) {
        const digits = cardNumber.replace(/\D/g, '');
        if (digits.length < 13 || digits.length > 19) return false;

        const withoutCheck = digits.slice(0, -1);
        const checkDigit = parseInt(digits.slice(-1), 10);

        return this.calculateLuhnCheckDigit(withoutCheck) === checkDigit;
    },

    /**
     * Generate random digit
     * @returns {string} - Random digit 0-9
     */
    randomDigit() {
        return Math.floor(Math.random() * 10).toString();
    },

    /**
     * Parse BIN input and replace wildcards with random digits
     * Supports formats:
     * - 453789xxxxxxxxxx (x = random)
     * - 4537890000000000 (fixed)
     * - 453789|12|2026 (with expiry)
     * @param {string} binInput - BIN pattern
     * @returns {object} - { bin, month, year }
     */
    parseBinInput(binInput) {
        const parts = binInput.split('|');
        let bin = parts[0].trim();
        let month = parts[1] ? parts[1].trim() : null;
        let year = parts[2] ? parts[2].trim() : null;

        return { bin, month, year };
    },

    /**
     * Generate card number from BIN pattern
     * @param {string} binPattern - BIN with x wildcards
     * @param {number} length - Total card length (default 16)
     * @returns {string} - Valid card number
     */
    generateCardNumber(binPattern, length = 16) {
        // Replace x/X with random digits
        let cardDigits = binPattern.toLowerCase().replace(/x/g, () => this.randomDigit());

        // Pad with random digits if needed (excluding check digit)
        while (cardDigits.length < length - 1) {
            cardDigits += this.randomDigit();
        }

        // Trim if too long
        cardDigits = cardDigits.slice(0, length - 1);

        // Calculate and append Luhn check digit
        const checkDigit = this.calculateLuhnCheckDigit(cardDigits);

        return cardDigits + checkDigit;
    },

    /**
     * Generate random expiry date (future date)
     * @returns {object} - { month: 'MM', year: 'YY' }
     */
    generateExpiry() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        // Random year 1-4 years in future
        const futureYears = Math.floor(Math.random() * 4) + 1;
        const year = currentYear + futureYears;

        // Random month 1-12
        let month = Math.floor(Math.random() * 12) + 1;

        // If same year, ensure month is in future
        if (year === currentYear && month <= currentMonth) {
            month = currentMonth + Math.floor(Math.random() * (12 - currentMonth)) + 1;
        }

        return {
            month: month.toString().padStart(2, '0'),
            year: year.toString().slice(-2)
        };
    },

    /**
     * Generate random CVV
     * @param {number} length - CVV length (3 or 4 for Amex)
     * @returns {string} - Random CVV
     */
    generateCVV(length = 3) {
        let cvv = '';
        for (let i = 0; i < length; i++) {
            cvv += this.randomDigit();
        }
        return cvv;
    },

    /**
     * Detect card type from BIN
     * @param {string} cardNumber - Card number or BIN
     * @returns {string} - Card type
     */
    detectCardType(cardNumber) {
        const bin = cardNumber.replace(/\D/g, '').slice(0, 6);

        if (/^4/.test(bin)) return 'VISA';
        if (/^5[1-5]/.test(bin)) return 'MASTERCARD';
        if (/^3[47]/.test(bin)) return 'AMEX';
        if (/^6(?:011|5)/.test(bin)) return 'DISCOVER';
        if (/^35(?:2[89]|[3-8])/.test(bin)) return 'JCB';
        if (/^62/.test(bin)) return 'UNIONPAY';

        return 'UNKNOWN';
    },

    /**
     * Generate complete card data from BIN
     * @param {string} binInput - BIN pattern (with optional |MM|YYYY)
     * @returns {object} - Complete card data
     */
    generate(binInput) {
        const parsed = this.parseBinInput(binInput);
        const cardNumber = this.generateCardNumber(parsed.bin);
        const cardType = this.detectCardType(cardNumber);

        let expiry;
        if (parsed.month && parsed.year) {
            expiry = {
                month: parsed.month.padStart(2, '0'),
                year: parsed.year.length === 4 ? parsed.year.slice(-2) : parsed.year
            };
        } else {
            expiry = this.generateExpiry();
        }

        const cvvLength = cardType === 'AMEX' ? 4 : 3;
        const cvv = this.generateCVV(cvvLength);

        return {
            cardNumber,
            cardType,
            expiry,
            cvv,
            formatted: {
                cardNumber: cardNumber.replace(/(\d{4})/g, '$1 ').trim(),
                expiry: `${expiry.month}/${expiry.year}`
            }
        };
    },

    /**
     * Generate multiple cards
     * @param {string} binInput - BIN pattern
     * @param {number} count - Number of cards to generate
     * @returns {array} - Array of card objects
     */
    generateBatch(binInput, count = 10) {
        const cards = [];
        for (let i = 0; i < count; i++) {
            cards.push(this.generate(binInput));
        }
        return cards;
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCGenerator;
}
