const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    socketId: {
        type: String,
        default: null
    },

    online: {
        type: Boolean,
        default: false
    }

});

const User = mongoose.model("User", userSchema);

module.exports = User;