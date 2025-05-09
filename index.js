const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Secure CORS configuration
app.use(cors({
  origin: '*', // Change for production
  methods: ['GET', 'POST']
}));

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000, // 2 minutes
    skipMiddlewares: true
  }
});

// Store connected users
const users = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins
  socket.on('join', (userId) => {
    if (!userId || typeof userId !== 'string') {
      console.error('Invalid userId:', userId);
      return socket.disconnect(true);
    }

    // Handle duplicate connections
    if (users[userId]) {
      console.log(`Displacing previous connection for ${userId}`);
      io.to(users[userId]).emit('duplicate-connection');
      delete users[userId];
    }

    users[userId] = socket.id;
    socket.userId = userId;
    console.log(`User ${userId} joined. Active users: ${Object.keys(users).length}`);
  });

  // Relay signaling data
  socket.on('signal', (data) => {
    try {
      if (!data?.target || !data?.signal) {
        throw new Error('Invalid signal data');
      }

      const targetSocketId = users[data.target];
      if (!targetSocketId) {
        throw new Error(`Target user ${data.target} not found`);
      }

      io.to(targetSocketId).emit('signal', {
        sender: socket.userId,
        signal: data.signal
      });
    } catch (err) {
      console.error('Signaling error:', err.message);
      socket.emit('signal-error', err.message);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    if (socket.userId) {
      delete users[socket.userId];
      console.log(`User ${socket.userId} disconnected. Reason: ${reason}`);
      io.emit('user-disconnected', socket.userId);
    }
  });

  // Heartbeat
  const interval = setInterval(() => {
    if (!socket.connected) {
      clearInterval(interval);
      return;
    }
    socket.emit('ping');
  }, 30000);

  socket.on('pong', () => {
    console.log(`Heartbeat received from ${socket.userId}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});