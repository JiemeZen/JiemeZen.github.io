// ============================================
// Firebase Configuration (v10 Modular SDK)
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, arrayUnion, query, where, onSnapshot, orderBy, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyA1GFHC2Lnf7aG6eifnULMMGvFeKiWBb2A",
    authDomain: "sharetab-481e1.firebaseapp.com",
    projectId: "sharetab-481e1",
    storageBucket: "sharetab-481e1.firebasestorage.app",
    messagingSenderId: "807614809483",
    appId: "1:807614809483:web:5a97f905a65af01ebd9b8e",
    measurementId: "G-QSPEE92V2B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export Firebase instances and methods
export {
    auth,
    db,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    arrayUnion,
    query,
    where,
    onSnapshot,
    orderBy,
    serverTimestamp,
    Timestamp
};
