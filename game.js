// ── Game state ────────────────────────────────────────────

// Visual snake fill order: top row left→right, bottom row right→left
// drop6=col4(rightmost), drop7=col3, ..., drop10=col0(leftmost)
const DROP_ORDER = [
  "drop1","drop2","drop3","drop4","drop5",
  "drop6","drop7","drop8","drop9","drop10"
];

// Visual layout: top row = drop1..drop5 (left→right),
//               bottom row = drop10..drop6 (left→right visually = drop10,drop9,...,drop6)
const DROP_COORDS = {
  drop1:  { col: 0, row: 0 }, drop2:  { col: 1, row: 0 }, drop3:  { col: 2, row: 0 },
  drop4:  { col: 3, row: 0 }, drop5:  { col: 4, row: 0 },
  drop10: { col: 0, row: 1 }, drop9:  { col: 1, row: 1 }, drop8:  { col: 2, row: 1 },
  drop7:  { col: 3, row: 1 }, drop6:  { col: 4, row: 1 },
};

const ITEM_COLORS = ["blue", "yellow", "gray", "pink"];

const COLOR_HEX = {
  blue:   "#aed6f1",
  yellow: "#fef08a",
  gray:   "#c8c8c8",
  pink:   "#f5b8cd",
};

// occupancy[dropId] = itemId | null
const occupancy = {};
DROP_ORDER.forEach(id => { occupancy[id] = null; });

// per-item color
const itemColors = {};

// staging positions captured once items are in the DOM
const stagingPositions = {};

let uiBusy = false;

// ── Item color helpers ────────────────────────────────────

function assignColor(itemEl) {
  const color = ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)];
  itemEl.dataset.color = color;
  itemColors[itemEl.id] = color;
  updateItemVisual(itemEl);
}

function updateItemVisual(itemEl) {
  const color = itemColors[itemEl.id];
  if (color) {
    itemEl.style.setProperty("--item-color", COLOR_HEX[color] ?? "#ccc");
  }
}

function getItemColor(itemId) {
  return itemColors[itemId] ?? null;
}

// ── Board sections (for goal matching) ───────────────────

function buildBoardSections() {
  const topRow    = ["drop1","drop2","drop3","drop4","drop5"];
  const bottomRow = ["drop10","drop9","drop8","drop7","drop6"];
  const sections  = {};

  for (let w = 2; w <= 5; w++) {
    sections[`rect${w}`] = [];
    for (let c = 0; c <= 5 - w; c++) {
      const sec = [];
      for (let i = 0; i < w; i++) sec.push(topRow[c + i]);
      for (let i = 0; i < w; i++) sec.push(bottomRow[c + i]);
      sections[`rect${w}`].push(sec);
    }
  }

  for (let w = 2; w <= 5; w++) {
    sections[`line${w}`] = [];
    for (const row of [topRow, bottomRow]) {
      for (let c = 0; c <= 5 - w; c++) {
        sections[`line${w}`].push(row.slice(c, c + w));
      }
    }
  }

  return sections;
}

const BOARD_SECTIONS = buildBoardSections();

// ── Pattern matching ──────────────────────────────────────

function matchesPattern(section, pattern, relaxed = false) {
  const letterToColor = {};
  const colorToLetter = {};
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "-") continue;
    const color = occupancy[section[i]] ? getItemColor(occupancy[section[i]]) : null;
    if (!color) return false;
    if (ch in letterToColor) {
      if (letterToColor[ch] !== color) return false;
    } else {
      if (!relaxed && color in colorToLetter) return false;
      letterToColor[ch] = color;
      colorToLetter[color] = ch;
    }
  }
  return true;
}

function checkGoal(goal) {
  const w = goal.pattern.length / (goal.shape === "rectangle" ? 2 : 1);
  const key = goal.shape === "rectangle" ? `rect${w}` : `line${w}`;
  const sections = BOARD_SECTIONS[key];
  if (!sections) return { matched: false };
  for (const section of sections) {
    if (matchesPattern(section, goal.pattern, goal.relaxed ?? false)) return { matched: true, section };
  }
  return { matched: false };
}

function getMatchedItemIds(goal, section) {
  return section
    .map((dropId, i) => ({ dropId, ch: goal.pattern[i] }))
    .filter(({ ch }) => ch !== "-")
    .map(({ dropId }) => occupancy[dropId])
    .filter(Boolean);
}

// ── Adjacency ─────────────────────────────────────────────

function areAdjacent(a, b) {
  const ca = DROP_COORDS[a], cb = DROP_COORDS[b];
  if (!ca || !cb) return false;
  return (Math.abs(ca.col - cb.col) === 1 && ca.row === cb.row) ||
         (Math.abs(ca.row - cb.row) === 1 && ca.col === cb.col);
}

// ── Animation ─────────────────────────────────────────────

