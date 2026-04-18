(function () {
  'use strict';

  const hostname = window.location.hostname;
  const isChatGPT = hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
  const isClaude = hostname === 'claude.ai';
  const isGemini = hostname === 'gemini.google.com';
  const isGitHubCopilot =
    hostname === 'github.com' && /^\/copilot(?:\/|$)/.test(window.location.pathname);

  if (!isChatGPT && !isClaude && !isGemini && !isGitHubCopilot) return;

  /**
   * イベントの composedPath を辿り（Shadow DOM 対応）、
   * 最初に見つかった編集可能要素（<textarea> または contenteditable 要素）を返す。
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
   * 現在のサイトに対応する送信ボタンを探して返す。
   * セレクターは具体的なものから汎用的なものの順に並べている。
   */
  function findSubmitButton(inputEl) {
    // まずは入力欄に近いコンテキスト（form）を優先して探索する。
    const form = inputEl?.closest?.('form');
    if (form) {
      const scopedSelectors = [
        'button[type="submit"]',
        'button[aria-label="Send Message"]',
        'button[aria-label="Send message"]',
        'button[aria-label="メッセージを送信"]',
        'button[aria-label*="送信"]',
        'button[aria-label="Send"]',
        'button[data-testid="send-button"]',
        'button[data-testid="copilot-chat-send-button"]',
      ];
      for (const sel of scopedSelectors) {
        const el = form.querySelector(sel);
        if (el) return el;
      }
    }

    const selectors = [
      // ChatGPT
      'button[data-testid="send-button"]',
      // Claude
      'button[aria-label="Send Message"]',
      'button[aria-label="Send message"]',
      'button[aria-label="メッセージを送信"]',
      'button[aria-label*="送信"]',
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

  function submitMessage(inputEl) {
    const btn = findSubmitButton(inputEl);
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
      btn.click();
      return true;
    }

    // Claude を含む一部サイトでは form submit の方が安定する場合がある。
    const form = inputEl?.closest?.('form');
    if (form) {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
      return true;
    }

    return false;
  }

  /**
   * キャレット位置に改行を挿入する。
   *
   * - <textarea>: ネイティブセッターで value を直接書き換え（React の state と同期するため）、
   *   `input` イベントを発火する。
   * - contenteditable: Shift+Enter の keydown イベントをディスパッチし、
   *   リッチテキストエディタ（Claude は ProseMirror、Gemini は Quill など）に
   *   改行処理を委ねる。
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
      // contenteditable に Shift+Enter をディスパッチして、エディタ自身の
      // キーハンドラに改行処理を委ねる。
      // この合成イベントは isTrusted === false になるため、キャプチャリスナーの
      // `!event.isTrusted` ガードにより再インターセプトされず、無限ループを防ぐ。
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

    // 自分でディスパッチした合成イベント（isTrusted === false）は無視し、
    // contenteditable パスでの無限ループを防ぐ。
    if (!event.isTrusted) return;

    const inputEl = getInputElement(event);
    if (!inputEl) return;

    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl + Enter → メッセージを送信
      event.preventDefault();
      event.stopImmediatePropagation();
      submitMessage(inputEl);
    } else {
      // 通常 Enter または Shift+Enter → 改行を挿入
      event.preventDefault();
      event.stopImmediatePropagation();
      insertNewline(inputEl);
    }
  }

  // キャプチャフェーズで登録することで、サイト独自のリスナーより先に発火させる。
  document.addEventListener('keydown', handleKeydown, true);
})();
