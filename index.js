const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS
app.use(cors());

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store connected users
const users = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins
  socket.on('join', (userId) => {
    users[userId] = socket.id;
    socket.userId = userId;
    console.log(`User ${userId} joined with socket ID ${socket.id}`);
  });

  // Relay signaling data between users
  socket.on('signal', (data) => {
    const targetSocketId = users[data.target];
    if (targetSocketId) {
      io.to(targetSocketId).emit('signal', {
        sender: socket.userId,
        signal: data.signal
      });
    }
  });

  // When a user disconnects
  socket.on('disconnect', () => {
    if (socket.userId) {
      delete users[socket.userId];
      console.log(`User ${socket.userId} disconnected`);
      io.emit('user-disconnected', socket.userId);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});