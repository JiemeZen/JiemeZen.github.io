// ============================================
// App.js — Main Application Controller
// ============================================

import { signUp, logIn, logOut, getCurrentUser, waitForAuth } from './auth.js';
import { createGroup, addMemberByEmail, getGroup, listenToUserGroups, listenToGroup, cleanupGroupListeners, updateGroupSettings, updateGroupName } from './groups.js';
import { addExpense, updateExpense, deleteExpense, listenToExpenses } from './expenses.js';
import { simplifyDebts, formatAmount, getCurrencySymbol } from './balances.js';
import { settleUp, listenToSettlements } from './settle.js';
import { db, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, orderBy } from './config.js';

// ============================================
// State
// ============================================
let currentGroupId = null;
let currentGroup = null;
let currentExpenses = [];
let currentSettlements = [];
let expenseUnsub = null;
let settlementUnsub = null;
let groupUnsub = null;
let allGroups = [];
let userSettings = { defaultCurrency: 'SGD', displayName: '' };

const AVAILABLE_CURRENCIES = ['SGD', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY', 'MYR', 'THB'];

// Type emoji map
const TYPE_EMOJIS = {
    food: '🍔', transport: '🚕', ticket: '🎫', shopping: '🛍️',
    stay: '🏨', drinks: '🍺', grocery: '🛒', bills: '📄',
    health: '💊', entertainment: '🎬', gift: '🎁', other: '📌'
};

const TYPE_COLORS = {
    food: '#FF9800', transport: '#2196F3', ticket: '#9C27B0', shopping: '#E91E63',
    stay: '#00BCD4', drinks: '#FF5722', grocery: '#4CAF50', bills: '#607D8B',
    health: '#F44336', entertainment: '#673AB7', gift: '#FFEB3B', other: '#9E9E9E'
};

function normalizeCurrencyList(currencies, fallback = 'SGD') {
    const safeFallback = AVAILABLE_CURRENCIES.includes(fallback) ? fallback : 'SGD';
    const normalized = [...new Set((currencies || []).filter(c => AVAILABLE_CURRENCIES.includes(c)))];
    if (!normalized.includes(safeFallback)) normalized.unshift(safeFallback);
    return normalized.length ? normalized : [safeFallback];
}

function getGroupEnabledCurrencies(extraCurrency = null) {
    const fallback = currentGroup?.defaultCurrency || userSettings.defaultCurrency || 'SGD';
    const configured = Array.isArray(currentGroup?.enabledCurrencies) && currentGroup.enabledCurrencies.length
        ? currentGroup.enabledCurrencies
        : [fallback];
    return normalizeCurrencyList(extraCurrency ? [...configured, extraCurrency] : configured, fallback);
}

function renderCurrencyOptions(selectEl, currencies, selectedCurrency) {
    const options = normalizeCurrencyList(currencies, selectedCurrency || currencies?.[0] || 'SGD');
    selectEl.innerHTML = options.map(currency => `<option value="${currency}">${currency}</option>`).join('');
    selectEl.value = options.includes(selectedCurrency) ? selectedCurrency : options[0];
}

// ============================================
// Toast Notification
// ============================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const inner = toast.querySelector('div');
    inner.textContent = message;
    inner.className = `px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium max-w-sm ${type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-primary'}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ============================================
// Router (inline simple hash router)
// ============================================
function navigate(hash) {
    window.location.hash = hash;
}

function getRoute() {
    const hash = window.location.hash.slice(1) || 'login';
    if (hash.startsWith('group/')) return { view: 'group', groupId: hash.split('/')[1] };
    return { view: hash };
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const el = document.getElementById(`view-${viewId}`);
    if (el) el.classList.remove('hidden');
}

function handleRoute() {
    const route = getRoute();
    const user = getCurrentUser();

    const authRequired = ['dashboard', 'group', 'settings'];
    if (authRequired.includes(route.view) && !user) {
        navigate('login');
        return;
    }
    if ((route.view === 'login' || route.view === 'signup') && user) {
        navigate('dashboard');
        return;
    }

    const header = document.getElementById('app-header');
    if (user && route.view !== 'login' && route.view !== 'signup') {
        header.classList.remove('hidden');
    } else {
        header.classList.add('hidden');
    }

    if (route.view === 'group') {
        showView('group');
        loadGroup(route.groupId);
    } else if (route.view === 'settings') {
        showView('settings');
        loadSettings();
    } else if (route.view === 'dashboard') {
        showView('dashboard');
        loadDashboard();
    } else {
        showView(route.view);
    }
}

window.addEventListener('hashchange', handleRoute);

// ============================================
// Dark Mode
// ============================================
function initDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.documentElement.classList.add('dark');
    updateDarkIcons(isDark);
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark);
    updateDarkIcons(isDark);
}

function updateDarkIcons(isDark) {
    document.getElementById('icon-sun').classList.toggle('hidden', !isDark);
    document.getElementById('icon-moon').classList.toggle('hidden', isDark);
}

// ============================================
// Settings
// ============================================
async function loadSettings() {
    const user = getCurrentUser();
    if (!user) return;
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            userSettings.defaultCurrency = data.defaultCurrency || 'SGD';
            userSettings.displayName = data.displayName || user.displayName || '';
        }
    } catch (e) { /* ignore */ }
    document.getElementById('settings-name').value = userSettings.displayName;
    document.getElementById('settings-currency').value = userSettings.defaultCurrency;
}

async function saveSettings() {
    const user = getCurrentUser();
    if (!user) return;
    const name = document.getElementById('settings-name').value.trim();
    const currency = document.getElementById('settings-currency').value;
    try {
        await setDoc(doc(db, 'users', user.uid), {
            displayName: name,
            defaultCurrency: currency,
            email: user.email
        }, { merge: true });
        userSettings.displayName = name;
        userSettings.defaultCurrency = currency;
        document.getElementById('user-display-name').textContent = name;
        showToast('Settings saved!');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ============================================
// Dashboard
// ============================================
function loadDashboard() {
    const user = getCurrentUser();
    if (!user) return;
    document.getElementById('user-display-name').textContent = user.displayName || user.email;

    listenToUserGroups((groups) => {
        allGroups = groups;
        renderGroupList(groups);
        renderOverallBalance(groups);
    });
}

function renderGroupList(groups) {
    const container = document.getElementById('group-list');
    const empty = document.getElementById('empty-groups');

    if (groups.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    // Render cards with placeholder, then fill in balances async
    container.innerHTML = groups.map(g => {
        const createdDate = g.createdAt?.toDate ? g.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        return `
        <a href="#group/${g.id}" class="block bg-white dark:bg-dark-card rounded-xl border border-gray-100 dark:border-gray-700 p-3 hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-sm text-gray-800 dark:text-gray-100">${escapeHtml(g.name)}</h3>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">${g.memberUids.length} member${g.memberUids.length > 1 ? 's' : ''} · ${g.defaultCurrency || 'SGD'}${createdDate ? ' · ' + createdDate : ''}</p>
                </div>
                <div class="text-right mr-2 min-w-0 max-w-[52%]" id="group-balance-${g.id}">
                    <p class="text-[10px] text-gray-400">—</p>
                </div>
                <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </div>
        </a>
    `}).join('');

    // Fill in per-group balances asynchronously
    renderGroupBalances(groups);
}

async function renderGroupBalances(groups) {
    const user = getCurrentUser();
    if (!user) return;

    for (const group of groups) {
        try {
            const expSnap = await getDocs(query(collection(db, 'groups', group.id, 'expenses'), orderBy('createdAt', 'desc')));
            const setSnap = await getDocs(query(collection(db, 'groups', group.id, 'settlements'), orderBy('createdAt', 'desc')));
            const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const settlements = setSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const debts = simplifyDebts(expenses, settlements);

            let owed = {};
            let owe = {};
            for (const debt of debts) {
                if (debt.to === user.uid) {
                    owed[debt.currency] = (owed[debt.currency] || 0) + debt.amount;
                }
                if (debt.from === user.uid) {
                    owe[debt.currency] = (owe[debt.currency] || 0) + debt.amount;
                }
            }

            const el = document.getElementById(`group-balance-${group.id}`);
            if (!el) continue;

            const owedEntries = Object.entries(owed);
            const oweEntries = Object.entries(owe);

            if (owedEntries.length === 0 && oweEntries.length === 0) {
                el.innerHTML = `<p class="text-[12px] text-gray-400">settled</p>`;
            } else {
                const owedText = owedEntries.length > 0 ? owedEntries.map(([c, a]) => formatAmount(a, c)).join(', ') : formatAmount(0, group.defaultCurrency || 'SGD');
                const oweText = oweEntries.length > 0 ? oweEntries.map(([c, a]) => formatAmount(a, c)).join(', ') : formatAmount(0, group.defaultCurrency || 'SGD');
                el.innerHTML = `
                    <p class="text-[12px] font-medium text-green-600 truncate">owed ${owedText}</p>
                    <p class="text-[12px] font-medium text-red-500 truncate">owe ${oweText}</p>
                `;
            }
        } catch (e) {
            console.error('Error calculating group balance', group.id, e);
        }
    }
}

async function renderOverallBalance(groups) {
    const user = getCurrentUser();
    if (!user || groups.length === 0) {
        document.getElementById('total-owed').textContent = `$0.00`;
        document.getElementById('total-owe').textContent = `$0.00`;
        return;
    }

    let totalOwed = {}; // currency -> amount others owe me
    let totalOwe = {};  // currency -> amount I owe others

    for (const group of groups) {
        try {
            const expSnap = await getDocs(query(collection(db, 'groups', group.id, 'expenses'), orderBy('createdAt', 'desc')));
            const setSnap = await getDocs(query(collection(db, 'groups', group.id, 'settlements'), orderBy('createdAt', 'desc')));
            const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const settlements = setSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const debts = simplifyDebts(expenses, settlements);

            for (const debt of debts) {
                if (debt.to === user.uid) {
                    totalOwed[debt.currency] = (totalOwed[debt.currency] || 0) + debt.amount;
                }
                if (debt.from === user.uid) {
                    totalOwe[debt.currency] = (totalOwe[debt.currency] || 0) + debt.amount;
                }
            }
        } catch (e) {
            console.error('Error calculating balance for group', group.id, e);
        }
    }

    // Format: show primary currency or multi-currency
    const owedEntries = Object.entries(totalOwed);
    const oweEntries = Object.entries(totalOwe);

    document.getElementById('total-owed').textContent = owedEntries.length === 0
        ? '$0.00'
        : owedEntries.map(([c, a]) => formatAmount(a, c)).join(' + ');
    document.getElementById('total-owe').textContent = oweEntries.length === 0
        ? '$0.00'
        : oweEntries.map(([c, a]) => formatAmount(a, c)).join(' + ');
}

// ============================================
// Group Detail
// ============================================
function loadGroup(groupId) {
    if (currentGroupId === groupId && currentGroup) return;
    cleanupGroupDetail();
    currentGroupId = groupId;

    groupUnsub = listenToGroup(groupId, (group) => {
        currentGroup = group;
        renderGroupHeader(group);
    });

    expenseUnsub = listenToExpenses(groupId, (expenses) => {
        currentExpenses = expenses;
        renderExpenses();
        renderBalances();
        renderChart();
    });

    settlementUnsub = listenToSettlements(groupId, (settlements) => {
        currentSettlements = settlements;
        renderHistory();
        renderBalances();
    });
}

function cleanupGroupDetail() {
    if (expenseUnsub) expenseUnsub();
    if (settlementUnsub) settlementUnsub();
    if (groupUnsub) groupUnsub();
    expenseUnsub = null;
    settlementUnsub = null;
    groupUnsub = null;
    currentGroupId = null;
    currentGroup = null;
    currentExpenses = [];
    currentSettlements = [];
}

function renderGroupHeader(group) {
    document.getElementById('group-name').textContent = group.name;
    document.getElementById('group-members-count').textContent = `${group.memberUids.length} member${group.memberUids.length > 1 ? 's' : ''} · ${group.defaultCurrency || 'SGD'}`;
}

// ============================================
// Expense Rendering
// ============================================
function renderExpenses() {
    const sorted = sortExpenses(currentExpenses);
    const container = document.getElementById('expense-list');
    const empty = document.getElementById('empty-expenses');

    if (sorted.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    container.innerHTML = sorted.map(exp => {
        const payer = currentGroup?.members?.[exp.paidBy]?.displayName || 'Unknown';
        const typeEmoji = TYPE_EMOJIS[exp.type] || '📌';
        const dateStr = exp.date?.toDate ? exp.date.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
        const currency = exp.currency || currentGroup?.defaultCurrency || 'SGD';
        const perspective = getExpenseUserPerspective(exp, currency);
        return `
            <div class="expense-card bg-white dark:bg-dark-card rounded-lg border border-gray-100 dark:border-gray-700 p-2.5 cursor-pointer hover:shadow-sm transition-shadow" data-expense-id="${exp.id}">
                <div class="flex items-center gap-2.5">
                    <span class="text-lg flex-shrink-0">${typeEmoji}</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">${escapeHtml(exp.description)}</p>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400">${payer} · ${dateStr}</p>
                        <p class="text-[10px] font-medium ${perspective.className} truncate">${perspective.text}</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">${formatAmount(exp.amount, currency)}</p>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500">${exp.splitBetween?.length || 0} ppl</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Click to edit
    container.querySelectorAll('.expense-card').forEach(card => {
        card.addEventListener('click', () => {
            const expenseId = card.dataset.expenseId;
            openEditExpense(expenseId);
        });
    });
}

