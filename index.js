const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: '*', // Change to specific domain in production
  methods: ['GET', 'POST']
}));

const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000,
    skipMiddlewares: true
  }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('join-room', (roomId, userId) => {
    if (typeof roomId !== 'string' || typeof userId !== 'string') {
      console.error('❌ Invalid roomId or userId');
      return socket.disconnect(true);
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.userId = userId;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        participants: {},
        messages: []
      };
    }

    rooms[roomId].participants[userId] = socket.id;

    console.log(`✅ ${userId} joined room ${roomId}. Total: ${Object.keys(rooms[roomId].participants).length}`);

    socket.to(roomId).emit('user-joined', userId);

    socket.emit('room-info', {
      participants: Object.keys(rooms[roomId].participants).filter(id => id !== userId),
      messages: rooms[roomId].messages
    });
  });

  socket.on('signal', ({ targetUserId, signal }) => {
    try {
      const { roomId, userId } = socket;
      if (!roomId || !targetUserId || !signal) throw new Error('Missing data');

      const room = rooms[roomId];
      if (!room) throw new Error('Room not found');

      const targetSocketId = room.participants[targetUserId];
      if (!targetSocketId) throw new Error('Target not in room');

      io.to(targetSocketId).emit('signal', { senderId: userId, signal });
    } catch (err) {
      console.error('❌ Signal error:', err.message);
      socket.emit('signal-error', err.message);
    }
  });

  socket.on('message', (text) => {
    try {
      const { roomId, userId } = socket;
      if (!roomId || typeof text !== 'string' || !text.trim()) throw new Error('Invalid message');

      const room = rooms[roomId];
      if (!room) throw new Error('Room not found');

      const message = {
        senderId: userId,
        text: text.trim(),
        timestamp: new Date().toISOString()
      };

      room.messages.push(message);
      io.to(roomId).emit('message', message);
    } catch (err) {
      console.error('❌ Message error:', err.message);
      socket.emit('message-error', err.message);
    }
  });

  socket.on('disconnect', (reason) => {
    const { roomId, userId } = socket;
    if (roomId && userId && rooms[roomId]) {
      delete rooms[roomId].participants[userId];
      console.log(`⚠️ ${userId} left room ${roomId} (Reason: ${reason})`);

      socket.to(roomId).emit('user-left', userId);

      if (Object.keys(rooms[roomId].participants).length === 0) {
        delete rooms[roomId];
        console.log(`🧹 Room ${roomId} deleted (empty)`);
      }
    }
  });

  // Heartbeat
  const heartbeat = setInterval(() => {
    if (!socket.connected) return clearInterval(heartbeat);
    socket.emit('ping');
  }, 30000);

  socket.on('pong', () => {
    console.log(`💓 Pong from ${socket.userId || 'unknown'} in room ${socket.roomId || 'none'}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
