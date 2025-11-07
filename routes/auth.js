const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Helper to generate JWT
function signToken(user) {
  // keep payload minimal
  const payload = { id: user._id, username: user.username };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * POST /api/auth/signup
 * body: { username, password }
 */
router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    // Check existing user
    const exists = await User.findOne({ username: username.trim().toLowerCase() });
    if (exists) return res.status(409).json({ error: 'username already taken' });

    // Create user (password will be hashed by pre('save') hook)
    const user = new User({ username: username.trim().toLowerCase(), password });
    await user.save();

    const token = signToken(user);
    return res.status(201).json({ message: 'user created', token, user: { id: user._id, username: user.username } });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

/**
 * POST /api/auth/signin
 * body: { username, password }
 */
router.post('/signin', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'invalid credentials' });

    const token = signToken(user);
    return res.json({ message: 'signed in', token, user: { id: user._id, username: user.username } });
  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
