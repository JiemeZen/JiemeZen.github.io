// ============================================
// Settle Module
// Record settlements between users
// ============================================

import {
    db,
    collection,
    addDoc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp
} from './config.js';
import { getCurrentUser } from './auth.js';

// ============================================
// Record Settlement
// ============================================
export async function settleUp(groupId, { from, to, amount, currency, originalAmount, originalCurrency, exchangeRate }) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');

    if (!from || !to || !amount || !currency) {
        throw new Error('All settlement fields are required');
    }

    if (from === to) {
        throw new Error('Cannot settle with yourself');
    }

    const settlementData = {
        from,
        to,
        amount: Number(amount),
        currency,
        createdBy: user.uid,
        createdAt: serverTimestamp()
    };

    // Include exchange rate info if settling in a different currency
    if (originalAmount && originalCurrency && exchangeRate) {
        settlementData.originalAmount = Number(originalAmount);
        settlementData.originalCurrency = originalCurrency;
        settlementData.exchangeRate = Number(exchangeRate);
    }

    const docRef = await addDoc(
        collection(db, 'groups', groupId, 'settlements'),
        settlementData
    );
    return docRef.id;
}

// ============================================
// Listen to Group Settlements (Real-time)
// ============================================
export function listenToSettlements(groupId, callback) {
    const q = query(
        collection(db, 'groups', groupId, 'settlements'),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const settlements = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(settlements);
    }, (error) => {
        console.error('Error listening to settlements:', error);
    });
}
