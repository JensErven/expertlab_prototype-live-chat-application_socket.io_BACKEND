const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Specify the allowed origins for your WebSocket connections
    methods: ["GET", "POST"],
  },
});

const users = {};
const chatHistory = {};

// Function to check if a username is available
function isUsernameAvailable(username) {
  for (const socketId in users) {
    if (users[socketId] === username) {
      return false; // Username is already taken
    }
  }
  return true; // Username is available
}

// Add WebSocket event handlers here using 'io.on'
io.on("connection", (socket) => {
  // Handle user registration
  socket.on("register", (username) => {
    if (isUsernameAvailable(username)) {
      users[socket.id] = username;
      io.emit("userList", Object.values(users));
      // Send a success response to the client
      socket.emit("registrationResponse", { success: true });
    } else {
      // Send an error response to the client
      socket.emit("registrationResponse", {
        success: false,
        error: "Username is not available",
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });

  // ... other event handlers for chat messages
  // Handle chat history request
  socket.on("getChatHistory", ({ sender, receiver }) => {
    const chatKey1 = `${sender}-${receiver}`;
    const chatKey2 = `${receiver}-${sender}`;

    // Check both combinations
    const history1 = chatHistory[chatKey1] || [];
    const history2 = chatHistory[chatKey2] || [];

    const combinedHistory = history1.concat(history2);

    // Sort the combined history by timestamp
    combinedHistory.sort((a, b) => a.timestamp - b.timestamp);

    socket.emit("chatHistory", { sender, receiver, history: combinedHistory });
  });

  socket.on("message", ({ sender, receiver, message }) => {
    const senderSocket = Object.keys(users).find(
      (socketId) => users[socketId] === sender
    );
    const receiverSocket = Object.keys(users).find(
      (socketId) => users[socketId] === receiver
    );
    if (senderSocket && receiverSocket) {
      // Save the message in chat history
      const chatKey = `${sender}-${receiver}`;
      if (!chatHistory[chatKey]) {
        chatHistory[chatKey] = [];
      }
      chatHistory[chatKey].push({
        sender,
        receiver,
        message,
        timestamp: new Date(),
      });

      // Emit the message to the sender and receiver
      socket
        .to(senderSocket && receiverSocket)
        .emit("message", { sender, receiver, message });
    }
  });
});

const port = process.env.PORT || 3001; // Use the provided PORT or a default port

server.listen(port, () => {
  console.log(`server is listening on port ${port}`);
});
