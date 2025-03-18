importScripts("https://www.gstatic.com/firebasejs/9.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDByuiO1W_9SwAuXor7MEpT3TlDnNUUAZk",
  authDomain: "nikoniko-1212.firebaseapp.com",
  projectId: "nikoniko-1212",
  storageBucket: "nikoniko-1212.firebasestorage.app",
  messagingSenderId: "438316016391",
  appId: "1:438316016391:web:a52e9983b2f437031b1ba2",
  measurementId: "G-Z1GTRT5HVZ"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

function showNotification(title, body) {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }

    if (Notification.permission === "granted") {
      var notification = new Notification(title, {
        body: body,
        icon: "icon.png"
      });

      notification.onclick = function () {
        console.log("Notification clicked");
      };
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(function (permission) {
        if (permission === "granted") {
          var notification = new Notification(title, {
            body: body,
            icon: "icon.png"
          });

          notification.onclick = function () {
            console.log("Notification clicked");
          };
        }
      });
    }
  }