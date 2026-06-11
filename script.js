// ── Goal card modal ──────────────────────────────────────
const modal     = document.getElementById("goal-modal");
const modalName = document.getElementById("goal-modal-name");
const modalPts  = document.getElementById("goal-modal-pts");
const modalDesc = document.getElementById("goal-modal-desc");
const modalGrid = document.getElementById("goal-modal-pattern");
const modalClose = document.getElementById("goal-modal-close");

function openGoalModal(goal) {
  modalName.textContent = goal.name;
  modalPts.textContent  = goal.points + " pts";
  modalDesc.textContent = goal.description;

  modalGrid.innerHTML = "";
  modalGrid.style.gridTemplateColumns = `repeat(${goal.cols}, 1fr)`;
  for (const ch of goal.pattern) {
    const cell = document.createElement("div");
    cell.className = "pattern-cell" + (ch === "-" ? " empty" : "");
    modalGrid.appendChild(cell);
  }

  modal.classList.add("open");
}

function closeGoalModal() {
  modal.classList.remove("open");
}

modalClose.addEventListener("click", closeGoalModal);

// Close on backdrop click
modal.addEventListener("click", e => {
  if (e.target === modal) closeGoalModal();
});

// Close on Escape
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeGoalModal();
});

// ── Shared card builder ───────────────────────────────────
function buildPatternGrid(pattern, cols) {
  const rows = pattern.length / cols;

  // Outer frame claims the available flex space and centers the grid inside it.
  const frame = document.createElement("div");
  frame.className = "goal-card-pattern-frame";

  const grid = document.createElement("div");
  grid.className = "goal-card-pattern";
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  // --cols/--rows let the CSS width formula pick the constraining dimension.
  // No aspect-ratio on the grid — cell aspect-ratio:1 drives height naturally.
  grid.style.setProperty("--cols", cols);
  grid.style.setProperty("--rows", rows);

  for (const ch of pattern) {
    const cell = document.createElement("div");
    cell.className = "pattern-cell" + (ch === "-" ? " empty" : "");
    grid.appendChild(cell);
  }

  frame.appendChild(grid);
  return frame;
}

// ── Action system ─────────────────────────────────────────

const ACTION_DATA = [
  {
    name: "Teleport",
    count: 5,
    description: "Move any board item to any other occupied board space. The displaced item swaps to where you picked up from.",
    controls: "auto",
  },
  {
    name: "Swap",
    count: 5,
    description: "Swap any board item with an adjacent item directly to its left, right, above, or below.",
    controls: "auto",
  },
  {
    name: "Gravity Assist",
    count: 5,
    description: "Make two adjacent swaps in a row. The second swap must involve one of the two items from the first swap.",
    controls: "auto",
  },
  {
    name: "Abducktion",
    count: 5,
    description: "Remove one item from the board. It returns to staging and the board refills.",
    controls: "auto",
  },
  {
    name: "Dubabducktion",
    count: 5,
    description: "Remove two adjacent board items. Click the first, then click a neighbor. Both return to staging and the board refills.",
    controls: "step",
    stepLabel: "Step 1 of 2 — select the first item",
  },
  {
    name: "Black Hole",
    count: 5,
    description: "Remove one board item and every other item on the board that shares its color. All removed items return to staging.",
    controls: "auto",
  },
  {
    name: "Parallel Universe",
    count: 5,
    description: "Swap any item with the one directly above or below it, as many times as you like. Tap End Action when done.",
    controls: "end",
  },
  {
    name: "Shape Shifter",
    count: 5,
    description: "Swap two items in the same row (adjacent or skip one). Those two plus a third neighbor lock in as your set. Rearrange only those three freely, then tap End Action.",
    controls: "end",
  },
  {
    name: "Orbit",
    count: 5,
    description: "Select the upper-left item of any fully occupied 2×2 block, then rotate all four items clockwise as many times as you like. Tap End Action when done.",
    controls: "orbit",
  },
  {
    name: "Wormhole",
    count: 5,
    description: "Select a board item, then choose a new color for it from the palette below.",
    controls: "wormhole",
  },
  {
    name: "Body Snatcher",
    count: 5,
    description: "Click three board items to select them. All three are removed, recolored, then drag each back to any empty space to complete the action.",
    controls: "auto",
  },
  {
    name: "Mass Abducktion",
    count: 5,
    description: "Discard exactly 3 action cards from your hand. Select which cards to discard using the picker below, then confirm to clear the board and refill it.",
    controls: "mass",
  },
];

const WORMHOLE_COLORS = [
  { name: "blue",   hex: "#aed6f1" },
  { name: "yellow", hex: "#fef08a" },
  { name: "gray",   hex: "#c8c8c8" },
  { name: "pink",   hex: "#f5b8cd" },
];

let activeAction = null; // name string or null

function renderActionList() {
  const area = document.getElementById("action-area");
  // Remove any previously rendered cards (keep the label)
  area.querySelectorAll(".action-card").forEach(c => c.remove());

  ACTION_DATA.forEach(action => {
    const card = document.createElement("div");
    card.className = "action-card";
    card.dataset.action = action.name;

    const label = document.createElement("span");
    label.textContent = action.name;

    const badge = document.createElement("span");
    badge.className = "action-count";
    badge.textContent = action.count;

    card.appendChild(label);
    card.appendChild(badge);
    card.addEventListener("click", () => openActionDetail(action.name));
    area.appendChild(card);
  });
}

