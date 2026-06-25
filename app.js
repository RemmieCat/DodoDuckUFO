// ── Service worker ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/DodoDuckUFO/sw.js');
}

// ── Storage keys ──────────────────────────────────────────
const HIGH_SCORES_KEY = "abducktion_highscores";
const HIGH_SCORES_MAX = 15;

// ── Action deck definitions ───────────────────────────────
const DECK_CONFIGS = {
  Original: {
    "Parallel Universe": 2, "Abducktion": 8, "Dubabducktion": 6,
    "Body Snatcher": 6, "Orbit": 6, "Wormhole": 4, "Shape Shifter": 6,
    "Gravity Assist": 6, "Swap": 10, "Teleport": 4, "Black Hole": 2,
  },
  Boosted: {
    "Parallel Universe": 4, "Abducktion": 8, "Dubabducktion": 8,
    "Body Snatcher": 8, "Orbit": 8, "Wormhole": 6, "Shape Shifter": 8,
    "Gravity Assist": 8, "Swap": 10, "Teleport": 6, "Black Hole": 4,
  },
  Fair: {
    "Parallel Universe": 10, "Abducktion": 10, "Dubabducktion": 10,
    "Body Snatcher": 10, "Orbit": 10, "Wormhole": 10, "Shape Shifter": 10,
    "Gravity Assist": 10, "Swap": 10, "Teleport": 10, "Black Hole": 10,
  },
};

// ── Action deck state ─────────────────────────────────────
let actionDeck    = [];  // draw pile (array of name strings)
let actionDiscard = [];  // discard pile

function buildDeck(deckName) {
  const config = DECK_CONFIGS[deckName] ?? DECK_CONFIGS.Original;
  const deck = [];
  for (const [name, count] of Object.entries(config)) {
    for (let i = 0; i < count; i++) deck.push(name);
  }
  return shuffleArray(deck);
}

function drawFromDeck(count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (actionDeck.length === 0) {
      if (actionDiscard.length === 0) break;
      actionDeck = shuffleArray([...actionDiscard]);
      actionDiscard = [];
    }
    drawn.push(actionDeck.pop());
  }
  return drawn;
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
    initGoals();
    initActionDeck();
    requestAnimationFrame(() => requestAnimationFrame(() => Game.initGame()));
  }
});
document.getElementById("btn-play-again").addEventListener("click", () => {
  location.reload();
});

function openInfoModal() {
  document.getElementById("info-modal").classList.add("open");
}
function closeInfoModal() {
  document.getElementById("info-modal").classList.remove("open");
}

document.getElementById("btn-info-splash").addEventListener("click", openInfoModal);
document.getElementById("btn-info-game").addEventListener("click", openInfoModal);
document.getElementById("info-close").addEventListener("click", closeInfoModal);
document.getElementById("info-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("info-modal")) closeInfoModal();
});

document.getElementById("btn-delete-data").addEventListener("click", () => {
  if (confirm("Delete all saved scores and settings?")) {
    localStorage.removeItem(HIGH_SCORES_KEY);
    localStorage.removeItem("abducktion_settings");
    location.reload();
  }
});
// double-tap board intentionally does NOT end the game

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
  { name: "Flying V",           shape: "rectangle", pattern: "-A-A-A",     cols: 3, points:  4, description: "Three ducks of the same color in a diagonal V shape." },
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
  { name: "Gemini",             shape: "rectangle", pattern: "AA--BA--BB", cols: 5, points: 10, description: "Six ducks in this shape, color, and orientation." },
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

// Filtered goal pool based on settings — computed once at game start
let ACTIVE_GOAL_POOL = ALL_GOALS;

function getGoalPool() {
  const s = window.settings ?? {};
  const base = s.removeHighGoals ? ALL_GOALS.filter(g => g.points <= 6) : ALL_GOALS;
  const shuffled = shuffleArray([...base]);
  const deckSize = s.goalDeckSize ?? 15;
  return shuffled.slice(0, Math.min(deckSize, shuffled.length));
}

function initGoals() {
  ACTIVE_GOAL_POOL = getGoalPool();
  goalPool = [...ACTIVE_GOAL_POOL];
  shuffleArray(goalPool);
  const count = window.settings?.goalCount ?? 3;
  activeGoals = [];
  for (let i = 0; i < count; i++) activeGoals.push(drawGoal());
  renderActiveGoals();
}

function buildGoalCardFace(goal) {
  const face = document.createElement("div");
  face.className = "goal-card-front";

  const name = document.createElement("div");
  name.className = "goal-card-name";
  name.textContent = goal.name;

  const pts = document.createElement("div");
  pts.className = "goal-card-points";
  pts.textContent = goal.points + " pts";

  face.appendChild(name);
  face.appendChild(pts);
  face.appendChild(buildPatternGrid(goal.pattern, goal.cols));
  return face;
}