function quadBezier(p0, p1, p2, t) {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

// opts: { fromScale, toScale, fromOpacity, toOpacity }
// Any omitted value means "keep current / don't interpolate that property"
function animateTo(el, endX, endY, duration = 400, opts = {}) {
  stopAnimation(el);
  return new Promise(resolve => {
    const startX = el.offsetLeft, startY = el.offsetTop;
    const dx = endX - startX, dy = endY - startY;
    const dist = Math.hypot(dx, dy);
    const arc = clamp(dist * 0.32, 40, 130);
    const cX = startX + dx / 2 + (dy === 0 ? 0 : Math.sign(dy) * arc);
    const cY = startY + dy / 2 + (dx === 0 ? 0 : -Math.sign(dx) * arc);

    const { fromScale = null, toScale = null, fromOpacity = null, toOpacity = null } = opts;
    const animScale   = fromScale   !== null || toScale   !== null;
    const animOpacity = fromOpacity !== null || toOpacity !== null;

    if (animScale   && fromScale   !== null) el.style.transform = `scale(${fromScale})`;
    if (animOpacity && fromOpacity !== null) el.style.opacity   = fromOpacity;

    const scaleStart = fromScale   ?? (toScale   !== null ? 1 : null);
    const scaleEnd   = toScale     ?? (fromScale !== null ? 1 : null);
    const opStart    = fromOpacity ?? (toOpacity !== null ? 1 : null);
    const opEnd      = toOpacity   ?? (fromOpacity !== null ? 1 : null);

    const t0 = performance.now();
    let raf = null, cancelled = false;

    function step(now) {
      if (cancelled) return;
      const raw = Math.min((now - t0) / duration, 1);
      const t = easeOutCubic(raw);
      el.style.left = quadBezier(startX, cX, endX, t) + "px";
      el.style.top  = quadBezier(startY, cY, endY, t) + "px";
      if (animScale)   el.style.transform = `scale(${scaleStart + (scaleEnd - scaleStart) * t})`;
      if (animOpacity) el.style.opacity   = opStart + (opEnd - opStart) * t;
      if (raw < 1) { raf = requestAnimationFrame(step); }
      else { el._anim = null; resolve(); }
    }

    raf = requestAnimationFrame(step);
    el._anim = { cancel() { cancelled = true; cancelAnimationFrame(raf); el._anim = null; resolve(); } };
  });
}

function stopAnimation(el) {
  if (el._anim) { el._anim.cancel(); el._anim = null; }
}

// Position an item centered inside a drop cell, relative to the item-layer container.
function centeredInCell(itemEl, cellEl) {
  const layer = document.getElementById("item-layer");
  const layerRect = layer.getBoundingClientRect();
  const cellRect = cellEl.getBoundingClientRect();
  return {
    left: (cellRect.left - layerRect.left) + (cellRect.width  - itemEl.offsetWidth)  / 2,
    top:  (cellRect.top  - layerRect.top)  + (cellRect.height - itemEl.offsetHeight) / 2,
  };
}

// ── Item DOM helpers ──────────────────────────────────────

function currentDropId(itemEl) {
  return itemEl.dataset.dropId || null;
}

function getAllItems() {
  return Array.from(document.querySelectorAll(".duck-item"));
}

// ── Fill board ────────────────────────────────────────────

async function fillBoard() {
  setUiBusy(true);
  try {
    const items = getAllItems();

    // Phase 1: compact board items to the back of dropOrder
    const onBoard = items
      .filter(it => currentDropId(it))
      .map(it => ({ it, idx: DROP_ORDER.indexOf(currentDropId(it)) }))
      .sort((a, b) => a.idx - b.idx);

    const suffix = DROP_ORDER.slice(DROP_ORDER.length - onBoard.length);

    DROP_ORDER.forEach(id => { occupancy[id] = null; });
    const boardMoves = onBoard.map((entry, i) => {
      const toId = suffix[i];
      occupancy[toId] = entry.it.id;
      entry.it.dataset.dropId = toId;
      return { it: entry.it, from: entry.idx, to: DROP_ORDER.indexOf(toId) };
    }).filter(m => m.from !== m.to)
      .sort((a, b) => b.from - a.from); // start rightmost/furthest item first

    if (boardMoves.length) {
      await runStaggered(boardMoves.map(m => ({
        itemEl: m.it,
        waypoints: buildShiftWaypoints(m.it, m.from, m.to),
      })));
    }

    // Phase 2: pull staging items into open slots from the front
    const open = DROP_ORDER.filter(id => !occupancy[id]);
    const targets = [...open].reverse(); // highest index first
    const staging = items
      .filter(it => !currentDropId(it))
      .sort((a, b) => itemNum(a.id) - itemNum(b.id));

    const fillMoves = [];
    for (let i = 0; i < Math.min(targets.length, staging.length); i++) {
      const it = staging[i], toId = targets[i];
      occupancy[toId] = it.id;
      it.dataset.dropId = toId;
      fillMoves.push({ itemEl: it, waypoints: buildFillWaypoints(it, DROP_ORDER.indexOf(toId)) });
    }

    if (fillMoves.length) await runStaggered(fillMoves);

    // Signal that the board has items — used to switch UFO click to progress modal
    if (!fillBoard._everFilled) {
      fillBoard._everFilled = true;
      document.dispatchEvent(new CustomEvent("game:board-filled"));
    }
  } finally {
    setUiBusy(false);
  }
}

function buildShiftWaypoints(itemEl, fromIdx, toIdx) {
  const step = toIdx > fromIdx ? 1 : -1;
  const pts = [];
  for (let i = fromIdx + step; step > 0 ? i <= toIdx : i >= toIdx; i += step) {
    const cell = document.getElementById(DROP_ORDER[i]);
    pts.push(centeredInCell(itemEl, cell));
  }
  return pts;
}

function buildFillWaypoints(itemEl, toIdx) {
  const pts = [];
  for (let i = 0; i <= toIdx; i++) {
    const cell = document.getElementById(DROP_ORDER[i]);
    const wp = centeredInCell(itemEl, cell);
    // First hop out of the UFO: grow from nothing and fade in
    if (i === 0) wp.opts = { fromScale: 0, toScale: 1, fromOpacity: 0, toOpacity: 1 };
    pts.push(wp);
  }
  return pts;
}

async function runStaggered(trajectories) {
  if (!trajectories.length) return;
  return new Promise(resolve => {
    let done = 0;
    function start(i) {
      if (i >= trajectories.length) return;
      const traj = trajectories[i];
      let nextStarted = false;
      animateTrajectory(traj, () => { if (!nextStarted) { nextStarted = true; start(i + 1); } })
        .then(() => { if (++done === trajectories.length) resolve(); });
    }
    start(0);
  });
}

// Each waypoint is { left, top } or { left, top, opts }
async function animateTrajectory({ itemEl, waypoints }, onFirst) {
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    await animateTo(itemEl, wp.left, wp.top, 400, wp.opts ?? {});
    if (i === 0 && typeof onFirst === "function") onFirst();
  }
}

