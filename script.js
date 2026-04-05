// ── STATE ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'volunteer-manager-v1';

const DEFAULT_STATE = {
  positions: [
    { id:'p1', title:'Event Coordinator', capacity:2, time:['Saturdays 9am-1pm'], skills:['Leadership','Communication'], assigned:[] },
    { id:'p2', title:'Registration Desk', capacity:3, time:['Sunday 8am-12pm'], skills:['Organization'], assigned:[] },
    { id:'p3', title:'First Aid Station', capacity:1, time:'Flexible', skills:['CPR','Medical'], assigned:[] }
  ],
  volunteers: [
    { id:'v1', name:'Alex Kim', availability:['Weekends'], skills:['CPR','Medical'], contact:'alex@example.com' },
    { id:'v2', name:'Jordan Lee', availability:['Saturdays'], skills:['Leadership','Communication'], contact:'jordan@example.com' },
    { id:'v3', name:'Sam Rivera', availability:['Flexible'], skills:['Organization','Communication'], contact:'sam@example.com' }
  ]
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const state = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_STATE));
    // migrate availability from string to array
    state.volunteers.forEach(v => {
      if (typeof v.availability === 'string') {
        v.availability = v.availability.split(',').map(s => s.trim()).filter(Boolean);
      }
    });
    return state;
  } catch(e) {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}

let state = loadState();
let draggingId = null;
let currentView = 'board';

// ── UTILS ──────────────────────────────────────────────────────────────────

function uid() { return 'id-' + Math.random().toString(36).slice(2,9); }

function remaining(pos) { return pos.capacity - pos.assigned.length; }

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

// ── TOP BAR STATS ──────────────────────────────────────────────────────────

function renderStats() {
  const totalSlots = state.positions.reduce((a,p) => a + p.capacity, 0);
  const filled     = state.positions.reduce((a,p) => a + p.assigned.length, 0);
  const unassigned = state.volunteers.filter(v => !state.positions.some(p => p.assigned.includes(v.id))).length;
  document.getElementById('topbar-stats').innerHTML = `
    <div class="stat-pill"><strong>${filled}</strong> / ${totalSlots} slots filled</div>
    <div class="stat-pill" style="color:var(--text-faint)">·</div>
    <div class="stat-pill"><strong>${unassigned}</strong> unassigned volunteer${unassigned!==1?'s':''}</div>
  `;
}

// ── VIEW SWITCHING ─────────────────────────────────────────────────────────

function setView(v) {
  currentView = v;
  document.getElementById('nav-board').classList.toggle('active', v==='board');
  document.getElementById('nav-all').classList.toggle('active', v==='all');
  document.getElementById('board-view').style.display = v==='board' ? 'flex' : 'none';
  document.getElementById('all-view').style.display = v==='all' ? 'block' : 'none';
  if (v==='board') renderBoard(); else renderAll();
  renderStats();
}

// ── BOARD VIEW ─────────────────────────────────────────────────────────────

