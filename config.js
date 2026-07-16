// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5EvPwabkZiILJQOhLb8nJkZsIF6NDbWU",
  authDomain: "personal-hub-elly.firebaseapp.com",
  projectId: "personal-hub-elly",
  storageBucket: "personal-hub-elly.firebasestorage.app",
  messagingSenderId: "833829545894",
  appId: "1:833829545894:web:a1bf0e292f8023903bd167"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
window.firebaseConfig = firebaseConfig;   // Make it available globally