// ── Direct item move (swap if occupied) ──────────────────

async function moveItemToCell(itemId, targetDropId) {
  commitAction();
  const itemEl = document.getElementById(itemId);
  const targetCell = document.getElementById(targetDropId);
  if (!itemEl || !targetCell) return;

  stopAnimation(itemEl);
  const srcDropId = currentDropId(itemEl);
  if (srcDropId === targetDropId) {
    const pos = centeredInCell(itemEl, targetCell);
    await animateTo(itemEl, pos.left, pos.top);
    return;
  }

  const displaced = occupancy[targetDropId];

  occupancy[targetDropId] = itemId;
  itemEl.dataset.dropId = targetDropId;

  if (displaced) {
    const displacedEl = document.getElementById(displaced);
    stopAnimation(displacedEl);
    if (srcDropId) {
      occupancy[srcDropId] = displaced;
      displacedEl.dataset.dropId = srcDropId;
    } else {
      displacedEl.dataset.dropId = "";
    }
    const srcCell = srcDropId ? document.getElementById(srcDropId) : null;
    const displacedTarget = srcCell
      ? centeredInCell(displacedEl, srcCell)
      : { left: stagingPositions[displaced]?.left ?? 0, top: stagingPositions[displaced]?.top ?? 0 };
    const movingTarget = centeredInCell(itemEl, targetCell);
    await Promise.all([
      animateTo(itemEl, movingTarget.left, movingTarget.top),
      animateTo(displacedEl, displacedTarget.left, displacedTarget.top),
    ]);
  } else {
    if (srcDropId) occupancy[srcDropId] = null;
    const pos = centeredInCell(itemEl, targetCell);
    await animateTo(itemEl, pos.left, pos.top);
  }
}

// ── Send item to staging ──────────────────────────────────

async function sendToStaging(itemId) {
  commitAction();
  const itemEl = document.getElementById(itemId);
  if (!itemEl) return;
  const dropId = currentDropId(itemEl);
  if (dropId) occupancy[dropId] = null;
  itemEl.dataset.dropId = "";
  const sp = stagingPositions[itemId];
  if (sp) {
    await animateTo(itemEl, sp.left, sp.top, 400, { toScale: 0, toOpacity: 0 });
    // Snap back to invisible at rest so it hides cleanly behind the UFO
    itemEl.style.transform = "scale(0)";
    itemEl.style.opacity   = "0";
  }
  assignColor(itemEl);
}

// ── Helpers ───────────────────────────────────────────────

function itemNum(id) { return Number(id.replace(/\D/g, "")); }

function setUiBusy(busy) {
  uiBusy = busy;
}

let _actionCommitted = false;

function commitAction() {
  if (!_activeAction || _actionCommitted) return;
  _actionCommitted = true;
  document.dispatchEvent(new CustomEvent("game:action-committed"));
}

// ── Action state machine ──────────────────────────────────

let _activeAction = null;
const actionState = {};

function selectAction(name) {
  if (_activeAction === name) { cancelAction(); return; }
  if (_activeAction) cancelAction();
  _actionCommitted = false;
  _activeAction = name;
  if      (name === "Gravity Assist") actionState[name] = { step: 1, firstItemIds: [] };
  else if (name === "Dubabducktion")  actionState[name] = { step: 1, firstDropId: null };
  else if (name === "Shape Shifter")  actionState[name] = { phase: "selecting", dropIds: [] };
  else if (name === "Orbit")          actionState[name] = { phase: "selecting", dropIds: null };
  else if (name === "Wormhole")       actionState[name] = { itemId: null };
  else if (name === "Body Snatcher")  actionState[name] = { phase: "selecting", selectedIds: [], removedDrops: {}, placedCount: 0 };
  else                                actionState[name] = {};
}

function cancelAction() {
  if (!_activeAction) return;
  const name = _activeAction;
  if (name === "Orbit") {
    clearOrbitHighlight();
  }
  if (name === "Wormhole") {
    const st = actionState[name];
    if (st?.itemId) {
      const el = document.getElementById(st.itemId);
      el?.classList.remove("item-wormhole-selected");
      // Restore item to its original board position if it was removed
      if (st.origDropId && el && !currentDropId(el)) {
        occupancy[st.origDropId] = st.itemId;
        el.dataset.dropId = st.origDropId;
        const cell = document.getElementById(st.origDropId);
        const sp = stagingPositions[st.itemId];
        if (sp) { el.style.left = sp.left + "px"; el.style.top = sp.top + "px"; }
        const pos = centeredInCell(el, cell);
        animateTo(el, pos.left, pos.top, 400, { fromScale: 0, toScale: 1, fromOpacity: 0, toOpacity: 1 });
      }
    }
  }
  if (name === "Body Snatcher") {
    const state = actionState[name];
    state?.selectedIds?.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove("item-bs-staging");
        el.style.zIndex = "5";
      }
    });
  }
  _actionCommitted = false;
  _activeAction = null;
  actionState[name] = {};
}

