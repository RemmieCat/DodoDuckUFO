// ── Service worker ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/DodoDuckUFO/sw.js');
}

// ── Page navigation ───────────────────────────────────────
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

let gameInitialized = false;
document.getElementById("btn-start").addEventListener("click", () => {
  showPage("page-game");
  if (!gameInitialized) {
    gameInitialized = true;
    requestAnimationFrame(() => requestAnimationFrame(() => Game.initGame()));
  }
});
document.getElementById("btn-play-again").addEventListener("click", () => {
  location.reload();
});
document.getElementById("board-grid").addEventListener("dblclick", () => endGame());

// ── Board DOM construction ────────────────────────────────
// Snake layout: top row left→right (drop1–drop5),
//               bottom row right→left (drop6=col4 … drop10=col0)
const boardGrid = document.getElementById("board-grid");
[1,2,3,4,5,10,9,8,7,6].forEach(n => {
  const cell = document.createElement("div");
  cell.className = "drop-cell";
  cell.id = "drop" + n;
  boardGrid.appendChild(cell);
});

// Item overlay — duck items float above the layout
const itemLayer = document.createElement("div");
itemLayer.id = "item-layer";
document.querySelector(".game-layout").appendChild(itemLayer);
for (let i = 1; i <= 10; i++) {
  const item = document.createElement("div");
  item.id = "item" + i;
  item.className = "duck-item";
  item.textContent = "🦆";
  itemLayer.appendChild(item);
}

// ── Goal data ─────────────────────────────────────────────
const ALL_GOALS = [
  { name: "Reflection",         shape: "rectangle", pattern: "XYZXYZ",     cols: 3, points:  4, relaxed: true, description: "Top and bottom rows of a 3×2 block are identical — same colors in the same positions." },
  { name: "Duckfoot",           shape: "rectangle", pattern: "-A-AAA",     cols: 3, points:  4, description: "Three ducks of the same color in a column, with the top-left and top-middle ignored." },
  { name: "Pairbond",           shape: "rectangle", pattern: "ABAB",       cols: 2, points:  2, description: "Two alternating colors in a 2×2 block." },
  { name: "Corkscrew",          shape: "rectangle", pattern: "ABABAB",     cols: 3, points:  7, description: "Two alternating colors across a 3×2 block." },
  { name: "Flying V",           shape: "rectangle", pattern: "-A-A-A",     cols: 3, points: 50, description: "Three ducks of the same color in a diagonal V shape." },
  { name: "Mating Dance",       shape: "line",      pattern: "AABB",       cols: 4, points:  2, description: "Two pairs of matching colors in a row of four." },
  { name: "Paddling",           shape: "line",      pattern: "ABCD",       cols: 4, points:  1, description: "Four ducks all different colors in a row." },
  { name: "Alligator",          shape: "rectangle", pattern: "----AAAAA-", cols: 5, points:  9, description: "Four ignored spaces, then four of the same color, then one ignored." },
  { name: "Hatchlings",         shape: "rectangle", pattern: "AAABBB",     cols: 3, points:  6, description: "Three of one color next to three of another in a 3×2 block." },
  { name: "Nestlings",          shape: "rectangle", pattern: "A-AAAA",     cols: 3, points:  8, description: "Five ducks of the same color with one gap, in a 3×2 block." },
  { name: "Ducklings",          shape: "line",      pattern: "AAA",        cols: 3, points:  2, description: "Three ducks of the same color in a row." },
  { name: "Flying Z",           shape: "rectangle", pattern: "AA--AA",     cols: 3, points:  5, description: "Two of one color on top, two empty in the middle, two of the same color on the bottom." },
  { name: "Gooseneck",          shape: "rectangle", pattern: "AAA--A",     cols: 3, points:  7, description: "Three of one color on top, two empty, then one more of the same color." },
  { name: "Birds of a Feather", shape: "line",      pattern: "AAAA",       cols: 4, points:  4, description: "Four ducks of the same color in a row." },
  { name: "Crisscross",         shape: "rectangle", pattern: "ABBA",       cols: 2, points:  3, description: "Two colors in an X pattern across a 2×2 block." },
  { name: "Egg",                shape: "rectangle", pattern: "AAAA",       cols: 2, points:  5, description: "Four ducks of the same color in a 2×2 block." },
  { name: "Orion's Belt",       shape: "line",      pattern: "A-A-A",      cols: 5, points:  3, description: "Three ducks of the same color at positions 1, 3, and 5 in a row." },
  { name: "Pond Corners",       shape: "rectangle", pattern: "A---AA---A", cols: 5, points:  6, description: "Same color in all four corners of a 5×2 block." },
  { name: "Full House",         shape: "line",      pattern: "AAABB",      cols: 5, points:  5, description: "Three of one color followed by two of another in a row of five." },
  { name: "Flock Party",        shape: "line",      pattern: "AAAAA",      cols: 5, points:  7, description: "Five ducks of the same color filling an entire row." },
  { name: "Cassiopeia",         shape: "rectangle", pattern: "A-A-A-A-A-", cols: 5, points:  8, description: "Five ducks of the same color at every other position across a 5×2 block." },
  { name: "Big Dipper",         shape: "rectangle", pattern: "--AAAAAA",   cols: 4, points: 10, description: "Two empty spaces in the top-left, then six ducks of the same color filling the rest of a 4×2 block." },
  { name: "Turtle",             shape: "rectangle", pattern: "-AAA-A---A", cols: 5, points:  9, description: "A turtle-shaped pattern of same-color ducks in a 5×2 block." },
  { name: "Scorpius",           shape: "rectangle", pattern: "A-AA-AA-",   cols: 4, points:  9, description: "A scorpion-shaped pattern of same-color ducks in a 4×2 block." },
];

