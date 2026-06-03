// ============================================
// Expenses Module
// Expense CRUD with real-time listeners
// ============================================

import {
    db,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    Timestamp
} from './config.js';
import { getCurrentUser } from './auth.js';

// ============================================
// Add Expense
// ============================================
export async function addExpense(groupId, { description, amount, currency, paidBy, splitBetween, splitAmounts, type, date }) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');

    if (!description || !amount || !currency || !paidBy || !splitBetween.length) {
        throw new Error('All fields are required');
    }

    // If equal split, calculate amounts
    let finalSplitAmounts = splitAmounts;
    if (!finalSplitAmounts) {
        const perPerson = amount / splitBetween.length;
        finalSplitAmounts = {};
        splitBetween.forEach(uid => {
            finalSplitAmounts[uid] = Math.round(perPerson * 100) / 100;
        });
    }

    const expenseData = {
        description,
        amount: Number(amount),
        currency,
        paidBy,
        splitBetween,
        splitAmounts: finalSplitAmounts,
        type: type || 'other',
        date: date ? Timestamp.fromDate(new Date(date + 'T00:00:00')) : serverTimestamp(),
        createdBy: user.uid,
        createdAt: serverTimestamp()
    };

    const docRef = await addDoc(
        collection(db, 'groups', groupId, 'expenses'),
        expenseData
    );
    return docRef.id;
}

// ============================================
// Update Expense
// ============================================
export async function updateExpense(groupId, expenseId, { description, amount, currency, paidBy, splitBetween, splitAmounts, type, date }) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');

    let finalSplitAmounts = splitAmounts;
    if (!finalSplitAmounts) {
        const perPerson = amount / splitBetween.length;
        finalSplitAmounts = {};
        splitBetween.forEach(uid => {
            finalSplitAmounts[uid] = Math.round(perPerson * 100) / 100;
        });
    }

    const updateData = {
        description,
        amount: Number(amount),
        currency,
        paidBy,
        splitBetween,
        splitAmounts: finalSplitAmounts,
        type: type || 'other',
        date: date ? Timestamp.fromDate(new Date(date + 'T00:00:00')) : serverTimestamp(),
        updatedBy: user.uid,
        updatedAt: serverTimestamp()
    };

    await updateDoc(doc(db, 'groups', groupId, 'expenses', expenseId), updateData);
}

// ============================================
// Delete Expense
// ============================================
export async function deleteExpense(groupId, expenseId) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');
    await deleteDoc(doc(db, 'groups', groupId, 'expenses', expenseId));
}

// ============================================
// Listen to Group Expenses (Real-time)
// ============================================
export function listenToExpenses(groupId, callback) {
    const q = query(
        collection(db, 'groups', groupId, 'expenses'),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const expenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(expenses);
    }, (error) => {
        console.error('Error listening to expenses:', error);
    });
}
