const mongoose = require('mongoose');
// If your room_id can exceed 2^53-1, store it as String instead of Number.

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['start', 'move'], required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false }
);

const strokeSchema = new mongoose.Schema(
  {
    room_id: { type: Number, required: true }, // or { type: String, required: true }
    // One polyline/path = array of points
    strokes: { type: [pointSchema], required: true },

    // Drawing attributes
    color: { type: String, required: true },             // kept for pen; ignored by eraser
    tool: { type: String, enum: ['pen', 'eraser'], default: 'pen' },
    size: { type: Number, default: 5 },                  // pen/eraser thickness used when drawn

    // Optional metadata
    created_by: { type: String },                        // your auth user id if you have it
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
    minimize: false,
  }
);

// Helpful indexes for room playback & pagination
strokeSchema.index({ room_id: 1, created_at: 1 });

const Stroke = mongoose.model('Stroke', strokeSchema);
module.exports = Stroke;
