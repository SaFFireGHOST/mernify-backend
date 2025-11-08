const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();
const router = express.Router();

// ---- Supabase (admin) ----
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---- Gemini (AI) ----
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

// GET /api/ai/history?room_id=123&limit=100
router.get("/history", async (req, res) => {
  try {
    const roomId = Number(req.query.room_id);
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    if (!roomId) return res.status(400).json({ error: "room_id required" });

    const { data, error } = await supabaseAdmin
      .from("ai_messages")
      .select("*")
      .eq("room_id", roomId)
      .order("id", { ascending: true })
      .limit(limit);

    if (error) throw error;
    res.json({ messages: data });
  } catch (err) {
    console.error("AI history error:", err);
    res.status(500).json({ error: "Failed to load history" });
  }
});

// POST /api/ai/ask
// body: { prompt: string, room_id: number, user_id?: string }
router.post("/ask", async (req, res) => {
  try {
    const { prompt, room_id, user_id } = req.body;

    if (!prompt?.trim()) return res.status(400).json({ error: "Prompt required" });
    if (!room_id) return res.status(400).json({ error: "room_id required" });

    // 1) Insert the user's message
    const { data: userInsert, error: userErr } = await supabaseAdmin
      .from("ai_messages")
      .insert({
        room_id,
        user_id: user_id ?? null,
        role: "user",
        content: prompt,
      })
      .select()
      .single();
    if (userErr) throw userErr;

    // 2) Call the AI
    // You are a helpful AI study assistant. Please format your response in readable Markdown.
    // Use paragraphs, newlines, bullet points, or numbered lists as needed.
    const formattedPrompt = `Be concise. If confident, answer in ≤120 words using bullets/steps.
If missing crucial info, ask 1 clarifying question only.
No preamble or repetition.
User: ${prompt}`;

    const result = await model.generateContent(formattedPrompt);
    const aiText = result.response.text();

    // 3) Insert the assistant's message
    const { data: aiInsert, error: aiErr } = await supabaseAdmin
      .from("ai_messages")
      .insert({
        room_id,
        user_id: null,          // assistant
        role: "assistant",
        content: aiText,
      })
      .select()
      .single();
    if (aiErr) throw aiErr;

    // Return both rows for convenience
    res.json({ user_message: userInsert, ai_message: aiInsert });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

module.exports = router;
