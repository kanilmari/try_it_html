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

const FORMATTER_TEMPLATE = `<!DOCTYPE html>
<html>
<body>

<textarea id="koodi" rows="10" cols="50">
<div><h1>Otsikko</h1><p>Tässä on tekstiä
        joka on vähän miten sattuu</p></div>
</textarea>

<br>
<button onclick="formatoiKoodi()">Formatoi Koodi!</button>

<script src="https://unpkg.com/prettier@2.8.8/standalone.js"></script>
<script src="https://unpkg.com/prettier@2.8.8/parser-html.js"></script>

<script>
  function formatoiKoodi() {
    // Haetaan ruma koodi
    const rumaKoodi = document.getElementById('koodi').value;

    // 3. Tässä on se "taika": yksi funktiokutsu tekee kaiken työn
    const kaunisKoodi = prettier.format(rumaKoodi, {
      parser: "html",
      plugins: prettierPlugins,
      htmlWhitespaceSensitivity: "ignore" // Poistaa turhat välilyönnit
    });

    // Päivitetään tulos takaisin
    document.getElementById('koodi').value = kaunisKoodi;
  }
</script>

</body>
</html>`;

const TOOL_CONFIG = {
  tryit: {
    id: "tryit",
    title: "Simple TryIt editor (HTML + CSS + JS)",
    description: "Edit the HTML below and press <strong>Run</strong>.",
    runLabel: "Run ▶",
    resetLabel: "Reset template",
    defaultCode: () => getDefaultTemplate(),
    run: runTryIt,
  },
  formatter: {
    id: "formatter",
    title: "HTML formatter",
    description: "Liitä HTML-koodi, paina <strong>Format</strong> ja saat siistin lähdekoodin ja esikatselun.",
    runLabel: "Format ▶",
    resetLabel: "Reset formatter sample",
    defaultCode: () => FORMATTER_TEMPLATE,
    run: runFormatter,
  },
};

const codeTextareaEl = document.getElementById("code");
const previewEl = document.getElementById("preview");
const tabInfoEl = document.getElementById("tabInfo");
const statusEl = document.getElementById("status");
const themeSelectEl = document.getElementById("themeSelect");
const previewDarkToggleEl = document.getElementById("previewDarkToggle");
const panesEl = document.getElementById("panes");
const splitterEl = document.getElementById("splitter");
const appTitleEl = document.getElementById("appTitle");
const headerDescriptionEl = document.getElementById("headerDescription");
const runButtonEl = document.getElementById("runButton");
const resetButtonEl = document.getElementById("resetButton");
const tabButtons = document.querySelectorAll("[data-tool]");

const STORAGE_PREFIX = "tryit-code-";
let storageDisabled = false;
let storageAvailable = false;

const TAB_ID = getOrCreateTabId();

let currentTheme = "light";
let previewDarkMode = false;
let activeTool = "tryit";

// CodeMirror instance (created in init)
let codeMirror = null;

let isDragging = false;
let startX = 0;
let startY = 0;
let startLeftWidth = 0;
let startTopHeight = 0;
let isVerticalLayout = false;
let activePointerId = null;

updateTabInfo();

function setStatus(message, type = "info") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = "status " + (type === "error" ? "status-error" : "status-info");
}

function updateTabInfo() {
  if (!tabInfoEl) return;
  const toolTitle = TOOL_CONFIG[activeTool]?.title || "TryIt";
  tabInfoEl.textContent = `Tab id: ${TAB_ID} · Mode: ${toolTitle}`;
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

function getStorageKey() {
  return `${STORAGE_PREFIX}${activeTool}-${TAB_ID}`;
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
  if (storageDisabled || !storageAvailable) return;

  const payload = {
    code: getEditorValue(),
    theme: currentTheme,
    updatedAt: Date.now()
  };
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(payload));
    cleanupOldEntries();
  } catch (e) {
    // Quota full or storage otherwise blocked → switch to permanent private mode
    disableStorage("Saving failed: localStorage is full or blocked. Switched to private mode, code will no longer be saved in the browser.");
  }
}

function loadFromStorage() {
  if (storageDisabled || !storageAvailable) return null;

  const raw = localStorage.getItem(getStorageKey());
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    localStorage.removeItem(getStorageKey());
    return null;
  }
}

