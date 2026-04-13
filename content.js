(function () {
  'use strict';

  const hostname = window.location.hostname;
  const isChatGPT = hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
  const isClaude = hostname === 'claude.ai';
  const isGemini = hostname === 'gemini.google.com';
  const isGitHubCopilot =
    hostname === 'github.com' && window.location.pathname.startsWith('/copilot');

  if (!isChatGPT && !isClaude && !isGemini && !isGitHubCopilot) return;

  /**
   * Walk the event's composed path (handles shadow DOM) and return the first
   * editable element: a <textarea> or a contenteditable element.
   */
  function getInputElement(event) {
    for (const el of event.composedPath()) {
      if (!(el instanceof Element)) continue;
      if (el instanceof HTMLTextAreaElement) return el;
      if (el.contentEditable === 'true') return el;
    }
    return null;
  }

  /**
   * Try to locate the send/submit button for the current site.
   * Selectors are listed from most-specific to most-generic.
   */
  function findSubmitButton() {
    const selectors = [
      // ChatGPT
      'button[data-testid="send-button"]',
      // Claude
      'button[aria-label="Send Message"]',
      'button[aria-label="Send message"]',
      // Gemini
      '[aria-label="Send message"]',
      'button.send-button',
      // GitHub Copilot Chat
      'button[data-testid="copilot-chat-send-button"]',
      'button[aria-label="Send"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /**
   * Insert a newline at the current caret position inside an editable element.
   *
   * - <textarea>: directly mutate the value (using the native setter so that
   *   React/framework state stays in sync) and fire an `input` event.
   * - contenteditable: dispatch a Shift+Enter keydown so the rich-text editor
   *   (ProseMirror on Claude, Quill on Gemini, etc.) handles it natively and
   *   inserts its own "hard break".
   */
  function insertNewline(inputEl) {
    if (inputEl instanceof HTMLTextAreaElement) {
      const nativeSet = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      ).set;
      const s = inputEl.selectionStart;
      const e = inputEl.selectionEnd;
      nativeSet.call(inputEl, inputEl.value.slice(0, s) + '\n' + inputEl.value.slice(e));
      inputEl.selectionStart = inputEl.selectionEnd = s + 1;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Dispatch Shift+Enter onto the contenteditable so the editor's own
      // key-handler inserts the appropriate line break.
      // isTrusted will be false on this synthetic event, so our capture
      // listener (which guards with `!event.isTrusted`) will ignore it and
      // let it reach the editor's handler without looping.
      inputEl.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    }
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter') return;

    // IME変換中（日本語入力など）のEnterは無視して通常動作させる
    if (event.isComposing) return;

    // Ignore synthetic events we dispatched ourselves (isTrusted === false)
    // to avoid infinite loops in the contenteditable path.
    if (!event.isTrusted) return;

    const inputEl = getInputElement(event);
    if (!inputEl) return;

    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl + Enter → submit the message
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const btn = findSubmitButton();
      if (btn) btn.click();
    } else {
      // Plain Enter or Shift+Enter → insert a newline
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      insertNewline(inputEl);
    }
  }

  // Capture phase ensures our handler fires before the site's own listeners.
  document.addEventListener('keydown', handleKeydown, true);
})();
