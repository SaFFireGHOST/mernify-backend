require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');

const app = express();
app.use(express.json());

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/simple_auth_db';
mongoose.set('strictQuery', true);
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

// Routes
app.use('/api/auth', authRoutes);

// Example protected route (test)
const { verifyToken } = require('./middleware/auth');
app.get('/api/protected', verifyToken, (req, res) => {
  // req.user populated by middleware
  res.json({ message: 'This is protected data', user: req.user });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
