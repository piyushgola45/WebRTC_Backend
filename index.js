// ... (keep previous imports and setup)

// Store appointments
const appointments = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins an appointment
  socket.on('join-appointment', (appointmentId, userType, userId) => {
    if (!appointmentId || !userType || !userId) {
      return socket.disconnect(true);
    }

    // Initialize appointment if it doesn't exist
    if (!appointments[appointmentId]) {
      appointments[appointmentId] = {
        participants: {},
        messages: [],
        status: 'waiting'
      };
    }

    // Add participant
    appointments[appointmentId].participants[userType] = {
      socketId: socket.id,
      userId: userId
    };

    socket.join(appointmentId);
    socket.appointmentId = appointmentId;
    socket.userType = userType;
    socket.userId = userId;

    console.log(`${userType} joined appointment ${appointmentId}`);

    // If both participants joined, start the meeting
    if (Object.keys(appointments[appointmentId].participants).length === 2) {
      appointments[appointmentId].status = 'active';
      io.to(appointmentId).emit('meeting-started');
    }

    // Send current participants info
    socket.emit('appointment-info', {
      participants: appointments[appointmentId].participants,
      messages: appointments[appointmentId].messages,
      status: appointments[appointmentId].status
    });
  });

  // ... (keep rest of your existing signal, message, and disconnect handlers)
});

// ... (keep server startup code)