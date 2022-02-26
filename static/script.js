/* For index.html */

async function createChat() {
  // send POST request to the server and redirect to a new page returned by the server
  // new page is either username.html (if no auth key) or a new chat room page (if auth key)
  try {
    let fetchRedirectPage = {
    method: 'POST',
    headers: new Headers({
      'auth_key': window.localStorage.getItem('auth_key')
      })
    }

    let response = await fetch('/', fetchRedirectPage);
    window.location.replace(response.url);
  } catch (error) {
    console.log('Create Chat Request Failed', error);
  }
}


/* For username.html */

function preventManuallyEnter() {
  // username.html can not be accessed by manually typing the url
  // if manual access, redirect to home page
  let prev_url = document.referrer;
  if (!prev_url || prev_url === "" || prev_url.length === 0) {
    window.location.replace("/");
  }
}

async function getUsername() {
  // when user type in an username and click update
  // get the username and pass it to the register function
  try {
    // get the username typed by the user
    let new_username = document.querySelector("#username").value;

    // check the input username is not empty
    if (isEmpty(new_username)) {
      alert("Username can not be empty!");
      return false;
    }

    // register an account (username + auth key)
    await register(new_username, document.referrer);

  } catch (error) {
    console.log('Get Username Request Failed', error);
  }
}

async function register(new_username, prev_url) {
  // register an account (username + auth key)
  try {
    let fetchRedirectPage = {
    method: 'POST',
    headers: new Headers({
      'username': new_username
      })
    }

    let response = await fetch('/username', fetchRedirectPage);
    let response_data = await response.json();
    let auth_key = response_data['auth_key'];

    // add auth key to localStorage
    window.localStorage.setItem('auth_key', auth_key);

    if (prev_url.indexOf("chat") !== -1) {
      // if the user is redirected to username page by the chat page, go to the chat page
      window.location.replace(prev_url);
    } else {
      // otherwise, go to the home page to create a chat
      window.location.replace("/");
    }

  } catch (error) {
    console.log('Register Request Failed', error);
  }

}

function isEmpty(input_string) {
  // check if a string is empty
  return !input_string.trim().length;
}

/* For chat.html */

async function postMessage() {
  // post message in a chat room (after clicking "post" button)
  try {
    // get message
    let curr_message = document.querySelector("#comment").value;
    // set the input box blank
    document.querySelector("#comment").value = "";

    // check if the input message is empty
    if (isEmpty(curr_message)) {
      alert("Message can not be empty!");
      return false;
    }

    // get chat id
    let curr_chat_id = getChatID(window.location.pathname);

    // get auth key of the speaker
    let curr_auth_key = getAuthKey();

    // send new message and the related info to the server
    let fetchRedirectPage = {
    method: 'POST',
    headers: new Headers({
      'post_type': 'new message',
      'auth_key': curr_auth_key,
      'chat_id': curr_chat_id,
      'message_body': curr_message
      })
    }

    await fetch('/chat', fetchRedirectPage);

  } catch (error) {
    console.log('Post Message Request Failed', error);
  }

}

function displayMessages(all_messages) {
  // display all messages on the web page
  let container = document.querySelector(".messages");
  container.innerHTML = "";
  for (let i = 0; i < all_messages.length; i++) {
    container.appendChild(buildOneMessage(all_messages[i]))
  }
}

function buildOneMessage(message) {
  // build one message tag
  let curr_message = document.createElement("message");
  let curr_author = document.createElement("author");
  let curr_content = document.createElement("content");
  curr_author.innerHTML = message["username"];
  curr_content.innerHTML = message["message_body"]; //TODO: clean up user input
  curr_message.appendChild(curr_author);
  curr_message.appendChild(curr_content);
  return curr_message;
}

async function getMessages() {
  // get all messages of a chat room from the server
  let chat_id = getChatID(window.location.pathname);

  try {
    let fetchRedirectPage = {
    method: 'GET',
    headers: new Headers({
      'chat_id': chat_id
      })
    }

    let response = await fetch("/chat", fetchRedirectPage);
    let data = await response.json();

    // if no message, do nothing
    if (data["empty"] && data["empty"] === "yes") {
      return;
    }

    // otherwise, display all the messages
    displayMessages(data);

  } catch (error) {
    console.log('Get Message Request Failed', error);
  }
}


async function startMessagePolling() {
  // continuously get messages without blocking the user
  await getMessages();
  await startMessagePolling();
}


function getChatID(pathname) {
  // get the chat id from the url
  return pathname.substring(pathname.lastIndexOf('/') + 1);
}

function getAuthKey() {
  // get the auth key
  return window.localStorage.getItem('auth_key');
}

async function authenticate() {
  // when a user try to log in a chat room,
  // do authentication and redirect the user to the correct page
  try {
    // hide the chat room's content
    let body = document.querySelector("body");
    body.style.display = "none";

    // get pathname to further 1)check if chat id exits 2) extract chat id
    const pathname = window.location.pathname;

    // if no chat id, redirect to the home page
    if (pathname === "/chat" || pathname === "/chat/") {
      window.location.replace('/');
    }

    // get chat id
    let possible_chat_id = getChatID(pathname);

    // get possible magic passphrase
    const queryString = window.location.search;
    let possible_magic_passphrase = new URLSearchParams(queryString).get("magic_passphrase");

    // get possible auth key
    let possible_auth_key = getAuthKey();

    let fetchRedirectPage = {
      method: 'POST',
      headers: new Headers({
        'post_type': 'authentication',
        'chat_id': possible_chat_id,
        'magic_passphrase': possible_magic_passphrase,
        'auth_key': possible_auth_key
        })
    }

    let response = await fetch('/chat', fetchRedirectPage);
    let response_data = await response.json();
    let authentication = response_data["authentication"];

    if (authentication === "success") {
      body.style.display = "block";
    } else if (authentication === "pending") {
      window.location.replace("/username");
    } else {
      window.location.replace("/");
    }

  } catch (error) {
    console.log('Request Failed', error);
  }
}