function getExpenseUserPerspective(exp, currency) {
    const user = getCurrentUser();
    if (!user) return { text: '', className: 'text-gray-400 dark:text-gray-500' };

    const amount = Number(exp.amount) || 0;
    const userShare = Number(exp.splitAmounts?.[user.uid] || 0);
    const paid = exp.paidBy === user.uid ? amount : 0;

    if (exp.paidBy === user.uid) {
        const lent = Math.max(0, amount - userShare);
        return {
            text: `Paid ${formatAmount(paid, currency)} · Lent ${formatAmount(lent, currency)}`,
            className: lent > 0 ? 'text-primary' : 'text-gray-500 dark:text-gray-400'
        };
    }

    if (userShare > 0) {
        return {
            text: `Paid ${formatAmount(0, currency)} · Owe ${formatAmount(userShare, currency)}`,
            className: 'text-secondary'
        };
    }

    return {
        text: `Paid ${formatAmount(0, currency)} · Not split with you`,
        className: 'text-gray-400 dark:text-gray-500'
    };
}

function formatAmountWithCode(amount, currency) {
    return `${formatAmount(amount, currency)} ${currency}`;
}

function sortExpenses(expenses) {
    const sortVal = document.getElementById('expense-sort')?.value || 'date-desc';
    const sorted = [...expenses];
    switch (sortVal) {
        case 'date-asc':
            sorted.sort((a, b) => getExpTimestamp(a) - getExpTimestamp(b));
            break;
        case 'date-desc':
            sorted.sort((a, b) => getExpTimestamp(b) - getExpTimestamp(a));
            break;
        case 'amount-desc':
            sorted.sort((a, b) => b.amount - a.amount);
            break;
        case 'amount-asc':
            sorted.sort((a, b) => a.amount - b.amount);
            break;
        case 'type':
            sorted.sort((a, b) => (a.type || 'other').localeCompare(b.type || 'other'));
            break;
    }
    return sorted;
}