// Actions that have explicit "End Action" / "Done" buttons — do NOT auto-close on complete.
const OPEN_ENDED_ACTIONS = new Set(["Parallel Universe", "Shape Shifter", "Orbit"]);

function completeAction(name, counts) {
  if (counts && name in counts) counts[name] = Math.max(0, counts[name] - 1);
  if (name === "Orbit") clearOrbitHighlight();
  _actionCommitted = false;
  _activeAction = null;
  actionState[name] = {};
  document.dispatchEvent(new CustomEvent("game:action-complete", { detail: { name } }));
}

// ── Drag engine ───────────────────────────────────────────

const SNAP_THRESHOLD = 120;

function makeDraggable(itemEl, {
  onDragStart,   // (itemEl) => bool
  onDrop,        // (itemEl, snapTargetId) => verdict string|false
  onAfterMove,   // (movedItemId, displacedItemId) => void  (optional)
  getActionCounts, // () => object
}) {
  let dragging = false, ox = 0, oy = 0, origDropId = null;

  itemEl.addEventListener("pointerdown", async e => {
    if (uiBusy) return;
    if (!_activeAction) return;
    if (onDragStart && onDragStart(itemEl) === false) return;

    e.preventDefault();
    stopAnimation(itemEl);
    origDropId = currentDropId(itemEl);

    const rect = itemEl.getBoundingClientRect();
    ox = e.clientX - rect.left;
    oy = e.clientY - rect.top;

    itemEl.classList.add("item-dragging");
    itemEl.setPointerCapture(e.pointerId);
    dragging = true;

    const layer = document.getElementById("item-layer");

    function onMove(ev) {
      if (!dragging) return;
      ev.preventDefault();
      const lr = layer.getBoundingClientRect();
      const newL = clamp(ev.clientX - lr.left - ox, 0, lr.width  - itemEl.offsetWidth);
      const newT = clamp(ev.clientY - lr.top  - oy, 0, lr.height - itemEl.offsetHeight);
      itemEl.style.left = newL + "px";
      itemEl.style.top  = newT + "px";
      highlightNearest(itemEl);
    }

    async function onUp(ev) {
      if (!dragging) return;
      dragging = false;
      itemEl.classList.remove("item-dragging");
      try { itemEl.releasePointerCapture(ev.pointerId); } catch (_) {}
      itemEl.removeEventListener("pointermove", onMove);
      itemEl.removeEventListener("pointerup", onUp);
      itemEl.removeEventListener("pointercancel", onUp);
      clearHighlights();

      const snap = findSnap(itemEl);
      const snapId = snap ? snap.id : null;
      const verdict = onDrop ? onDrop(itemEl, snapId) : "allow";

      if (verdict === false) {
        await bounceBack(itemEl, origDropId);
        return;
      }
      if (verdict === "recenter") {
        await bounceBack(itemEl, origDropId);
        return;
      }
      if (verdict === "remove") {
        const name = _activeAction;
        completeAction(name, getActionCounts?.());
        setUiBusy(true);
        try {
          if (name === "Black Hole") {
            // Remove the triggered item plus every board item sharing its color
            const color = getItemColor(itemEl.id);
            const targets = getAllItems().filter(it =>
              currentDropId(it) && getItemColor(it.id) === color
            );
            // Clear occupancy for all targets before animating
            targets.forEach(it => {
              const d = currentDropId(it);
              if (d) occupancy[d] = null;
              it.dataset.dropId = "";
            });
            await Promise.all(targets.map(it => sendToStaging(it.id)));
          } else {
            await sendToStaging(itemEl.id);
          }
          await fillBoard();
        } finally { setUiBusy(false); }
        onAfterMove && onAfterMove(itemEl.id, null);
        return;
      }
      if (verdict === "select" || verdict === "orbit-select" ||
          verdict === "wormhole-select" || verdict === "bodysnatcher-select" ||
          verdict === "bodysnatcher-place") {
        // Delegate to action-specific handler via event
        itemEl.dispatchEvent(new CustomEvent("game:verdict", {
          bubbles: true, detail: { verdict, snapId, origDropId }
        }));
        return;
      }
      if (!snapId || snapId === origDropId) {
        await bounceBack(itemEl, origDropId);
        return;
      }
      const displaced = occupancy[snapId] ?? null;
      await moveItemToCell(itemEl.id, snapId);
      onAfterMove && onAfterMove(itemEl.id, displaced);
    }

    itemEl.addEventListener("pointermove", onMove);
    itemEl.addEventListener("pointerup", onUp);
    itemEl.addEventListener("pointercancel", onUp);
  });
}

async function bounceBack(itemEl, dropId) {
  if (dropId) {
    const cell = document.getElementById(dropId);
    if (cell) {
      const pos = centeredInCell(itemEl, cell);
      await animateTo(itemEl, pos.left, pos.top);
      return;
    }
  }
  // Body Snatcher placing phase: snap back over its slot in the action detail
  if (_activeAction === "Body Snatcher") {
    const slot = document.querySelector(`.bs-proxy-slot[data-item-id="${itemEl.id}"]`);
    if (slot) {
      const layer = document.getElementById("item-layer");
      const layerRect = layer.getBoundingClientRect();
      const sr = slot.getBoundingClientRect();
      const tx = sr.left - layerRect.left + (sr.width  - itemEl.offsetWidth)  / 2;
      const ty = sr.top  - layerRect.top  + (sr.height - itemEl.offsetHeight) / 2;
      await animateTo(itemEl, tx, ty);
      itemEl.style.transform = "scale(0.5)";
      return;
    }
  }
  const sp = stagingPositions[itemEl.id];
  if (sp) await animateTo(itemEl, sp.left, sp.top);
}

