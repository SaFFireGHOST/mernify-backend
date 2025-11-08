// routes/rooms.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('../middleware/auth'); // your existing middleware

const router = express.Router();

// Supabase admin client (server-side only)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - Supabase operations will fail');
}
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// GET /api/rooms
// Returns a paginated list of rooms (public endpoint).
router.get('/', async (req, res) => {
    try {
        // pagination params (optional)
        const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200); // 1..200
        const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

        const from = offset;
        const to = offset + limit - 1;

        // select all columns, newest first
        const { data, error } = await supabaseAdmin
            .from('rooms')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('Supabase select error (rooms list):', error);
            return res.status(500).json({ error: error.message || 'failed to fetch rooms', detail: error });
        }

        return res.json({ rooms: data || [] });
    } catch (err) {
        console.error('Get rooms error:', err);
        return res.status(500).json({ error: 'internal server error' });
    }
});

/**
 * POST /api/rooms
 * Create a new room. Requires auth.
 * body: { title: string, subject?: string, video_url?: string, thumbnail?: string }
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const { title, subject = null, video_url = null } = req.body;
        if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title is required' });

        const created_by = req.user?.id; // should be mongo _id string

        const roomRow = {
            title: title.trim(),
            subject,
            video_url,
            created_by,
            // thumbnail: thumbnail || null, // if you add thumbnail
        };

        const { data: room, error } = await supabaseAdmin
            .from('rooms')
            .insert([roomRow])
            .select()
            .single();

        if (error) {
            console.error('Supabase insert error (rooms):', error);
            return res.status(500).json({ error: error.message || 'failed to create room', detail: error });
        }

        return res.status(201).json({ room });
    } catch (err) {
        console.error('Create room error:', err);
        return res.status(500).json({ error: 'internal server error' });
    }
});

// PATCH /api/rooms/:id
// Update room details (auth optional for demo, but add verifyToken if needed)
router.patch('/:id', async (req, res) => {
  try {
    const roomId = Number(req.params.id);
    if (isNaN(roomId)) return res.status(400).json({ error: 'invalid room id' });

    // check room exists
    const { data: existingRoom, error: fetchErr } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if (fetchErr) {
      console.error('Supabase select error (rooms fetch):', fetchErr);
      return res.status(500).json({ error: fetchErr.message || 'failed to fetch room' });
    }
    if (!existingRoom) return res.status(404).json({ error: 'room not found' });

    // requester id (for audit) — may be null if you later remove verifyToken
    const requesterId = req.user?.id ?? null;

    const updates = {};
    if (typeof req.body.video_url !== 'undefined') updates.video_url = req.body.video_url;
    if (typeof req.body.title !== 'undefined') updates.title = req.body.title;
    if (typeof req.body.subject !== 'undefined') updates.subject = req.body.subject;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'no fields to update' });
    }

    const { data: updatedRoom, error: updateErr } = await supabaseAdmin
      .from('rooms')
      .update(updates)
      .eq('id', roomId)
      .select()
      .single();

    if (updateErr) {
      console.error('Supabase update error (rooms):', updateErr);
      return res.status(500).json({ error: updateErr.message || 'failed to update room' });
    }

    // If video_url changed, reset/upsert room_playback row so players re-sync to start
    if (typeof updates.video_url !== 'undefined') {
      try {
        const playbackRow = {
          room_id: roomId,
          video_url: updates.video_url ?? null,
          is_playing: false,
          playback_time: 0,
          client_ts: 0,
          updated_by: requesterId,
        };
        const { data: pbData, error: pbError } = await supabaseAdmin
          .from('room_playback')
          .upsert([playbackRow], { onConflict: 'room_id' })
          .select()
          .single();

        if (pbError) {
          // non-fatal but log for debugging
          console.warn('room_playback upsert warning after video_url update:', pbError);
        }
      } catch (e) {
        console.warn('Exception upserting room_playback after video update:', e);
      }
    }

    return res.json({ room: updatedRoom });
  } catch (err) {
    console.error('PATCH /api/rooms/:id error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// NEW: GET /api/rooms/:roomId/messages - Fetch all messages for a room (public for simplicity)
router.get('/:roomId/messages', async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) return res.status(400).json({ error: 'invalid room id' });

    const { data, error } = await supabaseAdmin
      .from('room_messages')
      .select('id, created_at, user_id, content, profiles:room_messages_user_id_fkey (username)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase fetch messages error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Flatten profiles.username
    const messages = data.map(msg => ({
      ...msg,
      username: msg.profiles?.username || 'Unknown'
    }));

    return res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// NEW: POST /api/rooms/:roomId/messages - Send a new message (requires auth)
router.post('/:roomId/messages', verifyToken, async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) return res.status(400).json({ error: 'invalid room id' });

    const { content } = req.body;
    if (!content || typeof content !== 'string') return res.status(400).json({ error: 'content required' });

    const user_id = req.user.id.toString(); // Mongo _id as string

    const { data, error } = await supabaseAdmin
      .from('room_messages')
      .insert([{ room_id: roomId, user_id, content }])
      .select('id, created_at, user_id, content, profiles:room_messages_user_id_fkey (username)')
      .single();

    if (error) {
      console.error('Supabase insert message error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Flatten username
    const message = {
      ...data,
      username: data.profiles?.username || 'Unknown'
    };

    return res.status(201).json({ message });
  } catch (err) {
    console.error('Post message error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});


// ---------- NEW: GET /api/rooms/:roomId/comments ----------
router.get('/:roomId/comments', async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) return res.status(400).json({ error: 'invalid room id' });

    const { data, error } = await supabaseAdmin
      .from('video_comments')
      .select(`
        id,
        created_at,
        user_id,
        content,
        video_timestamp,
        profiles:video_comments_user_id_fkey (username)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch comments error:', error);
      return res.status(500).json({ error: error.message });
    }

    const comments = data.map(c => ({
      ...c,
      username: c.profiles?.username || 'Unknown',
      profiles: undefined // clean up
    }));

    return res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// ---------- NEW: POST /api/rooms/:roomId/comments ----------
router.post('/:roomId/comments', verifyToken, async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) return res.status(400).json({ error: 'invalid room id' });

    const { content, video_timestamp = 0 } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content required' });
    }

    const user_id = req.user.id.toString(); // Mongo _id → Supabase text

    const { data, error } = await supabaseAdmin
      .from('video_comments')
      .insert([{ room_id: roomId, user_id, content, video_timestamp }])
      .select(`
        id,
        created_at,
        user_id,
        content,
        video_timestamp,
        profiles:video_comments_user_id_fkey (username)
      `)
      .single();

    if (error) {
      console.error('Supabase insert comment error:', error);
      return res.status(500).json({ error: error.message });
    }

    const comment = {
      ...data,
      username: data.profiles?.username || 'Unknown',
      profiles: undefined
    };

    return res.status(201).json({ comment });
  } catch (err) {
    console.error('Post comment error:', err);
    return res.status(500).json({ error: 'internal server error' });
  }
});



module.exports = router;