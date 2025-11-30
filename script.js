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

const codeTextareaEl = document.getElementById("code");
const previewEl = document.getElementById("preview");
const tabInfoEl = document.getElementById("tabInfo");
const statusEl = document.getElementById("status");
const themeSelectEl = document.getElementById("themeSelect");
const panesEl = document.getElementById("panes");
const splitterEl = document.getElementById("splitter");

const STORAGE_PREFIX = "tryit-code-";
let storageDisabled = false;

const TAB_ID = getOrCreateTabId();
const STORAGE_KEY = STORAGE_PREFIX + TAB_ID;

let currentTheme = "light";

// CodeMirror instance (created in init)
let codeMirror = null;

let isDragging = false;
let startX = 0;
let startLeftWidth = 0;
let isVerticalLayout = false;
let activePointerId = null;

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
    code: getEditorValue(),
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
  const code = getEditorValue();
  previewEl.srcdoc = code;
  saveToStorage();
}

function resetTemplate() {
  setEditorValue(getDefaultTemplate());
  runCode();
}

function getEditorValue() {
  if (codeMirror) {
    return codeMirror.getValue();
  }
  return codeTextareaEl ? codeTextareaEl.value : "";
}

function setEditorValue(value) {
  if (codeMirror) {
    codeMirror.setValue(value);
  } else if (codeTextareaEl) {
    codeTextareaEl.value = value;
  }
}

function init() {
  const storageOk = detectStorageAvailability();

  // Initialize CodeMirror over the textarea if available
  if (window.CodeMirror && codeTextareaEl) {
    codeMirror = CodeMirror.fromTextArea(codeTextareaEl, {
      mode: "htmlmixed",
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentUnit: 2,
      indentWithTabs: false,
    });

    // Ensure editor resizes with the pane
    setTimeout(() => {
      if (codeMirror) {
        codeMirror.refresh();
      }
    }, 0);
  }

  if (themeSelectEl) {
    themeSelectEl.addEventListener("change", (event) => {
      applyTheme(event.target.value);
    });
  }

  if (splitterEl && panesEl) {
    if (window.PointerEvent) {
      splitterEl.addEventListener("pointerdown", onSplitterPointerDown);
    } else {
      splitterEl.addEventListener("mousedown", onSplitterMouseDown);
      window.addEventListener("mousemove", onSplitterMouseMove);
      window.addEventListener("mouseup", onSplitterMouseUp);
    }
    window.addEventListener("resize", updateLayoutMode);
    updateLayoutMode();
  }

  if (storageOk) {
    cleanupOldEntries();
    const saved = loadFromStorage();
    if (saved && saved.code) {
      applyTheme(saved.theme || "light");
      setEditorValue(saved.code);
      runCode();
      return;
    }
  }

  // either storage is not available or nothing was saved
  applyTheme("light");
  setEditorValue(getDefaultTemplate());
  previewEl.srcdoc = getEditorValue(); // private mode: no saving
}

function updateLayoutMode() {
  isVerticalLayout = window.innerWidth <= 800;
}

function onSplitterMouseDown(event) {
  event.preventDefault();
  isDragging = true;
  splitterEl.classList.add("dragging");

  if (!isVerticalLayout) {
    startX = event.clientX;
    const rect = panesEl.getBoundingClientRect();
    const leftRect = (codeMirror ? codeMirror.getWrapperElement() : codeTextareaEl).getBoundingClientRect();
    startLeftWidth = leftRect.width / rect.width;
  }
}

function onSplitterMouseMove(event) {
  if (!isDragging) return;

  const rect = panesEl.getBoundingClientRect();

  if (!isVerticalLayout) {
    const dx = event.clientX - startX;
    let newLeftWidth = startLeftWidth + dx / rect.width;
    const minFraction = 150 / rect.width;
    const maxFraction = 1 - minFraction;
    if (newLeftWidth < minFraction) newLeftWidth = minFraction;
    if (newLeftWidth > maxFraction) newLeftWidth = maxFraction;
    const rightWidth = 1 - newLeftWidth;
    panesEl.style.gridTemplateColumns = `${newLeftWidth * 100}% auto ${rightWidth * 100}%`;
  }
}

function onSplitterMouseUp() {
  if (!isDragging) return;
  isDragging = false;
  splitterEl.classList.remove("dragging");
}

function onSplitterPointerDown(event) {
  event.preventDefault();
  splitterEl.setPointerCapture(event.pointerId);
  activePointerId = event.pointerId;
  isDragging = true;
  splitterEl.classList.add("dragging");

  if (!isVerticalLayout) {
    startX = event.clientX;
    const rect = panesEl.getBoundingClientRect();
    const leftRect = (codeMirror ? codeMirror.getWrapperElement() : codeTextareaEl).getBoundingClientRect();
    startLeftWidth = leftRect.width / rect.width;
  }

  splitterEl.addEventListener("pointermove", onSplitterPointerMove);
  splitterEl.addEventListener("pointerup", onSplitterPointerUpOrCancel);
  splitterEl.addEventListener("pointercancel", onSplitterPointerUpOrCancel);
}

function onSplitterPointerMove(event) {
  if (!isDragging || event.pointerId !== activePointerId) return;

  const rect = panesEl.getBoundingClientRect();

  if (!isVerticalLayout) {
    const dx = event.clientX - startX;
    let newLeftWidth = startLeftWidth + dx / rect.width;
    const minFraction = 150 / rect.width;
    const maxFraction = 1 - minFraction;
    if (newLeftWidth < minFraction) newLeftWidth = minFraction;
    if (newLeftWidth > maxFraction) newLeftWidth = maxFraction;
    const rightWidth = 1 - newLeftWidth;
    panesEl.style.gridTemplateColumns = `${newLeftWidth * 100}% auto ${rightWidth * 100}%`;
  }
}

function onSplitterPointerUpOrCancel(event) {
  if (event.pointerId !== activePointerId) return;
  isDragging = false;
  activePointerId = null;
  splitterEl.classList.remove("dragging");
  splitterEl.releasePointerCapture(event.pointerId);
  splitterEl.removeEventListener("pointermove", onSplitterPointerMove);
  splitterEl.removeEventListener("pointerup", onSplitterPointerUpOrCancel);
  splitterEl.removeEventListener("pointercancel", onSplitterPointerUpOrCancel);
}

// TODO: add syntax highlighting and indentation assistance for HTML elements in a later iteration.

window.addEventListener("load", init);