function findSnap(itemEl) {
  const cells = Array.from(document.querySelectorAll(".drop-cell"));
  const ir = itemEl.getBoundingClientRect();
  let bestArea = 0, bestCell = null, nearDist = Infinity, nearCell = null;
  for (const cell of cells) {
    const cr = cell.getBoundingClientRect();
    const area = overlapArea(ir, cr);
    const dist = centerDist(ir, cr);
    if (area > bestArea) { bestArea = area; bestCell = cell; }
    if (dist < nearDist) { nearDist = dist; nearCell = cell; }
  }
  if (bestArea > 0) return bestCell;
  if (nearDist <= SNAP_THRESHOLD) return nearCell;
  return null;
}

function highlightNearest(itemEl) {
  clearHighlights();
  const snap = findSnap(itemEl);
  if (snap) snap.classList.add("cell-highlight");
}

function clearHighlights() {
  document.querySelectorAll(".cell-highlight").forEach(el => el.classList.remove("cell-highlight"));
}

function clearOrbitHighlight() {
  document.querySelectorAll(".cell-orbit-highlight").forEach(el => el.classList.remove("cell-orbit-highlight"));
}

function overlapArea(r1, r2) {
  const ox = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
  const oy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
  return (ox > 0 && oy > 0) ? ox * oy : 0;
}

function centerDist(r1, r2) {
  return Math.hypot(
    (r1.left + r1.width / 2) - (r2.left + r2.width / 2),
    (r1.top + r1.height / 2) - (r2.top + r2.height / 2)
  );
}

// ── Match resolution ──────────────────────────────────────

async function resolveMatch(goal, section) {
  setUiBusy(true);
  try {
    const ids = getMatchedItemIds(goal, section);
    await Promise.all(ids.map(async id => {
      const el = document.getElementById(id);
      const fromDrop = currentDropId(el);
      if (fromDrop) occupancy[fromDrop] = null;
      el.dataset.dropId = "";
      await sendToStaging(id);
    }));
    await fillBoard();
  } finally {
    setUiBusy(false);
  }
}

// ── Init ──────────────────────────────────────────────────

function initGame() {
  const items = getAllItems();
  const layer = document.getElementById("item-layer");
  const layerRect = layer.getBoundingClientRect();
  const stagingEl = document.getElementById("staging-area");
  const stagingRect = stagingEl.getBoundingClientRect();

  // Create the UFO image inside item-layer, sized to fill the staging area
  const ufoEl = document.createElement("img");
  ufoEl.id = "staging-ufo";
  ufoEl.src = "images/transparent/ufo.png";
  ufoEl.alt = "UFO — click to fill board";
  ufoEl.style.left   = (stagingRect.left - layerRect.left) + "px";
  ufoEl.style.top    = (stagingRect.top  - layerRect.top)  + "px";
  ufoEl.style.width  = stagingRect.width  + "px";
  ufoEl.style.height = stagingRect.height + "px";
  ufoEl.addEventListener("click", () => {
    if (uiBusy) return;
    if (fillBoard._everFilled) {
      document.dispatchEvent(new CustomEvent("game:ufo-click"));
    } else {
      fillBoard();
    }
  });
  layer.appendChild(ufoEl);

  // Size items to 90% of a drop cell
  const firstCell = document.querySelector(".drop-cell");
  const cellSize = firstCell ? firstCell.getBoundingClientRect().width : 48;
  const itemSize = Math.round(cellSize * 0.9);
  items.forEach(it => {
    it.style.width  = itemSize + "px";
    it.style.height = itemSize + "px";
  });

  // Stack all items at the center of the UFO (behind it, z-index 5 < UFO z-index 8)
  const stackX = (stagingRect.left - layerRect.left) + (stagingRect.width  - itemSize) / 2;
  const stackY = (stagingRect.top  - layerRect.top)  + (stagingRect.height - itemSize) / 2;

  items.forEach(it => {
    it.style.left      = stackX + "px";
    it.style.top       = stackY + "px";
    it.style.transform = "scale(0)";
    it.style.opacity   = "0";
    stagingPositions[it.id] = { left: stackX, top: stackY };
    assignColor(it);
  });

  // Make items draggable with action routing
  items.forEach(it => {
    makeDraggable(it, {
      onDragStart:     (el) => actionDragStart(el),
      onDrop:          (el, snapId) => actionDrop(el, snapId),
      onAfterMove:     (movedId, displacedId) => actionAfterMove(movedId, displacedId),
      getActionCounts: () => window.Game?.actionCounts,
    });
  });
  // Items stay stacked under the UFO until the player clicks it.
}

// ── Action drag routing ───────────────────────────────────
// These call per-action validators; return false to reject, string verdict otherwise.

