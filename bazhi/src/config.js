// ============================================
// Firebase Configuration
// ============================================
// TODO: Replace with your Firebase config from Firebase Console
// Go to: console.firebase.google.com → Project Settings → Your apps

const firebaseConfig = {
    apiKey: "AIzaSyBTt-aoPBZ4OhC1IQsHPF1YPwtfrBdI9ok",
    authDomain: "bazhi-guru.firebaseapp.com",
    projectId: "bazhi-guru",
    storageBucket: "bazhi-guru.firebasestorage.app",
    messagingSenderId: "1022290691202",
    appId: "1:1022290691202:web:ac0d08ef2d695485aea09b",
    measurementId: "G-F3P2DQ5TGM"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// ============================================
// Backend API Configuration
// ============================================
// API calls are proxied through our secure backend
// This keeps the DeepSeek API key safe on the server

// TODO: After deploying bazhi-backend to Vercel, replace this with your actual Vercel URL
const BACKEND_API_URL = 'https://bazhi-backend.vercel.app/api/chat';

// ============================================
// App Configuration
// ============================================
const APP_CONFIG = {
  modelName: 'deepseek-chat',
  translationTemperature: 0.3,  // Lower for accuracy
  guruTemperature: 0.7,          // Balanced for expertise
  maxTokens: 2000
};
