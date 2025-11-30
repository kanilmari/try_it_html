const TEMPLATES = {
  light: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Example page (light)</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #fafafa;
      color: #111827;
      padding: 1rem;
    }
    h1 {
      text-align: center;
    }
    .box {
      padding: 1rem;
      margin-top: 1rem;
      border-radius: 8px;
      border: 1px solid #d1d5db;
    }
  </style>
</head>
<body>
<h1>Hello from the TryIt editor 👋</h1>
<p>You can add your own HTML, CSS and JS code here.</p>

<div class="box">
  <button onclick="alert('JavaScript is working!')">Test JS</button>
</div>
</body>
</html>`,
  dark: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Example page (dark)</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #020617;
      color: #e5e7eb;
      padding: 1rem;
    }
    h1 {
      text-align: center;
    }
    .box {
      padding: 1rem;
      margin-top: 1rem;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #020617;
    }
    button {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #4b5563;
      background: #111827;
      color: #e5e7eb;
    }
  </style>
</head>
<body>
<h1>Hello from the TryIt editor 👋</h1>
<p>This is the dark theme template. You can still add any HTML, CSS and JS you like.</p>

<div class="box">
  <button onclick="alert('JavaScript is working!')">Test JS</button>
</div>
</body>
</html>`
};

const codeEl = document.getElementById("code");
const previewEl = document.getElementById("preview");
const tabInfoEl = document.getElementById("tabInfo");
const statusEl = document.getElementById("status");
const themeSelectEl = document.getElementById("themeSelect");

const STORAGE_PREFIX = "tryit-code-";
let storageDisabled = false;

const TAB_ID = getOrCreateTabId();
const STORAGE_KEY = STORAGE_PREFIX + TAB_ID;

let currentTheme = "light";

tabInfoEl.textContent = "Tab id: " + TAB_ID;

function setStatus(message, type = "info") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = "status " + (type === "error" ? "status-error" : "status-info");
}

function disableStorage(reason) {
  storageDisabled = true;
  setStatus(reason, "error");
}

function detectStorageAvailability() {
  try {
    const testKey = STORAGE_PREFIX + "__test";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    setStatus("Storage enabled: code is saved to this tab's localStorage.");
    return true;
  } catch (e) {
    disableStorage("localStorage is not available, autosave disabled (likely private browsing mode).");
    return false;
  }
}

function getOrCreateTabId() {
  const url = new URL(window.location.href);
  let id = url.searchParams.get("tab");
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    url.searchParams.set("tab", id);
    history.replaceState(null, "", url.toString());
  }
  return id;
}

function cleanupOldEntries() {
  if (storageDisabled) return;

  const MAX_ITEMS = 20;
  const TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
  const now = Date.now();
  const entries = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        const obj = JSON.parse(raw);
        if (!obj.updatedAt || now - obj.updatedAt > TTL) {
          localStorage.removeItem(key);
        } else {
          entries.push({ key, updatedAt: obj.updatedAt });
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
  }

  entries.sort((a, b) => b.updatedAt - a.updatedAt); // newest first
  if (entries.length > MAX_ITEMS) {
    for (let i = MAX_ITEMS; i < entries.length; i++) {
      localStorage.removeItem(entries[i].key);
    }
  }
}

function saveToStorage() {
  if (storageDisabled) return;

  const payload = {
    code: codeEl.value,
    theme: currentTheme,
    updatedAt: Date.now()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    cleanupOldEntries();
  } catch (e) {
    // Quota full or storage otherwise blocked → switch to permanent private mode
    disableStorage("Saving failed: localStorage is full or blocked. Switched to private mode, code will no longer be saved in the browser.");
  }
}

function loadFromStorage() {
  if (storageDisabled) return null;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function applyTheme(theme) {
  currentTheme = theme || "light";
  document.body.setAttribute("data-theme", currentTheme);
  if (themeSelectEl && themeSelectEl.value !== currentTheme) {
    themeSelectEl.value = currentTheme;
  }
}

function getDefaultTemplate() {
  return TEMPLATES[currentTheme] || TEMPLATES.light;
}

function runCode() {
  const code = codeEl.value;
  previewEl.srcdoc = code;
  saveToStorage();
}

function resetTemplate() {
  codeEl.value = getDefaultTemplate();
  runCode();
}

function init() {
  const storageOk = detectStorageAvailability();

  if (themeSelectEl) {
    themeSelectEl.addEventListener("change", (event) => {
      applyTheme(event.target.value);
    });
  }

  if (storageOk) {
    cleanupOldEntries();
    const saved = loadFromStorage();
    if (saved && saved.code) {
      applyTheme(saved.theme || "light");
      codeEl.value = saved.code;
      runCode();
      return;
    }
  }

  // either storage is not available or nothing was saved
  applyTheme("light");
  codeEl.value = getDefaultTemplate();
  previewEl.srcdoc = codeEl.value; // private mode: no saving
}

// TODO: add syntax highlighting and indentation assistance for HTML elements in a later iteration.

window.addEventListener("load", init);
