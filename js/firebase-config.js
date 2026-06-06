// ============================================
// FIREBASE CONFIGURATION
// ============================================
// Thành Nhân Education - Firebase Project

const firebaseConfig = {
    apiKey: "AIzaSyB0X4HHNv-TqJAsyE9XKRXIxzB7yRO6v84",
    authDomain: "thanhnhaneducation-29a2f.firebaseapp.com",
    projectId: "thanhnhaneducation-29a2f",
    storageBucket: "thanhnhaneducation-29a2f.firebasestorage.app",
    messagingSenderId: "849842230265",
    appId: "1:849842230265:web:b4f852137e83633318a328",
    measurementId: "G-WHZJZSKGEV"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global Firebase references
window.auth = firebase.auth();
window.db = firebase.firestore();

// Owner email - tự động gán vai trò Owner
window.OWNER_EMAIL = 'Edu.thanhnhan@gmail.com';

console.log('🔥 Firebase initialized - ThanhNhanEducation');