function renderActiveGoals() {
  const row = document.getElementById("goal-cards-row");
  row.innerHTML = "";
  activeGoals.forEach((goal, idx) => {
    if (!goal) return;
    const card = document.createElement("div");
    card.className = "goal-card";
    card.dataset.goalIdx = idx;

    const inner = document.createElement("div");
    inner.className = "goal-card-inner";
    inner.appendChild(buildGoalCardFace(goal));

    const back = document.createElement("div");
    back.className = "goal-card-back";
    const backImg = document.createElement("img");
    backImg.src = "images/transparent/ufo.png";
    backImg.alt = "";
    backImg.style.cssText = "width:70%;opacity:0.55;pointer-events:none;";
    back.appendChild(backImg);
    inner.appendChild(back);

    card.appendChild(inner);
    card.addEventListener("click", () => handleGoalClick(goal, idx));
    row.appendChild(card);
  });
  highlightMatchingGoals();
}

function highlightMatchingGoals() {
  const row = document.getElementById("goal-cards-row");
  if (!row) return;
  row.querySelectorAll(".goal-card").forEach(card => {
    const idx = Number(card.dataset.goalIdx);
    const goal = activeGoals[idx];
    if (!goal) { card.classList.remove("goal-match"); return; }
    const { matched } = Game.checkGoal(goal);
    card.classList.toggle("goal-match", matched);
  });
}

// Flip card to UFO back, run midCallback, then flip back to show newGoal (or vanish).
async function flipGoalCard(card, newGoal, midCallback) {
  const inner = card.querySelector(".goal-card-inner");
  const FULL = 350;
  // Phase 1: flip fully to back so UFO is showing
  card.classList.add("flipping");
  await new Promise(resolve => setTimeout(resolve, FULL));
  // Board fill runs while UFO face is visible
  if (midCallback) await midCallback();
  // Update front face content while it's rotated away (invisible)
  if (newGoal) {
    const front = inner.querySelector(".goal-card-front");
    front.innerHTML = "";
    const name = document.createElement("div");
    name.className = "goal-card-name";
    name.textContent = newGoal.name;
    const pts = document.createElement("div");
    pts.className = "goal-card-points";
    pts.textContent = newGoal.points + " pts";
    front.appendChild(name);
    front.appendChild(pts);
    front.appendChild(buildPatternGrid(newGoal.pattern, newGoal.cols));
  } else {
    // No new goal — card vanishes; renderActiveGoals() will remove it from DOM
    card.classList.add("flip-vanish");
    return;
  }
  // Phase 2: flip back to reveal new goal
  card.classList.remove("flipping");
  await new Promise(resolve => setTimeout(resolve, FULL));
}

async function handleGoalClick(goal, idx) {
  if (Game.isUiBusy()) return;
  if (Game.getActiveAction()) return;
  const result = Game.checkGoal(goal);
  if (!result.matched) {
    openGoalModal(goal);
    return;
  }
  const card = document.querySelector(`.goal-card[data-goal-idx="${idx}"]`);
  const nextGoal = goalPool.length > 0 ? goalPool[goalPool.length - 1] : null;

  // Flip to UFO → fill board → flip back to new goal
  if (card) {
    await flipGoalCard(card, nextGoal, () => Game.resolveMatch(goal, result.section));
  } else {
    await Game.resolveMatch(goal, result.section);
  }

  totalScore += goal.points;
  collectedGoals.push(goal);
  activeGoals[idx] = drawGoal();
  const awarded = awardActionCards(2);
  renderActiveGoals();
  showAwardToast(goal, awarded);

  if (collectedGoals.length === ACTIVE_GOAL_POOL.length) {
    setTimeout(() => endGame(), 1500);
  }
}

function awardActionCards(count) {
  const drawn = drawFromDeck(count);
  const awarded = [];
  for (const name of drawn) {
    actionCounts[name] = (actionCounts[name] ?? 0) + 1;
    awarded.push(name);
    const card = document.querySelector(`.action-card[data-action="${CSS.escape(name)}"]`);
    if (card) {
      const badge = card.querySelector(".action-count");
      if (badge) badge.textContent = actionCounts[name];
      card.style.opacity = "";
      card.style.pointerEvents = "";
    }
  }
  return awarded;
}

