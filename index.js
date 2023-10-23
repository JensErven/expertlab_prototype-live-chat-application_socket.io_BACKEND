const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://expertlab-prototype-live-chat-application-socket-io-frontend.vercel.app",
      "http://localhost:3000",
    ], // Specify the allowed origins for your WebSocket connections
    methods: ["GET", "POST"],
  },
});

const users = {};
const chatHistory = {};

// rooms
const chatRooms = {};
const chatRoomHistory = {};

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
      io.emit("chatRoomList", Object.values(chatRooms));
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
    // Remove the user from all chat rooms
    for (const roomName in chatRooms) {
      if (chatRooms[roomName].users[socket.id]) {
        delete chatRooms[roomName].users[socket.id];
      }
    }
    delete users[socket.id];
    // Emit the updated user list
    io.emit("userList", Object.values(users));

    // Emit the updated chat room list
    io.emit("chatRoomList", Object.values(chatRooms));
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

  // not finished yet
  // socket.on("getChatRoomHistory", (roomName) => {
  //   const roomHistory = chatRoomHistory[roomName] || [];
  //   socket.emit("chatRoomHistory", { roomName, history: roomHistory });
  // });

  // not finished yet
  // socket.on("roomMessage", ({ receiver, sender, message }) => {
  //   const room = chatRooms[receiver];
  //   if (room) {
  //     // Iterate through the users in the chat room
  //     for (const socketId in room.users) {
  //       io.to(socketId).emit("roomMessage", {
  //         sender,
  //         receiver: receiver,
  //         message,
  //       });
  //     }
  //     // Save the message to the chat room history
  //     const roomHistory = chatRoomHistory[roomName] || [];
  //     roomHistory.push({ sender, message, timestamp: new Date() });
  //     chatRoomHistory[roomName] = roomHistory;
  //   }
  // });

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
      socket.to(receiverSocket).emit("message", { sender, receiver, message });
    }
  });

  // rooms features
  // Create a new chat room
  socket.on("createRoom", (roomName) => {
    // Check if the room already exists
    if (chatRooms[roomName]) {
      socket.emit(
        "createRoomError",
        "A room with the same name already exists."
      );
    } else {
      chatRooms[roomName] = { users: {}, roomName };
      io.emit("chatRoomList", Object.values(chatRooms));
    }
  });

  // Join a chat room
  socket.on("joinRoom", (roomName) => {
    if (chatRooms[roomName]) {
      chatRooms[roomName].users[socket.id] = users[socket.id];
      // Send an acknowledgment to the client
      io.emit("chatRoomList", Object.values(chatRooms));
    } else return;
  });

  socket.on("leaveRoom", (roomName) => {
    if (chatRooms[roomName]) {
      delete chatRooms[roomName].users[socket.id];
      io.emit("chatRoomList", Object.values(chatRooms));
    } else return;
  });
});

const port = process.env.PORT || 3001; // Use the provided PORT or a default port

server.listen(port, () => {
  console.log(`server is listening on port ${port}`);
});
