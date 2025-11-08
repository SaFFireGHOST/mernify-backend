const express = require('express');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Supabase admin client (server-side only)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('WARN: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Supabase operations will fail.');
}
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

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
    let { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    username = username.trim().toLowerCase();

    // Check existing user in Mongo
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: 'username already taken' });

    // Create user in Mongo (password will be hashed by pre('save') hook)
    const user = new User({ username, password });
    await user.save();

    // Now create Supabase profile row using Mongo _id as TEXT id
    try {
      const profileRow = { id: user._id.toString(), username };
      const { data, error: supErr } = await supabaseAdmin
        .from('profiles')
        .insert([profileRow]);

      if (supErr) {
        // rollback Mongo user if Supabase insert fails
        await User.deleteOne({ _id: user._id }).catch(e => console.error('Rollback: failed to delete mongo user:', e));
        console.error('Supabase insert error:', supErr);
        // If Postgres reports a unique violation on username, pass a friendly error
        const message = supErr?.message || 'Failed to create profile in Supabase';
        return res.status(500).json({ error: message });
      }
    } catch (supException) {
      // rollback Mongo user on unexpected Supabase error
      await User.deleteOne({ _id: user._id }).catch(e => console.error('Rollback: failed to delete mongo user:', e));
      console.error('Unexpected Supabase error:', supException);
      return res.status(500).json({ error: 'failed to create profile in Supabase' });
    }

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