function actionDragStart(itemEl) {
  const drop = currentDropId(itemEl);
  switch (_activeAction) {
    case "Body Snatcher": {
      const st = actionState["Body Snatcher"];
      if (st.phase === "selecting") return drop ? true : false;
      if (st.phase === "placing") {
        if (!st.selectedIds.includes(itemEl.id) || drop) return false;
        // Scale back to full size before drag begins so position math is correct
        itemEl.style.transform = "scale(1)";
        return true;
      }
      return false;
    }
    case "Abducktion":
    case "Black Hole":
    case "Teleport":
    case "Swap":
    case "Gravity Assist":
    case "Parallel Universe":
    case "Shape Shifter":
    case "Wormhole":
    case "Dubabducktion":
    case "Orbit":
      if (!drop) return false;
      if (_activeAction === "Gravity Assist") {
        const st = actionState["Gravity Assist"];
        if (st.step === 2 && !st.firstItemIds.includes(itemEl.id)) return false;
      }
      if (_activeAction === "Shape Shifter") {
        const st = actionState["Shape Shifter"];
        if (st.phase !== "selecting" && !st.dropIds.includes(drop)) return false;
      }
      return true;
    default:
      return true;
  }
}

function actionDrop(itemEl, snapId) {
  const src = currentDropId(itemEl);
  switch (_activeAction) {
    case "Teleport":
      if (!snapId) return false;
      if (snapId === src) return "recenter";
      if (!occupancy[snapId]) return false;
      return "allow";

    case "Swap":
      if (!snapId || snapId === src) return snapId === src ? "recenter" : false;
      if (!occupancy[snapId]) return false;
      if (!areAdjacent(src, snapId)) return false;
      return "allow";

    case "Gravity Assist": {
      if (!snapId || snapId === src) return snapId === src ? "recenter" : false;
      if (!occupancy[snapId]) return false;
      if (!areAdjacent(src, snapId)) return false;
      return "allow";
    }

    case "Abducktion":
      if (!snapId || snapId === src) return "remove";
      return false;

    case "Black Hole":
      if (!snapId || snapId === src) return "remove";
      return false;

    case "Dubabducktion":
      if (!snapId || snapId === src) return "select";
      return false;

    case "Parallel Universe": {
      if (!snapId || snapId === src) return snapId === src ? "recenter" : false;
      if (!occupancy[snapId]) return false;
      const cs = DROP_COORDS[src], cd = DROP_COORDS[snapId];
      if (cs.col !== cd.col || Math.abs(cs.row - cd.row) !== 1) return false;
      return "allow";
    }

    case "Shape Shifter": {
      if (!snapId || snapId === src) return snapId === src ? "recenter" : false;
      if (!occupancy[snapId]) return false;
      const cs = DROP_COORDS[src], cd = DROP_COORDS[snapId];
      if (cs.row !== cd.row) return false;
      const diff = Math.abs(cs.col - cd.col);
      const st = actionState["Shape Shifter"];
      if (st.phase === "selecting" && diff !== 1 && diff !== 2) return false;
      if (st.phase === "locking") {
        if (!st.dropIds.includes(src)) return false;
        const cols = st.dropIds.map(id => DROP_COORDS[id].col).sort((a,b)=>a-b);
        const valid = new Set([cols[0]-1, cols[0], cols[1], cols[1]+1]);
        if (!valid.has(cd.col)) return false;
      }
      if (st.phase === "locked") {
        if (!st.dropIds.includes(snapId)) return false;
        if (diff !== 1 && diff !== 2) return false;
      }
      return "allow";
    }

    case "Orbit":
      if (!snapId || snapId === src) return "orbit-select";
      return false;

    case "Wormhole":
      if (!snapId || snapId === src) return "wormhole-select";
      return false;

    case "Body Snatcher": {
      const st = actionState["Body Snatcher"];
      if (st.phase === "selecting") {
        if (!snapId || snapId === src) return "bodysnatcher-select";
        return false;
      }
      if (st.phase === "placing") {
        if (!snapId || occupancy[snapId]) return false;
        return "bodysnatcher-place";
      }
      return false;
    }

    default:
      return "allow";
  }
}

function actionAfterMove(movedId, displacedId) {
  switch (_activeAction) {
    case "Teleport":
      completeAction("Teleport", window.Game?.actionCounts);
      break;
    case "Swap":
      completeAction("Swap", window.Game?.actionCounts);
      break;
    case "Gravity Assist": {
      const st = actionState["Gravity Assist"];
      if (st.step === 1) {
        st.firstItemIds = [movedId, displacedId].filter(Boolean);
        st.step = 2;
      } else {
        completeAction("Gravity Assist", window.Game?.actionCounts);
      }
      break;
    }
    case "Shape Shifter": {
      const st = actionState["Shape Shifter"];
      const movedEl = document.getElementById(movedId);
      const movedNow = currentDropId(movedEl);
      const displacedNow = displacedId
        ? currentDropId(document.getElementById(displacedId))
        : null;
      if (st.phase === "selecting") {
        const diff = movedNow && displacedNow
          ? Math.abs(DROP_COORDS[movedNow].col - DROP_COORDS[displacedNow].col)
          : 1;
        if (diff === 2) {
          const midCol = Math.min(DROP_COORDS[movedNow].col, DROP_COORDS[displacedNow].col) + 1;
          const row = DROP_COORDS[movedNow].row;
          const mid = Object.keys(DROP_COORDS).find(id => DROP_COORDS[id].row === row && DROP_COORDS[id].col === midCol);
          st.dropIds = [movedNow, displacedNow, mid].sort((a,b) => DROP_COORDS[a].col - DROP_COORDS[b].col);
          st.phase = "locked";
        } else {
          st.dropIds = [movedNow, displacedNow].filter(Boolean);
          st.phase = "locking";
        }
      } else if (st.phase === "locking") {
        const newDrop = [movedNow, displacedNow].find(id => id && !st.dropIds.includes(id));
        if (newDrop) {
          st.dropIds.push(newDrop);
          st.dropIds.sort((a,b) => DROP_COORDS[a].col - DROP_COORDS[b].col);
          st.phase = "locked";
        }
      }
      break;
    }
  }
}

