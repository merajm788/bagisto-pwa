import firebase from '@firebase/app';
import '@firebase/auth';
import '@firebase/messaging';
var topic;
var serverAPI;
var messagingId;

var topicKey = "pwa.settings.push-notification.topic";
var serverAPIKey = "pwa.settings.push-notification.api-key";
var messagingIdKey = "pwa.settings.push-notification.messaging-id";

var isSafari = () => {
    return window.navigator.vendor == "Apple Computer, Inc." ? true : false;
}

var isTokenSentToServer = () => {
    return window.localStorage.getItem('sentToServer') === '1';
}

var setTokenSentToServer = sent => {
    window.localStorage.setItem('sentToServer', sent ? '1' : '0');
}

if (! isSafari()) {
    let url = `${window.config.app_base_url}/api/config?_config=${topicKey},${serverAPIKey},${messagingIdKey}`;

    fetch(url, {
        method: 'GET',
        headers: new Headers({
            'Accept'        : 'application/json',
            'Content-Type'  : 'application/json',
        }),
    })
    .then(response => response.json())
    .then(response => {
        topic = response.data[topicKey];
        serverAPI = response.data[serverAPIKey];
        messagingId = response.data[messagingIdKey];

        firebase.initializeApp({messagingSenderId: messagingId});
        const messaging = firebase.messaging();

        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
                console.log('Notification permission granted.');
                // TODO(developer): Retrieve an Instance ID token for use with FCM.
                retriveCurrentToken(messaging);
            } else {
                console.log('Unable to get permission to notify.');
            }
        });

        messaging.onMessage(function(payload){
            console.log('onMessage:', payload);

            const notificationTitle = payload.data.title;
            const notificationOptions = {
                body: payload.data.body,
                icon: payload.data.icon,        
            };

            var notification = new Notification(notificationTitle, notificationOptions);

            notification.onclick = function(event) {
                event.preventDefault(); // prevent the browser from focusing the Notification's tab
                window.open(payload.data.click_action , '_blank');
                notification.close();
            }
        });
    })
    .catch((error) => {
        console.log(error);
    });
}

function retriveCurrentToken(messaging) {
    // Get Instance ID token. Initially this makes a network call, once retrieved
    // subsequent calls to getToken will return from cache.
    messaging.getToken().then((currentToken) => {
        if (currentToken) {
            sendTokenToServer(currentToken);
            subscribeToTopic(currentToken);
            // updateUIForPushEnabled(currentToken);
        } else {
            // Show permission request.
            console.log('No Instance ID token available. Request permission to generate one.');
            // Show permission UI.
            // updateUIForPushPermissionRequired();
            setTokenSentToServer(false);
        }
    }).catch((err) => {
        console.log('An error occurred while retrieving token. ', err);
        // showToken('Error retrieving Instance ID token. ', err);
        setTokenSentToServer(false);
    });

    messaging.onTokenRefresh(function () {
        messaging
            .getToken()
            .then(function (refreshedToken) {
                console.log('Token refreshed.');
                // Indicate that the new Instance ID token has not yet been sent to the
                // app server.
                sendTokenToServer(refreshedToken);
                // Send Instance ID token to app server.
            })
            .catch(function (err) {
                console.log('Unable to retrieve refreshed token ', err);
                setTokenSentToServer(false);
            });
  });
}

// Send the Instance ID token your application server, so that it can:
// - send messages back to this app
// - subscribe/unsubscribe the token from topics
function sendTokenToServer(currentToken) {
    if (!  isTokenSentToServer()) {
        console.log('Sending token to server...');
        // TODO(developer): Send the current token to your server.
        setTokenSentToServer(true);
        console.log('Token ID sent to server');
    } else {
        console.log('Token already sent to server so won\'t send it again ' +
            'unless it changes');
    }
}

function subscribeToTopic(currentToken) {
    let post = {
        topic,
        currentToken: currentToken,
    }

    let url = `https://iid.googleapis.com/iid/v1/${currentToken}/rel/topics/${topic}`;

    fetch( url, {
        method: 'POST',
        headers: new Headers({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization':`key=${serverAPI}`,
        }),
        body : JSON.stringify(post)
    })
    .then(response => {
        if (response.status < 200 || response.status >= 400) {
            throw 'Error subscribing to topic: '+response.status + ' - ' + response.body;
        }

        console.log(response.status);
        console.log('Subscribed to "'+topic+'"');
    })
    .catch((error) => {
        console.log(error);
    });
}