// ── Goal system ───────────────────────────────────────────
let goalPool     = [];
let activeGoals  = [];
let collectedGoals = [];
let totalScore   = 0;

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawGoal() {
  return goalPool.length > 0 ? goalPool.pop() : null;
}

function initGoals() {
  goalPool = shuffleArray([...ALL_GOALS]);
  activeGoals = [drawGoal(), drawGoal(), drawGoal()];
  renderActiveGoals();
}

function renderActiveGoals() {
  const row = document.getElementById("goal-cards-row");
  row.innerHTML = "";
  activeGoals.forEach((goal, idx) => {
    if (!goal) return;
    const card = document.createElement("div");
    card.className = "goal-card";
    card.dataset.goalIdx = idx;

    const name = document.createElement("div");
    name.className = "goal-card-name";
    name.textContent = goal.name;

    const pts = document.createElement("div");
    pts.className = "goal-card-points";
    pts.textContent = goal.points + " pts";

    card.appendChild(name);
    card.appendChild(pts);
    card.appendChild(buildPatternGrid(goal.pattern, goal.cols));
    card.addEventListener("click", () => handleGoalClick(goal, idx));
    row.appendChild(card);
  });
}

async function handleGoalClick(goal, idx) {
  if (Game.isUiBusy()) return;
  const result = Game.checkGoal(goal);
  if (!result.matched) {
    openGoalModal(goal);
    return;
  }
  await Game.resolveMatch(goal, result.section);
  totalScore += goal.points;
  collectedGoals.push(goal);
  activeGoals[idx] = drawGoal();
  const awarded = awardActionCards(2);
  renderActiveGoals();
  showAwardToast(goal, awarded);

  if (collectedGoals.length === ALL_GOALS.length) {
    setTimeout(() => endGame(), 1500);
  }
}

function awardActionCards(count) {
  const available = ACTION_DATA.filter(a => !a.alwaysAvailable);
  const awarded = [];
  for (let i = 0; i < count; i++) {
    const pick = available[Math.floor(Math.random() * available.length)];
    actionCounts[pick.name] = (actionCounts[pick.name] ?? 0) + 1;
    awarded.push(pick.name);
    const card = document.querySelector(`.action-card[data-action="${CSS.escape(pick.name)}"]`);
    if (card) {
      const badge = card.querySelector(".action-count");
      if (badge) badge.textContent = actionCounts[pick.name];
      card.style.opacity = "";
      card.style.pointerEvents = "";
    }
  }
  return awarded;
}

function showAwardToast(matchedGoal, awardedActions) {
  let toast = document.getElementById("award-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "award-toast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `
    <div class="toast-pts">+${matchedGoal.points} pts — ${matchedGoal.name}</div>
    <div class="toast-cards">New action cards: ${awardedActions.map(n => `<strong>${n}</strong>`).join(", ")}</div>
  `;
  toast.classList.remove("toast-hide");
  toast.classList.add("toast-show");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");
  }, 4000);
}

initGoals();

// ── End game ──────────────────────────────────────────────
function endGame() {
  document.getElementById("results-score").textContent = totalScore + " pts";
  document.getElementById("results-goals").textContent = collectedGoals.length;
  document.getElementById("results-actions").textContent = actionsUsed;
  showPage("page-results");
}

// ── Progress modal ────────────────────────────────────────
function openProgressModal() {
  const header = `${collectedGoals.length} of ${ALL_GOALS.length} cards (${totalScore} points)`;
  document.getElementById("progress-modal-score").textContent = header;
  const list = document.getElementById("progress-goal-list");
  list.innerHTML = "";
  if (collectedGoals.length === 0) {
    const empty = document.createElement("li");
    empty.className = "progress-goal-empty";
    empty.textContent = "No goals matched yet.";
    list.appendChild(empty);
  } else {
    collectedGoals.forEach((g, i) => {
      const li = document.createElement("li");
      li.className = "progress-goal-item";
      li.dataset.idx = i;
      li.innerHTML = `<span class="progress-goal-pts">${g.points}</span> ${g.name}`;
      li.addEventListener("click", () => showGoalPreview(li, g));
      list.appendChild(li);
    });
  }
  showProgressVisual(null);
  document.getElementById("progress-modal").classList.add("open");
}