function applyTheme(theme) {
  currentTheme = theme || "light";
  document.body.setAttribute("data-theme", currentTheme);
  if (themeSelectEl && themeSelectEl.value !== currentTheme) {
    themeSelectEl.value = currentTheme;
  }

  // Sync CodeMirror theme with app theme
  if (codeMirror) {
    const cmTheme = currentTheme === "dark" ? "dracula" : "default";
    codeMirror.setOption("theme", cmTheme);
  }
}

function getDefaultTemplate() {
  return TEMPLATES[currentTheme] || TEMPLATES.light;
}

function runTryIt() {
  const code = getEditorValue();
  const wrapped = wrapPreviewHtml(code, previewDarkMode);
  previewEl.srcdoc = wrapped;
  saveToStorage();
}

function wrapPreviewHtml(html, useDark) {
  // Always inject explicit styles to ensure proper reset when toggling themes
  // This fixes the issue where dark styles could persist after unchecking dark mode
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

  // If the user already has a <head>, inject into it; otherwise prepend
  if (html.includes("<head")) {
    return html.replace(/<head([^>]*)>/i, (m) => m + themeStyle);
  }
  return themeStyle + html;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapFormatterPreview(html, useDark) {
  const bg = useDark ? "#020617" : "#ffffff";
  const text = useDark ? "#e5e7eb" : "#111827";
  const border = useDark ? "#1f2937" : "#e5e7eb";
  const accent = "#8b5cf6";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: ${bg}; color: ${text}; margin: 0; padding: 1rem; }
    h2 { margin-top: 0; color: ${accent}; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
    @media (min-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .panel { border: 1px solid ${border}; border-radius: 8px; padding: 1rem; background: ${useDark ? "#0b1120" : "#f8fafc"}; }
    pre { white-space: pre-wrap; word-break: break-word; background: ${useDark ? "#111827" : "#11182710"}; color: inherit; padding: 0.75rem; border-radius: 6px; overflow: auto; }
    .rendered { padding: 0.75rem; border-radius: 6px; border: 1px dashed ${border}; background: ${useDark ? "#0b1120" : "#fff"}; }
  </style>
</head>
<body>
  <div class="grid">
    <div class="panel">
      <h2>Formatted HTML</h2>
      <pre>${escapeHtml(html)}</pre>
    </div>
    <div class="panel">
      <h2>Rendered output</h2>
      <div class="rendered">${html}</div>
    </div>
  </div>
</body>
</html>`;
}

function runFormatter() {
  const code = getEditorValue();
  if (typeof prettier === "undefined" || typeof prettierPlugins === "undefined") {
    setStatus("Prettier is not available, cannot format HTML.", "error");
    return;
  }

  try {
    const formatted = prettier.format(code, {
      parser: "html",
      plugins: prettierPlugins,
      htmlWhitespaceSensitivity: "ignore",
    });

    setEditorValue(formatted);
    previewEl.srcdoc = wrapFormatterPreview(formatted, previewDarkMode);
    setStatus("HTML formatted and preview updated.");
    saveToStorage();
  } catch (error) {
    setStatus(`Formatting failed: ${error.message}`, "error");
  }
}

function runActiveTool() {
  const handler = TOOL_CONFIG[activeTool]?.run;
  if (typeof handler === "function") {
    handler();
  }
}

function resetActiveTemplate() {
  const config = TOOL_CONFIG[activeTool];
  if (!config) return;
  const defaultValue = config.defaultCode();
  setEditorValue(defaultValue);
  runActiveTool();
}

function setActiveTool(tool) {
  if (!TOOL_CONFIG[tool]) return;
  activeTool = tool;

  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tool === tool;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const config = TOOL_CONFIG[tool];
  if (appTitleEl) appTitleEl.textContent = config.title;
  if (headerDescriptionEl) headerDescriptionEl.innerHTML = config.description;
  if (runButtonEl) runButtonEl.textContent = config.runLabel;
  if (resetButtonEl) resetButtonEl.textContent = config.resetLabel;

  updateTabInfo();

  const saved = loadFromStorage();
  if (saved && saved.code) {
    applyTheme(saved.theme || currentTheme || "light");
    setEditorValue(saved.code);
    runActiveTool();
    return;
  }

  applyTheme(currentTheme || "light");
  setEditorValue(config.defaultCode());
  runActiveTool();
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
  storageAvailable = detectStorageAvailability();

  if (runButtonEl) {
    runButtonEl.addEventListener("click", runActiveTool);
  }
  if (resetButtonEl) {
    resetButtonEl.addEventListener("click", resetActiveTemplate);
  }
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveTool(btn.dataset.tool);
    });
  });

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

    // Apply initial theme based on currentTheme
    const cmInitialTheme = currentTheme === "dark" ? "dracula" : "default";
    codeMirror.setOption("theme", cmInitialTheme);

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

  if (previewDarkToggleEl) {
    previewDarkMode = previewDarkToggleEl.checked;
    previewDarkToggleEl.addEventListener("change", () => {
      previewDarkMode = previewDarkToggleEl.checked;
      // Re-run current code to apply or remove dark wrapper
      runActiveTool();
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

  if (storageAvailable) {
    cleanupOldEntries();
  }

  applyTheme(currentTheme || "light");
  setActiveTool(activeTool);
}

function updateLayoutMode() {
  const wasVertical = isVerticalLayout;
  isVerticalLayout = window.innerWidth <= 800;
  
  // Reset custom grid styles when switching layout mode
  if (wasVertical !== isVerticalLayout && panesEl) {
    panesEl.style.gridTemplateColumns = "";
    panesEl.style.gridTemplateRows = "";
  }
}

function onSplitterMouseDown(event) {
  event.preventDefault();
  isDragging = true;
  splitterEl.classList.add("dragging");

  const rect = panesEl.getBoundingClientRect();
  if (isVerticalLayout) {
    startY = event.clientY;
    const topEl = codeMirror ? codeMirror.getWrapperElement() : codeTextareaEl;
    const topRect = topEl.getBoundingClientRect();
    startTopHeight = topRect.height / rect.height;
  } else {
    startX = event.clientX;
    const leftRect = (codeMirror ? codeMirror.getWrapperElement() : codeTextareaEl).getBoundingClientRect();
    startLeftWidth = leftRect.width / rect.width;
  }
}

function onSplitterMouseMove(event) {
  if (!isDragging) return;

  const rect = panesEl.getBoundingClientRect();

  if (isVerticalLayout) {
    const dy = event.clientY - startY;
    let newTopHeight = startTopHeight + dy / rect.height;
    const minFraction = 100 / rect.height;
    const maxFraction = 1 - minFraction;
    if (newTopHeight < minFraction) newTopHeight = minFraction;
    if (newTopHeight > maxFraction) newTopHeight = maxFraction;
    const bottomHeight = 1 - newTopHeight;
    panesEl.style.gridTemplateRows = `${newTopHeight * 100}% auto ${bottomHeight * 100}%`;
    panesEl.style.gridTemplateColumns = "1fr";
  } else {
    const dx = event.clientX - startX;
    let newLeftWidth = startLeftWidth + dx / rect.width;
    const minFraction = 150 / rect.width;
    const maxFraction = 1 - minFraction;
    if (newLeftWidth < minFraction) newLeftWidth = minFraction;
    if (newLeftWidth > maxFraction) newLeftWidth = maxFraction;
    const rightWidth = 1 - newLeftWidth;
    panesEl.style.gridTemplateColumns = `${newLeftWidth * 100}% auto ${rightWidth * 100}%`;
    panesEl.style.gridTemplateRows = "";
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

  const rect = panesEl.getBoundingClientRect();
  if (isVerticalLayout) {
    startY = event.clientY;
    const topEl = codeMirror ? codeMirror.getWrapperElement() : codeTextareaEl;
    const topRect = topEl.getBoundingClientRect();
    startTopHeight = topRect.height / rect.height;
  } else {
    startX = event.clientX;
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

  if (isVerticalLayout) {
    const dy = event.clientY - startY;
    let newTopHeight = startTopHeight + dy / rect.height;
    const minFraction = 100 / rect.height;
    const maxFraction = 1 - minFraction;
    if (newTopHeight < minFraction) newTopHeight = minFraction;
    if (newTopHeight > maxFraction) newTopHeight = maxFraction;
    const bottomHeight = 1 - newTopHeight;
    panesEl.style.gridTemplateRows = `${newTopHeight * 100}% auto ${bottomHeight * 100}%`;
    panesEl.style.gridTemplateColumns = "1fr";
  } else {
    const dx = event.clientX - startX;
    let newLeftWidth = startLeftWidth + dx / rect.width;
    const minFraction = 150 / rect.width;
    const maxFraction = 1 - minFraction;
    if (newLeftWidth < minFraction) newLeftWidth = minFraction;
    if (newLeftWidth > maxFraction) newLeftWidth = maxFraction;
    const rightWidth = 1 - newLeftWidth;
    panesEl.style.gridTemplateColumns = `${newLeftWidth * 100}% auto ${rightWidth * 100}%`;
    panesEl.style.gridTemplateRows = "";
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
