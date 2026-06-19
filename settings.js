// ── Settings persistence ──────────────────────────────────
const SETTINGS_KEY = "abducktion_settings";

const DEFAULT_SETTINGS = {
  goalCount:       3,
  removeHighGoals: false,
  startingCards:   5,
  deck:            "Original",
  display:         "Icon",
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
}

// Radio button clicks (delegated)
document.addEventListener("click", e => {
  const btn = e.target.closest(".settings-radio");
  if (!btn || !_pendingSettings) return;
  const group = btn.closest(".settings-radio-group");
  if (!group) return;
  const key = group.dataset.setting;
  let val = btn.dataset.value;
  if (key === "goalCount" || key === "startingCards") val = Number(val);
  _pendingSettings[key] = val;
  syncSettingsUI(_pendingSettings);
});

document.getElementById("setting-removeHighGoals").addEventListener("change", e => {
  if (_pendingSettings) _pendingSettings.removeHighGoals = e.target.checked;
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
