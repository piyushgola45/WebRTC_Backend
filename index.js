// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const rooms = {};

io.on('connection', socket => {
  console.log(`New client: ${socket.id}`);

  socket.on('join-room', roomID => {
    const room = rooms[roomID] || [];
    if (room.length >= 2) {
      socket.emit('room-full');
      return;
    }

    rooms[roomID] = [...room, socket.id];
    socket.join(roomID);
    console.log(`${socket.id} joined ${roomID}`);

    const otherUser = rooms[roomID].find(id => id !== socket.id);
    if (otherUser) {
      socket.emit('user-joined', otherUser);
      socket.to(otherUser).emit('user-joined', socket.id);
    }

    socket.on('offer', payload => {
      io.to(payload.target).emit('offer', { sdp: payload.sdp, caller: socket.id });
    });

    socket.on('answer', payload => {
      io.to(payload.target).emit('answer', { sdp: payload.sdp, caller: socket.id });
    });

    socket.on('candidate', payload => {
      io.to(payload.target).emit('candidate', payload.candidate);
    });

    socket.on('disconnect', () => {
      rooms[roomID] = (rooms[roomID] || []).filter(id => id !== socket.id);
      if (rooms[roomID]?.length === 0) delete rooms[roomID];
    });
  });
});

server.listen(5000, () => console.log('Server running on http://localhost:5000'));
