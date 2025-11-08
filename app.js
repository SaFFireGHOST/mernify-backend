require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const roomsRoutes = require('./routes/rooms');
const roomPlaybackRoutes = require('./routes/roomPlayback');
const aiRoutes = require('./routes/aiRoutes');
const strokesRoutes = require('./routes/strokes');
const livekitRoutes = require('./routes/livekit');
const cors = require('cors');
const http = require('http'); // Added for Socket.io
const { Server } = require('socket.io'); // Added for Socket.io

console.log('SUPABASE_URL present:', !!process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('SERVICE_ROLE_KEY prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 8));
}

const app = express();
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.json());
app.use(cors());
app.use('/api/rooms', roomsRoutes);

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/simple_auth_db';
mongoose.set('strictQuery', true);
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

// Routes
app.use('/api/auth', authRoutes);
app.use("/api/ai", aiRoutes);
app.use('/api/room-playback', roomPlaybackRoutes);
app.use('/strokes', strokesRoutes);
app.use('/api/livekit', livekitRoutes);


// Example protected route (test)
const { verifyToken } = require('./middleware/auth');
app.get('/api/protected', verifyToken, (req, res) => {
  // req.user populated by middleware
  res.json({ message: 'This is protected data', user: req.user });
});

// Socket.io setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust for production (e.g., your frontend URL)
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId.toString()); // Ensure roomId is string for Socket.io rooms
    console.log(`User ${socket.id} joined room ${roomId}`);
    // Optionally, broadcast a request for current state to sync new joiners
    socket.to(roomId.toString()).emit('request-state');
  });

  // Handle playback updates (play, pause, seek, time updates)
  socket.on('playback-update', (data) => {
    const { roomId, ...update } = data;
    io.to(roomId.toString()).emit('playback-update', update);
  });

  // Handle state request for new joiners (send current state)
  socket.on('send-state', (data) => {
    const { roomId, ...state } = data;
    io.to(roomId.toString()).emit('playback-update', state);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));