function renderBoard() {
  const board = document.getElementById('board-view');
  board.innerHTML = '';

  const posPanel = document.createElement('div');
  posPanel.className = 'panel';
  posPanel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Positions</h2>
        <span class="count-badge">${state.positions.length}</span>
        <input type="search" id="position-search" placeholder="Search a position..." oninput="handlePositionSearch(this.value)">
      </div>
      <button class="btn-add" onclick="openPositionModal()">+ Add position</button>
    </div>
    <div class="scroll-area" id="pos-scroll"></div>
  `;
  board.appendChild(posPanel);

  const volPanel = document.createElement('div');
  volPanel.className = 'panel';
  volPanel.innerHTML = `
    <div class="panel-header">
      <div class="panel-title">
        <h2>Volunteers</h2>
        <span class="count-badge">${state.volunteers.length}</span>
      </div>
      <button class="btn-add" onclick="openVolunteerModal()">+ Add volunteer</button>
    </div>
    <div class="scroll-area" id="vol-scroll"></div>
  `;
  board.appendChild(volPanel);

  const posScroll = document.getElementById('pos-scroll');
  if (!state.positions.length) {
    posScroll.innerHTML = `<div class="empty-state"><div class="icon">📋</div>No positions yet.<br>Add one to get started.</div>`;
  } else {
    state.positions.forEach(pos => renderPositionCard(pos, posScroll));
  }

  const volScroll = document.getElementById('vol-scroll');
  if (!state.volunteers.length) {
    volScroll.innerHTML = `<div class="empty-state"><div class="icon">👤</div>No volunteers yet.<br>Add one to get started.</div>`;
  } else {
    state.volunteers.forEach(vol => renderVolunteerCard(vol, volScroll));
  }
}

function renderPositionCard(pos, container) {
  const rem    = remaining(pos);
  const pct    = pos.capacity > 0 ? Math.round((pos.assigned.length / pos.capacity) * 100) : 0;
  const isFull = rem <= 0;
  const card   = document.createElement('div');
  card.className = 'card';
  card.dataset.id = pos.id;

  const assignedChips = pos.assigned.map(vid => {
    const vol = state.volunteers.find(v => v.id === vid);
    if (!vol) return '';
    return `<span class="assigned-chip">${escHtml(vol.name)}
      <button onclick="unassign('${pos.id}','${vid}')" title="Remove">×</button>
    </span>`;
  }).join('');

  const dzClass = isFull ? 'drop-zone full' : 'drop-zone';
  const dzHint  = isFull
    ? `<span class="drop-hint">Position full</span>`
    : (pos.assigned.length === 0 ? `<span class="drop-hint">Drop a volunteer here</span>` : '');

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">${escHtml(pos.title)}</div>
      <div class="card-actions">
        <button class="btn-icon" onclick="openPositionModal('${pos.id}')" title="Edit">✎</button>
        <button class="btn-icon danger" onclick="deletePosition('${pos.id}')" title="Delete">✕</button>
      </div>
    </div>
    <div class="tags">
      <span class="tag blue">⏰ ${Array.isArray(pos.time) ? pos.time.join(', ') : escHtml(pos.time)}</span>
      ${pos.skills.map(s => `<span class="tag">${escHtml(s)}</span>`).join('')}
    </div>
    <div class="capacity-row">
      <span class="capacity-label">Capacity: <span>${rem}/${pos.capacity}</span> open</span>
      <span class="tag ${isFull ? 'amber' : 'teal'}">${isFull ? 'Full' : rem + ' spot' + (rem !== 1 ? 's' : '') + ' left'}</span>
    </div>
    <div class="capacity-bar-bg">
      <div class="capacity-bar-fill ${isFull ? 'full' : ''}" style="width:${pct}%"></div>
    </div>
    <div class="${dzClass}" id="dz-${pos.id}" data-posid="${pos.id}">
      ${assignedChips}
      ${dzHint}
    </div>
  `;

  container.appendChild(card);

  const dz = document.getElementById('dz-' + pos.id);
  dz.addEventListener('dragover', e => {
    if (isFull) return;
    e.preventDefault();
    dz.classList.add('over');
  });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('over');
    handleDrop(pos.id);
  });
}