function getExpTimestamp(exp) {
    if (exp.date?.toDate) return exp.date.toDate().getTime();
    if (exp.createdAt?.toDate) return exp.createdAt.toDate().getTime();
    return 0;
}

// ============================================
// Balances Tab
// ============================================
function renderBalances() {
    const container = document.getElementById('balance-list');
    const empty = document.getElementById('empty-balances');
    if (!currentGroup) return;

    const debts = simplifyDebts(currentExpenses, currentSettlements);
    if (debts.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    container.innerHTML = debts.map(d => {
        const fromName = currentGroup.members?.[d.from]?.displayName || 'Unknown';
        const toName = currentGroup.members?.[d.to]?.displayName || 'Unknown';
        return `
            <div class="bg-white dark:bg-dark-card rounded-lg border border-gray-100 dark:border-gray-700 p-3 flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-800 dark:text-gray-100"><span class="font-medium">${escapeHtml(fromName)}</span> owes <span class="font-medium">${escapeHtml(toName)}</span></p>
                    <p class="text-xs text-secondary font-semibold">${formatAmountWithCode(d.amount, d.currency || currentGroup.defaultCurrency || 'SGD')}</p>
                </div>
                <button class="btn-settle text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium hover:bg-primary/20 transition-colors" data-from="${d.from}" data-to="${d.to}" data-amount="${d.amount}" data-currency="${d.currency || currentGroup.defaultCurrency || 'SGD'}">Settle</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.btn-settle').forEach(btn => {
        btn.addEventListener('click', () => {
            openSettleModal(btn.dataset.from, btn.dataset.to, btn.dataset.amount, btn.dataset.currency);
        });
    });
}

// ============================================
// Chart Tab
// ============================================
function renderChart() {
    const container = document.getElementById('chart-bars');
    const empty = document.getElementById('empty-chart');
    if (currentExpenses.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    // Aggregate by currency first so large-denomination currencies do not dominate the whole chart.
    const totalsByCurrency = {};
    currentExpenses.forEach(exp => {
        const type = exp.type || 'other';
        const currency = exp.currency || currentGroup?.defaultCurrency || 'SGD';
        const amount = Number(exp.amount) || 0;

        totalsByCurrency[currency] = totalsByCurrency[currency] || { total: 0, types: {} };
        totalsByCurrency[currency].total += amount;
        totalsByCurrency[currency].types[type] = (totalsByCurrency[currency].types[type] || 0) + amount;
    });

    const currencyOrder = getGroupEnabledCurrencies();
    const sortedCurrencies = Object.keys(totalsByCurrency).sort((a, b) => {
        const aIndex = currencyOrder.indexOf(a);
        const bIndex = currencyOrder.indexOf(b);
        if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        return a.localeCompare(b);
    });

    container.innerHTML = sortedCurrencies.map(currency => {
        const group = totalsByCurrency[currency];
        const sortedTypes = Object.entries(group.types).sort((a, b) => b[1] - a[1]);
        return `
            <section class="chart-currency-group">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">${currency}</span>
                    <span class="chart-currency-total">${formatAmountWithCode(group.total, currency)}</span>
                </div>
                <div class="space-y-2">
                    ${sortedTypes.map(([type, amount]) => {
                        const pct = group.total > 0 ? Math.round((amount / group.total) * 100) : 0;
                        const emoji = TYPE_EMOJIS[type] || '📌';
                        const color = TYPE_COLORS[type] || '#9E9E9E';
                        return `
                            <div class="flex items-center gap-2">
                                <span class="text-sm w-6 text-center">${emoji}</span>
                                <div class="flex-1 min-w-0">
                                    <div class="flex justify-between gap-2 text-xs mb-0.5">
                                        <span class="text-gray-700 dark:text-gray-300 capitalize truncate">${type}</span>
                                        <span class="text-gray-500 dark:text-gray-400 whitespace-nowrap">${formatAmount(amount, currency)} (${pct}%)</span>
                                    </div>
                                    <div class="h-2 bg-gray-100 dark:bg-dark-input rounded-full overflow-hidden">
                                        <div class="h-full rounded-full transition-all" style="width:${pct}%; background:${color}"></div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    }).join('');
}

// ============================================
// History Tab
// ============================================
function renderHistory() {
    const container = document.getElementById('history-list');
    const empty = document.getElementById('empty-history');
    if (!currentGroup) return;

    if (currentSettlements.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    container.innerHTML = currentSettlements.map(s => {
        const fromName = currentGroup.members?.[s.from]?.displayName || 'Unknown';
        const toName = currentGroup.members?.[s.to]?.displayName || 'Unknown';
        const dateStr = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
        return `
            <div class="bg-white dark:bg-dark-card rounded-lg border border-gray-100 dark:border-gray-700 p-2.5">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-xs text-gray-800 dark:text-gray-100"><span class="font-medium">${escapeHtml(fromName)}</span> paid <span class="font-medium">${escapeHtml(toName)}</span></p>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500">${dateStr}</p>
                    </div>
                    <p class="text-sm font-semibold text-primary">${formatAmount(s.amount, s.currency || currentGroup.defaultCurrency || 'SGD')}</p>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Add/Edit Expense Modal
// ============================================
function openAddExpense() {
    if (!currentGroup) return;
    document.getElementById('expense-modal-title').textContent = 'Add Expense';
    document.getElementById('expense-submit-btn').textContent = 'Save Expense';
    document.getElementById('expense-edit-id').value = '';
    document.getElementById('form-add-expense').reset();
    document.getElementById('expense-type').value = 'other';
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];

    // Set currency to group default
    const currency = currentGroup.defaultCurrency || userSettings.defaultCurrency || 'SGD';
    renderCurrencyOptions(document.getElementById('expense-currency'), getGroupEnabledCurrencies(), currency);

    populateExpenseForm();
    clearTypeSelection();
    selectType('other');
    // Reset split type to Equal
    document.getElementById('split-equal').classList.add('border-primary', 'bg-primary/10', 'text-primary');
    document.getElementById('split-equal').classList.remove('border-gray-200', 'dark:border-gray-600', 'text-gray-500', 'dark:text-gray-400');
    document.getElementById('split-unequal').classList.remove('border-primary', 'bg-primary/10', 'text-primary');
    document.getElementById('split-unequal').classList.add('border-gray-200', 'dark:border-gray-600', 'text-gray-500', 'dark:text-gray-400');
    document.getElementById('unequal-split-inputs').classList.add('hidden');
    document.getElementById('unequal-split-inputs').innerHTML = '';
    showModal('modal-add-expense');
}

function openEditExpense(expenseId) {
    const expense = currentExpenses.find(e => e.id === expenseId);
    if (!expense || !currentGroup) return;

    document.getElementById('expense-modal-title').textContent = 'Edit Expense';
    document.getElementById('expense-submit-btn').textContent = 'Update Expense';
    document.getElementById('expense-edit-id').value = expenseId;
    document.getElementById('expense-desc').value = expense.description;
    document.getElementById('expense-amount').value = expense.amount;
    const expenseCurrency = expense.currency || currentGroup.defaultCurrency || 'SGD';
    renderCurrencyOptions(document.getElementById('expense-currency'), getGroupEnabledCurrencies(expenseCurrency), expenseCurrency);

    // Date
    if (expense.date?.toDate) {
        const d = expense.date.toDate();
        document.getElementById('expense-date').value = d.toISOString().split('T')[0];
    } else {
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    }

    populateExpenseForm();

    // Set paid by
    document.getElementById('expense-paid-by').value = expense.paidBy;

    // Set split members — only select users who were part of the original expense
    const isDark = document.documentElement.classList.contains('dark');
    const selectedStyle = 'background:#5BC5A7;color:#fff;';
    const unselectedStyle = isDark ? 'background:#3A3A3C;color:#9CA3AF;' : 'background:#E5E7EB;color:#6B7280;';
    const splitContainer = document.getElementById('expense-split-members');
    splitContainer.querySelectorAll('label').forEach(label => {
        const cb = label.querySelector('input');
        const isInSplit = expense.splitBetween?.includes(cb.value);
        cb.checked = isInSplit;
        label.style.cssText = isInSplit ? selectedStyle : unselectedStyle;
    });

    // Set type
    clearTypeSelection();
    selectType(expense.type || 'other');
    document.getElementById('expense-type').value = expense.type || 'other';

    showModal('modal-add-expense');
}

function populateExpenseForm() {
    if (!currentGroup) return;
    const user = getCurrentUser();
    const members = currentGroup.members || {};
    const paidBySelect = document.getElementById('expense-paid-by');
    const splitContainer = document.getElementById('expense-split-members');

    paidBySelect.innerHTML = Object.entries(members).map(([uid, m]) =>
        `<option value="${uid}" ${uid === user.uid ? 'selected' : ''}>${escapeHtml(m.displayName || m.email)}</option>`
    ).join('');

    splitContainer.innerHTML = Object.entries(members).map(([uid, m]) =>
        `<label class="inline-flex items-center gap-1 max-w-full px-2.5 py-1 rounded-full text-xs cursor-pointer transition-all select-none font-medium" style="background:#5BC5A7;color:#fff;">
            <input type="checkbox" value="${uid}" checked class="hidden member-check">
            <span class="truncate">${escapeHtml(m.displayName || m.email)}</span>
        </label>`
    ).join('');

    const isDark = document.documentElement.classList.contains('dark');
    const selectedStyle = 'background:#5BC5A7;color:#fff;';
    const unselectedStyle = isDark ? 'background:#3A3A3C;color:#9CA3AF;' : 'background:#E5E7EB;color:#6B7280;';

    // Toggle chip style on check
    splitContainer.querySelectorAll('label').forEach(label => {
        const cb = label.querySelector('input');
        label.addEventListener('click', (e) => {
            e.preventDefault();
            cb.checked = !cb.checked;
            label.style.cssText = cb.checked ? selectedStyle : unselectedStyle;
        });
    });

    // "For Me" button — select only current user
    const forMeBtn = document.getElementById('btn-for-me');
    const forMeInactive = 'background:rgba(255,101,47,0.15);color:#FF652F;';
    const forMeActive = 'background:#FF652F;color:#fff;';
    forMeBtn.style.cssText = forMeInactive;

    forMeBtn.onclick = () => {
        const allChecked = [...splitContainer.querySelectorAll('input')].filter(cb => cb.checked);
        const isOnlyMe = allChecked.length === 1 && allChecked[0].value === user.uid;

        if (isOnlyMe) {
            // Deactivate: select everyone
            splitContainer.querySelectorAll('label').forEach(label => {
                const cb = label.querySelector('input');
                cb.checked = true;
                label.style.cssText = selectedStyle;
            });
            forMeBtn.style.cssText = forMeInactive;
        } else {
            // Activate: select only me
            splitContainer.querySelectorAll('label').forEach(label => {
                const cb = label.querySelector('input');
                if (cb.value === user.uid) {
                    cb.checked = true;
                    label.style.cssText = selectedStyle;
                } else {
                    cb.checked = false;
                    label.style.cssText = unselectedStyle;
                }
            });
            forMeBtn.style.cssText = forMeActive;
        }
    };

    // Update For Me button state when individual chips are toggled
    const updateForMeState = () => {
        const allChecked = [...splitContainer.querySelectorAll('input')].filter(cb => cb.checked);
        const isOnlyMe = allChecked.length === 1 && allChecked[0].value === user.uid;
        forMeBtn.style.cssText = isOnlyMe ? forMeActive : forMeInactive;
    };
    splitContainer.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', () => setTimeout(updateForMeState, 0));
    });
}

function clearTypeSelection() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('border-primary', 'bg-primary/10');
        btn.classList.add('border-transparent');
    });
}

function renderUnequalSplitInputs() {
    if (!currentGroup) return;
    const container = document.getElementById('unequal-split-inputs');
    const members = currentGroup.members || {};
    const splitChecked = [...document.querySelectorAll('#expense-split-members input:checked')];

    container.innerHTML = splitChecked.map(cb => {
        const uid = cb.value;
        const name = members[uid]?.displayName || members[uid]?.email || uid;
        return `<div class="flex items-center gap-2">
            <span class="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">${escapeHtml(name)}</span>
            <input type="number" step="0.01" min="0" placeholder="0.00" data-uid="${uid}" class="unequal-amount w-24 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 dark:bg-dark-card rounded-lg text-right">
        </div>`;
    }).join('');

    // Add remaining display
    container.innerHTML += `<div class="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
        <span class="text-[10px] text-gray-500 dark:text-gray-400">Remaining</span>
        <span id="unequal-remaining" class="text-xs font-medium text-gray-600 dark:text-gray-300">—</span>
    </div>`;

    container.classList.remove('hidden');

    // Auto-calculation logic
    const inputs = container.querySelectorAll('.unequal-amount');
    inputs.forEach(input => {
        input.addEventListener('input', () => autoCalculateUnequalSplit());
    });
}

function autoCalculateUnequalSplit() {
    const totalAmount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const inputs = [...document.querySelectorAll('.unequal-amount')];
    const remainingEl = document.getElementById('unequal-remaining');

    // Find inputs that have been manually edited (non-empty)
    const filledInputs = inputs.filter(inp => inp.value !== '' && inp.value !== undefined);
    const emptyInputs = inputs.filter(inp => inp.value === '' || inp.value === undefined);
    const filledTotal = filledInputs.reduce((sum, inp) => sum + (parseFloat(inp.value) || 0), 0);
    const remaining = Math.round((totalAmount - filledTotal) * 100) / 100;

    // Update remaining display
    if (remainingEl) {
        remainingEl.textContent = remaining >= 0 ? formatAmount(remaining, document.getElementById('expense-currency').value) : `Over by ${formatAmount(Math.abs(remaining), document.getElementById('expense-currency').value)}`;
        remainingEl.classList.toggle('text-red-500', remaining < 0);
        remainingEl.classList.toggle('text-gray-600', remaining >= 0);
        remainingEl.classList.toggle('dark:text-gray-300', remaining >= 0);
    }

    // If exactly one empty input remains, auto-fill it with the remaining amount
    if (emptyInputs.length === 1 && remaining >= 0) {
        emptyInputs[0].value = remaining.toFixed(2);
    }
}

function selectType(type) {
    const btn = document.querySelector(`.type-btn[data-type="${type}"]`);
    if (btn) {
        btn.classList.add('border-primary', 'bg-primary/10');
        btn.classList.remove('border-transparent');
    }
    document.getElementById('expense-type').value = type;
}

async function handleExpenseSubmit(e) {
    e.preventDefault();
    if (!currentGroupId) return;

    const editId = document.getElementById('expense-edit-id').value;
    const description = document.getElementById('expense-desc').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const currency = document.getElementById('expense-currency').value;
    const type = document.getElementById('expense-type').value;
    const date = document.getElementById('expense-date').value;
    const paidBy = document.getElementById('expense-paid-by').value;
    const splitBetween = [...document.querySelectorAll('#expense-split-members input:checked')].map(cb => cb.value);

    if (splitBetween.length === 0) {
        showToast('Select at least one person to split with', 'error');
        return;
    }

    try {
        const data = { description, amount, currency, paidBy, splitBetween, type, date };

        // Check if unequal split is active
        const isUnequal = !document.getElementById('unequal-split-inputs').classList.contains('hidden');
        if (isUnequal) {
            const inputs = document.querySelectorAll('.unequal-amount');
            const splitAmounts = {};
            let total = 0;
            inputs.forEach(inp => {
                const val = parseFloat(inp.value) || 0;
                splitAmounts[inp.dataset.uid] = val;
                total += val;
            });
            if (Math.abs(total - amount) > 0.02) {
                showToast(`Split amounts (${total.toFixed(2)}) must equal total (${amount.toFixed(2)})`, 'error');
                return;
            }
            data.splitAmounts = splitAmounts;
        }

        if (editId) {
            await updateExpense(currentGroupId, editId, data);
            showToast('Expense updated!');
        } else {
            await addExpense(currentGroupId, data);
            showToast('Expense added!');
        }
        hideModal('modal-add-expense');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// Settle Modal
// ============================================
function openSettleModal(from, to, amount, currencyOverride) {
    if (!currentGroup) return;
    const members = currentGroup.members || {};
    const currency = currencyOverride || currentGroup.defaultCurrency || 'SGD';

    const fromSelect = document.getElementById('settle-from');
    const toSelect = document.getElementById('settle-to');
    fromSelect.innerHTML = Object.entries(members).map(([uid, m]) =>
        `<option value="${uid}" ${uid === from ? 'selected' : ''}>${escapeHtml(m.displayName || m.email)}</option>`
    ).join('');
    toSelect.innerHTML = Object.entries(members).map(([uid, m]) =>
        `<option value="${uid}" ${uid === to ? 'selected' : ''}>${escapeHtml(m.displayName || m.email)}</option>`
    ).join('');

    document.getElementById('settle-amount').value = amount;
    renderCurrencyOptions(document.getElementById('settle-currency'), getGroupEnabledCurrencies(currency), currency);

    // Reset exchange rate fields
    document.getElementById('settle-use-exchange').checked = false;
    document.getElementById('settle-exchange-fields').classList.add('hidden');
    document.getElementById('settle-exchange-rate').value = '';
    document.getElementById('settle-converted-amount').textContent = '';
    renderCurrencyOptions(document.getElementById('settle-pay-currency'), getGroupEnabledCurrencies(currency), currency);

    showModal('modal-settle');
}

function updateSettleConvertedDisplay() {
    const amount = parseFloat(document.getElementById('settle-amount').value) || 0;
    const rate = parseFloat(document.getElementById('settle-exchange-rate').value) || 0;
    const payCurrency = document.getElementById('settle-pay-currency').value;
    const owedCurrency = document.getElementById('settle-currency').value;
    const display = document.getElementById('settle-converted-amount');
    if (rate > 0 && amount > 0) {
        const converted = (amount * rate).toFixed(2);
        display.textContent = `${formatAmount(amount, owedCurrency)} × ${rate} = ${formatAmount(parseFloat(converted), payCurrency)}`;
    } else {
        display.textContent = '';
    }
}

async function handleSettleSubmit(e) {
    e.preventDefault();
    if (!currentGroupId) return;
    const from = document.getElementById('settle-from').value;
    const to = document.getElementById('settle-to').value;
    const amount = parseFloat(document.getElementById('settle-amount').value);
    const currency = document.getElementById('settle-currency').value;

    if (from === to) {
        showToast('From and To must be different', 'error');
        return;
    }

    // Check if exchange rate is being used
    const useExchange = document.getElementById('settle-use-exchange').checked;
    let settleData = { from, to, amount, currency };

    if (useExchange) {
        const rate = parseFloat(document.getElementById('settle-exchange-rate').value);
        const payCurrency = document.getElementById('settle-pay-currency').value;
        if (!rate || rate <= 0) {
            showToast('Please enter a valid exchange rate', 'error');
            return;
        }
        const convertedAmount = Math.round(amount * rate * 100) / 100;
        settleData = { from, to, amount: convertedAmount, currency: payCurrency, originalAmount: amount, originalCurrency: currency, exchangeRate: rate };
    }

    try {
        await settleUp(currentGroupId, settleData);
        showToast('Settlement recorded!');
        hideModal('modal-settle');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// Group Settings Modal
// ============================================
function openGroupSettings() {
    if (!currentGroup) return;
    const defaultCurrency = currentGroup.defaultCurrency || 'SGD';
    document.getElementById('group-settings-name').value = currentGroup.name || '';
    document.getElementById('group-settings-currency').value = defaultCurrency;
    renderGroupCurrencyList(getGroupEnabledCurrencies(), defaultCurrency);
    showModal('modal-group-settings');
}

function renderGroupCurrencyList(selectedCurrencies, defaultCurrency) {
    const container = document.getElementById('group-currency-list');
    const selected = normalizeCurrencyList(selectedCurrencies, defaultCurrency);
    container.innerHTML = AVAILABLE_CURRENCIES.map(currency => {
        const isChecked = selected.includes(currency);
        const isDefault = currency === defaultCurrency;
        return `
            <label class="group-currency-option flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium cursor-pointer select-none ${isChecked ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400'}">
                <input type="checkbox" value="${currency}" class="hidden" ${isChecked ? 'checked' : ''} ${isDefault ? 'disabled' : ''}>
                <span>${currency}</span>
            </label>
        `;
    }).join('');

    container.querySelectorAll('label').forEach(label => {
        const input = label.querySelector('input');
        label.addEventListener('click', (e) => {
            e.preventDefault();
            if (input.disabled) return;
            input.checked = !input.checked;
            label.classList.toggle('border-primary', input.checked);
            label.classList.toggle('bg-primary/10', input.checked);
            label.classList.toggle('text-primary', input.checked);
            label.classList.toggle('border-gray-200', !input.checked);
            label.classList.toggle('text-gray-500', !input.checked);
            label.classList.toggle('dark:border-gray-600', !input.checked);
            label.classList.toggle('dark:text-gray-400', !input.checked);
        });
    });
}

async function handleGroupSettingsSubmit(e) {
    e.preventDefault();
    if (!currentGroupId) return;
    const groupName = document.getElementById('group-settings-name').value.trim();
    const defaultCurrency = document.getElementById('group-settings-currency').value;
    const checkedCurrencies = [...document.querySelectorAll('#group-currency-list input:checked')].map(input => input.value);
    const enabledCurrencies = normalizeCurrencyList(checkedCurrencies, defaultCurrency);
    if (!groupName) {
        showToast('Group name is required', 'error');
        return;
    }
    try {
        await updateGroupSettings(currentGroupId, { defaultCurrency, enabledCurrencies });
        if (groupName !== currentGroup.name) {
            await updateGroupName(currentGroupId, groupName);
        }
        showToast('Group settings updated!');
        hideModal('modal-group-settings');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// Create Group
// ============================================
async function handleCreateGroup(e) {
    e.preventDefault();
    const name = document.getElementById('group-name-input').value.trim();
    const currency = document.getElementById('group-currency-input').value;
    if (!name) return;
    try {
        const groupId = await createGroup(name, currency, [currency]);
        showToast('Group created!');
        hideModal('modal-create-group');
        navigate(`group/${groupId}`);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// Add Member
// ============================================
async function handleAddMember(e) {
    e.preventDefault();
    if (!currentGroupId) return;
    const email = document.getElementById('member-email-input').value.trim();
    try {
        await addMemberByEmail(currentGroupId, email);
        showToast('Member added!');
        hideModal('modal-add-member');
        document.getElementById('member-email-input').value = '';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// Auth Forms
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
        await logIn(email, password);
        navigate('dashboard');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const currency = document.getElementById('signup-currency').value || 'SGD';
    try {
        await signUp(email, password, name, currency);
        navigate('dashboard');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ============================================
// Modal Utilities
// ============================================
function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// ============================================
// Tabs
// ============================================
function initTabs() {
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.group-tab').forEach(t => {
                t.classList.remove('active-tab', 'border-primary', 'text-primary');
                t.classList.add('border-transparent', 'text-gray-500');
            });
            tab.classList.add('active-tab', 'border-primary', 'text-primary');
            tab.classList.remove('border-transparent', 'text-gray-500');

            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            const tabName = tab.dataset.tab;
            document.getElementById(`tab-${tabName}`).classList.remove('hidden');
        });
    });
}

// ============================================
// Utility
// ============================================
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ============================================
// Initialize App
// ============================================
async function init() {
    initDarkMode();
    initTabs();

    // Type button selection
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            clearTypeSelection();
            selectType(btn.dataset.type);
        });
    });

    // Modal cancel buttons
    document.querySelectorAll('.modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.add('hidden');
        });
    });

    // Click overlay to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    });

    // Header buttons
    document.getElementById('btn-dark-mode').addEventListener('click', toggleDarkMode);
    document.getElementById('btn-settings').addEventListener('click', () => navigate('settings'));
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await logOut();
        cleanupGroupListeners();
        cleanupGroupDetail();
        navigate('login');
    });

    // Settings
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-back-from-settings').addEventListener('click', () => navigate('dashboard'));

    // Dashboard
    document.getElementById('btn-create-group').addEventListener('click', () => showModal('modal-create-group'));

    // Group detail
    document.getElementById('btn-back-dashboard').addEventListener('click', () => {
        cleanupGroupDetail();
        navigate('dashboard');
    });
    document.getElementById('btn-add-expense').addEventListener('click', openAddExpense);
    document.getElementById('btn-add-member').addEventListener('click', () => showModal('modal-add-member'));
    document.getElementById('btn-group-settings').addEventListener('click', openGroupSettings);
    document.getElementById('expense-sort').addEventListener('change', renderExpenses);

    // Split type toggle
    document.getElementById('split-equal').addEventListener('click', () => {
        document.getElementById('split-equal').classList.add('border-primary', 'bg-primary/10', 'text-primary');
        document.getElementById('split-equal').classList.remove('border-gray-200', 'dark:border-gray-600', 'text-gray-500', 'dark:text-gray-400');
        document.getElementById('split-unequal').classList.remove('border-primary', 'bg-primary/10', 'text-primary');
        document.getElementById('split-unequal').classList.add('border-gray-200', 'dark:border-gray-600', 'text-gray-500', 'dark:text-gray-400');
        document.getElementById('unequal-split-inputs').classList.add('hidden');
        document.getElementById('unequal-split-inputs').innerHTML = '';
    });
    document.getElementById('split-unequal').addEventListener('click', () => {
        document.getElementById('split-unequal').classList.add('border-primary', 'bg-primary/10', 'text-primary');
        document.getElementById('split-unequal').classList.remove('border-gray-200', 'dark:border-gray-600', 'text-gray-500', 'dark:text-gray-400');
        document.getElementById('split-equal').classList.remove('border-primary', 'bg-primary/10', 'text-primary');
        document.getElementById('split-equal').classList.add('border-gray-200', 'dark:border-gray-600', 'text-gray-500', 'dark:text-gray-400');
        renderUnequalSplitInputs();
    });

    // Forms
    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('form-signup').addEventListener('submit', handleSignup);
    document.getElementById('form-create-group').addEventListener('submit', handleCreateGroup);
    document.getElementById('form-add-member').addEventListener('submit', handleAddMember);
    document.getElementById('form-add-expense').addEventListener('submit', handleExpenseSubmit);
    document.getElementById('form-settle').addEventListener('submit', handleSettleSubmit);
    document.getElementById('form-group-settings').addEventListener('submit', handleGroupSettingsSubmit);
    document.getElementById('group-settings-currency').addEventListener('change', (e) => {
        const checkedCurrencies = [...document.querySelectorAll('#group-currency-list input:checked')].map(input => input.value);
        renderGroupCurrencyList(checkedCurrencies, e.target.value);
    });

    // Settle exchange rate toggle
    document.getElementById('settle-use-exchange').addEventListener('change', (e) => {
        document.getElementById('settle-exchange-fields').classList.toggle('hidden', !e.target.checked);
    });
    document.getElementById('settle-exchange-rate').addEventListener('input', updateSettleConvertedDisplay);
    document.getElementById('settle-amount').addEventListener('input', () => {
        if (document.getElementById('settle-use-exchange').checked) updateSettleConvertedDisplay();
        // Also update unequal split if visible
        if (!document.getElementById('unequal-split-inputs').classList.contains('hidden')) autoCalculateUnequalSplit();
    });
    document.getElementById('settle-pay-currency').addEventListener('change', updateSettleConvertedDisplay);

    // Expense amount change should trigger unequal recalculation
    document.getElementById('expense-amount').addEventListener('input', () => {
        if (!document.getElementById('unequal-split-inputs').classList.contains('hidden')) autoCalculateUnequalSplit();
    });

    // Wait for Firebase auth
    const user = await waitForAuth();
    document.getElementById('loading-overlay').classList.add('hidden');

    if (user) {
        // Load user settings
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                userSettings.defaultCurrency = data.defaultCurrency || 'SGD';
                userSettings.displayName = data.displayName || user.displayName || '';
            }
        } catch (e) { /* ignore */ }

        if (!window.location.hash || window.location.hash === '#login' || window.location.hash === '#signup') {
            navigate('dashboard');
        } else {
            handleRoute();
        }
    } else {
        navigate('login');
    }
}

init();
