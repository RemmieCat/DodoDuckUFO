// ── Settings persistence ──────────────────────────────────
const SETTINGS_KEY = "abducktion_settings";

const DEFAULT_SETTINGS = {
  goalCount:       3,
  goalDeckSize:    15,
  removeHighGoals: false,
  startingCards:   5,
  deck:            "Original",
  display:         "Icon",
  duckSet:         "Random",
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

window.settings = loadSettings();

// ── Modal state ───────────────────────────────────────────
let _pendingSettings = null;

function openSettingsModal() {
  _pendingSettings = { ...window.settings };
  buildDuckPickerGrid();
  syncSettingsUI(_pendingSettings);
  document.getElementById("settings-modal").classList.add("open");
}

function closeSettingsModal() {
  document.getElementById("settings-modal").classList.remove("open");
  _pendingSettings = null;
}

function syncSettingsUI(s) {
  document.querySelectorAll(".settings-radio-group").forEach(group => {
    const key = group.dataset.setting;
    const val = String(s[key]);
    group.querySelectorAll(".settings-radio").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.value === val);
    });
  });
  document.getElementById("setting-removeHighGoals").checked = !!s.removeHighGoals;

  // Disable 20/25 deck size options when removeHighGoals is on
  const deckSizeGroup = document.querySelector(".settings-radio-group[data-setting='goalDeckSize']");
  if (deckSizeGroup) {
    deckSizeGroup.querySelectorAll(".settings-radio").forEach(btn => {
      const v = Number(btn.dataset.value);
      const locked = s.removeHighGoals && v > 15;
      btn.disabled = locked;
      btn.classList.toggle("settings-radio-disabled", locked);
    });
    // If current value is now forbidden, clamp it
    if (s.removeHighGoals && (s.goalDeckSize ?? 15) > 15) {
      s.goalDeckSize = 15;
      deckSizeGroup.querySelectorAll(".settings-radio").forEach(btn => {
        btn.classList.toggle("active", Number(btn.dataset.value) === 15);
      });
    }
  }

  // Show duck picker only when Realistic is selected
  const duckPickerField = document.getElementById("duck-picker-field");
  if (duckPickerField) {
    duckPickerField.style.display = s.display === "Realistic" ? "" : "none";
  }
  syncDuckPicker(s);
}

// Radio button clicks (delegated)
document.addEventListener("click", e => {
  const btn = e.target.closest(".settings-radio");
  if (!btn || !_pendingSettings) return;
  const group = btn.closest(".settings-radio-group");
  if (!group) return;
  const key = group.dataset.setting;
  let val = btn.dataset.value;
  if (key === "goalCount" || key === "startingCards" || key === "goalDeckSize") val = Number(val);
  _pendingSettings[key] = val;
  syncSettingsUI(_pendingSettings);
});

document.getElementById("setting-removeHighGoals").addEventListener("change", e => {
  if (!_pendingSettings) return;
  _pendingSettings.removeHighGoals = e.target.checked;
  syncSettingsUI(_pendingSettings);
});

// ── Duck picker ───────────────────────────────────────────

const DUCK_DISPLAY_NAMES = {
  "images/ducks/blue_goose.png":            "Blue Goose",
  "images/ducks/blue_winged_teal.png":      "Blue-winged Teal",
  "images/ducks/brant.png":                 "Brant",
  "images/ducks/bufflehead.png":            "Bufflehead",
  "images/ducks/canada_goose.png":          "Canada Goose",
  "images/ducks/canvasback.png":            "Canvasback",
  "images/ducks/cinnamon_teal.png":         "Cinnamon Teal",
  "images/ducks/common_eider.png":          "Common Eider",
  "images/ducks/common_loon.png":           "Common Loon",
  "images/ducks/common_merganser.png":      "Common Merganser",
  "images/ducks/gadwall.png":               "Gadwall",
  "images/ducks/green_winged_teal.png":     "Green-winged Teal",
  "images/ducks/hooded_merganser.png":      "Hooded Merganser",
  "images/ducks/king_eider.png":            "King Eider",
  "images/ducks/mallard.png":               "Mallard",
  "images/ducks/mute_swan.png":             "Mute Swan",
  "images/ducks/northern_shoveler.png":     "Northern Shoveler",
  "images/ducks/red_breasted_merganser.png":"Red-breasted Merganser",
  "images/ducks/red_throated_loon.png":     "Red-throated Loon",
  "images/ducks/redhead.png":               "Redhead",
  "images/ducks/ring_necked.png":           "Ring-necked Duck",
  "images/ducks/ruddy.png":                 "Ruddy Duck",
  "images/ducks/snow_goose.png":            "Snow Goose",
  "images/ducks/surf_scoter.png":           "Surf Scoter",
  "images/ducks/tundra_swan.png":           "Tundra Swan",
  "images/ducks/wigeon.png":                "Wigeon",
  "images/ducks/wood.png":                  "Wood Duck",
};

