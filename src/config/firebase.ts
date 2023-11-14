// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
// import { getAuth, GoogleAuthProvider } from 'firebase/auth'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyBR164dLf4E3iaKAo7FqSSa1WmPXH40TwM',
  authDomain: 'fir-rtc-26d75.firebaseapp.com',
  projectId: 'fir-rtc-26d75',
  storageBucket: 'fir-rtc-26d75.appspot.com',
  messagingSenderId: '315777909815',
  appId: '1:315777909815:web:daacdb544c706261912bb2',
  measurementId: 'G-Q7LET63K52'
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const provider = new GoogleAuthProvider()