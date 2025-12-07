const TRY_IT_TEMPLATES = {
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

const FORMATTER_DEFAULT = `<div><p><strong>Paste your HTML here</strong></p><p>This formatter uses vkBeautify to tidy up indentation.</p></div>`;

const TAB_COPY = {
  tryit: {
    title: "Simple TryIt editor (HTML + CSS + JS)",
    description: "Edit the HTML below and press <strong>Run</strong>."
  },
  formatter: {
    title: "HTML formatter",
    description: "Paste HTML on the left and click <strong>Format</strong> to tidy it up."
  }
};

const STORAGE_PREFIXES = {
  tryit: "tryit-code-",
  formatter: "formatter-code-"
};

const codeTextareaEl = document.getElementById("code");
const previewEl = document.getElementById("preview");
const formatterInputEl = document.getElementById("formatterInput");
const formatterOutputEl = document.getElementById("formatterOutput");

const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = {
  tryit: document.getElementById("tab-tryit"),
  formatter: document.getElementById("tab-formatter")
};

const tabInfoEl = document.getElementById("tabInfo");
const statusEl = document.getElementById("status");
const themeSelectEl = document.getElementById("themeSelect");
const previewDarkToggleEl = document.getElementById("previewDarkToggle");
const previewToggleWrapperEl = document.getElementById("previewToggleWrapper");

const tryitControlsEl = document.getElementById("tryitControls");
const formatterControlsEl = document.getElementById("formatterControls");

const tabTitleEl = document.getElementById("tabTitle");
const tabDescriptionEl = document.getElementById("tabDescription");

const runTryItBtn = document.getElementById("runTryIt");
const resetTryItBtn = document.getElementById("resetTryIt");
const formatHtmlBtn = document.getElementById("formatHtml");
const resetFormatterBtn = document.getElementById("resetFormatter");

const tryitPanesEl = document.getElementById("tryitPanes");
const tryitSplitterEl = document.getElementById("tryitSplitter");
const formatterPanesEl = document.getElementById("formatterPanes");
const formatterSplitterEl = document.getElementById("formatterSplitter");

const STORAGE_PREFIX = STORAGE_PREFIXES.tryit;
const FORMATTER_STORAGE_PREFIX = STORAGE_PREFIXES.formatter;

let storageDisabled = false;

const TAB_ID = getOrCreateTabId();
const TRY_IT_STORAGE_KEY = STORAGE_PREFIX + TAB_ID;
const FORMATTER_STORAGE_KEY = FORMATTER_STORAGE_PREFIX + TAB_ID;

let currentTheme = "light";
let previewDarkMode = false;
let activeTab = "tryit";

let tryItEditor = null;
let formatterInputEditor = null;
let formatterOutputEditor = null;

const splitPanes = [];

class SplitPane {
  constructor(container, splitter, getPrimaryPane) {
    this.container = container;
    this.splitter = splitter;
    this.getPrimaryPane = getPrimaryPane;
    this.isVertical = window.innerWidth <= 800;
    this.isDragging = false;
    this.activePointerId = null;
    this.startFraction = 0;
    this.startCoord = 0;
    this.init();
  }

  init() {
    if (!this.container || !this.splitter) return;
    if (window.PointerEvent) {
      this.splitter.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    }
    window.addEventListener("resize", () => this.updateLayoutMode());
  }

  updateLayoutMode() {
    const wasVertical = this.isVertical;
    this.isVertical = window.innerWidth <= 800;
    if (wasVertical !== this.isVertical) {
      this.container.style.gridTemplateColumns = "";
      this.container.style.gridTemplateRows = "";
    }
  }

  onPointerDown(event) {
    event.preventDefault();
    this.splitter.setPointerCapture(event.pointerId);
    this.activePointerId = event.pointerId;
    this.isDragging = true;
    this.splitter.classList.add("dragging");

    const rect = this.container.getBoundingClientRect();
    const primaryRect = this.getPrimaryPane().getBoundingClientRect();

    if (this.isVertical) {
      this.startCoord = event.clientY;
      this.startFraction = primaryRect.height / rect.height;
    } else {
      this.startCoord = event.clientX;
      this.startFraction = primaryRect.width / rect.width;
    }

    this.splitter.addEventListener("pointermove", this.onPointerMove);
    this.splitter.addEventListener("pointerup", this.onPointerUpOrCancel);
    this.splitter.addEventListener("pointercancel", this.onPointerUpOrCancel);
  }

  onPointerMove = (event) => {
    if (!this.isDragging || event.pointerId !== this.activePointerId) return;

    const rect = this.container.getBoundingClientRect();
    const delta = this.isVertical ? event.clientY - this.startCoord : event.clientX - this.startCoord;
    const size = this.isVertical ? rect.height : rect.width;

    let newFraction = this.startFraction + delta / size;
    const minFraction = (this.isVertical ? 100 : 150) / size;
    const maxFraction = 1 - minFraction;
    if (newFraction < minFraction) newFraction = minFraction;
    if (newFraction > maxFraction) newFraction = maxFraction;

    const otherFraction = 1 - newFraction;
    if (this.isVertical) {
      this.container.style.gridTemplateRows = `${newFraction * 100}% auto ${otherFraction * 100}%`;
      this.container.style.gridTemplateColumns = "1fr";
    } else {
      this.container.style.gridTemplateColumns = `${newFraction * 100}% auto ${otherFraction * 100}%`;
      this.container.style.gridTemplateRows = "";
    }
  };

  onPointerUpOrCancel = (event) => {
    if (event.pointerId !== this.activePointerId) return;
    this.isDragging = false;
    this.activePointerId = null;
    this.splitter.classList.remove("dragging");
    this.splitter.releasePointerCapture(event.pointerId);
    this.splitter.removeEventListener("pointermove", this.onPointerMove);
    this.splitter.removeEventListener("pointerup", this.onPointerUpOrCancel);
    this.splitter.removeEventListener("pointercancel", this.onPointerUpOrCancel);
  };
}

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
  const prefixes = Object.values(STORAGE_PREFIXES);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
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

function saveTryItToStorage() {
  if (storageDisabled) return;

  const payload = {
    code: getTryItValue(),
    theme: currentTheme,
    updatedAt: Date.now()
  };
  try {
    localStorage.setItem(TRY_IT_STORAGE_KEY, JSON.stringify(payload));
    cleanupOldEntries();
  } catch (e) {
    disableStorage(
      "Saving failed: localStorage is full or blocked. Switched to private mode, code will no longer be saved in the browser."
    );
  }
}

function saveFormatterToStorage() {
  if (storageDisabled) return;

  const payload = {
    code: getFormatterInput(),
    updatedAt: Date.now(),
    theme: currentTheme
  };
  try {
    localStorage.setItem(FORMATTER_STORAGE_KEY, JSON.stringify(payload));
    cleanupOldEntries();
  } catch (e) {
    disableStorage(
      "Saving failed: localStorage is full or blocked. Switched to private mode, code will no longer be saved in the browser."
    );
  }
}

function loadFromStorage(key) {
  if (storageDisabled) return null;

  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    localStorage.removeItem(key);
    return null;
  }
}

