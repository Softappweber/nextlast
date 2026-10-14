/* ============================================================
   SoloDS Pro — app.js
   PeerJS + WebRTC P2P. Cloudflare TURN + OpenRelay fallback.
   All logic: calls, chat, files (chunked, 200MB), voice notes,
   reactions, replies, vanish, captions, call reactions, themes.
   ============================================================ */

(() => {
  'use strict';

  /* -----------------------------------------------------------
     0. CONFIG
     ----------------------------------------------------------- */
  const CONFIG = {
    TURN_WORKER: 'https://shy-bar-bad0.softappweber.workers.dev/turn-credentials',
    OPENRELAY_FALLBACK: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    MAX_FILE_BYTES: 200 * 1024 * 1024,        // 200 MB
    MAX_VOICE_BYTES: 5 * 1024 * 1024,          // 5 MB
    SESSION_SOFT_CAP: 2 * 1024 * 1024 * 1024,  // 2 GB total transferred
    SESSION_WARN_AT: 1.5 * 1024 * 1024 * 1024, // 1.5 GB
    CHUNK_SIZE: 16 * 1024,                     // 16 KB per data-channel send
    HIGH_WATER: 1024 * 1024,                   // 1 MB buffered → pause
    LOW_WATER: 256 * 1024,                     // 256 KB buffered → resume
    VANISH_TTL_MS: 15000,
    CAPTION_LANG: 'en-US'
  };

  /* -----------------------------------------------------------
     1. DOM CACHE
     ----------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);
  const DOM = {
    // landing
    landingScreen:   $('landingScreen'),
    appScreen:       $('appScreen'),
    userName:        $('userName'),
    startBtn:        $('startBtn'),
    // topbar
    backBtn:         $('backBtn'),
    connPill:        $('connPill'),
    connText:        $('connText'),
    themeBtnMain:    $('themeBtnMain'),
    // partner hero
    partnerAvatar:   $('partnerAvatar'),
    partnerNameDisplay: $('partnerNameDisplay'),
    codeDisplay:     $('codeDisplay'),
    copyCodeBtn:     $('copyCodeBtn'),
    // connect bar
    peerIdInput:     $('peerIdInput'),
    connectBtn:      $('connectBtn'),
    // chat
    chatMessages:    $('chatMessages'),
    messageInput:    $('messageInput'),
    sendMessageBtn:  $('sendMessageBtn'),
    attachBtn:       $('attachBtn'),
    voiceBtn:        $('voiceBtn'),
    fileInput:       $('fileInput'),
    replyBar:        $('replyBar'),
    replyBarQuote:   $('replyBarQuote'),
    replyBarCancel:  $('replyBarCancel'),
    vanishToggle:    $('vanishToggle'),
    // call
    callButtonsIdle: $('callButtonsIdle'),
    startCallBtn:    $('startCallBtn'),
    callActive:      $('callActive'),
    callTimer:       $('callTimer'),
    muteBtn:         $('muteBtn'),
    toggleVideoBtn:  $('toggleVideoBtn'),
    shareScreenBtn:  $('shareScreenBtn'),
    raiseHandBtn:    $('raiseHandBtn'),
    hangupBtn:       $('hangupBtn'),
    callStatus:      $('callStatus'),
    callStatusText:  $('callStatusText'),
    // video
    captionsToggle:  $('captionsToggle'),
    captionsBox:     $('captionsBox'),
    localVideo:      $('localVideo'),
    remoteVideo:     $('remoteVideo'),
    videoOffline:    $('videoOffline'),
    remoteAudio:     $('remoteAudio'),
    // overlays
    emojiPicker:     $('emojiPicker'),
    reactionLayer:   $('reactionLayer'),
    toastContainer:  $('toastContainer'),
    // theme
    themeModal:      $('themeModal'),
    closeThemeModal: $('closeThemeModal')
  };

  /* -----------------------------------------------------------
     2. STATE
     ----------------------------------------------------------- */
  const state = {
    peer: null,
    conn: null,
    call: null,
    localStream: null,
    screenStream: null,
    remoteStream: null,
    selfName: 'You',
    connected: false,
    inCall: false,
    callStart: 0,
    callTimerInterval: null,
    vanishMode: false,
    captionsOn: false,
    captionsRec: null,
    mediaRecorder: null,
    recordingChunks: [],
    recordingStream: null,
    replyTarget: null,        // { id, preview }
    reactionTargetMsgId: null,
    raisedHand: false,
    sessionBytes: 0,
    sessionWarned: false,
    // file transfer
    outgoingTransfers: new Map(),  // id → { file, chunkIndex, paused, resolve }
    incomingTransfers: new Map(),  // id → { name, size, mime, chunks, received, el }
    // voice notes
    outgoingVoice: null
  };

  /* -----------------------------------------------------------
     3. UTILITIES
     ----------------------------------------------------------- */
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const fmtBytes = (n) => {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  };

  const fmtDuration = (s) => {
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  };

  function toast(text, kind = '') {
    if (!DOM.toastContainer) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    DOM.toastContainer.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  function setConn(text) {
    if (DOM.connText) DOM.connText.textContent = text;
  }

  function setCallStatus(text) {
    if (!DOM.callStatusText) return;
    DOM.callStatusText.textContent = text;
    DOM.callStatus?.classList.remove('hidden');
  }
  function hideCallStatus() {
    DOM.callStatus?.classList.add('hidden');
  }

  function scrollChat() {
    if (DOM.chatMessages) DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
  }

  function trackBytes(n) {
    state.sessionBytes += n;
    if (!state.sessionWarned && state.sessionBytes > CONFIG.SESSION_WARN_AT) {
      state.sessionWarned = true;
      toast('Session data warning: approaching 2 GB cap', 'error');
      sysMsg('Warning: 1.5 GB transferred this session.');
    }
    if (state.sessionBytes > CONFIG.SESSION_SOFT_CAP) {
      toast('Session data cap reached (2 GB). Restart to continue.', 'error');
      if (state.conn) state.conn.close();
    }
  }

  function sysMsg(text, incoming = false) {
    if (!DOM.chatMessages) return;
    const el = document.createElement('div');
    el.className = 'chat-system';
    el.textContent = text;
    DOM.chatMessages.appendChild(el);
    scrollChat();
  }

  function openThemeModal() { DOM.themeModal?.classList.remove('hidden'); }
  function closeThemeModal() { DOM.themeModal?.classList.add('hidden'); }

  function applyTheme(name) {
    document.documentElement.dataset.theme = name;
    try { localStorage.setItem('solods_pro_theme', name); } catch {}
  }

  /* -----------------------------------------------------------
     4. TURN CREDENTIALS
     ----------------------------------------------------------- */
  async function fetchIceServers() {
    try {
      const res = await fetch(CONFIG.TURN_WORKER, { cache: 'no-store' });
      if (!res.ok) throw new Error('TURN worker ' + res.status);
      const data = await res.json();
      if (Array.isArray(data.iceServers) && data.iceServers.length) return data.iceServers;
      if (data.urls) return [{ urls: data.urls, username: data.username, credential: data.credential }];
      throw new Error('Bad TURN payload');
    } catch (e) {
      console.warn('[TURN] fallback to OpenRelay', e);
      return CONFIG.OPENRELAY_FALLBACK;
    }
  }

  /* -----------------------------------------------------------
     5. PEER LIFECYCLE
     ----------------------------------------------------------- */
  async function createPeer() {
    if (state.peer) return state.peer;
    const iceServers = await fetchIceServers();
    const peer = new Peer(undefined, {
      debug: 1,
      config: { iceServers, sdpSemantics: 'unified-plan' }
    });
    state.peer = peer;

    peer.on('open', (id) => {
      if (DOM.codeDisplay) DOM.codeDisplay.textContent = id;
      setConn('Ready');
      console.log('[peer] open', id);
    });

    peer.on('connection', (conn) => {
      // Incoming conn from a caller — wire it
      wireConn(conn);
    });

    peer.on('call', (call) => {
      // Peer is calling us. Answer with local stream.
      if (!state.localStream) {
        // No stream yet → answer with empty stream (they'll get no video)
        call.answer();
      } else {
        call.answer(state.localStream);
      }
      wireCall(call);
    });

    peer.on('error', (err) => {
      console.error('[peer]', err);
      toast('Connection error: ' + (err.type || err.message), 'error');
      setConn('Error');
    });

    peer.on('disconnected', () => {
      setConn('Disconnected');
      try { peer.reconnect(); } catch {}
    });

    return peer;
  }

  async function connectToPeer(remoteId) {
    if (!state.peer) await createPeer();
    if (!remoteId || remoteId === state.peer.id) {
      toast('Invalid peer code', 'error');
      return;
    }
    setConn('Connecting…');
    const conn = state.peer.connect(remoteId, { reliable: true });
    wireConn(conn);
  }

  function wireConn(conn) {
    state.conn = conn;
    state.connected = false;

    conn.on('open', () => {
      state.connected = true;
      setConn('Connected');
      sysMsg('Peer connected');
      toast('Peer connected', 'success');

      // Exchange names
      sendRaw({ type: 'hello', name: state.selfName });
    });

    conn.on('data', handleIncoming);

    conn.on('close', () => {
      state.connected = false;
      setConn('Disconnected');
      sysMsg('Peer disconnected');
      toast('Peer disconnected');
      endCall(false);
      // Flush pending transfers
      state.outgoingTransfers.forEach((t) => { t.aborted = true; });
      state.outgoingTransfers.clear();
    });

    conn.on('error', (e) => console.warn('[conn]', e));
  }

  function sendRaw(obj) {
    if (!state.conn || !state.conn.open) return false;
    try {
      state.conn.send(obj);
      return true;
    } catch (e) {
      console.warn('[send]', e);
      return false;
    }
  }

  /* -----------------------------------------------------------
     6. DATA CHANNEL ROUTER
     ----------------------------------------------------------- */
  function handleIncoming(raw) {
    const msg = typeof raw === 'string' ? tryJSON(raw) : raw;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'hello':          return handleHello(msg);
      case 'message':        return renderMessage(msg, false);
      case 'reply':          return renderReply(msg, false);
      case 'reaction':       return applyReaction(msg);
      case 'voice-note':     return renderVoiceNote(msg, false);
      case 'vanish-toggle':  return applyVanishToggle(msg);
      case 'caption':        return renderCaption(msg, false);
      case 'call-reaction':  return renderCallReaction(msg, false);
      case 'file-start':     return handleFileStart(msg);
      case 'file-chunk':     return handleFileChunk(msg);
      case 'file-end':       return handleFileEnd(msg);
      case 'file-abort':     return handleFileAbort(msg);
      case 'call-request':   return handleCallRequest(msg);
      case 'call-accept':    return handleCallAccept(msg);
      case 'call-reject':    return handleCallReject(msg);
      default:               console.warn('[unknown msg]', msg.type);
    }
  }

  function tryJSON(s) { try { return JSON.parse(s); } catch { return null; } }

  function handleHello(msg) {
    if (msg.name) {
      if (DOM.partnerNameDisplay) DOM.partnerNameDisplay.textContent = msg.name;
      if (DOM.partnerAvatar) DOM.partnerAvatar.textContent = msg.name.charAt(0).toUpperCase();
    }
  }

  /* -----------------------------------------------------------
     7. LANDING FLOW
     ----------------------------------------------------------- */
  async function enterApp() {
    const name = (DOM.userName?.value || '').trim() || 'Anonymous';
    state.selfName = name;
    try { localStorage.setItem('solods_pro_name', name); } catch {}

    if (DOM.partnerNameDisplay) DOM.partnerNameDisplay.textContent = name;
    if (DOM.partnerAvatar) DOM.partnerAvatar.textContent = name.charAt(0).toUpperCase();

    DOM.landingScreen?.classList.add('hidden');
    DOM.appScreen?.classList.remove('hidden');

    try {
      await createPeer();
    } catch (e) {
      toast('Failed to init peer', 'error');
    }
  }

  function leaveApp() {
    endCall(true);
    try { state.conn?.close(); } catch {}
    try { state.peer?.destroy(); } catch {}
    state.peer = null;
    state.conn = null;
    DOM.appScreen?.classList.add('hidden');
    DOM.landingScreen?.classList.remove('hidden');
  }

  /* -----------------------------------------------------------
     8. CHAT: TEXT, FILES, REPLIES, REACTIONS
     ----------------------------------------------------------- */
  function sendChat() {
    const text = (DOM.messageInput?.value || '').trim();
    if (!text) return;
    if (!state.connected) { toast('Not connected', 'error'); return; }

    if (state.replyTarget) {
      const payload = {
        type: 'reply',
        id: uid(),
        replyTo: state.replyTarget.id,
        replyPreview: state.replyTarget.preview,
        text,
        ts: Date.now(),
        vanish: state.vanishMode
      };
      sendRaw(payload);
      renderReply(payload, true);
      clearReplyTarget();
    } else {
      const payload = {
        type: 'message',
        id: uid(),
        text,
        ts: Date.now(),
        vanish: state.vanishMode
      };
      sendRaw(payload);
      renderMessage(payload, true);
    }
    DOM.messageInput.value = '';
  }

  function renderMessage(msg, self) {
    if (!DOM.chatMessages) return;
    const el = document.createElement('div');
    el.className = 'chat-msg' + (self ? ' self' : '');
    el.dataset.id = msg.id;
    el.innerHTML = `
      <div class="bubble">${escapeHTML(msg.text)}</div>
      <div class="msg-meta">
        <button class="reply-btn" title="Reply">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M9 17l-6-6 6-6M3 11h12a6 6 0 016 6v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="reaction-slot"></div>
    `;
    wireMessageInteractions(el, msg.text.slice(0, 80), msg.id);
    DOM.chatMessages.appendChild(el);
    scheduleVanish(el, msg);
    scrollChat();
  }

  function renderReply(msg, self) {
    if (!DOM.chatMessages) return;
    const el = document.createElement('div');
    el.className = 'chat-msg reply' + (self ? ' self' : '');
    el.dataset.id = msg.id;
    el.innerHTML = `
      <div class="reply-quote">${escapeHTML(msg.replyPreview || '')}</div>
      <div class="bubble">${escapeHTML(msg.text)}</div>
      <div class="msg-meta">
        <button class="reply-btn" title="Reply">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M9 17l-6-6 6-6M3 11h12a6 6 0 016 6v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="reaction-slot"></div>
    `;
    wireMessageInteractions(el, msg.text.slice(0, 80), msg.id);
    DOM.chatMessages.appendChild(el);
    scheduleVanish(el, msg);
    scrollChat();
  }

  function wireMessageInteractions(el, preview, msgId) {
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openEmojiPicker(msgId, e.clientX, e.clientY);
    });
    el.querySelector('.reply-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setReplyTarget(msgId, preview);
    });
  }

  function setReplyTarget(id, preview) {
    state.replyTarget = { id, preview };
    if (DOM.replyBar && DOM.replyBarQuote) {
      DOM.replyBarQuote.textContent = preview;
      DOM.replyBar.classList.remove('hidden');
    }
    DOM.messageInput?.focus();
  }
  function clearReplyTarget() {
    state.replyTarget = null;
    DOM.replyBar?.classList.add('hidden');
  }

  /* -----------------------------------------------------------
     9. EMOJI PICKER (chat reactions)
     ----------------------------------------------------------- */
  const EMOJI_SET = ['👍','❤️','😂','😮','😢','🔥','🎉','👏','🙏','✅','💯','👀'];

  function openEmojiPicker(msgId, x, y) {
    if (!DOM.emojiPicker) return;
    state.reactionTargetMsgId = msgId;
    DOM.emojiPicker.innerHTML = '';
    EMOJI_SET.forEach((em) => {
      const b = document.createElement('button');
      b.className = 'emoji-choice';
      b.textContent = em;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const payload = { type: 'reaction', id: msgId, emoji: em, ts: Date.now() };
        if (state.connected) sendRaw(payload);
        applyReaction(payload);
        closeEmojiPicker();
      });
      DOM.emojiPicker.appendChild(b);
    });
    // Keep picker on-screen
    const pw = 260, ph = 200;
    const px = Math.min(x, window.innerWidth - pw - 10);
    const py = Math.min(y, window.innerHeight - ph - 10);
    DOM.emojiPicker.style.left = px + 'px';
    DOM.emojiPicker.style.top = py + 'px';
    DOM.emojiPicker.classList.add('open');
  }
  function closeEmojiPicker() {
    DOM.emojiPicker?.classList.remove('open');
    state.reactionTargetMsgId = null;
  }

  function applyReaction(msg) {
    const target = DOM.chatMessages?.querySelector(`[data-id="${msg.id}"] .reaction-slot`);
    if (!target) return;
    // Toggle: if same emoji exists, remove
    const existing = Array.from(target.children).find((c) => c.textContent === msg.emoji);
    if (existing) { existing.remove(); return; }
    const chip = document.createElement('span');
    chip.className = 'reaction-chip';
    chip.textContent = msg.emoji;
    target.appendChild(chip);
  }

  /* -----------------------------------------------------------
     10. VANISH MODE
     ----------------------------------------------------------- */
  function toggleVanish() {
    state.vanishMode = !state.vanishMode;
    DOM.vanishToggle?.classList.toggle('active', state.vanishMode);
    if (state.connected) {
      sendRaw({ type: 'vanish-toggle', on: state.vanishMode, ts: Date.now() });
    }
    sysMsg(state.vanishMode ? 'Vanish mode ON — new messages disappear after 15s' : 'Vanish mode OFF');
  }
  function applyVanishToggle(msg) {
    state.vanishMode = !!msg.on;
    DOM.vanishToggle?.classList.toggle('active', state.vanishMode);
    sysMsg(state.vanishMode ? 'Peer enabled vanish mode' : 'Peer disabled vanish mode');
  }
  function scheduleVanish(el, msg) {
    if (!msg.vanish) return;
    setTimeout(() => {
      el.style.transition = 'opacity 200ms ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }, CONFIG.VANISH_TTL_MS);
  }

  /* -----------------------------------------------------------
     11. FILE TRANSFER (chunked, 200 MB cap)
     ----------------------------------------------------------- */
  async function handleFile(file) {
    if (!file) return;
    if (!state.connected) { toast('Not connected', 'error'); return; }
    if (file.size > CONFIG.MAX_FILE_BYTES) {
      toast(`File too large — max ${fmtBytes(CONFIG.MAX_FILE_BYTES)}`, 'error');
      return;
    }

    const id = uid();
    const el = renderFileBubble({
      id,
      name: file.name,
      size: file.size,
      self: true
    }, 'sending');

    state.outgoingTransfers.set(id, {
      file,
      id,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      chunkIndex: 0,
      paused: false,
      aborted: false,
      el,
      progressFill: el.querySelector('.file-progress-fill'),
      statusEl: el.querySelector('.file-size')
    });

    sendRaw({
      type: 'file-start',
      id,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream'
    });

    pumpFile(id);
  }

  async function pumpFile(id) {
    const t = state.outgoingTransfers.get(id);
    if (!t || t.aborted) return;
    const { file } = t;

    while (t.chunkIndex * CONFIG.CHUNK_SIZE < file.size) {
      if (t.aborted) return;
      if (!state.conn || !state.conn.open) return;

      // Backpressure
      const buffered = state.conn.dataChannel?.bufferedAmount || 0;
      if (buffered > CONFIG.HIGH_WATER) {
        t.paused = true;
        await waitForDrain(state.conn.dataChannel);
        t.paused = false;
      }

      const start = t.chunkIndex * CONFIG.CHUNK_SIZE;
      const end = Math.min(start + CONFIG.CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const buf = await slice.arrayBuffer();

      sendRaw({
        type: 'file-chunk',
        id,
        seq: t.chunkIndex,
        data: new Uint8Array(buf)
      });

      t.chunkIndex++;
      const sent = Math.min(t.chunkIndex * CONFIG.CHUNK_SIZE, file.size);
      updateProgress(t.progressFill, sent / file.size);
    }

    sendRaw({ type: 'file-end', id });
    if (t.statusEl) t.statusEl.textContent = fmtBytes(file.size) + ' · sent';
    state.outgoingTransfers.delete(id);
  }

  function waitForDrain(dc) {
    return new Promise((resolve) => {
      if (!dc) return resolve();
      const check = () => {
        if (!dc || dc.bufferedAmount < CONFIG.LOW_WATER) return resolve();
        dc.bufferedAmountLowThreshold = CONFIG.LOW_WATER;
        dc.addEventListener('bufferedamountlow', () => resolve(), { once: true });
      };
      check();
    });
  }

  function handleFileStart(msg) {
    const el = renderFileBubble({
      id: msg.id,
      name: msg.name,
      size: msg.size,
      self: false
    }, 'receiving');
    state.incomingTransfers.set(msg.id, {
      id: msg.id,
      name: msg.name,
      size: msg.size,
      mime: msg.mime,
      received: 0,
      chunks: [],
      el,
      progressFill: el.querySelector('.file-progress-fill'),
      statusEl: el.querySelector('.file-size')
    });
  }

  function handleFileChunk(msg) {
    const t = state.incomingTransfers.get(msg.id);
    if (!t) return;
    // data may arrive as Uint8Array or ArrayBuffer
    const chunk = msg.data instanceof Uint8Array ? msg.data : new Uint8Array(msg.data);
    t.chunks.push(chunk);
    t.received += chunk.byteLength;
    trackBytes(chunk.byteLength);
    updateProgress(t.progressFill, t.received / t.size);
  }

  function handleFileEnd(msg) {
    const t = state.incomingTransfers.get(msg.id);
    if (!t) return;
    const blob = new Blob(t.chunks, { type: t.mime });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = t.name;
    link.textContent = 'Download';
    link.className = 'file-download';

    // Replace status with download link
    const bubble = t.el.querySelector('.bubble');
    const fileInfo = bubble.querySelector('.file-info');
    if (fileInfo) {
      t.statusEl.textContent = fmtBytes(t.size) + ' · ready';
      fileInfo.appendChild(link);
    }
    // Clicking the bubble also triggers download
    bubble.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') return;
      link.click();
    });
    bubble.style.cursor = 'pointer';

    updateProgress(t.progressFill, 1);
    state.incomingTransfers.delete(msg.id);
  }

  function handleFileAbort(msg) {
    const t = state.outgoingTransfers.get(msg.id) || state.incomingTransfers.get(msg.id);
    if (!t) return;
    t.aborted = true;
    state.outgoingTransfers.delete(msg.id);
    state.incomingTransfers.delete(msg.id);
    if (t.el) t.el.style.opacity = '0.5';
    if (t.statusEl) t.statusEl.textContent = 'aborted';
  }

  function renderFileBubble({ id, name, size, self }, mode) {
    const el = document.createElement('div');
    el.className = 'chat-msg file' + (self ? ' self' : '');
    el.dataset.id = id;
    el.innerHTML = `
      <div class="bubble file-bubble">
        <div class="file-row">
          <div class="file-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <path d="M14 2v6h6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="file-info">
            <div class="file-name">${escapeHTML(name)}</div>
            <div class="file-size">${fmtBytes(size)} · ${mode}</div>
          </div>
        </div>
        <div class="file-progress">
          <div class="file-progress-fill"></div>
        </div>
      </div>
    `;
    DOM.chatMessages.appendChild(el);
    scrollChat();
    return el;
  }

  function updateProgress(fillEl, ratio) {
    if (!fillEl) return;
    const pct = Math.max(0, Math.min(1, ratio)) * 100;
    fillEl.style.width = pct.toFixed(1) + '%';
  }

  /* -----------------------------------------------------------
     12. VOICE NOTES (press-and-hold)
     ----------------------------------------------------------- */
  function pickAudioMime() {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return candidates.find((t) => window.MediaRecorder?.isTypeSupported(t)) || '';
  }

  async function startVoiceRecording() {
    if (!state.connected) { toast('Not connected', 'error'); return; }
    if (state.mediaRecorder) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.recordingStream = stream;
      state.recordingChunks = [];

      const mime = pickAudioMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      state.mediaRecorder = rec;

      rec.ondataavailable = (e) => {
        if (e.data.size) state.recordingChunks.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(state.recordingChunks, { type: rec.mimeType || 'audio/webm' });
        stopRecordingStream();
        state.mediaRecorder = null;
        state.recordingChunks = [];
        DOM.voiceBtn?.classList.remove('recording');

        if (blob.size < 800) return; // too short, ignore
        if (blob.size > CONFIG.MAX_VOICE_BYTES) {
          toast('Voice note too large (5 MB cap)', 'error');
          return;
        }
        await sendVoiceNote(blob);
      };

      rec.start();
      DOM.voiceBtn?.classList.add('recording');
      toast('Recording… release to send');
    } catch (e) {
      console.warn('[voice]', e);
      toast('Mic permission denied', 'error');
    }
  }

  function stopVoiceRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      try { state.mediaRecorder.stop(); } catch {}
    }
  }

  function stopRecordingStream() {
    state.recordingStream?.getTracks().forEach((t) => t.stop());
    state.recordingStream = null;
  }

  async function sendVoiceNote(blob) {
    const id = uid();
    // Show locally first
    renderVoiceNote({ id, mime: blob.type, data: URL.createObjectURL(blob), localUrl: true, ts: Date.now() }, true);

    const buf = await blob.arrayBuffer();
    sendRaw({
      type: 'voice-note',
      id,
      mime: blob.type,
      size: buf.byteLength,
      data: new Uint8Array(buf)
    });
    trackBytes(buf.byteLength);
  }

  function renderVoiceNote(msg, self) {
    if (!DOM.chatMessages) return;
    const el = document.createElement('div');
    el.className = 'chat-msg voice' + (self ? ' self' : '');
    el.dataset.id = msg.id;

    let src;
    if (msg.localUrl) {
      src = msg.data; // object URL
    } else {
      // data is Uint8Array or ArrayBuffer
      const bytes = msg.data instanceof Uint8Array ? msg.data : new Uint8Array(msg.data);
      const blob = new Blob([bytes], { type: msg.mime || 'audio/webm' });
      src = URL.createObjectURL(blob);
    }

    el.innerHTML = `
      <div class="bubble voice-bubble">
        <audio controls preload="metadata" src="${src}"></audio>
      </div>
    `;
    DOM.chatMessages.appendChild(el);
    scrollChat();
  }

  /* -----------------------------------------------------------
     13. LIVE CAPTIONS
     ----------------------------------------------------------- */
  function initCaptions() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast('Live captions not supported in this browser', 'error');
      return null;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = CONFIG.CAPTION_LANG;

    rec.onresult = (e) => {
      let finalText = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      if (finalText) {
        const payload = { type: 'caption', text: finalText.trim(), final: true, ts: Date.now() };
        if (state.connected) sendRaw(payload);
        renderCaption({ ...payload, self: true }, true);
      } else if (interim && DOM.captionsBox) {
        DOM.captionsBox.textContent = interim;
      }
    };
    rec.onerror = (e) => console.warn('[captions]', e.error);
    rec.onend = () => {
      if (state.captionsOn) { try { rec.start(); } catch {} }
    };
    return rec;
  }

  function toggleCaptions() {
    state.captionsOn = !state.captionsOn;
    DOM.captionsToggle?.classList.toggle('active', state.captionsOn);
    DOM.captionsBox?.classList.toggle('hidden', !state.captionsOn);

    if (state.captionsOn) {
      if (!state.captionsRec) state.captionsRec = initCaptions();
      try { state.captionsRec?.start(); } catch {}
      toast('Live captions on');
    } else {
      try { state.captionsRec?.stop(); } catch {}
      if (DOM.captionsBox) DOM.captionsBox.textContent = '';
      toast('Live captions off');
    }
  }

  function renderCaption(msg, self) {
    if (!DOM.captionsBox || !state.captionsOn) return;
    if (!msg.final) {
      DOM.captionsBox.textContent = msg.text;
      return;
    }
    DOM.captionsBox.textContent = (self ? 'You: ' : 'Peer: ') + msg.text;
    setTimeout(() => {
      if (DOM.captionsBox && DOM.captionsBox.textContent.endsWith(msg.text)) {
        DOM.captionsBox.textContent = '';
      }
    }, 3000);
  }

  /* -----------------------------------------------------------
     14. CALL REACTIONS + RAISE HAND
     ----------------------------------------------------------- */
  function sendCallReaction(emoji) {
    const payload = { type: 'call-reaction', emoji, ts: Date.now() };
    if (state.connected) sendRaw(payload);
    renderCallReaction({ ...payload, self: true }, true);
  }

  function renderCallReaction(msg, self) {
    if (!DOM.reactionLayer) return;
    const el = document.createElement('div');
    el.className = 'float-emoji';
    el.textContent = msg.emoji;
    el.style.left = (10 + Math.random() * 80) + '%';
    el.style.bottom = '0';
    DOM.reactionLayer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('rise'));
    setTimeout(() => el.remove(), 2400);
  }

  function toggleRaiseHand() {
    state.raisedHand = !state.raisedHand;
    DOM.raiseHandBtn?.classList.toggle('active', state.raisedHand);
    sendCallReaction(state.raisedHand ? '✋' : '👋');
  }

  /* -----------------------------------------------------------
     15. CALL LIFECYCLE
     ----------------------------------------------------------- */
  async function ensureLocalStream() {
    if (state.localStream) return state.localStream;
    try {
      state.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      if (DOM.localVideo) DOM.localVideo.srcObject = state.localStream;
      return state.localStream;
    } catch (e) {
      console.warn('[media]', e);
      toast('Camera/mic permission denied', 'error');
      throw e;
    }
  }

  async function startCall() {
    if (!state.connected) { toast('Connect to a peer first', 'error'); return; }
    if (state.inCall) { toast('Already in call'); return; }

    await ensureLocalStream();
    if (DOM.videoOffline) DOM.videoOffline.classList.add('hidden');

    // Asymmetric: whoever clicks Start Call is the "offerer"
    sendRaw({ type: 'call-request', ts: Date.now() });

    setCallStatus('Calling…');
    DOM.callButtonsIdle?.classList.add('hidden');

    // Start the actual WebRTC call
    const call = state.peer.call(state.conn.peer, state.localStream);
    wireCall(call);
  }

  function handleCallRequest() {
    // Peer wants to call. Auto-accept (they already clicked Start).
    ensureLocalStream().then(() => {
      if (DOM.videoOffline) DOM.videoOffline.classList.add('hidden');
      setCallStatus('Connecting…');
      DOM.callButtonsIdle?.classList.add('hidden');
    }).catch(() => {});
  }

  function handleCallAccept() {
    setCallStatus('Connecting…');
  }
  function handleCallReject() {
    toast('Call rejected');
    endCall();
  }

  function wireCall(call) {
    state.call = call;

    call.on('stream', (remoteStream) => {
      state.remoteStream = remoteStream;
      if (DOM.remoteVideo) {
        DOM.remoteVideo.srcObject = remoteStream;
        DOM.remoteVideo.play().catch(() => {});
      }
      // Also wire audio through remoteAudio element (in case video is muted)
      if (DOM.remoteAudio) DOM.remoteAudio.srcObject = remoteStream;

      enterCallUI();
    });

    call.on('close', () => {
      endCall();
    });

    call.on('error', (e) => {
      console.warn('[call]', e);
      toast('Call error: ' + e.message, 'error');
      endCall();
    });
  }

  function enterCallUI() {
    if (state.inCall) return;
    state.inCall = true;
    state.callStart = Date.now();
    hideCallStatus();
    DOM.callActive?.classList.remove('hidden');
    DOM.callButtonsIdle?.classList.add('hidden');
    if (DOM.videoOffline) DOM.videoOffline.classList.add('hidden');
    sysMsg('Call started');

    state.callTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.callStart) / 1000);
      if (DOM.callTimer) DOM.callTimer.textContent = fmtDuration(elapsed);
    }, 1000);
  }

  function endCall(notify = true) {
    if (state.callTimerInterval) {
      clearInterval(state.callTimerInterval);
      state.callTimerInterval = null;
    }
    if (state.inCall) sysMsg('Call ended');
    state.inCall = false;

    try { state.call?.close(); } catch {}
    state.call = null;

    if (DOM.remoteVideo) DOM.remoteVideo.srcObject = null;
    if (DOM.remoteAudio) DOM.remoteAudio.srcObject = null;
    if (DOM.callTimer) DOM.callTimer.textContent = '00:00';

    DOM.callActive?.classList.add('hidden');
    DOM.callButtonsIdle?.classList.remove('hidden');
    hideCallStatus();

    // Stop screen share if running
    if (state.screenStream) {
      state.screenStream.getTracks().forEach((t) => t.stop());
      state.screenStream = null;
      DOM.shareScreenBtn?.classList.remove('active');
    }

    state.raisedHand = false;
    DOM.raiseHandBtn?.classList.remove('active');
  }

  function toggleMute() {
    const t = state.localStream?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    DOM.muteBtn?.classList.toggle('active', !t.enabled);
  }

  function toggleCamera() {
    const t = state.localStream?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    DOM.toggleVideoBtn?.classList.toggle('active', !t.enabled);
    if (DOM.videoOffline) DOM.videoOffline.classList.toggle('hidden', t.enabled);
  }

  async function toggleScreenShare() {
    if (!state.inCall) { toast('Start a call first', 'error'); return; }
    if (state.screenStream) {
      // Stop
      state.screenStream.getTracks().forEach((t) => t.stop());
      state.screenStream = null;
      DOM.shareScreenBtn?.classList.remove('active');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      state.screenStream = s;
      const track = s.getVideoTracks()[0];

      // Replace outgoing video track
      const sender = state.call?.peerConnection
        ?.getSenders()
        ?.find((sn) => sn.track && sn.track.kind === 'video');
      if (sender) await sender.replaceTrack(track);

      // Show locally too
      if (DOM.localVideo) DOM.localVideo.srcObject = s;

      track.onended = () => {
        DOM.shareScreenBtn?.classList.remove('active');
        state.screenStream = null;
        // Restore camera
        const camTrack = state.localStream?.getVideoTracks()[0];
        if (sender && camTrack) sender.replaceTrack(camTrack);
        if (DOM.localVideo) DOM.localVideo.srcObject = state.localStream;
      };

      DOM.shareScreenBtn?.classList.add('active');
    } catch (e) {
      console.warn('[share]', e);
    }
  }

  /* -----------------------------------------------------------
     16. MOBILE TABS
     ----------------------------------------------------------- */
  function bindMobileTabs() {
    document.querySelectorAll('.mobile-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.mobile-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.querySelectorAll('.panel').forEach((p) => {
          p.classList.toggle('mobile-active', p.dataset.panel === target);
        });
      });
    });
    // Default: chat active
    document.querySelector('.panel-chat')?.classList.add('mobile-active');
  }

  /* -----------------------------------------------------------
     17. UI BINDINGS
     ----------------------------------------------------------- */
  function bindUI() {
    // Landing
    DOM.startBtn?.addEventListener('click', enterApp);
    DOM.userName?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); enterApp(); }
    });

    // Topbar
    DOM.backBtn?.addEventListener('click', leaveApp);
    DOM.themeBtnMain?.addEventListener('click', openThemeModal);
    DOM.closeThemeModal?.addEventListener('click', closeThemeModal);
    DOM.themeModal?.addEventListener('click', (e) => {
      if (e.target === DOM.themeModal) closeThemeModal();
    });
    document.querySelectorAll('.theme-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        applyTheme(opt.dataset.themeChoice);
        closeThemeModal();
      });
    });

    // Copy code
    DOM.copyCodeBtn?.addEventListener('click', () => {
      const code = DOM.codeDisplay?.textContent;
      if (!code || code === '—') return;
      navigator.clipboard.writeText(code).then(() => toast('Code copied', 'success'));
    });

    // Connect
    DOM.connectBtn?.addEventListener('click', () => {
      const id = (DOM.peerIdInput?.value || '').trim();
      if (!id) return toast('Paste a peer code first', 'error');
      connectToPeer(id);
    });
    DOM.peerIdInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); DOM.connectBtn?.click(); }
    });

    // Chat
    DOM.sendMessageBtn?.addEventListener('click', sendChat);
    DOM.messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
    DOM.attachBtn?.addEventListener('click', () => DOM.fileInput?.click());
    DOM.fileInput?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      e.target.value = '';
    });
    DOM.replyBarCancel?.addEventListener('click', clearReplyTarget);
    DOM.vanishToggle?.addEventListener('click', toggleVanish);

    // Voice note: press-and-hold
    const vBtn = DOM.voiceBtn;
    if (vBtn) {
      vBtn.addEventListener('mousedown', (e) => { e.preventDefault(); startVoiceRecording(); });
      vBtn.addEventListener('mouseup', (e) => { e.preventDefault(); stopVoiceRecording(); });
      vBtn.addEventListener('mouseleave', () => stopVoiceRecording());
      vBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecording(); }, { passive: false });
      vBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecording(); }, { passive: false });
    }

    // Call
    DOM.startCallBtn?.addEventListener('click', startCall);
    DOM.muteBtn?.addEventListener('click', toggleMute);
    DOM.toggleVideoBtn?.addEventListener('click', toggleCamera);
    DOM.shareScreenBtn?.addEventListener('click', toggleScreenShare);
    DOM.raiseHandBtn?.addEventListener('click', toggleRaiseHand);
    DOM.hangupBtn?.addEventListener('click', () => endCall());

    // Captions
    DOM.captionsToggle?.addEventListener('click', toggleCaptions);

    // Call reactions quick bar
    document.querySelectorAll('.reaction-quick').forEach((btn) => {
      btn.addEventListener('click', () => sendCallReaction(btn.dataset.reaction));
    });

    // Global click closes emoji picker
    document.addEventListener('click', (e) => {
      if (DOM.emojiPicker && DOM.emojiPicker.classList.contains('open')
          && !DOM.emojiPicker.contains(e.target)) {
        closeEmojiPicker();
      }
    });

    // Prevent default context menu on message bubbles (only inside chat)
    DOM.chatMessages?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.chat-msg')) e.preventDefault();
    });

    bindMobileTabs();
  }

  /* -----------------------------------------------------------
     18. BOOT
     ----------------------------------------------------------- */
  function boot() {
    // Restore theme
    let savedTheme = 'midnight';
    try { savedTheme = localStorage.getItem('solods_pro_theme') || 'midnight'; } catch {}
    applyTheme(savedTheme);

    // Restore name
    try {
      const savedName = localStorage.getItem('solods_pro_name');
      if (savedName && DOM.userName) DOM.userName.value = savedName;
    } catch {}

    bindUI();
    console.log('[SoloDS Pro] ready');
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();

})();
