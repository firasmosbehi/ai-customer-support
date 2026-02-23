type WidgetPosition = "bottom-right" | "bottom-left";

interface WidgetApiConfig {
  org_id: string;
  display_name: string;
  welcome_message: string;
  primary_color: string;
  position: WidgetPosition;
  avatar_url: string | null;
  powered_by: boolean;
}

interface WidgetConfigResponse {
  data?: WidgetApiConfig;
  error?: string;
}

interface ChatResponseError {
  error?: string;
}

const FALLBACK_CONFIG: WidgetApiConfig = {
  org_id: "",
  display_name: "Support Assistant",
  welcome_message: "Hi! How can I help you today?",
  primary_color: "#2563eb",
  position: "bottom-right",
  avatar_url: null,
  powered_by: true,
};

const getScriptElement = (): HTMLScriptElement | null => {
  const currentScript = document.currentScript;

  if (currentScript instanceof HTMLScriptElement && currentScript.dataset.orgId) {
    return currentScript;
  }

  const scripts = Array.from(document.querySelectorAll("script[data-org-id]"));

  for (let index = scripts.length - 1; index >= 0; index -= 1) {
    const script = scripts[index];

    if (script instanceof HTMLScriptElement && script.src.includes("widget.js")) {
      return script;
    }
  }

  return null;
};

const getLocalStorageValue = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLocalStorageValue = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage write failures.
  }
};

