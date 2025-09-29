// Cloutsy Firebase Messaging Service Worker
// This file handles background push notifications

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase with Cloutsy config
firebase.initializeApp({
    apiKey: "AIzaSyADERgvs_2t21fDHTSpwXzwxFdUZCJabic",
    authDomain: "collabkaroo.firebaseapp.com",
    projectId: "collabkaroo",
    storageBucket: "collabkaroo.firebasestorage.app",
    messagingSenderId: "653234338070",
    appId: "1:653234338070:web:79580c4c45d021d426f837"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
    console.log('Received background message ', payload);

    const notificationTitle = payload.notification.title || 'New Notification';
    const notificationOptions = {
        body: payload.notification.body || 'You have a new notification',
        icon: '/firebase-logo.png', // You can add your app icon here
        badge: '/firebase-logo.png',
        data: payload.data || {},
        tag: 'cloutsy-notification',
        requireInteraction: true,
        actions: [
            {
                action: 'view',
                title: 'View',
                icon: '/view-icon.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/dismiss-icon.png'
            }
        ]
    };

    // Show the notification
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    console.log('Notification click received.');

    event.notification.close();

    // Handle different actions
    if (event.action === 'view') {
        // Open your app or specific page
        event.waitUntil(
            clients.openWindow('https://yourapp.com') // Replace with your app URL
        );
    } else if (event.action === 'dismiss') {
        // Just close the notification
        console.log('Notification dismissed');
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('https://yourapp.com') // Replace with your app URL
        );
    }
});

// Service worker installation
self.addEventListener('install', function(event) {
    console.log('Firebase messaging service worker installed');
    self.skipWaiting();
});

// Service worker activation
self.addEventListener('activate', function(event) {
    console.log('Firebase messaging service worker activated');
    event.waitUntil(self.clients.claim());
});