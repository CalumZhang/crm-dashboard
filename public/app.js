/* BabyMilu CRM — Frontend */

const STATE_LABELS = {
  new: "New",
  contacted: "Contacted",
  responded: "Responded",
  intent_to_buy: "Intent to Buy",
  purchased: "Purchased",
  dropped: "Dropped"
};

const STATES = Object.keys(STATE_LABELS);

let allLeads = [];
let currentSort = { key: "createdAt", order: "desc" };
let expandedId = null;
let selectedIds = new Set();

// ---- API helpers ----

async function api(path, opts = {}) {
  const res = await fetch("/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts
  });
  if (res.status === 401 && !path.includes("/login") && !path.includes("/auth")) {
    showLogin();
    throw new Error("Not authenticated");
  }
  return res;
}

// ---- Auth ----

async function checkAuth() {
  try {
    const res = await api("/auth/check");
    const data = await res.json();
    if (data.authenticated) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("dashboard").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  loadLeads();
}

document.getElementById("login-btn").addEventListener("click", async () => {
  const pw = document.getElementById("password-input").value;
  const errEl = document.getElementById("login-error");
  errEl.style.display = "none";
  try {
    const res = await api("/login", { method: "POST", body: JSON.stringify({ password: pw }) });
    if (res.ok) {
      showDashboard();
    } else {
      errEl.textContent = "Invalid password";
      errEl.style.display = "block";
    }
  } catch {
    errEl.textContent = "Connection error";
    errEl.style.display = "block";
  }
});

document.getElementById("password-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("login-btn").click();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("/logout", { method: "POST" });
  showLogin();
});

// ---- Load leads ----

async function loadLeads() {
  try {
    const res = await api("/leads");
    allLeads = await res.json();
    renderStats();
    renderTable();
  } catch (err) {
    console.error("Failed to load leads:", err);
  }
}

// ---- Stats bar ----

function renderStats() {
  const counts = {};
  for (const s of STATES) counts[s] = 0;
  for (const l of allLeads) counts[l.state] = (counts[l.state] || 0) + 1;
  const bar = document.getElementById("stats-bar");
  bar.innerHTML = `<span>Total: <span class="stat-count">${allLeads.length}</span></span>` +
    STATES.map(s => `<span>${STATE_LABELS[s]}: <span class="stat-count">${counts[s]}</span></span>`).join("");
}

// ---- Table rendering ----

function getFilteredLeads() {
  let leads = [...allLeads];
  const search = document.getElementById("search-input").value.toLowerCase();
  const stateFilter = document.getElementById("state-filter").value;

  if (stateFilter) leads = leads.filter(l => l.state === stateFilter);
  if (search) {
    leads = leads.filter(l =>
      (l.discordUserId || "").toLowerCase().includes(search) ||
      (l.discordUsername || "").toLowerCase().includes(search) ||
      (l.discordDisplayName || "").toLowerCase().includes(search) ||
      (l.name || "").toLowerCase().includes(search)
    );
  }

  // Sort
  leads.sort((a, b) => {
    let aVal = a[currentSort.key] || "";
    let bVal = b[currentSort.key] || "";
    if (typeof aVal === "string" && aVal.match(/^\d{4}-/)) aVal = new Date(aVal).getTime();
    if (typeof bVal === "string" && bVal.match(/^\d{4}-/)) bVal = new Date(bVal).getTime();
    if (typeof aVal === "string") return currentSort.order === "desc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    return currentSort.order === "desc" ? (bVal || 0) - (aVal || 0) : (aVal || 0) - (bVal || 0);
  });

  return leads;
}