function openActionDetail(name) {
  const action = ACTION_DATA.find(a => a.name === name);
  if (!action) return;

  activeAction = name;

  document.getElementById("action-area").hidden   = true;
  document.getElementById("action-detail").hidden = false;

  document.getElementById("action-detail-name").textContent    = action.name;
  document.getElementById("action-detail-desc").textContent    = action.description;
  document.getElementById("action-detail-graphic").textContent = "[graphic placeholder]";

  const controls = document.getElementById("action-detail-controls");
  controls.innerHTML = "";

  if (action.controls === "step") {
    const stepEl = document.createElement("div");
    stepEl.className = "action-step-indicator";
    stepEl.id = "action-step-indicator";
    stepEl.textContent = action.stepLabel;
    controls.appendChild(stepEl);
  }

  if (action.controls === "wormhole") {
    const label = document.createElement("div");
    label.className = "action-controls-label";
    label.textContent = "Choose a color:";
    const row = document.createElement("div");
    row.className = "action-color-row";
    WORMHOLE_COLORS.forEach(color => {
      const swatch = document.createElement("button");
      swatch.className = "action-color-swatch";
      swatch.style.background = color.hex;
      swatch.title = color.name;
      swatch.setAttribute("aria-label", color.name);
      swatch.addEventListener("click", () => {
        console.log("Wormhole color chosen:", color.name);
        closeActionDetail();
      });
      row.appendChild(swatch);
    });
    controls.appendChild(label);
    controls.appendChild(row);
  }

  if (action.controls === "mass") {
    buildMassAbductionPicker(controls);
  }

  if (action.controls === "orbit") {
    const rotateBtn = document.createElement("button");
    rotateBtn.className = "action-btn action-btn-secondary";
    rotateBtn.id = "action-rotate-btn";
    rotateBtn.textContent = "↻ Rotate";
    rotateBtn.addEventListener("click", () => console.log("Orbit: rotate"));
    controls.appendChild(rotateBtn);
  }

  if (action.controls === "end" || action.controls === "orbit") {
    const endBtn = document.createElement("button");
    endBtn.className = "action-btn action-btn-primary";
    endBtn.id = "action-end-btn";
    endBtn.textContent = "End Action";
    endBtn.addEventListener("click", () => { console.log(name, "ended"); closeActionDetail(); });
    controls.appendChild(endBtn);
  }
}

function buildMassAbductionPicker(container) {
  // Discard tally: actionName -> qty chosen (0..count)
  const discard = {};
  ACTION_DATA.forEach(a => { discard[a.name] = 0; });

  const tallyEl = document.createElement("div");
  tallyEl.className = "action-controls-label";

  const pickerEl = document.createElement("div");
  pickerEl.className = "mass-picker";

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "action-btn action-btn-primary";
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Discard & Replace Board";

  function totalChosen() {
    return Object.values(discard).reduce((s, n) => s + n, 0);
  }

  function refresh() {
    const chosen = totalChosen();
    tallyEl.textContent = `${chosen} / 3 cards selected`;
    confirmBtn.disabled = chosen !== 3;

    pickerEl.innerHTML = "";
    ACTION_DATA.forEach(a => {
      if (a.name === "Mass Abducktion") return; // can't discard itself
      if (a.count === 0) return;
      const qty = discard[a.name];

      const row = document.createElement("div");
      row.className = "mass-picker-row";

      const rowLabel = document.createElement("span");
      rowLabel.className = "mass-picker-label";
      rowLabel.textContent = `${a.name} (${a.count})`;

      const controls = document.createElement("div");
      controls.className = "mass-picker-controls";

      const minus = document.createElement("button");
      minus.className = "mass-stepper";
      minus.textContent = "−";
      minus.disabled = qty === 0;
      minus.addEventListener("click", () => {
        discard[a.name] = Math.max(0, discard[a.name] - 1);
        refresh();
      });

      const qtyEl = document.createElement("span");
      qtyEl.className = "mass-stepper-qty";
      qtyEl.textContent = qty;

      const plus = document.createElement("button");
      plus.className = "mass-stepper";
      plus.textContent = "+";
      plus.disabled = qty >= a.count || chosen >= 3;
      plus.addEventListener("click", () => {
        if (totalChosen() >= 3) return;
        discard[a.name] = Math.min(a.count, discard[a.name] + 1);
        refresh();
      });

      controls.appendChild(minus);
      controls.appendChild(qtyEl);
      controls.appendChild(plus);
      row.appendChild(rowLabel);
      row.appendChild(controls);
      pickerEl.appendChild(row);
    });
  }

  confirmBtn.addEventListener("click", () => {
    console.log("Mass Abducktion confirmed, discarding:", Object.entries(discard).filter(([,v]) => v > 0));
    closeActionDetail();
  });

  container.appendChild(tallyEl);
  container.appendChild(pickerEl);
  container.appendChild(confirmBtn);
  refresh();
}

function closeActionDetail() {
  activeAction = null;
  document.getElementById("action-detail").hidden = true;
  document.getElementById("action-area").hidden   = false;
}

document.getElementById("action-detail-back").addEventListener("click", closeActionDetail);

// ── Goal cards ────────────────────────────────────────────
function renderGoalCards(goals, containerId) {
  const row = document.getElementById(containerId);
  goals.forEach(goal => {
    const card = document.createElement("div");
    card.className = "goal-card";

    const name = document.createElement("div");
    name.className = "goal-card-name";
    name.textContent = goal.name;

    const pts = document.createElement("div");
    pts.className = "goal-card-points";
    pts.textContent = goal.points + " pts";

    card.appendChild(name);
    card.appendChild(pts);
    card.appendChild(buildPatternGrid(goal.pattern, goal.cols));

    card.addEventListener("click", () => openGoalModal(goal));
    row.appendChild(card);
  });
}
