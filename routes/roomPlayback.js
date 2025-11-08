// routes/roomPlayback.js
const express = require('express');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Upsert playback state for a room.
 * body: { room_id: number|string, video_url?: string, is_playing: boolean, playback_time: number (seconds), client_ts: number (ms), updated_by: string }
 */






router.post('/', verifyToken, async (req, res) => {
  try {
    const { room_id, video_url = null, is_playing, playback_time, client_ts } = req.body;
    if (!room_id || typeof is_playing !== 'boolean' || typeof playback_time !== 'number') {
      return res.status(400).json({ error: 'room_id, is_playing (bool) and playback_time (number) required' });
    }

    const updated_by = req.user?.id || req.body.updated_by || null;

    // upsert: use room_id as PK
    const row = {
      room_id: Number(room_id),
      video_url,
      is_playing,
      playback_time,
      client_ts: Number(client_ts || Date.now()),
      updated_by,
    };

    const { data, error } = await supabaseAdmin
      .from('room_playback')
      .upsert([row], { onConflict: 'room_id' })  // upsert by room_id
      .select()
      .single();

    if (error) {
      console.error('Supabase upsert error (room_playback):', error);
      return res.status(500).json({ error: error.message || 'failed to update playback' });
    }

    // return updated row (includes server updated_at)
    return res.json({ playback: data });
  } catch (err) {
    console.error('room-playback error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
