const express = require("express");
const { requireAuth } = require("../auth");
const { fetchRecentMessages } = require("../discordApi");

const router = express.Router();
router.use(requireAuth);

// GET /api/leads/:id/messages — fetch recent Discord messages live
router.get("/leads/:id/messages", async (req, res) => {
  try {
    const messages = await fetchRecentMessages(req.params.id, 50);
    res.json(messages);
  } catch (err) {
    console.error("[API] GET /leads/:id/messages error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
