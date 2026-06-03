// ============================================
// Authentication Module
// Handles Firebase Auth operations
// ============================================

import {
    auth,
    db,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    doc,
    setDoc,
    serverTimestamp
} from './config.js';

// Current user state
let currentUser = null;
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

// ============================================
// Auth State Listener
// ============================================
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    authReadyResolve(user);
    
    // Dispatch custom event for other modules to react
    window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { user } }));
});

// ============================================
// Sign Up
// ============================================
export async function signUp(email, password, displayName, defaultCurrency) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update Firebase Auth profile
    await updateProfile(user, { displayName });

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
        email: email.toLowerCase(),
        displayName,
        defaultCurrency,
        createdAt: serverTimestamp()
    });

    return user;
}

// ============================================
// Log In
// ============================================
export async function logIn(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
}

// ============================================
// Log Out
// ============================================
export async function logOut() {
    await signOut(auth);
}

// ============================================
// Getters
// ============================================
export function getCurrentUser() {
    return currentUser;
}

export function waitForAuth() {
    return authReady;
}
