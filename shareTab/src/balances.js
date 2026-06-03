// ============================================
// Balances Module
// Debt simplification using min-cash-flow algorithm
// ============================================

// Currency symbols for display
const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', SGD: 'S$', AUD: 'A$',
    CAD: 'C$', JPY: '¥', CNY: '¥', MYR: 'RM', THB: '฿'
};

export function getCurrencySymbol(code) {
    return CURRENCY_SYMBOLS[code] || code + ' ';
}

// ============================================
// Calculate Net Balances
// Returns: { currency: { uid: netAmount } }
// Positive = owed money, Negative = owes money
// ============================================
export function calculateNetBalances(expenses, settlements) {
    // Group balances by currency
    const balancesByCurrency = {};

    // Process expenses
    for (const expense of expenses) {
        const { currency, paidBy, splitAmounts } = expense;
        if (!balancesByCurrency[currency]) {
            balancesByCurrency[currency] = {};
        }
        const balances = balancesByCurrency[currency];

        // Payer is owed the total split amount by others
        for (const [uid, amount] of Object.entries(splitAmounts)) {
            if (!balances[uid]) balances[uid] = 0;
            if (!balances[paidBy]) balances[paidBy] = 0;

            if (uid !== paidBy) {
                // uid owes paidBy this amount
                balances[uid] -= amount;
                balances[paidBy] += amount;
            }
        }
    }

    // Process settlements (reduce debts)
    for (const settlement of settlements) {
        const { currency, from, to, amount } = settlement;
        if (!balancesByCurrency[currency]) {
            balancesByCurrency[currency] = {};
        }
        const balances = balancesByCurrency[currency];

        if (!balances[from]) balances[from] = 0;
        if (!balances[to]) balances[to] = 0;

        // 'from' paid 'to', so from's debt decreases, to's credit decreases
        balances[from] += amount;
        balances[to] -= amount;
    }

    return balancesByCurrency;
}

// ============================================
// Simplify Debts (Min Cash Flow Algorithm)
// Returns array of: { from, to, amount, currency }
// ============================================
export function simplifyDebts(expenses, settlements) {
    const balancesByCurrency = calculateNetBalances(expenses, settlements);
    const simplifiedDebts = [];

    for (const [currency, balances] of Object.entries(balancesByCurrency)) {
        // Separate into creditors (positive) and debtors (negative)
        const creditors = []; // people who are owed money
        const debtors = [];   // people who owe money

        for (const [uid, amount] of Object.entries(balances)) {
            const rounded = Math.round(amount * 100) / 100;
            if (rounded > 0.01) {
                creditors.push({ uid, amount: rounded });
            } else if (rounded < -0.01) {
                debtors.push({ uid, amount: Math.abs(rounded) });
            }
        }

        // Sort by amount descending for greedy matching
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        // Greedy matching: pair largest debtor with largest creditor
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const transferAmount = Math.min(debtors[i].amount, creditors[j].amount);
            
            if (transferAmount > 0.01) {
                simplifiedDebts.push({
                    from: debtors[i].uid,
                    to: creditors[j].uid,
                    amount: Math.round(transferAmount * 100) / 100,
                    currency
                });
            }

            debtors[i].amount -= transferAmount;
            creditors[j].amount -= transferAmount;

            if (debtors[i].amount < 0.01) i++;
            if (creditors[j].amount < 0.01) j++;
        }
    }

    return simplifiedDebts;
}

// ============================================
// Calculate Overall Balance for a User
// Returns: { owed: { currency: amount }, owes: { currency: amount } }
// ============================================
export function getUserOverallBalance(uid, allGroupsData) {
    const owed = {}; // money others owe the user
    const owes = {}; // money user owes others

    for (const { expenses, settlements } of allGroupsData) {
        const debts = simplifyDebts(expenses, settlements);
        
        for (const debt of debts) {
            if (debt.to === uid) {
                // Someone owes user
                if (!owed[debt.currency]) owed[debt.currency] = 0;
                owed[debt.currency] += debt.amount;
            }
            if (debt.from === uid) {
                // User owes someone
                if (!owes[debt.currency]) owes[debt.currency] = 0;
                owes[debt.currency] += debt.amount;
            }
        }
    }

    return { owed, owes };
}

// ============================================
// Format currency amount for display
// ============================================
export function formatAmount(amount, currency) {
    const symbol = getCurrencySymbol(currency);
    const formatted = Math.abs(amount).toFixed(currency === 'JPY' ? 0 : 2);
    return `${symbol}${formatted}`;
}