function discardActionCards(discardMap) {
  for (const [name, qty] of Object.entries(discardMap)) {
    if (qty <= 0) continue;
    for (let i = 0; i < qty; i++) actionDiscard.push(name);
    actionCounts[name] = Math.max(0, (actionCounts[name] ?? 0) - qty);
  }
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

// ── Rank titles ───────────────────────────────────────────
const RANK_TITLES = [
  { min: 129, title: "CEO" },
  { min: 100, title: "Vice President" },
  { min:  50, title: "Manager" },
  { min:  31, title: "Supervisor" },
  { min:  15, title: "Associate" },
  { min:   0, title: "Intern" },
];

function getRankTitle(pts) {
  return RANK_TITLES.find(r => pts >= r.min)?.title ?? "Intern";
}

// ── High scores ───────────────────────────────────────────

function loadHighScores() {
  try { return JSON.parse(localStorage.getItem(HIGH_SCORES_KEY)) ?? []; }
  catch (_) { return []; }
}

function saveHighScores(scores) {
  localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(scores));
}

function addHighScore(pts) {
  const now = new Date();
  const entry = {
    pts,
    date: now.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" }),
    time: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
    _id: now.getTime(),
  };
  const scores = loadHighScores();
  scores.push(entry);
  scores.sort((a, b) => b.pts - a.pts);
  scores.splice(HIGH_SCORES_MAX);
  saveHighScores(scores);
  // Return scores and the index of this entry (-1 if bumped out of top 15)
  const idx = scores.findIndex(s => s._id === entry._id);
  return { scores, entry, idx };
}

function renderHighScores(scores, entry, currentIdx) {
  const tbody = document.getElementById("high-scores-body");
  tbody.innerHTML = "";

  const top5 = scores.slice(0, 5);
  let showedCurrent = false;

  top5.forEach((s, i) => {
    const isCurrent = (i === currentIdx);
    if (isCurrent) showedCurrent = true;
    appendScoreRow(tbody, i + 1, s, isCurrent);
  });

  if (!showedCurrent) {
    const sep = document.createElement("tr");
    sep.className = "hs-divider";
    sep.innerHTML = `<td colspan="4"></td>`;
    tbody.appendChild(sep);
    // currentIdx >= 5 means it's in saved range but outside top 5
    // currentIdx === -1 means it was bumped out entirely (score too low)
    const rank = currentIdx >= 0 ? currentIdx + 1 : null;
    appendScoreRow(tbody, rank, entry, true);
  }
}

function appendScoreRow(tbody, rank, s, isCurrent) {
  const tr = document.createElement("tr");
  if (isCurrent) tr.className = "hs-current";
  tr.innerHTML = `
    <td>${rank === null ? "16+" : rank}</td>
    <td>${s.pts} pts</td>
    <td>${s.date}</td>
    <td>${s.time}</td>
  `;
  tbody.appendChild(tr);
}

// ── End game ──────────────────────────────────────────────
function endGame() {
  document.getElementById("results-score").textContent = totalScore + " pts";
  document.getElementById("results-goals").textContent = collectedGoals.length;
  document.getElementById("results-actions").textContent = actionsUsed;
  document.getElementById("results-rank").textContent = getRankTitle(totalScore);
  const { scores, entry, idx } = addHighScore(totalScore);
  renderHighScores(scores, entry, idx);
  showPage("page-results");
}

// ── Progress modal ────────────────────────────────────────
function openProgressModal() {
  const header = `${collectedGoals.length} of ${ACTIVE_GOAL_POOL.length} cards (${totalScore} points)`;
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
document.addEventListener("game:board-updated", () => highlightMatchingGoals());
document.addEventListener("game:action-complete", () => highlightMatchingGoals());

// ── Action wiring ─────────────────────────────────────────
const actionCounts = {};
let actionsUsed = 0;

Game.actionCounts = actionCounts;

// Wrap openActionDetail before rendering the list so card listeners use the wired version
const _origOpen = openActionDetail;
window.openActionDetail = function(name) {
  const action = ACTION_DATA.find(a => a.name === name);
  if (!action?.alwaysAvailable && (actionCounts[name] ?? 0) <= 0) return;
  _origOpen(name);
  Game.selectAction(name);
};

function initActionDeck() {
  ACTION_DATA.forEach(a => { if (!a.alwaysAvailable) actionCounts[a.name] = 0; });
  actionDeck = buildDeck(window.settings?.deck ?? "Original");
  actionDiscard = [];
  const startingCards = window.settings?.startingCards ?? 5;
  const initialHand = drawFromDeck(startingCards);
  for (const name of initialHand) {
    actionCounts[name] = (actionCounts[name] ?? 0) + 1;
  }
  renderActionList();
}

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
    discardActionCards(discardMap);
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
  const isMassDiscard = !!e.detail?.massdiscard;
  if (name) {
    actionsUsed++;
    const action = ACTION_DATA.find(a => a.name === name);
    if (!action?.alwaysAvailable) {
      // For mass-discard events, counts were already deducted by discardActionCards
      if (!isMassDiscard) {
        // Move spent card to discard pile (count was decremented by completeAction in game.js)
        actionDiscard.push(name);
      }
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
