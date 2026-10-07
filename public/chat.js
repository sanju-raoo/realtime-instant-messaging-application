const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "/login.html";
}

const socket = io({
    auth: {
        token: token
    }
});

const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const userList = document.getElementById("userList");
const chatHeader = document.getElementById("chatHeader");
const chatStatus = document.getElementById("chatStatus");
const typingIndicator = document.getElementById("typingIndicator");
const usernameDisplay = document.getElementById("usernameDisplay");

let selectedUser = null;

// =========================
// GET LOGGED-IN USER
// =========================

const username = localStorage.getItem("username");

if (!username) {
window.location.href = "/login.html";
}

// Display username
if (usernameDisplay) {
usernameDisplay.textContent = username;
}

// =========================
// CONNECT TO CHAT
// =========================

socket.on("connect", () => {


console.log("Connected to Socket.IO");

socket.emit("joinChat");


});

// =========================
// SEND MESSAGE
// =========================

function sendMessage() {


const message = messageInput.value.trim();

if (selectedUser === null) {

    alert("Please select a user");
    return;

}

if (message === "") {
    return;
}

const chatData = {

    
    receiver: selectedUser,
    message: message

};

socket.emit(
    "chatMessage",
    chatData
);

messageInput.value = "";

// Stop typing
socket.emit("typing", {

    username: username,
    receiver: selectedUser,
    typing: false

});


}

// =========================
// ENTER KEY TO SEND
// =========================

messageInput.addEventListener("keydown", (event) => {


if (event.key === "Enter") {

    event.preventDefault();

    sendMessage();

}


});

// =========================
// TYPING DETECTION
// =========================

messageInput.addEventListener(
"input",
() => {


    if (selectedUser === null) {
        return;
    }

    socket.emit("typing", {

        username: username,
        receiver: selectedUser,
        typing: messageInput.value.trim() !== ""

    });

}


);

// =========================
// RECEIVE TYPING
// =========================

socket.on(
"typing",
(data) => {


    if (
        data.receiver === username &&
        data.username === selectedUser
    ) {

        if (data.typing) {

            typingIndicator.textContent =
                data.username + " is typing...";

        } else {

            typingIndicator.textContent = "";

        }

    }

}


);

// =========================
// CREATE MESSAGE
// =========================

function displayMessage(chatData) {


const messageElement =
    document.createElement("div");

messageElement.classList.add("message");

const isSent =
    chatData.username === username;

messageElement.classList.add(
    isSent ? "sent" : "received"
);


// Message text
const textElement =
    document.createElement("div");

textElement.textContent =
    chatData.message;


// Time
const timeElement =
    document.createElement("small");

if (chatData.createdAt) {

    const time =
        new Date(
            chatData.createdAt
        ).toLocaleTimeString([], {

            hour: "2-digit",
            minute: "2-digit"

        });

    timeElement.textContent = time;

}


const metaElement = document.createElement("div");
metaElement.classList.add("message-meta");

metaElement.appendChild(timeElement);

if (isSent) {
    const statusElement = document.createElement("span");
    statusElement.classList.add("message-status");
    statusElement.textContent = "✓";

    if (chatData._id) {
        statusElement.dataset.messageId = chatData._id;
    }

    metaElement.appendChild(statusElement);
}

messageElement.appendChild(textElement);
messageElement.appendChild(metaElement);
messages.appendChild(messageElement);

messages.scrollTop =
    messages.scrollHeight;


}

// =========================
// RECEIVE PRIVATE MESSAGE
// =========================

socket.on(
"privateMessage",
(chatData) => {


    /*
     Only show the message if it belongs
     to the currently selected conversation.
    */

    const belongsToCurrentChat =

        (
            chatData.username === username &&
            chatData.receiver === selectedUser
        )

        ||

        (
            chatData.username === selectedUser &&
            chatData.receiver === username
        );


    if (!belongsToCurrentChat) {
        return;
    }


    // Remove welcome message if present
    const welcome =
        document.querySelector(".welcome-message");

    if (welcome) {
        welcome.remove();
    }


    displayMessage(chatData);
    socket.on("messageDelivered", (data) => {
    const statusElement = document.querySelector(
        `.message-status[data-message-id="${data.messageId}"]`
    );

    if (statusElement) {
        statusElement.textContent = "✓✓";
    }
});
}



);

// =========================
// USER LIST
// =========================

socket.on(
"userList",
(users) => {


    userList.innerHTML = "";

    users.forEach(
        (user) => {

            // Don't show yourself
            if (user.username === username) {
                return;
            }


            const userElement =
                document.createElement("div");

            userElement.classList.add("user-item");


            // Status
            const status =
                user.online
                    ? "🟢"
                    : "⚫";


            userElement.innerHTML = `

                <div style="
                    display:flex;
                    align-items:center;
                    gap:10px;
                ">

                    <div style="
                        width:38px;
                        height:38px;
                        border-radius:50%;
                        background:#e0e7ff;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                    ">
                        👤
                    </div>

                    <div>

                        <strong>
                            ${user.username}
                        </strong>

                        <br>

                        <small>
                            ${status}
                            ${user.online ? " Online" : " Offline"}
                        </small>

                    </div>

                </div>

            `;


            userElement.onclick =
                () => {

                    selectedUser =
                        user.username;


                    // Header
                    chatHeader.textContent =
                        selectedUser;


                    chatStatus.textContent =
                        user.online
                            ? "🟢 Online"
                            : "⚫ Offline";


                    // Clear messages
                    messages.innerHTML = "";

                    typingIndicator.textContent = "";


                    // Load private chat
                    socket.emit(
                        "loadPrivateChat",
                        {

                            username: username,

                            receiver: selectedUser

                        }
                    );

                };


            userList.appendChild(
                userElement
            );

        }
    );

}


);

// =========================
// PRIVATE CHAT HISTORY
// =========================

socket.on(
"privateChatHistory",
(messagesList) => {


    messages.innerHTML = "";


    if (messagesList.length === 0) {

        messages.innerHTML = `

            <div class="welcome-message">

                <div class="welcome-icon">
                    💬
                </div>

                <h2>
                    Start a conversation
                </h2>

                <p>
                    Send a message to ${selectedUser}
                </p>

            </div>

        `;

        return;

    }


    messagesList.forEach(
        (chatData) => {

            displayMessage(chatData);

        }
    );


    messages.scrollTop =
        messages.scrollHeight;

}


);

// =========================
// SOCKET ERROR
// =========================

socket.on("connect_error", (error) => {


console.log(
    "Socket connection error:",
    error
);


});