// Orbit rotate (called from UI)
async function orbitRotate() {
  const st = actionState["Orbit"];
  if (!st || !st.dropIds) return;
  st.locked = true; // prevent re-selection after first rotate
  commitAction();
  const [ul, ur, lr, ll] = st.dropIds;
  const ulId = occupancy[ul], urId = occupancy[ur], lrId = occupancy[lr], llId = occupancy[ll];
  occupancy[ur] = ulId; document.getElementById(ulId).dataset.dropId = ur;
  occupancy[lr] = urId; document.getElementById(urId).dataset.dropId = lr;
  occupancy[ll] = lrId; document.getElementById(lrId).dataset.dropId = ll;
  occupancy[ul] = llId; document.getElementById(llId).dataset.dropId = ul;
  setUiBusy(true);
  try {
    await Promise.all([ul, ur, lr, ll].map(dropId => {
      const itemEl = document.getElementById(occupancy[dropId]);
      const cell = document.getElementById(dropId);
      const pos = centeredInCell(itemEl, cell);
      return animateTo(itemEl, pos.left, pos.top);
    }));
  } finally { setUiBusy(false); }
}

// Handle verdict events from drag engine
document.addEventListener("game:verdict", async e => {
  const { verdict, snapId, origDropId } = e.detail;
  const itemEl = e.target;

  if (verdict === "wormhole-select") {
    const st = actionState["Wormhole"];
    // If a previous item was already removed, restore it first
    if (st.itemId) {
      const prev = document.getElementById(st.itemId);
      prev?.classList.remove("item-wormhole-selected");
      if (st.origDropId && prev && !currentDropId(prev)) {
        occupancy[st.origDropId] = st.itemId;
        prev.dataset.dropId = st.origDropId;
        const cell = document.getElementById(st.origDropId);
        const sp = stagingPositions[st.itemId];
        if (sp) { prev.style.left = sp.left + "px"; prev.style.top = sp.top + "px"; }
        const pos = centeredInCell(prev, cell);
        animateTo(prev, pos.left, pos.top, 400, { fromScale: 0, toScale: 1, fromOpacity: 0, toOpacity: 1 });
      }
    }
    st.itemId = itemEl.id;
    st.origDropId = origDropId;
    // Remove item from board and animate to staging
    if (origDropId) occupancy[origDropId] = null;
    itemEl.dataset.dropId = "";
    setUiBusy(true);
    try {
      const sp = stagingPositions[itemEl.id];
      if (sp) {
        await animateTo(itemEl, sp.left, sp.top, 400, { toScale: 0, toOpacity: 0 });
        itemEl.style.transform = "scale(0)";
        itemEl.style.opacity   = "0";
      }
    } finally { setUiBusy(false); }
    document.dispatchEvent(new CustomEvent("game:wormhole-ready", { detail: { itemId: itemEl.id } }));
    return;
  }

  if (verdict === "orbit-select") {
    const st = actionState["Orbit"];
    // After first rotate the group is locked — ignore new selections
    if (st.locked) return;
    // Item stays in place — no bounce
    const [ul, ur, lr, ll] = [origDropId,
      Object.keys(DROP_COORDS).find(id => DROP_COORDS[id].row === 0 && DROP_COORDS[id].col === DROP_COORDS[origDropId]?.col + 1),
      Object.keys(DROP_COORDS).find(id => DROP_COORDS[id].row === 1 && DROP_COORDS[id].col === DROP_COORDS[origDropId]?.col + 1),
      Object.keys(DROP_COORDS).find(id => DROP_COORDS[id].row === 1 && DROP_COORDS[id].col === DROP_COORDS[origDropId]?.col),
    ];
    if (!ul || DROP_COORDS[ul]?.row !== 0 || DROP_COORDS[ul]?.col > 3) return;
    if (!occupancy[ul] || !occupancy[ur] || !occupancy[lr] || !occupancy[ll]) return;
    st.dropIds = [ul, ur, lr, ll];
    st.phase = "selected";
    // Highlight the four cells that will rotate
    clearOrbitHighlight();
    [ul, ur, lr, ll].forEach(id => document.getElementById(id)?.classList.add("cell-orbit-highlight"));
    document.dispatchEvent(new CustomEvent("game:orbit-ready"));
    return;
  }

  if (verdict === "bodysnatcher-select") {
    const st = actionState["Body Snatcher"];
    if (st.selectedIds.includes(itemEl.id) || st.selectedIds.length >= 3) {
      await bounceBack(itemEl, origDropId);
      return;
    }
    // Remove immediately — same as Abducktion
    if (origDropId) occupancy[origDropId] = null;
    itemEl.dataset.dropId = "";
    setUiBusy(true);
    try {
      await sendToStaging(itemEl.id);
      // Assign a fresh color for the replacement duck
      assignColor(itemEl);
    } finally { setUiBusy(false); }
    st.selectedIds.push(itemEl.id);
    if (st.selectedIds.length === 3) {
      st.phase = "placing";
      st.placedCount = 0;
      document.dispatchEvent(new CustomEvent("game:bodysnatcher-placing", { detail: { itemIds: st.selectedIds } }));
    }
    return;
  }

  if (verdict === "bodysnatcher-place") {
    const st = actionState["Body Snatcher"];
    occupancy[snapId] = itemEl.id;
    itemEl.dataset.dropId = snapId;
    itemEl.classList.remove("item-bs-staging");
    itemEl.style.zIndex = "5";
    const cell = document.getElementById(snapId);
    const pos = centeredInCell(itemEl, cell);
    await animateTo(itemEl, pos.left, pos.top, 400, { fromScale: 0, toScale: 1, fromOpacity: 0, toOpacity: 1 });
    st.placedCount++;
    document.dispatchEvent(new CustomEvent("game:bodysnatcher-item-placed", { detail: { itemId: itemEl.id } }));
    if (st.placedCount === 3) completeAction("Body Snatcher", window.Game?.actionCounts);
    return;
  }

  if (verdict === "select") {
    // Dubabducktion
    const st = actionState["Dubabducktion"];
    if (st.step === 1) {
      st.firstDropId = origDropId;
      st.step = 2;
      setUiBusy(true);
      try { await sendToStaging(itemEl.id); } finally { setUiBusy(false); }
    } else {
      if (!areAdjacent(st.firstDropId, origDropId)) {
        await bounceBack(itemEl, origDropId);
        return;
      }
      completeAction("Dubabducktion", window.Game?.actionCounts);
      setUiBusy(true);
      try { await sendToStaging(itemEl.id); await fillBoard(); } finally { setUiBusy(false); }
    }
  }
});