function applyTheme(theme) {
  currentTheme = theme || "light";
  document.body.setAttribute("data-theme", currentTheme);
  if (themeSelectEl && themeSelectEl.value !== currentTheme) {
    themeSelectEl.value = currentTheme;
  }

  const cmTheme = currentTheme === "dark" ? "dracula" : "default";
  [tryItEditor, formatterInputEditor, formatterOutputEditor].forEach((editor) => {
    if (editor) {
      editor.setOption("theme", cmTheme);
    }
  });
}

function getDefaultTemplate() {
  return TRY_IT_TEMPLATES[currentTheme] || TRY_IT_TEMPLATES.light;
}

function wrapPreviewHtml(html, useDark) {
  const lightStyle = `
<style data-tryit-theme="light">
  html, body {
    background: #ffffff !important;
    color: #111827 !important;
  }
  a { color: #2563eb !important; }
  button, input, textarea, select {
    background: #ffffff !important;
    color: #111827 !important;
    border-color: #d1d5db !important;
  }
</style>`;

  const darkStyle = `
<style data-tryit-theme="dark">
  html, body {
    background: #020617 !important;
    color: #e5e7eb !important;
  }
  a { color: #38bdf8 !important; }
  button, input, textarea, select {
    background: #020617 !important;
    color: #e5e7eb !important;
    border-color: #475569 !important;
  }
</style>`;

  const themeStyle = useDark ? darkStyle : lightStyle;

  if (html.includes("<head")) {
    return html.replace(/<head([^>]*)>/i, (m) => m + themeStyle);
  }
  return themeStyle + html;
}