function renderVolunteerCard(vol, container) {
  const assignedTo = state.positions.filter(p => p.assigned.includes(vol.id));
  const card = document.createElement('div');
  card.className = 'card vol-card';
  card.draggable = true;
  card.dataset.id = vol.id;

  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">${escHtml(vol.name)}</div>
      <div class="card-actions">
        <button class="btn-icon" onclick="openVolunteerModal('${vol.id}')" title="Edit">✎</button>
        <button class="btn-icon danger" onclick="deleteVolunteer('${vol.id}')" title="Delete">✕</button>
      </div>
    </div>
    <div class="tags">
      <span class="tag teal">📅 ${escHtml(vol.availability.join(', '))}</span>
      ${vol.skills.map(s => `<span class="tag">${escHtml(s)}</span>`).join('')}
    </div>
    <div class="tags">
      <span class="tag amber">✉ ${escHtml(vol.contact)}</span>
      ${assignedTo.length
        ? assignedTo.map(p => `<span class="tag teal">↳ ${escHtml(p.title)}</span>`).join('')
        : '<span class="tag" style="opacity:0.6">Unassigned</span>'}
    </div>
  `;

  card.addEventListener('dragstart', () => {
    draggingId = vol.id;
    requestAnimationFrame(() => card.classList.add('dragging'));
  });
  card.addEventListener('dragend', () => {
    draggingId = null;
    card.classList.remove('dragging');
  });

  container.appendChild(card);
}

function handleDrop(posId) {
  if (!draggingId) return;
  const pos = state.positions.find(p => p.id === posId);
  if (!pos) return;
  if (pos.assigned.includes(draggingId)) { showToast('Already assigned to this position'); return; }
  if (remaining(pos) <= 0) { showToast('This position is already full'); return; }
  pos.assigned.push(draggingId);
  const vol = state.volunteers.find(v => v.id === draggingId);
  saveState();
  showToast((vol?.name || 'Volunteer') + ' assigned to ' + pos.title);
  renderBoard();
  renderStats();
}

function unassign(posId, volId) {
  const pos = state.positions.find(p => p.id === posId);
  if (pos) {
    pos.assigned = pos.assigned.filter(id => id !== volId);
    saveState();
    renderBoard();
    renderStats();
  }
}

function autoAssign() {
  const unassigned = state.volunteers.filter(
    v => !state.positions.some(p => p.assigned.includes(v.id))
  );

  if (!unassigned.length) {
    showToast('No unassigned volunteers to place');
    return;
  }

  function timeMatches(vol, pos) {
    // Convert array to string or keep as string, then lowercase
    const posTime = (Array.isArray(pos.time) ? pos.time.join(' ') : pos.time).toLowerCase();
  
    return vol.availability.some(a => {
    const v = a.toLowerCase();
    // Ensure 'a' exists and is a string before comparing
    return v === 'flexible' || posTime.includes('flexible') ||
           v.includes(posTime) || posTime.includes(v);
  });
  }

  function skillScore(vol, pos) {
    const volSkills = vol.skills.map(s => s.toLowerCase());
    return pos.skills.filter(s => volSkills.includes(s.toLowerCase())).length;
  }

  let placed = 0;

  state.positions.forEach(pos => {
    const slots = pos.capacity - pos.assigned.length;
    if (slots <= 0) return;

    const eligible = unassigned
      .filter(v => !pos.assigned.includes(v.id))
      .filter(v => timeMatches(v, pos))        // hard gate: time must match
      .map(v => ({ vol: v, score: skillScore(v, pos) }))
      .filter(({ score }) => score > 0)        // hard gate: at least one skill must match
      .sort((a, b) => b.score - a.score);

    eligible.slice(0, slots).forEach(({ vol }) => {
      pos.assigned.push(vol.id);
      unassigned.splice(unassigned.indexOf(vol), 1);
      placed++;
    });
  });

  saveState();
  renderBoard();
  renderStats();
  showToast(placed ? `Auto-assigned ${placed} volunteer${placed !== 1 ? 's' : ''}` : 'No matches found');
}

function deletePosition(id) {
  const pos = state.positions.find(p => p.id === id);
  if (!pos) return;
  if (!confirm('Delete "' + pos.title + '"? This cannot be undone.')) return;
  state.positions = state.positions.filter(p => p.id !== id);
  saveState();
  closeModal();
  currentView === 'board' ? renderBoard() : renderAll();
  renderStats();
}

function deleteVolunteer(id) {
  const vol = state.volunteers.find(v => v.id === id);
  if (!vol) return;
  if (!confirm('Remove "' + vol.name + '"? They will also be unassigned from any positions.')) return;
  state.volunteers = state.volunteers.filter(v => v.id !== id);
  state.positions.forEach(p => { p.assigned = p.assigned.filter(vid => vid !== id); });
  saveState();
  closeModal();
  currentView === 'board' ? renderBoard() : renderAll();
  renderStats();
}

// ── ALL VIEW ───────────────────────────────────────────────────────────────

function renderAll() {
  const el = document.getElementById('all-view');

  const posCards = state.positions.map(pos => {
    const rem = remaining(pos);
    const assigned = pos.assigned.map(vid => state.volunteers.find(v => v.id === vid)?.name).filter(Boolean);
    return `
      <div class="all-card">
        <div class="all-card-title-row">
          <span style="font-size:14px;font-weight:600;color:var(--text);">${escHtml(pos.title)}</span>
          <span class="tag ${rem === 0 ? 'amber' : 'teal'}">${rem}/${pos.capacity} open</span>
        </div>
        <div class="tags">
          <span class="tag blue">⏰ ${escHtml(pos.time)}</span>
          ${pos.skills.map(s => `<span class="tag">${escHtml(s)}</span>`).join('')}
        </div>
        ${assigned.length
          ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">Assigned: ${assigned.map(n => `<strong>${escHtml(n)}</strong>`).join(', ')}</div>`
          : ''}
      </div>
    `;
  }).join('');

  const volCards = state.volunteers.map(vol => {
    const roles = state.positions.filter(p => p.assigned.includes(vol.id));
    return `
      <div class="all-card">
        <div class="all-card-title-row">
          <span style="font-size:14px;font-weight:600;color:var(--text);">${escHtml(vol.name)}</span>
          ${roles.length
            ? `<span class="tag teal">${roles.length} role${roles.length > 1 ? 's' : ''}</span>`
            : `<span class="tag">Unassigned</span>`}
        </div>
        <div class="tags">
          <span class="tag teal">📅 ${escHtml(vol.availability.join(', '))}</span>
          ${vol.skills.map(s => `<span class="tag">${escHtml(s)}</span>`).join('')}
          <span class="tag amber">✉ ${escHtml(vol.contact)}</span>
        </div>
        ${roles.length
          ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">${roles.map(p => `<strong>${escHtml(p.title)}</strong>`).join(', ')}</div>`
          : ''}
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="all-section">
      <div class="all-section-header">Positions — ${state.positions.length} total</div>
      ${state.positions.length
        ? `<div class="all-grid">${posCards}</div>`
        : `<div class="empty-state">No positions yet.</div>`}
    </div>
    <div class="all-section">
      <div class="all-section-header">Volunteers — ${state.volunteers.length} total</div>
      ${state.volunteers.length
        ? `<div class="all-grid">${volCards}</div>`
        : `<div class="empty-state">No volunteers yet.</div>`}
    </div>
  `;
}

// ── MODALS ─────────────────────────────────────────────────────────────────

function openPositionModal(editId) {
  editId = editId || null;
  const pos = editId ? state.positions.find(p => p.id === editId) : null;
  const isEdit = !!pos;

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h2>${isEdit ? 'Edit position' : 'Add position'}</h2>
        <div class="field">
          <label>Title</label>
          <input id="f-title" value="${isEdit ? escAttr(pos.title) : ''}" placeholder="e.g. Registration Desk">
        </div>
        <div class="field">
          <label>Capacity</label>
          <input id="f-cap" type="number" min="1" value="${isEdit ? pos.capacity : 1}">
        </div>
        <div class="field">
          <label>Time / Schedule</label>
          <input id="f-time" value="${isEdit ? escAttr(pos.time) : ''}" placeholder="e.g. Saturdays 9am–1pm">
        </div>
        <div class="field">
          <label>Required skills</label>
          <input id="f-skills" value="${isEdit ? escAttr(pos.skills.join(', ')) : ''}" placeholder="e.g. CPR, Leadership">
          <div class="field-hint">Separate multiple skills with commas</div>
        </div>
        <div class="modal-actions">
          ${isEdit ? `<button class="btn-danger" onclick="deletePosition('${editId}')">Delete</button>` : ''}
          <button class="btn-cancel" onclick="closeModal()">Cancel</button>
          <button class="btn-save" onclick="savePosition('${editId || ''}')">${isEdit ? 'Save changes' : 'Add position'}</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-bg').addEventListener('click', e => { if (e.target.id === 'modal-bg') closeModal(); });
  setTimeout(() => document.getElementById('f-title').focus(), 50);
}

function savePosition(editId) {
  editId = editId || null;
  const title = document.getElementById('f-title').value.trim();
  if (!title) { document.getElementById('f-title').focus(); return; }

  const data = {
    title,
    capacity: Math.max(1, parseInt(document.getElementById('f-cap').value) || 1),
    time:   document.getElementById('f-time').value.trim() || 'TBD',
    skills: document.getElementById('f-skills').value.split(',').map(s => s.trim()).filter(Boolean)
  };

  if (editId) {
    const pos = state.positions.find(p => p.id === editId);
    if (pos) {
      Object.assign(pos, data);
      if (pos.assigned.length > pos.capacity) pos.assigned = pos.assigned.slice(0, pos.capacity);
    }
    showToast('Position updated');
  } else {
    state.positions.push({ id: uid(), ...data, assigned: [] });
    showToast('Position added');
  }

  saveState();
  closeModal();
  currentView === 'board' ? renderBoard() : renderAll();
  renderStats();
}

function openVolunteerModal(editId) {
  editId = editId || null;
  const vol = editId ? state.volunteers.find(v => v.id === editId) : null;
  const isEdit = !!vol;

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-bg" id="modal-bg">
      <div class="modal">
        <h2>${isEdit ? 'Edit volunteer' : 'Add volunteer'}</h2>
        <div class="field">
          <label>Full name</label>
          <input id="v-name" value="${isEdit ? escAttr(vol.name) : ''}" placeholder="e.g. Alex Kim">
        </div>
        <div class="field">
          <label>Availability</label>
          <input id="v-avail" value="${isEdit ? escAttr(vol.availability.join(', ')) : ''}" placeholder="e.g. Weekends, Saturdays">
          <div class="field-hint">Separate multiple times with commas</div>
        </div>
        <div class="field">
          <label>Skills</label>
          <input id="v-skills" value="${isEdit ? escAttr(vol.skills.join(', ')) : ''}" placeholder="e.g. CPR, Organization">
          <div class="field-hint">Separate multiple skills with commas</div>
        </div>
        <div class="field">
          <label>Contact info</label>
          <input id="v-contact" value="${isEdit ? escAttr(vol.contact) : ''}" placeholder="email or phone number">
        </div>
        <div class="modal-actions">
          ${isEdit ? `<button class="btn-danger" onclick="deleteVolunteer('${editId}')">Remove</button>` : ''}
          <button class="btn-cancel" onclick="closeModal()">Cancel</button>
          <button class="btn-save" onclick="saveVolunteer('${editId || ''}')">${isEdit ? 'Save changes' : 'Add volunteer'}</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-bg').addEventListener('click', e => { if (e.target.id === 'modal-bg') closeModal(); });
  setTimeout(() => document.getElementById('v-name').focus(), 50);
}

function saveVolunteer(editId) {
  editId = editId || null;
  const name = document.getElementById('v-name').value.trim();
  if (!name) { document.getElementById('v-name').focus(); return; }

  const data = {
    name,
    availability: document.getElementById('v-avail').value.split(',').map(s => s.trim()).filter(Boolean),
    skills:  document.getElementById('v-skills').value.split(',').map(s => s.trim()).filter(Boolean),
    contact: document.getElementById('v-contact').value.trim() || '—'
  };

  if (editId) {
    const vol = state.volunteers.find(v => v.id === editId);
    if (vol) Object.assign(vol, data);
    showToast('Volunteer updated');
  } else {
    state.volunteers.push({ id: uid(), ...data });
    showToast('Volunteer added');
  }

  saveState();
  closeModal();
  currentView === 'board' ? renderBoard() : renderAll();
  renderStats();
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// position search functionality
let positionSearchQuery = '';

function handlePositionSearch(value) {
  positionSearchQuery = value.toLowerCase();
  filterPositions();
}

function filterPositions() {
  const posScroll = document.getElementById('pos-scroll');
  if (!posScroll) return;

  posScroll.innerHTML = '';

  const filtered = state.positions.filter(pos =>
    pos.title.toLowerCase().includes(positionSearchQuery)
  );

  if (!filtered.length) {
    posScroll.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        No matching positions.
      </div>
    `;
    return;
  }

  filtered.forEach(pos => renderPositionCard(pos, posScroll));
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── INIT ───────────────────────────────────────────────────────────────────
renderBoard();
renderStats();