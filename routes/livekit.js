// routes/livekit.js
const express = require('express');
const router = express.Router();
const { AccessToken } = require('livekit-server-sdk');
// If you want this protected, import verifyToken and use it on the route:
// const { verifyToken } = require('../middleware/auth');

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

router.get('/token', async (req, res) => {
  try {
    const { room, identity } = req.query;
    if (!room) return res.status(400).json({ error: 'room (roomId) is required' });
    if (!identity) return res.status(400).json({ error: 'identity is required' });

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: String(identity) });
    at.addGrant({
      room: String(room),
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({ url: LIVEKIT_URL, token });
  } catch (e) {
    console.error('livekit /token error', e);
    res.status(500).json({ error: 'failed to create token' });
  }
});

module.exports = router;