// ── Mass Abducktion ───────────────────────────────────────

async function massAbducktion(discardMap, counts) {
  // Deduct discarded action counts and fire complete events for each
  if (counts && discardMap) {
    Object.entries(discardMap).forEach(([name, qty]) => {
      if (qty > 0 && name in counts) {
        counts[name] = Math.max(0, counts[name] - qty);
        document.dispatchEvent(new CustomEvent("game:action-complete", { detail: { name } }));
      }
    });
  }
  // Fire complete for Mass Abducktion itself (no count to deduct — always available)
  document.dispatchEvent(new CustomEvent("game:action-complete", { detail: { name: "Mass Abducktion" } }));
  setUiBusy(true);
  try {
    const onBoard = getAllItems().filter(it => currentDropId(it));
    onBoard.forEach(it => {
      const d = currentDropId(it);
      if (d) occupancy[d] = null;
      it.dataset.dropId = "";
    });
    await Promise.all(onBoard.map(it => sendToStaging(it.id)));
    await fillBoard();
  } finally { setUiBusy(false); }
}

// ── Body Snatcher — show replacement items in action detail ──

function showBodySnatcherItems(containerEl) {
  const st = actionState["Body Snatcher"];
  if (!st || st.phase !== "placing") return;
  // Only show items not yet placed
  const ids = st.selectedIds.filter(id => !currentDropId(document.getElementById(id)));
  if (ids.length === 0) { containerEl.innerHTML = ""; return; }

  containerEl.innerHTML = "";
  const label = document.createElement("div");
  label.className = "action-controls-label";
  label.textContent = "Drag each duck to an empty space:";
  containerEl.appendChild(label);

  const row = document.createElement("div");
  row.className = "bs-preview-row";
  containerEl.appendChild(row);

  const layer = document.getElementById("item-layer");
  const layerRect = layer.getBoundingClientRect();

  ids.forEach(id => {
    const itemEl = document.getElementById(id);
    if (!itemEl) return;

    // Slot is half the item's natural size; item uses scale(0.5) to match
    const halfSize = Math.round(itemEl.offsetWidth / 2);
    const slot = document.createElement("div");
    slot.className = "bs-proxy-slot";
    slot.dataset.itemId = id;
    slot.style.width  = halfSize + "px";
    slot.style.height = halfSize + "px";
    row.appendChild(slot);

    // After the slot is in the DOM, position the item centered over it
    requestAnimationFrame(() => {
      const sr = slot.getBoundingClientRect();
      // Item is full size in layout but scale(0.5) shrinks visual to fit the slot
      itemEl.style.left    = (sr.left - layerRect.left + (sr.width  - itemEl.offsetWidth)  / 2) + "px";
      itemEl.style.top     = (sr.top  - layerRect.top  + (sr.height - itemEl.offsetHeight) / 2) + "px";
      itemEl.style.transform = "scale(0.5)";
      itemEl.style.opacity   = "1";
      itemEl.style.zIndex    = "20"; // above action-detail
    });
  });
}

// Expose for use from index.html script block
window.Game = {
  initGame, fillBoard, resolveMatch, checkGoal,
  selectAction, cancelAction, completeAction,
  orbitRotate, sendToStaging, massAbducktion, showBodySnatcherItems,
  getActiveAction: () => _activeAction,
  getActionState:  (n) => actionState[n],
  setWormholeColor: async (color) => {
    const st = actionState["Wormhole"];
    if (!st?.itemId) return;
    const el = document.getElementById(st.itemId);
    el.classList.remove("item-wormhole-selected");
    el.dataset.color = color;
    itemColors[st.itemId] = color;
    updateItemVisual(el);
    const dropId = st.origDropId;
    completeAction("Wormhole", window.Game?.actionCounts);
    if (dropId) {
      occupancy[dropId] = el.id;
      el.dataset.dropId = dropId;
      const cell = document.getElementById(dropId);
      const sp = stagingPositions[el.id];
      if (sp) {
        el.style.left = sp.left + "px";
        el.style.top  = sp.top  + "px";
      }
      const pos = centeredInCell(el, cell);
      setUiBusy(true);
      try {
        await animateTo(el, pos.left, pos.top, 400, { fromScale: 0, toScale: 1, fromOpacity: 0, toOpacity: 1 });
      } finally { setUiBusy(false); }
    }
  },
  isUiBusy: () => uiBusy,
  occupancy,
  actionCounts: null, // set by index.html after load
};
