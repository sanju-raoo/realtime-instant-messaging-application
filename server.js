require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const JWT_SECRET = process.env.JWT_SECRET;

app.use(express.static("public"));


// ===============================
// MongoDB Connection
// ===============================

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.log("MongoDB connection error:", error);
    });


// ===============================
// Socket.IO
// ===============================

io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error("Authentication required"));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        socket.user = decoded;

        next();
    } catch (error) {
        next(new Error("Invalid or expired token"));
    }
});

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    console.log("Authenticated user:", socket.user.username);

    // =========================
    // JOIN CHAT
    // =========================

    socket.on("joinChat", async (username) => {

        try {
        const username = socket.user.username;

        let user = await User.findOne({ username: username });

            if (!user) {

                user = new User({
                    username: username,
                    socketId: socket.id,
                    online: true
                });

            } else {

                user.socketId = socket.id;
                user.online = true;

            }

            await user.save();

            console.log(
                "User registered:",
                username
            );

            io.emit("userStatus", {
                username: username,
                online: true
            });

            const users = await User.find();

            io.emit("userList", users);

        } catch (error) {

            console.log(
                "User registration error:",
                error
            );

        }

    });


    // =========================
    // LOAD OLD MESSAGES
    // =========================

    Message.find()
        .sort({ createdAt: 1 })
        .limit(50)
        .then((messages) => {

            socket.emit(
                "chatHistory",
                messages
            );

        })
        .catch((error) => {

            console.log(
                "Error loading messages:",
                error
            );

        });


    // =========================
    // PRIVATE MESSAGE
    // =========================

    socket.on(
        "chatMessage",
        async (chatData) => {

             try {
        const senderUsername = socket.user.username;

        const receiverUser = await User.findOne({
            username: chatData.receiver
        });

        if (!receiverUser) {
            console.log("Receiver not found");
            return;
        }

        const newMessage = new Message({
            username: senderUsername,
            receiver: chatData.receiver,
            message: chatData.message
        });

                await newMessage.save();

                console.log(
                    "Private message saved"
                );


                // Send to receiver
             if (receiverUser.socketId) {
    io.to(receiverUser.socketId).emit(
        "privateMessage",
        newMessage
    );
}

socket.emit("privateMessage", newMessage);

if (receiverUser.socketId) {
    socket.emit("messageDelivered", {
        messageId: newMessage._id
    });
}

                // Send back to sender
                socket.emit(
                    "privateMessage",
                    newMessage
                );

            } catch (error) {

                console.log(
                    "Private message error:",
                    error
                );

            }

        }
    );


    // =========================
    // LOAD PRIVATE CHAT HISTORY
    // =========================

    socket.on(
        "loadPrivateChat",
        async (chatData) => {

            try {

                const messages =
                    await Message.find({

                        $or: [

                            {
                                username:
                                    chatData.username,

                                receiver:
                                    chatData.receiver
                            },

                            {
                                username:
                                    chatData.receiver,

                                receiver:
                                    chatData.username
                            }

                        ]

                    }).sort({
                        createdAt: 1
                    });


                socket.emit(
                    "privateChatHistory",
                    messages
                );

            } catch (error) {

                console.log(
                    "Private chat history error:",
                    error
                );

            }

        }
    );


    // =========================
    // TYPING INDICATOR
    // =========================

    socket.on("typing", async (data) => {

        try {

            const receiverUser =
                await User.findOne({
                    username: data.receiver
                });

            if (
                receiverUser &&
                receiverUser.socketId
            ) {

                io.to(
                    receiverUser.socketId
                ).emit(
                    "typing",
                    data
                );

            }

        } catch (error) {

            console.log(
                "Typing error:",
                error
            );

        }

    });


    // =========================
    // USER DISCONNECT
    // =========================

    socket.on(
        "disconnect",
        async () => {

            console.log(
                "User disconnected:",
                socket.id
            );

            try {

                const user =
                    await User.findOne({
                        socketId:
                            socket.id
                    });

                if (user) {

                    const username =
                        user.username;

                    user.online = false;
                    user.socketId = null;

                    await user.save();


                    io.emit(
                        "userStatus",
                        {
                            username:
                                username,

                            online: false
                        }
                    );


                    const users =
                        await User.find();

                    io.emit(
                        "userList",
                        users
                    );

                }

            } catch (error) {

                console.log(
                    "Disconnect update error:",
                    error
                );

            }

        }
    );

});
app.use(express.json());


// =========================
// REGISTER USER
// =========================

app.post("/api/register", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({
                message: "Username and password are required"
            });

        }

        const existingUser =
            await User.findOne({ username });

        if (existingUser) {

            return res.status(400).json({
                message: "Username already exists"
            });

        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        const user =
            new User({

                username: username,

                password: hashedPassword,

                online: false

            });

        await user.save();

        res.status(201).json({
            message: "Registration successful"
        });

    } catch (error) {

        console.log(
            "Registration error:",
            error
        );

        res.status(500).json({
            message: "Server error"
        });

    }

});
app.post("/api/login", async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({
                message: "Username and password are required"
            });

        }

        const user =
            await User.findOne({ username });

        if (!user) {

            return res.status(401).json({
                message: "Invalid username or password"
            });

        }

        const passwordMatch =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordMatch) {

            return res.status(401).json({
                message: "Invalid username or password"
            });

        }

        const token =
            jwt.sign(
                {
                    userId: user._id,
                    username: user.username
                },
                JWT_SECRET,
                {
                    expiresIn: "1d"
                }
            );

        res.json({

            message: "Login successful",

            token: token,

            username: user.username

        });

    } catch (error) {

        console.log(
            "Login error:",
            error
        );

        res.status(500).json({
            message: "Server error"
        });

    }

});
// ===============================
// Start Server
// ===============================

server.listen(3000, () => {

    console.log(
        "Server running on http://localhost:3000"
    );

});

app.get('/', (req, res) => {
  res.send('Server is up and running!');
});