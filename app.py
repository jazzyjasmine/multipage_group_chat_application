import string
import random
import uuid
from collections import deque
from flask import Flask, render_template, request, redirect, url_for, jsonify
from typing import Dict

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# { auth_key: username }
# example: {1435275768: "Alice", 5769853333: "Bob"}
users = {}  # add new entries only through username.html, by updating username


# add a new entry when create a new chat
# update when someone log in a chat room by invite link:
#     1. log in with valid auth key and valid invite link -> chat room
#     2. no auth key and valid invite link -> username.html -> chat room
chats = {}


def new_chat(host_auth_key: str) -> Dict:
    """Creates new chat dictionary"""
    magic_passphrase = ''.join(random.choices(string.ascii_lowercase + string.digits, k=40))

    return dict([
        ("authorized_users", {host_auth_key}),
        ("magic_passphrase", magic_passphrase),
        ("messages", [])
    ])


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/username')
def auth():
    return app.send_static_file('username.html')


@app.route('/chat/<int:chat_id>')
def chat(chat_id):
    magic_passphrase = chats[chat_id]['magic_passphrase']
    return render_template('chat.html',
                           chat_id=chat_id,
                           magic_passphrase=magic_passphrase)


# -------------------------------- API ROUTES ----------------------------------
# TODO: Create the API
@app.route('/', methods=['POST'])
def create_new_chat():
    """Handles POST request of creating a new chat

    if no auth key:
        redirect to username.html
    if auth key:
        1. get the auth key
        2. get a new chat id
        3. add new chat info to chats
        4. redirect to the new chat page

    Returns:
        redirect url (response.url)

    """
    possible_auth_key = request.headers['auth_key']
    if not is_valid_auth_key(possible_auth_key):
        # if the user does not have an auth key, redirect them to the home page
        return redirect(url_for('auth'))
    else:
        # if valid auth key, create a new chat room and redirect the user to it
        new_chat_id = get_new_chat_id()
        chats[new_chat_id] = new_chat(possible_auth_key)
        return redirect(url_for('chat',
                                chat_id=new_chat_id))


def get_new_chat_id() -> int:
    """Generates a new chat id."""
    return len(chats)


def is_valid_auth_key(possible_auth_key: str) -> bool:
    """Checks if the auth key is valid"""
    return possible_auth_key != "null" and possible_auth_key in users


@app.route('/username', methods=['POST'])
def register_to_create_chat():
    """Handles the POST request when an unauthorized user submits a username to create a new chat."""
    new_username = request.headers['username']
    new_auth_key = uuid.uuid1().hex  # assign a uuid as the auth key to the new user
    users[new_auth_key] = new_username  # store the new auth key and username
    return jsonify({"auth_key": new_auth_key})  # return the new auth key


@app.route('/chat', methods=['POST', 'GET'])
def classify_request():
    """Handles GET and POST request to the /chat page"""

    # get all messages of a chat room by providing chat id
    if request.method == 'GET':
        chat_id = int(request.headers["chat_id"])

        if not chats[chat_id]["messages"]:
            return jsonify({"empty": "yes"})

        return jsonify(list(chats[chat_id]["messages"]))

    if request.method == 'POST':
        post_type = request.headers["post_type"]
        chat_id = int(request.headers["chat_id"])
        auth_key = request.headers["auth_key"]

        # post a new message
        if post_type == "new message":
            message_body = request.headers["message_body"]
            post_new_message(chat_id, message_body, auth_key)
            return "success"

        # Authenticate user's access to this chat page and redirect
        if post_type == "authentication":
            magic_passphrase = request.headers["magic_passphrase"]
            return authenticate(chat_id, auth_key, magic_passphrase)

    return "success"


def post_new_message(chat_id: int, message_body: str, auth_key: str) -> None:
    """Stores the new message to chats"""
    # get username by auth_key
    username = users[auth_key]

    # add the new message to chats
    message_dict = {"username": username, "message_body": message_body}
    if not chats[chat_id]["messages"]:
        chats[chat_id]["messages"] = deque([message_dict])
    elif len(chats[chat_id]["messages"]) + 1 <= 30:
        chats[chat_id]["messages"].append(message_dict)
    else:
        # only keep the nearest 30 messages
        chats[chat_id]["message"].popleft()
        chats[chat_id]["message"].append(message_dict)


def authenticate(possible_chat_id: int, possible_auth_key: str, possible_magic_passphrase: str):
    """Authenticate user's access to a chat page and return checking result."""

    # if chat id not valid, redirect to home page
    if possible_chat_id not in chats:
        return jsonify({"authentication": "fail"})

    # chat id is valid henceforth
    # if the auth key is in the chat room's authorized users, success (no need to check magic passphrase)
    if possible_auth_key in chats[possible_chat_id]["authorized_users"]:
        return jsonify({"authentication": "success"})

    has_valid_magic_passphrase = is_valid_magic_passphrase(possible_magic_passphrase, possible_chat_id)

    # if invalid auth key but valid magic passphrase, let the user register (pending)
    if not is_valid_auth_key(possible_auth_key) and has_valid_magic_passphrase:
        return jsonify({"authentication": "pending"})

    # if valid auth key and valid magic passphrase, add the user to the authorized users, success
    if is_valid_auth_key(possible_auth_key) and has_valid_magic_passphrase:
        chats[possible_chat_id]["authorized_users"].add(possible_auth_key)
        return jsonify({"authentication": "success"})

    return jsonify({"authentication": "fail"})


def is_valid_magic_passphrase(possible_magic_passphrase: str, valid_chat_id: int) -> bool:
    """Checks if magic passphrase is valid."""
    return possible_magic_passphrase == chats[valid_chat_id]["magic_passphrase"]
