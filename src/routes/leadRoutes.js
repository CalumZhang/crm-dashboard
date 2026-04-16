const express = require("express");
const { requireAuth } = require("../auth");
const {
  getAllLeads,
  getLead,
  updateLeadState,
  addNote,
  bulkUpdateState
} = require("../leadService");

const router = express.Router();
router.use(requireAuth);

// GET /api/leads?sort=state&order=asc&search=term&state=new
router.get("/leads", async (req, res) => {
  try {
    let leads = await getAllLeads();
    const { sort, order, search, state } = req.query;

    // Filter by state
    if (state) {
      leads = leads.filter(l => l.state === state);
    }

    // Search across id, username, display name, name
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(l =>
        (l.discordUserId || "").toLowerCase().includes(q) ||
        (l.discordUsername || "").toLowerCase().includes(q) ||
        (l.discordDisplayName || "").toLowerCase().includes(q) ||
        (l.name || "").toLowerCase().includes(q)
      );
    }

    // Sort
    if (sort) {
      leads.sort((a, b) => {
        let aVal = a[sort];
        let bVal = b[sort];
        // Handle Firestore Timestamps
        if (aVal && typeof aVal.toDate === "function") aVal = aVal.toDate();
        if (bVal && typeof bVal.toDate === "function") bVal = bVal.toDate();
        if (aVal instanceof Date) aVal = aVal.getTime();
        if (bVal instanceof Date) bVal = bVal.getTime();
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        if (typeof aVal === "string") return order === "desc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
        return order === "desc" ? bVal - aVal : aVal - bVal;
      });
    }

    // Serialize Firestore Timestamps to ISO strings for JSON
    const serialized = leads.map(serializeLead);
    res.json(serialized);
  } catch (err) {
    console.error("[API] GET /leads error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/:id
router.get("/leads/:id", async (req, res) => {
  try {
    const lead = await getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    res.json(serializeLead(lead));
  } catch (err) {
    console.error("[API] GET /leads/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id  { state: "contacted" }
router.patch("/leads/:id", async (req, res) => {
  try {
    const { state } = req.body;
    await updateLeadState(req.params.id, state);
    res.json({ ok: true });
  } catch (err) {
    console.error("[API] PATCH /leads/:id error:", err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/leads/:id/notes  { text: "..." }
router.post("/leads/:id/notes", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Note text required" });
    const note = await addNote(req.params.id, text.trim());
    res.json(note);
  } catch (err) {
    console.error("[API] POST /leads/:id/notes error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/bulk  { ids: [...], state: "contacted" }
router.post("/leads/bulk", async (req, res) => {
  try {
    const { ids, state } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }
    await bulkUpdateState(ids, state);
    res.json({ ok: true, updated: ids.length });
  } catch (err) {
    console.error("[API] POST /leads/bulk error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Serialize Firestore Timestamps to ISO strings
function serializeLead(lead) {
  const out = { ...lead };
  for (const key of ["createdAt", "updatedAt", "lastInteractedAt"]) {
    if (out[key] && typeof out[key].toDate === "function") {
      out[key] = out[key].toDate().toISOString();
    } else if (out[key] instanceof Date) {
      out[key] = out[key].toISOString();
    }
  }
  if (out.qualifyingMessages) {
    out.qualifyingMessages = out.qualifyingMessages.map(m => {
      const msg = { ...m };
      if (msg.timestamp && typeof msg.timestamp.toDate === "function") {
        msg.timestamp = msg.timestamp.toDate().toISOString();
      } else if (msg.timestamp instanceof Date) {
        msg.timestamp = msg.timestamp.toISOString();
      }
      return msg;
    });
  }
  if (out.notes) {
    out.notes = out.notes.map(n => {
      const note = { ...n };
      if (note.createdAt && typeof note.createdAt.toDate === "function") {
        note.createdAt = note.createdAt.toDate().toISOString();
      } else if (note.createdAt instanceof Date) {
        note.createdAt = note.createdAt.toISOString();
      }
      return note;
    });
  }
  return out;
}

module.exports = router;