function runTryIt() {
  const code = getTryItValue();
  const wrapped = wrapPreviewHtml(code, previewDarkMode);
  previewEl.srcdoc = wrapped;
  saveTryItToStorage();
}

function resetTryIt() {
  setTryItValue(getDefaultTemplate());
  runTryIt();
}

function formatHtml() {
  if (!window.vkbeautify || typeof window.vkbeautify.html !== "function") {
    setStatus("Formatter library missing", "error");
    return;
  }

  const raw = getFormatterInput();
  try {
    const formatted = window.vkbeautify.html(raw, "  ");
    setFormatterOutput(formatted);
    saveFormatterToStorage();
  } catch (e) {
    setStatus("Formatting failed: " + e.message, "error");
  }
}

function resetFormatter() {
  setFormatterInput(FORMATTER_DEFAULT);
  setFormatterOutput("");
  formatHtml();
}

function getTryItValue() {
  if (tryItEditor) {
    return tryItEditor.getValue();
  }
  return codeTextareaEl ? codeTextareaEl.value : "";
}

function setTryItValue(value) {
  if (tryItEditor) {
    tryItEditor.setValue(value);
  } else if (codeTextareaEl) {
    codeTextareaEl.value = value;
  }
}

function getFormatterInput() {
  if (formatterInputEditor) {
    return formatterInputEditor.getValue();
  }
  return formatterInputEl ? formatterInputEl.value : "";
}

function setFormatterInput(value) {
  if (formatterInputEditor) {
    formatterInputEditor.setValue(value);
  } else if (formatterInputEl) {
    formatterInputEl.value = value;
  }
}

function setFormatterOutput(value) {
  if (formatterOutputEditor) {
    formatterOutputEditor.setValue(value);
  } else if (formatterOutputEl) {
    formatterOutputEl.value = value;
  }
}

function initEditors() {
  if (window.CodeMirror && codeTextareaEl) {
    tryItEditor = CodeMirror.fromTextArea(codeTextareaEl, {
      mode: "htmlmixed",
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentUnit: 2,
      indentWithTabs: false
    });
  }

  if (window.CodeMirror && formatterInputEl) {
    formatterInputEditor = CodeMirror.fromTextArea(formatterInputEl, {
      mode: "htmlmixed",
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      indentUnit: 2,
      indentWithTabs: false
    });
  }

  if (window.CodeMirror && formatterOutputEl) {
    formatterOutputEditor = CodeMirror.fromTextArea(formatterOutputEl, {
      mode: "htmlmixed",
      lineNumbers: true,
      lineWrapping: true,
      readOnly: true
    });
  }

  setTimeout(() => {
    [tryItEditor, formatterInputEditor, formatterOutputEditor].forEach((editor) => {
      if (editor) {
        editor.refresh();
      }
    });
  }, 0);
}

