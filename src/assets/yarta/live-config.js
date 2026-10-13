/* Yarta live backend switch.
   null  = prototype mode: fictional demo organisations, everything stays in this browser.
   A Firebase web config = live mode: invite-only sign-in, data in Firestore and Cloud Storage,
   access enforced by backend/firestore.rules and backend/storage.rules.

   When the Firebase project exists, replace null with its web app config, e.g.
   window.YARTA_FIREBASE = {
     apiKey: '…', authDomain: 'yarta-xxxx.firebaseapp.com', projectId: 'yarta-xxxx',
     storageBucket: 'yarta-xxxx.firebasestorage.app', messagingSenderId: '…', appId: '…'
   };
   (A Firebase web config is not a secret: it identifies the project. The security rules protect the data.) */
window.YARTA_FIREBASE = null;
