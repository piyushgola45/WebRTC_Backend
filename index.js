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

// Store room participants
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins a room
  socket.on('join-room', (roomId, userId) => {
    if (!roomId || typeof roomId !== 'string' || !userId || typeof userId !== 'string') {
      console.error('Invalid roomId or userId:', roomId, userId);
      return socket.disconnect(true);
    }

    // Join the room
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(socket.roomId);
    socket.userId = userId;

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = {
        participants: {},
        messages: []
      };
    }

    // Add user to room
    rooms[roomId].participants[userId] = socket.id;

    console.log(`User ${userId} joined room ${roomId}. Participants: ${Object.keys(rooms[roomId].participants).length}`);
    
    // Notify other users in the room about the new participant
    socket.to(roomId).emit('user-joined', userId);
    
    // Send room info to the new user
    socket.emit('room-info', {
      participants: Object.keys(rooms[roomId].participants).filter(id => id !== userId),
      messages: rooms[roomId].messages
    });
  });

  // Handle signaling within a room
  socket.on('signal', ({ targetUserId, signal }) => {
    try {
      if (!socket.roomId || !targetUserId || !signal) {
        throw new Error('Invalid signaling data');
      }

      const room = rooms[socket.roomId];
      if (!room) {
        throw new Error('Room not found');
      }

      const targetSocketId = room.participants[targetUserId];
      if (!targetSocketId) {
        throw new Error('Target user not found in room');
      }

      io.to(targetSocketId).emit('signal', {
        senderId: socket.userId,
        signal
      });
    } catch (err) {
      console.error('Signaling error:', err.message);
      socket.emit('signal-error', err.message);
    }
  });

  // Handle messages within a room
  socket.on('message', (text) => {
    try {
      if (!socket.roomId || !text || typeof text !== 'string') {
        throw new Error('Invalid message data');
      }

      const room = rooms[socket.roomId];
      if (!room) {
        throw new Error('Room not found');
      }

      const message = {
        senderId: socket.userId,
        text,
        timestamp: new Date().toISOString()
      };

      // Store message in room history
      room.messages.push(message);

      // Broadcast to all room participants
      io.to(socket.roomId).emit('message', message);
    } catch (err) {
      console.error('Message error:', err.message);
      socket.emit('message-error', err.message);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    if (socket.roomId && socket.userId && rooms[socket.roomId]) {
      delete rooms[socket.roomId].participants[socket.userId];
      console.log(`User ${socket.userId} disconnected from room ${socket.roomId}. Reason: ${reason}`);
      
      // Notify other users in the room
      socket.to(socket.roomId).emit('user-left', socket.userId);
      
      // Clean up empty rooms
      if (Object.keys(rooms[socket.roomId].participants).length === 0) {
        delete rooms[socket.roomId];
        console.log(`Room ${socket.roomId} cleaned up (no participants)`);
      }
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
    console.log(`Heartbeat received from ${socket.userId} in room ${socket.roomId}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});