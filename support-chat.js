(() => {
  if (new URLSearchParams(location.search).has('editor-preview')) return;
  if (document.querySelector('#jzSupportWidget')) return;

  const STORAGE_KEY = 'jz-visitor-support';
  const state = {
    open: false,
    loading: false,
    conversation: null,
    session: readSession(),
    lastSeenAdminMessage: 0,
    pollTimer: null
  };

  const icon = (name) => {
    const paths = {
      chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/>',
      close: '<path d="m18 6-12 12M6 6l12 12"/>',
      send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      arrow: '<path d="m9 18 6-6-6-6"/>',
      check: '<path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
      plus: '<path d="M12 5v14M5 12h14"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  };

  const widget = document.createElement('aside');
  widget.id = 'jzSupportWidget';
  widget.className = 'jz-support-widget';
  widget.innerHTML = `
    <section class="jz-support-panel" id="jzSupportPanel" aria-hidden="true" aria-label="Visitor support">
      <header class="jz-support-header">
        <div class="jz-support-avatar">JZ<span></span></div>
        <div><strong>Visitor support</strong><span>Send a complaint or question</span></div>
        <button class="jz-support-close" type="button" aria-label="Close support">${icon('close')}</button>
      </header>
      <div class="jz-support-content" id="jzSupportContent"></div>
    </section>
    <button class="jz-support-launcher" type="button" aria-controls="jzSupportPanel" aria-expanded="false">
      <span class="jz-support-launcher-icon">${icon('chat')}</span>
      <span class="jz-support-launcher-copy"><strong>Need help?</strong><small>Talk to JZ</small></span>
      <b class="jz-support-badge" aria-label="New admin reply" hidden>1</b>
    </button>`;
  document.body.append(widget);

  if (!document.querySelector('link[href="support-chat.css"]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = 'support-chat.css';
    document.head.append(stylesheet);
  }

  const panel = widget.querySelector('#jzSupportPanel');
  const content = widget.querySelector('#jzSupportContent');
  const launcher = widget.querySelector('.jz-support-launcher');
  const badge = widget.querySelector('.jz-support-badge');

  function readSession() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return value?.conversationId && value?.visitorToken ? value : null;
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    state.session = session;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
  }

  function clearSession() {
    state.session = null;
    state.conversation = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Support is temporarily unavailable.');
    return result;
  }

  function setOpen(open) {
    state.open = open;
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    launcher.setAttribute('aria-expanded', String(open));
    widget.classList.toggle('panel-open', open);
    if (open) {
      badge.hidden = true;
      state.lastSeenAdminMessage = adminMessageCount();
      setTimeout(() => content.querySelector('input,textarea,button')?.focus(), 180);
      scrollMessages();
    }
  }

  function renderStart(error = '') {
    content.innerHTML = `
      <div class="jz-support-intro">
        <span class="jz-support-overline">Direct to the admin</span>
        <h2>How can we help?</h2>
        <p>Tell us what happened. Your message and the admin reply will stay available in this browser.</p>
      </div>
      <form class="jz-support-form" id="jzSupportStartForm">
        <label>Your name<input name="name" maxlength="80" autocomplete="name" required placeholder="How should we address you?"></label>
        <label>Email <small>Optional</small><input name="email" type="email" maxlength="150" autocomplete="email" placeholder="For a reply outside this chat"></label>
        <label>What is this about?
          <select name="subject">
            <option>General complaint</option>
            <option>Order or delivery</option>
            <option>Academy access</option>
            <option>Payment or refund</option>
            <option>Website problem</option>
            <option>Other question</option>
          </select>
        </label>
        <label>Message<textarea name="message" rows="4" maxlength="2000" required placeholder="Describe the problem and how we can help."></textarea></label>
        <p class="jz-support-error" role="alert">${escapeHtml(error)}</p>
        <button class="jz-support-submit" type="submit"><span>Send to admin</span>${icon('send')}</button>
      </form>
      <p class="jz-support-privacy">Private support conversation · Do not send card numbers or passwords.</p>`;
    content.querySelector('#jzSupportStartForm').addEventListener('submit', startConversation);
  }

  function renderConversation(error = '') {
    const conversation = state.conversation;
    if (!conversation) return renderStart(error);
    const messages = conversation.messages || [];
    const status = String(conversation.status || 'open').replace('-', ' ');
    const closed = conversation.status === 'closed';
    content.innerHTML = `
      <div class="jz-conversation-top">
        <div><span class="jz-support-overline">${escapeHtml(conversation.subject || 'Support')}</span><strong>${escapeHtml(conversation.visitorName || conversation.name || 'Visitor')}</strong></div>
        <span class="jz-conversation-status ${escapeHtml(conversation.status || 'open')}">${escapeHtml(status)}</span>
      </div>
      <div class="jz-message-list" id="jzSupportMessages" role="log" aria-live="polite"></div>
      ${closed ? `<div class="jz-conversation-closed">${icon('check')}<div><strong>Conversation ${escapeHtml(status)}</strong><span>You can start another message if you still need help.</span></div></div><button class="jz-new-conversation" type="button">${icon('plus')} Start another conversation</button>` : `<form class="jz-reply-form" id="jzVisitorReplyForm"><textarea name="message" rows="2" maxlength="2000" required aria-label="Reply to admin" placeholder="Write a follow-up…"></textarea><button type="submit" aria-label="Send reply">${icon('send')}</button></form>`}
      <p class="jz-support-error" role="alert">${escapeHtml(error)}</p>`;
    const messageList = content.querySelector('#jzSupportMessages');
    messages.forEach((message) => messageList.append(createMessage(message)));
    content.querySelector('#jzVisitorReplyForm')?.addEventListener('submit', sendVisitorReply);
    content.querySelector('.jz-new-conversation')?.addEventListener('click', () => { clearSession(); renderStart(); });
    scrollMessages();
  }

  function createMessage(message) {
    const fromAdmin = ['admin', 'owner', 'staff'].includes(String(message.sender || message.role || message.author || '').toLowerCase());
    const item = document.createElement('article');
    item.className = `jz-message ${fromAdmin ? 'admin' : 'visitor'}`;
    const label = document.createElement('span');
    label.textContent = fromAdmin ? 'JZ Admin' : 'You';
    const copy = document.createElement('p');
    copy.textContent = message.message || message.text || '';
    const time = document.createElement('time');
    const value = message.createdAt || message.at;
    time.textContent = value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    item.append(label, copy, time);
    return item;
  }

  async function startConversation(event) {
    event.preventDefault();
    if (state.loading) return;
    state.loading = true;
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    button.querySelector('span').textContent = 'Sending…';
    try {
      const fields = new FormData(form);
      const result = await request('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          name: fields.get('name'),
          email: fields.get('email'),
          subject: fields.get('subject'),
          message: fields.get('message'),
          page: `${location.pathname}${location.search}`
        })
      });
      saveSession({ conversationId: result.conversationId, visitorToken: result.visitorToken });
      state.conversation = result.conversation;
      renderConversation();
      beginPolling();
    } catch (error) {
      renderStart(error.message);
    } finally {
      state.loading = false;
    }
  }

  async function sendVisitorReply(event) {
    event.preventDefault();
    if (state.loading) return;
    state.loading = true;
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const message = new FormData(form).get('message');
      const result = await request(`/api/complaints/${encodeURIComponent(state.session.conversationId)}/messages`, {
        method: 'POST',
        headers: { 'X-Visitor-Token': state.session.visitorToken },
        body: JSON.stringify({ message })
      });
      state.conversation = result.conversation || result;
      renderConversation();
    } catch (error) {
      renderConversation(error.message);
    } finally {
      state.loading = false;
    }
  }

  async function loadConversation(silent = false) {
    if (!state.session) return renderStart();
    try {
      const result = await request(`/api/complaints/${encodeURIComponent(state.session.conversationId)}`, { headers: { 'X-Visitor-Token': state.session.visitorToken } });
      const previousAdminMessages = adminMessageCount();
      state.conversation = result.conversation || result;
      const nextAdminMessages = adminMessageCount();
      if (!state.open && nextAdminMessages > Math.max(previousAdminMessages, state.lastSeenAdminMessage)) badge.hidden = false;
      renderConversation();
      if (state.open) state.lastSeenAdminMessage = nextAdminMessages;
    } catch (error) {
      if (!silent) {
        if (/not found|invalid|expired|access/i.test(error.message)) clearSession();
        renderStart(error.message);
      }
    }
  }

  function adminMessageCount() {
    return (state.conversation?.messages || []).filter((message) => ['admin', 'owner', 'staff'].includes(String(message.sender || message.role || message.author || '').toLowerCase())).length;
  }

  function beginPolling() {
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => {
      if (!document.hidden && state.session) loadConversation(true);
    }, 10000);
  }

  function scrollMessages() {
    requestAnimationFrame(() => {
      const list = content.querySelector('#jzSupportMessages');
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  function escapeHtml(value) {
    const node = document.createElement('span');
    node.textContent = String(value || '');
    return node.innerHTML;
  }

  launcher.addEventListener('click', () => setOpen(!state.open));
  widget.querySelector('.jz-support-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.open) setOpen(false); });

  if (state.session) loadConversation();
  else renderStart();
  beginPolling();
})();
