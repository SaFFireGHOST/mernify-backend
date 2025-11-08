const express = require('express');
const router = express.Router();
const Stroke = require('../models/Stroke'); // Require the model

// GET /strokes/:roomId
router.get('/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const strokes = await Stroke.find({ room_id: parseInt(roomId) }).sort({ created_at: 1 });
    res.json(strokes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /strokes
// POST /strokes
router.post("/", async (req, res) => {
  try {
    let { room_id, strokes, color, tool, size, created_by } = req.body;

    // --- basic validation ---
    if (room_id === undefined || room_id === null) {
      return res.status(400).json({ error: "room_id is required" });
    }
    if (!Array.isArray(strokes) || strokes.length === 0) {
      return res.status(400).json({ error: "strokes must be a non-empty array" });
    }
    if (typeof color !== "string" || !color.trim()) {
      return res.status(400).json({ error: "color is required" });
    }

    // --- normalize/cast room_id ---
    // If your schema keeps room_id as Number:
    if (typeof room_id === "string" && /^\d+$/.test(room_id)) {
      room_id = Number(room_id);
    }
    // (If you switched schema to String for safety, just do: room_id = String(room_id))

    // --- normalize tool & size (defaults keep backward compatibility) ---
    tool = tool === "eraser" ? "eraser" : "pen";
    size = Number(size);
    if (!Number.isFinite(size) || size <= 0) size = 5;

    // --- sanitize/validate points ---
    const normPoints = strokes
      .map((p) => ({
        type: p?.type === "start" || p?.type === "move" ? p.type : undefined,
        x: Number(p?.x),
        y: Number(p?.y),
      }))
      .filter((p) => p.type && Number.isFinite(p.x) && Number.isFinite(p.y));

    if (normPoints.length === 0) {
      return res.status(400).json({ error: "strokes contain no valid points" });
    }

    const doc = new Stroke({
      room_id,
      strokes: normPoints,
      color,
      tool,        // <— new
      size,        // <— new
      created_by,  // optional
    });

    await doc.save();
    return res.status(201).json(doc);
  } catch (err) {
    console.error("POST /strokes error:", err);
    return res.status(500).json({ error: err.message || "Failed to save stroke" });
  }
});


// DELETE /strokes/:roomId
router.delete('/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    await Stroke.deleteMany({ room_id: parseInt(roomId) });
    res.json({ message: 'Cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;