function showProgressVisual(goal) {
  const visual = document.getElementById("progress-visual");
  if (!goal) {
    visual.innerHTML = `<img class="progress-ufo-img" src="images/transparent/ufo.png" alt="UFO">`;
    return;
  }
  visual.innerHTML = "";
  const frame = buildPatternGrid(goal.pattern, goal.cols);
  frame.classList.add("progress-pattern-frame");
  visual.appendChild(frame);
}

function showGoalPreview(li, goal) {
  document.querySelectorAll(".progress-goal-item.active").forEach(el => el.classList.remove("active"));
  li.classList.add("active");
  showProgressVisual(goal);
}

document.getElementById("progress-modal-close").addEventListener("click", () => {
  document.getElementById("progress-modal").classList.remove("open");
});
document.getElementById("progress-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("progress-modal"))
    document.getElementById("progress-modal").classList.remove("open");
});

document.addEventListener("game:ufo-click", () => openProgressModal());

// ── Action wiring ─────────────────────────────────────────
const actionCounts = {};
let actionsUsed = 0;
ACTION_DATA.forEach(a => { if (!a.alwaysAvailable) actionCounts[a.name] = a.count; });
Game.actionCounts = actionCounts;

// Wrap openActionDetail before rendering the list so card listeners use the wired version
const _origOpen = openActionDetail;
window.openActionDetail = function(name) {
  const action = ACTION_DATA.find(a => a.name === name);
  if (!action?.alwaysAvailable && (actionCounts[name] ?? 0) <= 0) return;
  _origOpen(name);
  Game.selectAction(name);
};
renderActionList();

// Wrap closeActionDetail so the game engine is always cancelled together
const _origClose = closeActionDetail;
window.closeActionDetail = function() {
  _origClose();
  Game.cancelAction();
};
document.getElementById("action-detail-back").addEventListener("click", () => closeActionDetail());

// Orbit rotate button — enabled once a valid block is selected
document.addEventListener("game:orbit-ready", () => {
  const btn = document.getElementById("action-rotate-btn");
  if (btn) btn.disabled = false;
});

// Cancel button: disable after first board change, re-enable when action ends
document.addEventListener("game:action-committed", () => {
  const btn = document.getElementById("action-detail-back");
  if (btn) { btn.disabled = true; btn.style.opacity = "0.35"; btn.style.cursor = "not-allowed"; }
});
document.addEventListener("game:action-complete", () => {
  const btn = document.getElementById("action-detail-back");
  if (btn) { btn.disabled = false; btn.style.opacity = ""; btn.style.cursor = ""; }
});

// Delegated clicks for dynamically created action controls
document.addEventListener("click", e => {
  if (e.target.classList.contains("action-color-swatch")) {
    Game.setWormholeColor(e.target.title);
    return;
  }
  if (e.target.id === "action-end-btn") {
    Game.completeAction(Game.getActiveAction(), actionCounts);
    closeActionDetail();
    return;
  }
  if (e.target.id === "action-rotate-btn") {
    Game.orbitRotate();
    return;
  }
  if (e.target.id === "mass-confirm-btn") {
    const discardMap = e.target._discardMap ?? {};
    Game.massAbducktion(discardMap, actionCounts);
    closeActionDetail();
    return;
  }
});

// Body Snatcher placing phase
document.addEventListener("game:bodysnatcher-placing", () => {
  Game.showBodySnatcherItems(document.getElementById("action-detail-controls"));
});
document.addEventListener("game:bodysnatcher-item-placed", () => {
  Game.showBodySnatcherItems(document.getElementById("action-detail-controls"));
});

// Auto-close detail and update count badge when an action completes
document.addEventListener("game:action-complete", async e => {
  if (!document.getElementById("action-detail").hidden) {
    closeActionDetail();
  }
  const name = e.detail?.name;
  if (name) {
    actionsUsed++;
    const action = ACTION_DATA.find(a => a.name === name);
    if (!action?.alwaysAvailable) {
      const card = document.querySelector(`.action-card[data-action="${CSS.escape(name)}"]`);
      if (card) {
        const badge = card.querySelector(".action-count");
        const newCount = actionCounts[name] ?? 0;
        if (badge) badge.textContent = newCount;
        if (newCount <= 0) {
          card.style.opacity = "0.4";
          card.style.pointerEvents = "none";
        }
      }
    }
  }

  const allExhausted = Object.values(actionCounts).every(n => n <= 0);
  if (allExhausted) {
    for (let idx = 0; idx < activeGoals.length; idx++) {
      const goal = activeGoals[idx];
      if (!goal) continue;
      const result = Game.checkGoal(goal);
      if (!result.matched) continue;
      await Game.resolveMatch(goal, result.section);
      totalScore += goal.points;
      collectedGoals.push(goal);
      activeGoals[idx] = null;
      renderActiveGoals();
    }
    setTimeout(() => endGame(), 1500);
  }
});
