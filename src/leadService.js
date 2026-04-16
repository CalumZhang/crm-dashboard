const { db } = require("./firestore");
const admin = require("firebase-admin");

const APP_COLLECTION = "app";
const APP_DOC_ID = "marketing";
const CRM_LEADS_COLLECTION = "crm_leads";

function getLeadsRef() {
  return db.collection(APP_COLLECTION).doc(APP_DOC_ID).collection(CRM_LEADS_COLLECTION);
}

const VALID_STATES = ["new", "contacted", "responded", "intent_to_buy", "purchased", "dropped"];

// ---- Read ----

async function getAllLeads() {
  const snap = await getLeadsRef().orderBy("createdAt", "desc").get();
  return snap.docs.map(doc => ({ discordUserId: doc.id, ...doc.data() }));
}

async function getLead(discordUserId) {
  const doc = await getLeadsRef().doc(discordUserId).get();
  if (!doc.exists) return null;
  return { discordUserId: doc.id, ...doc.data() };
}

// ---- Write ----

async function createLead({
  discordUserId,
  discordUsername,
  discordDisplayName,
  name,
  qualifyingMessages,
  introContent,
  source
}) {
  const now = new Date();
  const data = {
    discordUsername: discordUsername || "",
    discordDisplayName: discordDisplayName || "",
    name: name || discordDisplayName || discordUsername || "",
    state: "new",
    qualifyingMessages: qualifyingMessages || [],
    introContent: introContent || null,
    notes: [],
    lastInteractedAt: now,
    source: source || "backfill",
    createdAt: now,
    updatedAt: now
  };
  await getLeadsRef().doc(discordUserId).set(data);
  return { discordUserId, ...data };
}

async function updateLeadState(discordUserId, state) {
  if (!VALID_STATES.includes(state)) {
    throw new Error(`Invalid state: ${state}`);
  }
  const now = admin.firestore.FieldValue.serverTimestamp();
  await getLeadsRef().doc(discordUserId).update({
    state,
    lastInteractedAt: now,
    updatedAt: now
  });
}

async function addNote(discordUserId, text) {
  const now = new Date().toISOString();
  const note = { text, createdAt: now };
  const ref = getLeadsRef().doc(discordUserId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("Lead not found");
  const data = doc.data();
  const notes = data.notes || [];
  notes.push(note);
  await ref.update({
    notes,
    lastInteractedAt: new Date(),
    updatedAt: new Date()
  });
  return note;
}

async function bulkUpdateState(discordUserIds, state) {
  if (!VALID_STATES.includes(state)) {
    throw new Error(`Invalid state: ${state}`);
  }
  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  for (const id of discordUserIds) {
    const ref = getLeadsRef().doc(id);
    batch.update(ref, { state, lastInteractedAt: now, updatedAt: now });
  }
  await batch.commit();
}

async function markLeadsAsPurchased(discordUserIds) {
  return bulkUpdateState(discordUserIds, "purchased");
}

module.exports = {
  getAllLeads,
  getLead,
  createLead,
  updateLeadState,
  addNote,
  bulkUpdateState,
  markLeadsAsPurchased,
  VALID_STATES
};
