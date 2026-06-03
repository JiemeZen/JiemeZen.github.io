// ============================================
// Groups Module
// Group CRUD and member management
// ============================================

import {
    db,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    arrayUnion,
    query,
    where,
    onSnapshot,
    orderBy,
    serverTimestamp
} from './config.js';
import { getCurrentUser } from './auth.js';

let groupsUnsubscribe = null;

// ============================================
// Create Group
// ============================================
export async function createGroup(name, defaultCurrency = 'SGD') {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');

    const groupData = {
        name,
        defaultCurrency,
        memberUids: [user.uid],
        members: {
            [user.uid]: {
                email: user.email,
                displayName: user.displayName || user.email
            }
        },
        createdBy: user.uid,
        createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'groups'), groupData);
    return docRef.id;
}

// ============================================
// Update Group Settings
// ============================================
export async function updateGroupSettings(groupId, { defaultCurrency }) {
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');
    await updateDoc(doc(db, 'groups', groupId), { defaultCurrency });
}

// ============================================
// Add Member by Email
// ============================================
export async function addMemberByEmail(groupId, email) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = getCurrentUser();
    if (!user) throw new Error('Must be logged in');

    const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', normalizedEmail)
    );
    const snapshot = await getDocs(usersQuery);

    if (snapshot.empty) {
        throw new Error('No user found with that email. They must create an account first.');
    }

    const memberDoc = snapshot.docs[0];
    const memberUid = memberDoc.id;
    const memberData = memberDoc.data();

    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) throw new Error('Group not found');

    const groupData = groupDoc.data();
    if (groupData.memberUids.includes(memberUid)) {
        throw new Error('This user is already a member of the group.');
    }

    await updateDoc(doc(db, 'groups', groupId), {
        memberUids: arrayUnion(memberUid),
        [`members.${memberUid}`]: {
            email: memberData.email,
            displayName: memberData.displayName || memberData.email
        }
    });

    return { uid: memberUid, ...memberData };
}

// ============================================
// Get Group by ID
// ============================================
export async function getGroup(groupId) {
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) return null;
    return { id: groupDoc.id, ...groupDoc.data() };
}

// ============================================
// Listen to User's Groups (Real-time)
// ============================================
export function listenToUserGroups(callback) {
    const user = getCurrentUser();
    if (!user) return () => {};

    if (groupsUnsubscribe) {
        groupsUnsubscribe();
    }

    const q = query(
        collection(db, 'groups'),
        where('memberUids', 'array-contains', user.uid),
        orderBy('createdAt', 'desc')
    );

    groupsUnsubscribe = onSnapshot(q, (snapshot) => {
        const groups = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(groups);
    }, (error) => {
        console.error('Error listening to groups:', error);
    });

    return groupsUnsubscribe;
}

// ============================================
// Listen to Single Group (Real-time)
// ============================================
export function listenToGroup(groupId, callback) {
    return onSnapshot(doc(db, 'groups', groupId), (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() });
        }
    });
}

// ============================================
// Cleanup
// ============================================
export function cleanupGroupListeners() {
    if (groupsUnsubscribe) {
        groupsUnsubscribe();
        groupsUnsubscribe = null;
    }
}
