(() => {
  const CFG = window.APP_CONFIG;
  const STORAGE_KEYS = {
    MODEL: "globalmark_model",
    PROXY_URL: "globalmark_proxy_url",
    DIRECT_KEY: "globalmark_direct_api_key"
  };

  // State
  let history = [];
  let isGenerating = false;

  // DOM Elements
  const chatScrollContainer = document.getElementById("chatScrollContainer");
  const welcomePanel = document.getElementById("welcomePanel");
  const messagesList = document.getElementById("messagesList");
  const chatForm = document.getElementById("chatForm");
  const userInput = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const charCount = document.getElementById("charCount");
  const clearChatBtn = document.getElementById("clearChatBtn");

  // Settings Modal Elements
  const activeModelLabel = document.getElementById("activeModelLabel");
  const modelBadgeBtn = document.getElementById("modelBadgeBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const modelSelect = document.getElementById("modelSelect");
  const customModelGroup = document.getElementById("customModelGroup");
  const customModelInput = document.getElementById("customModelInput");
  const proxyUrlInput = document.getElementById("proxyUrlInput");
  const directApiKeyInput = document.getElementById("directApiKeyInput");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const resetSettingsBtn = document.getElementById("resetSettingsBtn");

  // Settings Helpers
  function getActiveModel() {
    return localStorage.getItem(STORAGE_KEYS.MODEL) || CFG.DEFAULT_MODEL;
  }

  function getProxyUrl() {
    const saved = localStorage.getItem(STORAGE_KEYS.PROXY_URL);
    return saved !== null ? saved.trim() : (CFG.PROXY_URL || "").trim();
  }

  function getDirectApiKey() {
    return (localStorage.getItem(STORAGE_KEYS.DIRECT_KEY) || "").trim();
  }

  function updateModelBadge() {
    activeModelLabel.textContent = getActiveModel();
  }

  // Safe HTML Escaping & Lightweight Markdown Renderer
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatInlineMarkdown(text) {
    return text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function renderMarkdown(rawText) {
    const escaped = escapeHtml(rawText.replace(/\r\n/g, "\n"));
    const lines = escaped.split("\n");
    const html = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Blank line
      if (!line.trim()) {
        i++;
        continue;
      }

      // Markdown Table
      if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) {
        const headerCells = splitTableRow(line);
        i += 2; // Skip header and separator
        const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        html.push("<table><thead><tr>" + headerCells.map((c) => `<th>${formatInlineMarkdown(c)}</th>`).join("") + "</tr></thead>");
        if (rows.length > 0) {
          html.push("<tbody>" + rows.map((r) => "<tr>" + r.map((c) => `<td>${formatInlineMarkdown(c)}</td>`).join("") + "</tr>").join("") + "</tbody>");
        }
        html.push("</table>");
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
        i++;
        continue;
      }

      // Blockquote
      if (line.startsWith("&gt; ")) {
        const quoteLines = [];
        while (i < lines.length && lines[i].startsWith("&gt; ")) {
          quoteLines.push(lines[i].slice(5));
          i++;
        }
        html.push(`<blockquote>${formatInlineMarkdown(quoteLines.join("<br>"))}</blockquote>`);
        continue;
      }

      // Unordered List
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(`<li>${formatInlineMarkdown(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
          i++;
        }
        html.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      // Ordered List
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(`<li>${formatInlineMarkdown(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
          i++;
        }
        html.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      // Paragraph
      const paraLines = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !/^(#{1,4})\s+/.test(lines[i]) &&
        !lines[i].startsWith("&gt; ") &&
        !/^\s*[-*]\s+/.test(lines[i]) &&
        !/^\s*\d+\.\s+/.test(lines[i])
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      html.push(`<p>${formatInlineMarkdown(paraLines.join("<br>"))}</p>`);
    }

    return html.join("");
  }

  function splitTableRow(row) {
    return row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  // Message UI Helpers
  function appendMessage(role, text, isError = false) {
    welcomePanel.hidden = true;

    const row = document.createElement("div");
    row.className = `message-row ${role}${isError ? " error" : ""}`;

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = role === "user" ? "You" : isError ? "System Notice" : `GlobalMark AI (${getActiveModel()})`;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (role === "user" || isError) {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = renderMarkdown(text);
    }

    row.appendChild(meta);
    row.appendChild(bubble);
    messagesList.appendChild(row);
    scrollToBottom();
    return row;
  }

  function appendTypingIndicator() {
    welcomePanel.hidden = true;
    const row = document.createElement("div");
    row.className = "message-row assistant";
    row.innerHTML = `
      <div class="message-meta">GlobalMark AI (${escapeHtml(getActiveModel())})</div>
      <div class="message-bubble">
        <div class="typing-dots" aria-label="Thinking">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    messagesList.appendChild(row);
    scrollToBottom();
    return row;
  }

  function scrollToBottom() {
    chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
  }

  // API Call
  async function callGemini(promptText) {
    const model = getActiveModel();
    const proxyUrl = getProxyUrl();
    const directKey = getDirectApiKey();

    // Trim history to max turns
    const recentHistory = history.slice(-CFG.MAX_HISTORY_TURNS);
    const contents = [
      ...recentHistory,
      { role: "user", parts: [{ text: promptText }] }
    ];

    const payload = {
      model,
      systemInstruction: {
        parts: [{ text: CFG.SYSTEM_PROMPT }]
      },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2048
      }
    };

    let response;
    if (proxyUrl) {
      // Production Cloudflare Worker or custom proxy
      response = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else if (directKey) {
      // Direct Gemini API (local/BYOK only)
      const directEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const { model: _omit, ...geminiBody } = payload;
      response = await fetch(directEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": directKey
        },
        body: JSON.stringify(geminiBody)
      });
    } else {
      // Local dev server proxy (/api/chat)
      if (window.location.protocol === "file:") {
        throw new Error(
          "Opened via file://. Start the local server (local-server.ps1) or add a Direct API Key in Settings."
        );
      }
      response = await fetch("./api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiMsg = data?.error?.message || data?.error || `HTTP ${response.status}`;
      if (response.status === 404 && !proxyUrl && !directKey) {
        throw new Error(
          "No backend proxy found at /api/chat. For local testing, run local-server.ps1; for GitHub Pages, configure PROXY_URL in config.js."
        );
      }
      throw new Error(apiMsg);
    }

    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!replyText) {
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`Request blocked by safety filter (${blockReason}). Please rephrase your marketing question.`);
      }
      throw new Error("The model returned an empty response. Please try again.");
    }

    return replyText;
  }

  // Input Handling
  function updateInputState() {
    const len = userInput.value.length;
    charCount.textContent = `${len} / ${CFG.MAX_INPUT_CHARS}`;
    sendBtn.disabled = isGenerating || userInput.value.trim().length === 0;

    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 150) + "px";
  }

  userInput.addEventListener("input", updateInputState);

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        chatForm.dispatchEvent(new Event("submit"));
      }
    }
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isGenerating) return;

    const text = userInput.value.trim();
    if (!text) return;

    userInput.value = "";
    updateInputState();

    appendMessage("user", text);
    isGenerating = true;
    sendBtn.disabled = true;
    const typingEl = appendTypingIndicator();

    try {
      const reply = await callGemini(text);
      typingEl.remove();
      appendMessage("assistant", reply);

      history.push({ role: "user", parts: [{ text }] });
      history.push({ role: "model", parts: [{ text: reply }] });
    } catch (err) {
      typingEl.remove();
      appendMessage("assistant", err.message || "Unable to reach the AI service.", true);
    } finally {
      isGenerating = false;
      updateInputState();
      userInput.focus();
    }
  });

  clearChatBtn.addEventListener("click", () => {
    history = [];
    messagesList.innerHTML = "";
    welcomePanel.hidden = false;
    userInput.focus();
  });

  // Settings Modal Logic
  function populateModelSelect() {
    modelSelect.innerHTML = "";
    CFG.AVAILABLE_MODELS.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      modelSelect.appendChild(opt);
    });
    const customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "Custom model ID...";
    modelSelect.appendChild(customOpt);
  }

  function openSettings() {
    const active = getActiveModel();
    const isPreset = CFG.AVAILABLE_MODELS.some((m) => m.id === active);
    if (isPreset) {
      modelSelect.value = active;
      customModelGroup.hidden = true;
      customModelInput.value = "";
    } else {
      modelSelect.value = "__custom__";
      customModelGroup.hidden = false;
      customModelInput.value = active;
    }

    proxyUrlInput.value = localStorage.getItem(STORAGE_KEYS.PROXY_URL) || "";
    directApiKeyInput.value = localStorage.getItem(STORAGE_KEYS.DIRECT_KEY) || "";
    settingsModal.hidden = false;
  }

  function closeSettings() {
    settingsModal.hidden = true;
  }

  modelSelect.addEventListener("change", () => {
    customModelGroup.hidden = modelSelect.value !== "__custom__";
    if (!customModelGroup.hidden) {
      customModelInput.focus();
    }
  });

  saveSettingsBtn.addEventListener("click", () => {
    let selectedModel = modelSelect.value;
    if (selectedModel === "__custom__") {
      selectedModel = customModelInput.value.trim() || CFG.DEFAULT_MODEL;
    }
    localStorage.setItem(STORAGE_KEYS.MODEL, selectedModel);

    const proxyVal = proxyUrlInput.value.trim();
    if (proxyVal) {
      localStorage.setItem(STORAGE_KEYS.PROXY_URL, proxyVal);
    } else {
      localStorage.removeItem(STORAGE_KEYS.PROXY_URL);
    }

    const keyVal = directApiKeyInput.value.trim();
    if (keyVal) {
      localStorage.setItem(STORAGE_KEYS.DIRECT_KEY, keyVal);
    } else {
      localStorage.removeItem(STORAGE_KEYS.DIRECT_KEY);
    }

    updateModelBadge();
    closeSettings();
  });

  resetSettingsBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.MODEL);
    localStorage.removeItem(STORAGE_KEYS.PROXY_URL);
    localStorage.removeItem(STORAGE_KEYS.DIRECT_KEY);
    updateModelBadge();
    openSettings();
  });

  settingsBtn.addEventListener("click", openSettings);
  modelBadgeBtn.addEventListener("click", openSettings);
  closeSettingsBtn.addEventListener("click", closeSettings);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // Init
  populateModelSelect();
  updateModelBadge();
  updateInputState();
})();