function renderTable() {
  const leads = getFilteredLeads();
  const tbody = document.getElementById("leads-body");
  tbody.innerHTML = "";

  for (const lead of leads) {
    const tr = document.createElement("tr");
    tr.dataset.id = lead.discordUserId;
    if (expandedId === lead.discordUserId) tr.classList.add("expanded");

    const checked = selectedIds.has(lead.discordUserId) ? "checked" : "";

    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" class="row-check" data-id="${lead.discordUserId}" ${checked}></td>
      <td class="lead-name" style="cursor:pointer;font-weight:500">${esc(lead.name || lead.discordDisplayName || lead.discordUsername)}</td>
      <td>@${esc(lead.discordUsername)}</td>
      <td>
        <select class="state-select" data-id="${lead.discordUserId}">
          ${STATES.map(s => `<option value="${s}" ${s === lead.state ? "selected" : ""}>${STATE_LABELS[s]}</option>`).join("")}
        </select>
      </td>
      <td>${formatDate(lead.lastInteractedAt)}</td>
      <td>${formatDate(lead.createdAt)}</td>
      <td><button class="expand-btn" data-id="${lead.discordUserId}" style="font-size:0.8rem;cursor:pointer;border:1px solid #ddd;border-radius:4px;padding:2px 8px;background:#fff">Details</button></td>
    `;
    tbody.appendChild(tr);

    // Detail row (hidden by default)
    if (expandedId === lead.discordUserId) {
      const detailTr = document.createElement("tr");
      detailTr.classList.add("detail-row");
      detailTr.innerHTML = `<td colspan="7"><div class="detail-panel" id="detail-${lead.discordUserId}"><span class="loading">Loading...</span></div></td>`;
      tbody.appendChild(detailTr);
      loadLeadDetail(lead.discordUserId);
    }
  }

  updateBulkUI();
}

// ---- Event delegation ----

document.getElementById("leads-body").addEventListener("click", (e) => {
  // Expand button
  const expandBtn = e.target.closest(".expand-btn");
  if (expandBtn) {
    const id = expandBtn.dataset.id;
    expandedId = expandedId === id ? null : id;
    renderTable();
    return;
  }

  // Clickable name
  const nameCell = e.target.closest(".lead-name");
  if (nameCell) {
    const id = nameCell.closest("tr").dataset.id;
    expandedId = expandedId === id ? null : id;
    renderTable();
    return;
  }
});

document.getElementById("leads-body").addEventListener("change", async (e) => {
  // State dropdown
  if (e.target.classList.contains("state-select")) {
    const id = e.target.dataset.id;
    const state = e.target.value;
    try {
      await api(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ state }) });
      const lead = allLeads.find(l => l.discordUserId === id);
      if (lead) {
        lead.state = state;
        lead.lastInteractedAt = new Date().toISOString();
      }
      renderStats();
    } catch (err) {
      console.error("Failed to update state:", err);
      renderTable();
    }
    return;
  }

  // Row checkbox
  if (e.target.classList.contains("row-check")) {
    const id = e.target.dataset.id;
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    updateBulkUI();
  }
});

// Select all
document.getElementById("select-all").addEventListener("change", (e) => {
  const leads = getFilteredLeads();
  if (e.target.checked) {
    leads.forEach(l => selectedIds.add(l.discordUserId));
  } else {
    selectedIds.clear();
  }
  renderTable();
});

// Search & filter
document.getElementById("search-input").addEventListener("input", renderTable);
document.getElementById("state-filter").addEventListener("change", renderTable);

// Sort headers
document.querySelectorAll("thead th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (currentSort.key === key) {
      currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
    } else {
      currentSort = { key, order: "asc" };
    }
    // Update arrows
    document.querySelectorAll(".sort-arrow").forEach(el => el.textContent = "");
    th.querySelector(".sort-arrow").textContent = currentSort.order === "asc" ? " \u25B2" : " \u25BC";
    renderTable();
  });
});

// Bulk actions
document.getElementById("bulk-contacted-btn").addEventListener("click", () => bulkAction("contacted"));
document.getElementById("bulk-dropped-btn").addEventListener("click", () => bulkAction("dropped"));

function updateBulkUI() {
  const count = selectedIds.size;
  const countEl = document.getElementById("selected-count");
  const btnC = document.getElementById("bulk-contacted-btn");
  const btnD = document.getElementById("bulk-dropped-btn");
  if (count > 0) {
    countEl.textContent = `${count} selected`;
    btnC.classList.remove("hidden");
    btnD.classList.remove("hidden");
  } else {
    countEl.textContent = "";
    btnC.classList.add("hidden");
    btnD.classList.add("hidden");
  }
}

async function bulkAction(state) {
  if (selectedIds.size === 0) return;
  const ids = [...selectedIds];
  if (!confirm(`Mark ${ids.length} lead(s) as "${STATE_LABELS[state]}"?`)) return;
  try {
    await api("/leads/bulk", { method: "POST", body: JSON.stringify({ ids, state }) });
    ids.forEach(id => {
      const lead = allLeads.find(l => l.discordUserId === id);
      if (lead) {
        lead.state = state;
        lead.lastInteractedAt = new Date().toISOString();
      }
    });
    selectedIds.clear();
    document.getElementById("select-all").checked = false;
    renderStats();
    renderTable();
  } catch (err) {
    console.error("Bulk action failed:", err);
  }
}

// ---- Lead detail ----

async function loadLeadDetail(discordUserId) {
  const panel = document.getElementById(`detail-${discordUserId}`);
  if (!panel) return;

  // Load lead detail + messages in parallel
  const [leadRes, messagesRes] = await Promise.allSettled([
    api(`/leads/${discordUserId}`),
    api(`/leads/${discordUserId}/messages`)
  ]);

  const lead = leadRes.status === "fulfilled" ? await leadRes.value.json() : null;
  let messages = [];
  if (messagesRes.status === "fulfilled" && messagesRes.value.ok) {
    messages = await messagesRes.value.json();
  }

  if (!lead) {
    panel.innerHTML = `<span style="color:#e74c3c">Failed to load lead details</span>`;
    return;
  }

  panel.innerHTML = `
    <div class="detail-meta">
      <div class="meta-item"><span class="meta-label">Discord ID:</span> <span class="meta-value">${esc(lead.discordUserId)}</span></div>
      <div class="meta-item"><span class="meta-label">Handle:</span> <span class="meta-value">@${esc(lead.discordUsername)}</span></div>
      <div class="meta-item"><span class="meta-label">Display Name:</span> <span class="meta-value">${esc(lead.discordDisplayName)}</span></div>
      <div class="meta-item"><span class="meta-label">Name:</span> <span class="meta-value">${esc(lead.name)}</span></div>
    </div>

    ${lead.introContent ? `
    <div class="detail-section">
      <h4>Intro</h4>
      <div class="intro-content">${esc(lead.introContent)}</div>
    </div>` : ""}

    <div class="detail-section">
      <h4>Qualifying Messages (Purchase Interest)</h4>
      ${lead.qualifyingMessages && lead.qualifyingMessages.length > 0 ? `
        <ul class="qualifying-messages">
          ${lead.qualifyingMessages.map(m => `
            <li>
              ${esc(m.content)}
              <div class="msg-meta">${formatDate(m.timestamp)} in #${esc(m.channelName || m.channelId)} ${m.confidence ? `(confidence: ${m.confidence.toFixed(2)})` : ""} <a href="https://discord.com/channels/${m.channelId}/${m.messageId}" target="_blank">link</a></div>
            </li>
          `).join("")}
        </ul>` : `<span class="loading">None recorded</span>`}
    </div>

    <div class="detail-section">
      <h4>Recent Discord Messages</h4>
      <div class="discord-messages">
        ${messages.length > 0 ? messages.map(m => `
          <div class="discord-msg">
            ${esc(m.content || "(no text)")}
            <div class="msg-time">${formatDate(m.timestamp)} <a href="${esc(m.permalink)}" target="_blank">link</a></div>
          </div>
        `).join("") : `<span class="loading">No messages found or search unavailable</span>`}
      </div>
    </div>

    <div class="detail-section">
      <h4>Notes</h4>
      <ul class="notes-list" id="notes-${discordUserId}">
        ${(lead.notes || []).map(n => `
          <li>${esc(n.text)} <span class="note-time">${formatDate(n.createdAt)}</span></li>
        `).join("")}
      </ul>
      <div class="note-form">
        <input type="text" id="note-input-${discordUserId}" placeholder="Add a note...">
        <button onclick="addNote('${discordUserId}')">Add</button>
      </div>
    </div>
  `;

  // Enter key for note input
  const noteInput = document.getElementById(`note-input-${discordUserId}`);
  if (noteInput) {
    noteInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addNote(discordUserId);
    });
  }
}

async function addNote(discordUserId) {
  const input = document.getElementById(`note-input-${discordUserId}`);
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await api(`/leads/${discordUserId}/notes`, { method: "POST", body: JSON.stringify({ text }) });
    const note = await res.json();
    const notesList = document.getElementById(`notes-${discordUserId}`);
    const li = document.createElement("li");
    li.innerHTML = `${esc(note.text)} <span class="note-time">${formatDate(note.createdAt)}</span>`;
    notesList.appendChild(li);
    input.value = "";

    // Update local data
    const lead = allLeads.find(l => l.discordUserId === discordUserId);
    if (lead) {
      lead.lastInteractedAt = new Date().toISOString();
      if (!lead.notes) lead.notes = [];
      lead.notes.push(note);
    }
  } catch (err) {
    console.error("Failed to add note:", err);
  }
}

// ---- Utilities ----

function esc(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ---- Init ----
checkAuth();