const COLOR_LABELS = ["teal", "purple", "gold", "gray"];
const COLOR_SWATCHES = ["#5ec9be", "#9d7ff7", "#f5b800", "#9ca3af"];

function buildDuckPickerGrid() {
  const grid = document.getElementById("duck-picker-grid");
  if (!grid || grid.dataset.built) return;
  grid.dataset.built = "1";

  Object.entries(DUCK_DISPLAY_NAMES).forEach(([src]) => {
    const btn = document.createElement("button");
    btn.className = "duck-picker-thumb";
    btn.dataset.src = src;
    btn.title = DUCK_DISPLAY_NAMES[src];
    btn.type = "button";
    const img = document.createElement("img");
    img.src = src;
    img.alt = DUCK_DISPLAY_NAMES[src];
    btn.appendChild(img);
    grid.appendChild(btn);
  });
}

function syncDuckPicker(s) {
  const grid = document.getElementById("duck-picker-grid");
  const hint = document.getElementById("duck-picker-hint");
  const randomBtn = document.getElementById("duck-picker-random");
  if (!grid || !grid.dataset.built) return;

  const chosen = Array.isArray(s.duckSet) ? s.duckSet : [];
  grid.querySelectorAll(".duck-picker-thumb").forEach(btn => {
    const idx = chosen.indexOf(btn.dataset.src);
    btn.classList.toggle("duck-picker-selected", idx !== -1);
    btn.dataset.slot = idx !== -1 ? idx : "";
    // Show color dot for assigned slot
    let dot = btn.querySelector(".duck-slot-dot");
    if (idx !== -1) {
      if (!dot) { dot = document.createElement("span"); dot.className = "duck-slot-dot"; btn.appendChild(dot); }
      dot.style.background = COLOR_SWATCHES[idx];
      dot.title = COLOR_LABELS[idx];
    } else if (dot) {
      dot.remove();
    }
  });

  const isRandom = !Array.isArray(s.duckSet);
  randomBtn.classList.toggle("active", isRandom);
  if (hint) hint.textContent = isRandom ? "random" : `${chosen.length}/4 chosen`;
}

document.getElementById("duck-picker-grid").addEventListener("click", e => {
  const btn = e.target.closest(".duck-picker-thumb");
  if (!btn || !_pendingSettings) return;
  const src = btn.dataset.src;
  let chosen = Array.isArray(_pendingSettings.duckSet) ? [..._pendingSettings.duckSet] : [];
  const idx = chosen.indexOf(src);
  if (idx !== -1) {
    chosen.splice(idx, 1);
  } else if (chosen.length < 4) {
    chosen.push(src);
  }
  _pendingSettings.duckSet = chosen.length > 0 ? chosen : "Random";
  syncDuckPicker(_pendingSettings);
});

document.getElementById("duck-picker-random").addEventListener("click", () => {
  if (!_pendingSettings) return;
  _pendingSettings.duckSet = "Random";
  syncDuckPicker(_pendingSettings);
});

document.getElementById("settings-close").addEventListener("click", closeSettingsModal);
document.getElementById("settings-cancel").addEventListener("click", closeSettingsModal);

document.getElementById("settings-update").addEventListener("click", () => {
  window.settings = { ..._pendingSettings };
  saveSettings(window.settings);
  closeSettingsModal();
});

document.getElementById("btn-settings").addEventListener("click", openSettingsModal);

document.getElementById("settings-modal").addEventListener("click", e => {
  if (e.target.id === "settings-modal") closeSettingsModal();
});