function initStorageAndDefaults(storageOk) {
  if (storageOk) {
    cleanupOldEntries();
    const savedTryIt = loadFromStorage(TRY_IT_STORAGE_KEY);
    const savedFormatter = loadFromStorage(FORMATTER_STORAGE_KEY);

    if (savedTryIt && savedTryIt.code) {
      applyTheme(savedTryIt.theme || "light");
      setTryItValue(savedTryIt.code);
      runTryIt();
    } else {
      applyTheme("light");
      setTryItValue(getDefaultTemplate());
      previewEl.srcdoc = wrapPreviewHtml(getTryItValue(), previewDarkMode);
    }

    if (savedFormatter && savedFormatter.code) {
      setFormatterInput(savedFormatter.code);
      setFormatterOutput("");
    } else {
      setFormatterInput(FORMATTER_DEFAULT);
      setFormatterOutput("");
    }
  } else {
    applyTheme("light");
    setTryItValue(getDefaultTemplate());
    previewEl.srcdoc = wrapPreviewHtml(getTryItValue(), previewDarkMode);
    setFormatterInput(FORMATTER_DEFAULT);
    setFormatterOutput("");
  }

  formatHtml();
}

function switchTab(tab) {
  if (!TAB_COPY[tab]) return;
  activeTab = tab;

  tabButtons.forEach((button) => {
    const target = button.getAttribute("data-tab-target");
    const isActive = target === tab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  Object.entries(tabPanels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === tab);
  });

  if (tabTitleEl) tabTitleEl.textContent = TAB_COPY[tab].title;
  if (tabDescriptionEl) tabDescriptionEl.innerHTML = TAB_COPY[tab].description;

  if (previewToggleWrapperEl) {
    previewToggleWrapperEl.classList.toggle("hidden", tab !== "tryit");
  }

  if (tryitControlsEl) tryitControlsEl.classList.toggle("hidden", tab !== "tryit");
  if (formatterControlsEl) formatterControlsEl.classList.toggle("hidden", tab !== "formatter");

  setTimeout(() => {
    [tryItEditor, formatterInputEditor, formatterOutputEditor].forEach((editor) => editor && editor.refresh());
    splitPanes.forEach((pane) => pane.updateLayoutMode());
  }, 0);
}

function initTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-tab-target");
      switchTab(target);
    });
  });
}

function initSplitters() {
  const tryItPane = new SplitPane(tryitPanesEl, tryitSplitterEl, () => {
    if (tryItEditor) return tryItEditor.getWrapperElement();
    return codeTextareaEl;
  });

  const formatterPane = new SplitPane(formatterPanesEl, formatterSplitterEl, () => {
    if (formatterInputEditor) return formatterInputEditor.getWrapperElement();
    return formatterInputEl;
  });

  splitPanes.push(tryItPane, formatterPane);
}

function init() {
  const storageOk = detectStorageAvailability();
  initTabs();
  initEditors();
  applyTheme(currentTheme);

  if (themeSelectEl) {
    themeSelectEl.addEventListener("change", (event) => {
      applyTheme(event.target.value);
      saveTryItToStorage();
      saveFormatterToStorage();
    });
  }

  if (previewDarkToggleEl) {
    previewDarkMode = previewDarkToggleEl.checked;
    previewDarkToggleEl.addEventListener("change", () => {
      previewDarkMode = previewDarkToggleEl.checked;
      runTryIt();
    });
  }

  initSplitters();
  initStorageAndDefaults(storageOk);

  if (runTryItBtn) runTryItBtn.addEventListener("click", runTryIt);
  if (resetTryItBtn) resetTryItBtn.addEventListener("click", resetTryIt);
  if (formatHtmlBtn) formatHtmlBtn.addEventListener("click", formatHtml);
  if (resetFormatterBtn) resetFormatterBtn.addEventListener("click", resetFormatter);

  switchTab("tryit");
}

window.addEventListener("load", init);