const generateVisitorId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `visitor_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
};

const createInitials = (name: string): string => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 2);

  if (words.length === 0) {
    return "AI";
  }

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
};

const withTrailingSlashTrimmed = (value: string): string => {
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const parseApiBaseUrl = (script: HTMLScriptElement): string => {
  if (script.dataset.apiBase && script.dataset.apiBase.trim().length > 0) {
    return withTrailingSlashTrimmed(script.dataset.apiBase.trim());
  }

  try {
    return withTrailingSlashTrimmed(new URL(script.src, window.location.href).origin);
  } catch {
    return withTrailingSlashTrimmed(window.location.origin);
  }
};

const runWidget = async () => {
  const script = getScriptElement();

  if (!script) {
    console.error("[SupportPilot] Could not find widget script tag.");
    return;
  }

  const orgId = script.dataset.orgId?.trim();

  if (!orgId) {
    console.error("[SupportPilot] Missing required data-org-id attribute.");
    return;
  }

  const apiBaseUrl = parseApiBaseUrl(script);
  const visitorStorageKey = `supportpilot:visitor:${orgId}`;
  const conversationStorageKey = `supportpilot:conversation:${orgId}`;

  let visitorId = getLocalStorageValue(visitorStorageKey);

  if (!visitorId) {
    visitorId = generateVisitorId();
    setLocalStorageValue(visitorStorageKey, visitorId);
  }

  let conversationId = getLocalStorageValue(conversationStorageKey);

  const config = await (async (): Promise<WidgetApiConfig> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/widget/${encodeURIComponent(orgId)}`, {
        method: "GET",
      });

      const body = (await response.json().catch(() => null)) as WidgetConfigResponse | null;

      if (!response.ok || !body?.data) {
        throw new Error(body?.error ?? "Failed to load widget config");
      }

      return body.data;
    } catch (error) {
      console.error("[SupportPilot] Falling back to default config.", error);
      return {
        ...FALLBACK_CONFIG,
        org_id: orgId,
      };
    }
  })();

  const host = document.createElement("div");
  host.setAttribute("data-supportpilot-widget", "");
  host.style.position = "fixed";
  host.style.zIndex = "2147483000";
  host.style.bottom = "24px";
  host.style[config.position === "bottom-left" ? "left" : "right"] = "24px";
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: "open" });
  shadowRoot.innerHTML = `
    <style>
      :host, *, *::before, *::after {
        box-sizing: border-box;
      }

      .sp-root {
        --sp-primary: ${config.primary_color};
        --sp-bg: #ffffff;
        --sp-border: #dbe5ef;
        --sp-text: #0f172a;
        --sp-muted: #516074;
        --sp-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: var(--sp-text);
      }

      .sp-bubble {
        width: 56px;
        height: 56px;
        border: none;
        border-radius: 9999px;
        background: linear-gradient(140deg, var(--sp-primary), #1d4ed8);
        color: #ffffff;
        font-size: 24px;
        cursor: pointer;
        box-shadow: var(--sp-shadow);
      }

      .sp-panel {
        width: min(380px, calc(100vw - 24px));
        height: min(560px, calc(100vh - 110px));
        margin-bottom: 12px;
        border-radius: 16px;
        border: 1px solid var(--sp-border);
        background: var(--sp-bg);
        box-shadow: var(--sp-shadow);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .sp-panel[hidden] {
        display: none;
      }

      .sp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        border-bottom: 1px solid var(--sp-border);
        background: linear-gradient(170deg, rgba(37, 99, 235, 0.08), rgba(16, 185, 129, 0.07));
      }

      .sp-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .sp-avatar {
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: var(--sp-primary);
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
      }

      .sp-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }

      .sp-title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
      }

      .sp-subtitle {
        margin: 1px 0 0;
        font-size: 12px;
        color: var(--sp-muted);
      }

      .sp-close {
        border: none;
        background: transparent;
        color: var(--sp-muted);
        width: 30px;
        height: 30px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }

      .sp-close:hover {
        background: rgba(15, 23, 42, 0.08);
      }

      .sp-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        background: #fbfdff;
      }

      .sp-message {
        max-width: 88%;
        margin-bottom: 12px;
        padding: 9px 11px;
        border-radius: 12px;
        white-space: pre-wrap;
        word-wrap: break-word;
        line-height: 1.45;
        font-size: 13px;
      }

      .sp-message.user {
        margin-left: auto;
        background: var(--sp-primary);
        color: #ffffff;
        border-bottom-right-radius: 4px;
      }

      .sp-message.assistant {
        margin-right: auto;
        background: #ffffff;
        border: 1px solid var(--sp-border);
        border-bottom-left-radius: 4px;
      }

      .sp-footer {
        border-top: 1px solid var(--sp-border);
        padding: 10px;
        background: #ffffff;
      }

      .sp-form {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sp-input {
        flex: 1;
        border: 1px solid var(--sp-border);
        border-radius: 10px;
        padding: 10px 11px;
        font-size: 13px;
        outline: none;
      }

      .sp-input:focus {
        border-color: var(--sp-primary);
      }

      .sp-send {
        border: none;
        border-radius: 10px;
        background: var(--sp-primary);
        color: #ffffff;
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .sp-send:disabled,
      .sp-input:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }

      .sp-powered {
        margin-top: 8px;
        font-size: 11px;
        color: var(--sp-muted);
        text-align: center;
      }

      .sp-powered a {
        color: inherit;
      }

      @media (max-width: 520px) {
        .sp-panel {
          width: calc(100vw - 16px);
          height: min(70vh, 520px);
        }
      }
    </style>
    <div class="sp-root">
      <section class="sp-panel" hidden>
        <header class="sp-header">
          <div class="sp-title-wrap">
            <div class="sp-avatar"></div>
            <div>
              <p class="sp-title"></p>
              <p class="sp-subtitle">Typically replies in under a minute</p>
            </div>
          </div>
          <button class="sp-close" type="button" aria-label="Close chat">×</button>
        </header>
        <div class="sp-messages" aria-live="polite"></div>
        <footer class="sp-footer">
          <form class="sp-form">
            <input class="sp-input" type="text" maxlength="4000" placeholder="Ask your question..." />
            <button class="sp-send" type="submit">Send</button>
          </form>
          <div class="sp-powered"></div>
        </footer>
      </section>
      <button class="sp-bubble" type="button" aria-label="Open chat">💬</button>
    </div>
  `;

  const root = shadowRoot.querySelector(".sp-root");
  const panel = shadowRoot.querySelector(".sp-panel");
  const bubble = shadowRoot.querySelector(".sp-bubble");
  const close = shadowRoot.querySelector(".sp-close");
  const title = shadowRoot.querySelector(".sp-title");
  const avatar = shadowRoot.querySelector(".sp-avatar");
  const messages = shadowRoot.querySelector(".sp-messages");
  const form = shadowRoot.querySelector(".sp-form");
  const input = shadowRoot.querySelector(".sp-input");
  const send = shadowRoot.querySelector(".sp-send");
  const powered = shadowRoot.querySelector(".sp-powered");

  if (
    !(root instanceof HTMLElement) ||
    !(panel instanceof HTMLElement) ||
    !(bubble instanceof HTMLButtonElement) ||
    !(close instanceof HTMLButtonElement) ||
    !(title instanceof HTMLElement) ||
    !(avatar instanceof HTMLElement) ||
    !(messages instanceof HTMLElement) ||
    !(form instanceof HTMLFormElement) ||
    !(input instanceof HTMLInputElement) ||
    !(send instanceof HTMLButtonElement) ||
    !(powered instanceof HTMLElement)
  ) {
    console.error("[SupportPilot] Failed to initialize widget elements.");
    return;
  }

  title.textContent = config.display_name;

  if (config.avatar_url) {
    const image = document.createElement("img");
    image.src = config.avatar_url;
    image.alt = config.display_name;
    avatar.appendChild(image);
  } else {
    avatar.textContent = createInitials(config.display_name);
  }

  if (config.powered_by) {
    const link = document.createElement("a");
    link.href = apiBaseUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Powered by SupportPilot";
    powered.appendChild(link);
  }

  let isOpen = false;
  let isStreaming = false;
  let hasRenderedWelcome = false;

  const appendMessage = (role: "user" | "assistant", text: string): HTMLDivElement => {
    const message = document.createElement("div");
    message.className = `sp-message ${role}`;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  };

  const setStreamingState = (streaming: boolean) => {
    isStreaming = streaming;
    input.disabled = streaming;
    send.disabled = streaming;
  };

  const toggleOpen = (open: boolean) => {
    isOpen = open;
    panel.hidden = !open;

    if (open && !hasRenderedWelcome) {
      appendMessage("assistant", config.welcome_message);
      hasRenderedWelcome = true;
    }

    if (open) {
      window.setTimeout(() => input.focus(), 30);
    }
  };

  const sendMessage = async (rawText: string) => {
    const message = rawText.trim();

    if (!message || isStreaming) {
      return;
    }

    appendMessage("user", message);
    const assistantMessage = appendMessage("assistant", "...");
    setStreamingState(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/chat?org_id=${encodeURIComponent(orgId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          org_id: orgId,
          visitor_id: visitorId,
          conversation_id: conversationId ?? undefined,
          message,
        }),
      });

      const headerConversationId = response.headers.get("x-conversation-id");

      if (headerConversationId) {
        conversationId = headerConversationId;
        setLocalStorageValue(conversationStorageKey, headerConversationId);
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ChatResponseError | null;
        throw new Error(body?.error ?? "Unable to send message");
      }

      if (!response.body) {
        assistantMessage.textContent = "No response stream was returned.";
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        fullText += decoder.decode(value, { stream: true });
        assistantMessage.textContent = fullText || "...";
        messages.scrollTop = messages.scrollHeight;
      }

      fullText += decoder.decode();
      assistantMessage.textContent = fullText.trim() || "I couldn't generate a response.";
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unexpected widget error";
      assistantMessage.textContent = messageText;
    } finally {
      setStreamingState(false);
      input.focus();
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value;
    input.value = "";
    await sendMessage(message);
  });

  bubble.addEventListener("click", () => toggleOpen(!isOpen));
  close.addEventListener("click", () => toggleOpen(false));
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void runWidget();
  });
} else {
  void runWidget();
}
