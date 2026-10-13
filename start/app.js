/* ============================================================
   SoloDS v16 — Premium Edition
   ============================================================ */

/* ============================================================
   🔐 APPROVED IDS
   ============================================================ */

const APPROVED_IDS = [
  'vikaas66',
  'sushant',
  'chinu'
];

/* ============================================================
   ICE CONFIG
   ============================================================ */

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

/* ============================================================
   STATE
   ============================================================ */

let myName = '';
let partnerName = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let callTimerInterval = null;
let callStartTime = 0;
let micMuted = false;
let videoEnabled = false;
let isSavedPartner = false;
let ringtoneCtx = null;
let ringtoneInterval = null;
let currentTheme = 'obsidian';

let myPublicSlug = '';
let myPublicPeer = null;
let isOnline = false;
let incomingPeerCall = null;
let isCallerMode = false;
let callerTargetSlug = '';
let callerPeer = null;
let peerIsStarting = false;

let incomingFileChunks = [];
let incomingFileSize = 0;
let incomingFileName = '';
let incomingFileType = '';
let isReceivingFile = false;
const CHUNK_SIZE = 16 * 1024;
const MAX_FILE_SIZE = 500 * 1024 * 1024;

let screenStream = null;
let isScreenSharing = false;

/* ============================================================
   DOM
   ============================================================ */

const $ = id => document.getElementById(id);

const homeScreen = $('homeScreen');
const callerScreen = $('callerScreen');
const mainScreen = $('mainScreen');

const contactsList = $('contactsList');
const emptyState = $('emptyState');

const statusCard = $('statusCard');
const statusDot = $('statusDot');
const statusLabel = $('statusLabel');
const statusSub = $('statusSub');
const goOnlineBtn = $('goOnlineBtn');

const backBtn = $('backBtn');
const connPill = $('connPill');
const connText = $('connText');
const chatChip = $('chatChip');

const chatMessages = $('chatMessages');
const messageInput = $('messageInput');
const sendMessageBtn = $('sendMessageBtn');
const attachBtn = $('attachBtn');
const fileInput = $('fileInput');

const callButtonsIdle = $('callButtonsIdle');
const callButtonsIncoming = $('callButtonsIncoming');
const callActive = $('callActive');
const startCallBtn = $('startCallBtn');
const acceptCallBtn = $('acceptCallBtn');
const rejectCallBtn = $('rejectCallBtn');
const hangupBtn = $('hangupBtn');
const muteMicBtn = $('muteMicBtn');
const shareScreenBtn = $('shareScreenBtn');
const callTimer = $('callTimer');
const callStatusText = $('callStatusText');

const remoteVideo = $('remoteVideo');
const localVideo = $('localVideo');
const videoOffline = $('videoOffline');
const toggleVideoBtn = $('toggleVideoBtn');
const remoteAudio = $('remoteAudio');

const menuBtn = $('menuBtn');
const menuDropdown = $('menuDropdown');
const resetBtn = $('resetBtn');

const themeBtnHome = $('themeBtnHome');
const themeBtnMain = $('themeBtnMain');
const themeModal = $('themeModal');
const closeThemeModal = $('closeThemeModal');

const toastContainer = $('toastContainer');

const callerStatus = $('callerStatus');
const callerCallBtn = $('callerCallBtn');
const callerVideoBtn = $('callerVideoBtn');
const callerCancelBtn = $('callerCancelBtn');

const incomingCallModal = $('incomingCallModal');
const incomingName = $('incomingName');
const incomingAcceptBtn = $('incomingAcceptBtn');
const incomingRejectBtn = $('incomingRejectBtn');

/* ============================================================
   THEME
   ============================================================ */

function loadTheme() {
  const saved = localStorage.getItem('solods_theme') || 'obsidian';
  currentTheme = saved;
  document.body.setAttribute('data-theme', saved);
  updateThemeActive();
}

function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('solods_theme', theme);
  updateThemeActive();
}

function updateThemeActive() {
  document.querySelectorAll('.theme-tile').forEach(t => {
    t.classList.toggle('active', t.dataset.themeChoice === currentTheme);
  });
}

function openTheme() { themeModal.classList.remove('hidden'); }
function closeTheme() { themeModal.classList.add('hidden'); }

themeBtnHome?.addEventListener('click', openTheme);
themeBtnMain?.addEventListener('click', openTheme);
closeThemeModal?.addEventListener('click', closeTheme);
themeModal?.addEventListener('click', (e) => { if (e.target === themeModal) closeTheme(); });

document.querySelectorAll('.theme-tile').forEach(t => {
  t.addEventListener('click', () => {
    setTheme(t.dataset.themeChoice);
    setTimeout(closeTheme, 200);
  });
});

/* ============================================================
   TOASTS
   ============================================================ */

function showToast(msg, type = 'info', duration = 3200) {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(20px)';
    t.style.transition = 'all 0.24s';
    setTimeout(() => t.remove(), 240);
  }, duration);
}

/* ============================================================
   INIT
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadContacts();
  setupMobileNav();
  checkURLMode();
});

function checkURLMode() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  let target = params.get('call');
  if (!target && hash.startsWith('#call=')) target = hash.substring(6);
  if (target) enterCallerMode(target.toLowerCase());
}

/* ============================================================
   HOST
   ============================================================ */

goOnlineBtn?.addEventListener('click', async () => {
  if (peerIsStarting) return;
  if (isOnline) goOffline();
  else await goOnline();
});

async function goOnline() {
  const entered = prompt('Enter your SoloDS ID:');
  if (!entered) return;

  const name = entered.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!APPROVED_IDS.includes(name)) {
    showToast('Invalid ID. Contact SoloDS.', 'error', 4000);
    return;
  }

  myName = name;
  myPublicSlug = name;
  peerIsStarting = true;
  goOnlineBtn.disabled = true;
  const span = goOnlineBtn.querySelector('span');
  if (span) span.textContent = 'Connecting...';

  try {
    if (myPublicPeer) {
      try { myPublicPeer.destroy(); } catch {}
      myPublicPeer = null;
      await new Promise(r => setTimeout(r, 400));
    }

    const peerId = 'solods-' + myPublicSlug;

    myPublicPeer = new Peer(peerId, { debug: 1, config: ICE_CONFIG });

    myPublicPeer.on('open', () => {
      peerIsStarting = false;
      isOnline = true;
      updateOnlineUI(true);
      goOnlineBtn.disabled = false;
      if (span) span.textContent = 'Go Offline';
      showToast('You are online', 'success');
    });

    myPublicPeer.on('call', (call) => {
      incomingPeerCall = call;
      showIncomingCall(call.metadata?.name || 'Someone');
      startRingtone();
    });

    myPublicPeer.on('connection', (conn) => {
      dataChannel = conn;
      setupPeerDataChannel();
    });

    myPublicPeer.on('error', (err) => {
      console.error('Peer error:', err);
      peerIsStarting = false;
      if (err.type === 'unavailable-id') showToast('ID already online elsewhere', 'error');
      else if (err.type === 'network') showToast('Network error', 'error');
      else showToast('Error: ' + err.type, 'error');
      goOffline();
    });

    myPublicPeer.on('disconnected', () => {
      setTimeout(() => {
        if (myPublicPeer && !myPublicPeer.destroyed) {
          try { myPublicPeer.reconnect(); } catch {}
        }
      }, 2000);
    });

  } catch (e) {
    console.error(e);
    peerIsStarting = false;
    showToast('Failed to go online', 'error');
    goOnlineBtn.disabled = false;
    if (span) span.textContent = 'Go Online';
  }
}

function goOffline() {
  peerIsStarting = false;
  if (myPublicPeer) { try { myPublicPeer.destroy(); } catch {} myPublicPeer = null; }
  isOnline = false;
  updateOnlineUI(false);
  if (goOnlineBtn) {
    goOnlineBtn.disabled = false;
    const span = goOnlineBtn.querySelector('span');
    if (span) span.textContent = 'Go Online';
  }
}

function updateOnlineUI(online) {
  if (!statusCard) return;
  if (online) {
    statusCard.classList.add('online');
    statusDot.classList.add('online');
    statusLabel.textContent = 'Online';
    statusSub.textContent = 'Receiving calls';
  } else {
    statusCard.classList.remove('online');
    statusDot.classList.remove('online');
    statusLabel.textContent = 'Offline';
    statusSub.textContent = 'Not receiving calls';
  }
}

/* ============================================================
   CALLER
   ============================================================ */

function enterCallerMode(slug) {
  isCallerMode = true;
  callerTargetSlug = slug;

  homeScreen.classList.add('hidden');
  callerScreen.classList.remove('hidden');
  callerStatus.textContent = 'Establishing secure channel…';

  const callerId = 'solods-c-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

  callerPeer = new Peer(callerId, { debug: 1, config: ICE_CONFIG });

  callerPeer.on('open', () => {
    callerStatus.textContent = 'Ready to connect';
    callerCallBtn.disabled = false;
    callerVideoBtn.disabled = false;
  });

  callerPeer.on('error', (err) => {
    console.error('Caller error:', err);
    if (err.type === 'peer-unavailable') {
      callerStatus.textContent = 'This user is offline';
      showToast('User is offline', 'error');
    } else {
      callerStatus.textContent = 'Connection error';
    }
  });
}

callerCallBtn?.addEventListener('click', () => startCall(false));
callerVideoBtn?.addEventListener('click', () => startCall(true));

async function startCall(withVideo) {
  if (!callerPeer) return;
  callerStatus.textContent = 'Requesting microphone…';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: withVideo ? { width: 640, height: 480 } : false
    });

    if (withVideo) videoEnabled = true;
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
    callerStatus.textContent = 'Connecting…';

    const peerId = 'solods-' + callerTargetSlug;

    const call = callerPeer.call(peerId, localStream, {
      metadata: { name: callerTargetSlug }
    });

    if (!call) {
      showToast('Call failed', 'error');
      callerStatus.textContent = 'Call failed';
      return;
    }

    incomingPeerCall = call;

    call.on('stream', (stream) => {
      remoteStream = stream;
      remoteAudio.srcObject = stream;

      if (stream.getVideoTracks().length > 0) {
        remoteVideo.srcObject = stream;
        videoOffline.classList.add('hidden');
      }

      callerScreen.classList.add('hidden');
      mainScreen.classList.remove('hidden');
      partnerName = callerTargetSlug;

      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);

      setConnPill(true);
      startCallUI();
      addSystemMsg('Connected');
      showToast('Connected', 'success');
    });

    call.on('close', () => {
      endCall();
      goBackHome();
    });

  } catch (e) {
    console.error(e);
    if (e.name === 'NotAllowedError') callerStatus.textContent = 'Mic access needed';
    else callerStatus.textContent = 'Call failed';
  }
}

callerCancelBtn?.addEventListener('click', () => {
  if (callerPeer) { try { callerPeer.destroy(); } catch {} callerPeer = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  isCallerMode = false;
  callerScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
});

/* ============================================================
   INCOMING
   ============================================================ */

function showIncomingCall(name) {
  incomingName.textContent = APPROVED_IDS.includes(name.toLowerCase()) ? name : 'Someone';
  incomingCallModal.classList.remove('hidden');
}

incomingAcceptBtn?.addEventListener('click', async () => {
  stopRingtone();
  incomingCallModal.classList.add('hidden');
  if (!incomingPeerCall) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });
    localStream.getAudioTracks().forEach(t => { t.enabled = true; });
    incomingPeerCall.answer(localStream);

    incomingPeerCall.on('stream', (stream) => {
      remoteStream = stream;
      remoteAudio.srcObject = stream;

      if (stream.getVideoTracks().length > 0) {
        remoteVideo.srcObject = stream;
        videoOffline.classList.add('hidden');
      }

      homeScreen.classList.add('hidden');
      mainScreen.classList.remove('hidden');

      partnerName = 'Guest';
      setConnPill(true);
      startCallUI();
      addSystemMsg('Call started');
    });

    incomingPeerCall.on('close', () => {
      endCall();
      if (isOnline) {
        homeScreen.classList.remove('hidden');
        mainScreen.classList.add('hidden');
      } else {
        goBackHome();
      }
    });

  } catch (e) {
    console.error(e);
    showToast('Failed to accept', 'error');
  }
});

incomingRejectBtn?.addEventListener('click', () => {
  stopRingtone();
  incomingCallModal.classList.add('hidden');
  if (incomingPeerCall) {
    try { incomingPeerCall.close(); } catch {}
    incomingPeerCall = null;
  }
});

/* ============================================================
   PEER DATA CHANNEL
   ============================================================ */

function setupPeerDataChannel() {
  if (!dataChannel) return;
  dataChannel.on('open', () => addSystemMsg('Chat ready'));
  dataChannel.on('data', (data) => {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      handleDataMessage(parsed);
    } catch {
      addMessage(data, 'received');
    }
  });
  dataChannel.on('close', () => addSystemMsg('Connection closed'));
}

function sendViaDataChannel(data) {
  if (dataChannel && dataChannel.open) {
    dataChannel.send(typeof data === 'string' ? data : JSON.stringify(data));
    return true;
  }
  return false;
}

/* ============================================================
   CONTACTS
   ============================================================ */

function getContacts() {
  try { return JSON.parse(localStorage.getItem('solods_contacts') || '[]'); }
  catch { return []; }
}

function loadContacts() {
  const contacts = getContacts();
  if (contacts.length === 0) {
    contactsList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  contactsList.innerHTML = '';
  contacts.sort((a, b) => b.lastConnected - a.lastConnected);
  contacts.forEach(c => {
    const row = document.createElement('div');
    row.className = 'contact-row';
    row.innerHTML = `
      <div class="contact-avatar">${(c.name || '?').charAt(0).toUpperCase()}</div>
      <div class="contact-meta">
        <div class="contact-name">${esc(c.name)}</div>
        <div class="contact-sub">${c.slug ? '@' + esc(c.slug) : timeAgo(c.lastConnected)}</div>
      </div>
      <svg class="contact-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    row.addEventListener('click', () => {
      if (c.slug) enterCallerMode(c.slug);
    });
    contactsList.appendChild(row);
  });
}

function timeAgo(ts) {
  if (!ts) return 'Never';
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

/* ============================================================
   MOBILE NAV
   ============================================================ */

function setupMobileNav() {
  const items = document.querySelectorAll('.mobile-nav-item');
  const panes = document.querySelectorAll('.pane');
  if (window.innerWidth <= 900) {
    document.querySelector('.pane-chat')?.classList.add('active-pane');
  }
  items.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.dataset.tab;
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      panes.forEach(p => {
        p.classList.remove('active-pane');
        if (p.dataset.pane === target) p.classList.add('active-pane');
      });
    });
  });
}

/* ============================================================
   CHAT
   ============================================================ */

sendMessageBtn?.addEventListener('click', sendMessage);
messageInput?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'message', text }));
    addMessage(text, 'sent');
    messageInput.value = '';
  } else if (sendViaDataChannel({ type: 'message', text })) {
    addMessage(text, 'sent');
    messageInput.value = '';
  }
}

function addMessage(text, type) {
  const d = document.createElement('div');
  d.className = 'message ' + type;
  d.textContent = text;
  chatMessages.appendChild(d);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMsg(text) {
  const d = document.createElement('div');
  d.className = 'message system';
  d.textContent = text;
  chatMessages.appendChild(d);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ============================================================
   FILE SHARING
   ============================================================ */

attachBtn?.addEventListener('click', () => fileInput.click());
fileInput?.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) sendFile(f);
  fileInput.value = '';
});

async function sendFile(file) {
  if (file.size > MAX_FILE_SIZE) { showToast('File too large (max 500MB)', 'error'); return; }

  const start = JSON.stringify({ type: 'file-start', name: file.name, size: file.size, mimeType: file.type });
  if (!(dataChannel?.readyState === 'open') && !sendViaDataChannel(start)) {
    showToast('Not connected', 'error'); return;
  }

  try {
    if (dataChannel?.readyState === 'open') dataChannel.send(start);
    await new Promise(r => setTimeout(r, 150));

    const buf = await file.arrayBuffer();
    let off = 0, idx = 0;

    const msg = document.createElement('div');
    msg.className = 'message sent';
    msg.textContent = 'Sending ' + file.name + '...';
    chatMessages.appendChild(msg);

    while (off < buf.byteLength) {
      const chunk = buf.slice(off, off + CHUNK_SIZE);
      const b64 = bufToB64(chunk);
      const payload = JSON.stringify({ type: 'file-chunk', data: b64, index: idx });
      if (dataChannel?.readyState === 'open') dataChannel.send(payload);
      else sendViaDataChannel(payload);
      off += CHUNK_SIZE;
      idx++;
      if (idx % 10 === 0) await new Promise(r => setTimeout(r, 10));
    }

    const end = JSON.stringify({ type: 'file-end', name: file.name, size: file.size, mimeType: file.type, totalChunks: idx });
    if (dataChannel?.readyState === 'open') dataChannel.send(end);
    else sendViaDataChannel(end);

    msg.textContent = 'Sent: ' + file.name;
    showToast('File sent', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to send', 'error');
  }
}

function bufToB64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function handleFileStart(data) {
  incomingFileChunks = [];
  incomingFileSize = data.size;
  incomingFileName = data.name;
  incomingFileType = data.mimeType;
  isReceivingFile = true;

  const msg = document.createElement('div');
  msg.className = 'message received';
  msg.id = 'recv-file';
  msg.textContent = 'Receiving ' + data.name + '...';
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleFileChunk(data) {
  if (!isReceivingFile) return;
  incomingFileChunks.push(data.data);
}

function handleFileEnd(data) {
  isReceivingFile = false;
  const msg = document.getElementById('recv-file');
  if (msg) msg.remove();

  try {
    const buffers = incomingFileChunks.map(b64ToBuf);
    const blob = new Blob(buffers, { type: data.mimeType });
    const url = URL.createObjectURL(blob);

    const div = document.createElement('div');
    div.className = 'message received';

    const isImg = data.mimeType.startsWith('image/');
    const isVid = data.mimeType.startsWith('video/');

    if (isImg) {
      div.innerHTML = `<div>${esc(data.name)}</div><img src="${url}" style="max-width:100%;border-radius:8px;margin-top:6px;">`;
    } else if (isVid) {
      div.innerHTML = `<div>${esc(data.name)}</div><video src="${url}" controls style="max-width:100%;border-radius:8px;margin-top:6px;"></video>`;
    } else {
      div.innerHTML = `<div>${esc(data.name)}</div><a href="${url}" download="${esc(data.name)}" style="color:inherit;font-weight:600;font-size:12px;">Download</a>`;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    showToast('File received', 'success');
  } catch (e) {
    console.error(e);
  }
  incomingFileChunks = [];
}

/* ============================================================
   RINGTONE
   ============================================================ */

function startRingtone() {
  try {
    stopRingtone();
    ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
    const play = () => {
      if (!ringtoneCtx) return;
      const t = ringtoneCtx.currentTime;
      [0, 0.2, 0.4].forEach(o => {
        const osc = ringtoneCtx.createOscillator();
        const g = ringtoneCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        g.gain.setValueAtTime(0, t + o);
        g.gain.linearRampToValueAtTime(0.15, t + o + 0.02);
        g.gain.linearRampToValueAtTime(0, t + o + 0.15);
        osc.connect(g);
        g.connect(ringtoneCtx.destination);
        osc.start(t + o);
        osc.stop(t + o + 0.2);
      });
    };
    play();
    ringtoneInterval = setInterval(play, 2000);
  } catch (e) {}
}

function stopRingtone() {
  if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null; }
  if (ringtoneCtx) { try { ringtoneCtx.close(); } catch {} ringtoneCtx = null; }
}

/* ============================================================
   CALLS
   ============================================================ */

startCallBtn?.addEventListener('click', () => {
  if (!dataChannel || dataChannel.readyState !== 'open') return;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
  micMuted = false;
  muteMicBtn.classList.remove('muted');
  muteMicBtn.querySelector('span').textContent = 'Mute';
  dataChannel.send(JSON.stringify({ type: 'call-request' }));
  callButtonsIdle.classList.add('hidden');
  callButtonsIncoming.classList.remove('hidden');
  callStatusText.textContent = 'Calling…';
  isInCall = true;
});

acceptCallBtn?.addEventListener('click', () => {
  stopRingtone();
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
  micMuted = false;
  muteMicBtn.classList.remove('muted');
  micMuted = false;
  dataChannel.send(JSON.stringify({ type: 'call-accept' }));
  startCallUI();
});

rejectCallBtn?.addEventListener('click', () => {
  stopRingtone();
  dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  callButtonsIncoming.classList.add('hidden');
  callButtonsIdle.classList.remove('hidden');
});

function startCallUI() {
  stopRingtone();
  callButtonsIdle.classList.add('hidden');
  callButtonsIncoming.classList.add('hidden');
  callActive.classList.remove('hidden');
  callStartTime = Date.now();
  callTimer.textContent = '00:00';
  if (callTimerInterval) clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    const el = Math.floor((Date.now() - callStartTime) / 1000);
    const m = String(Math.floor(el / 60)).padStart(2, '0');
    const s = String(el % 60).padStart(2, '0');
    callTimer.textContent = `${m}:${s}`;
  }, 1000);
  isInCall = true;
  addSystemMsg('Call started');
}

muteMicBtn?.addEventListener('click', () => {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !micMuted);
  if (micMuted) {
    muteMicBtn.classList.add('muted');
    muteMicBtn.querySelector('span').textContent = 'Unmute';
  } else {
    muteMicBtn.classList.remove('muted');
    muteMicBtn.querySelector('span').textContent = 'Mute';
  }
});

hangupBtn?.addEventListener('click', () => {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'call-end' }));
  }
  if (incomingPeerCall) { try { incomingPeerCall.close(); } catch {} incomingPeerCall = null; }
  endCall();
});

function endCall() {
  stopRingtone();
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = false; });
  micMuted = true;
  if (muteMicBtn) {
    muteMicBtn.classList.add('muted');
    muteMicBtn.querySelector('span').textContent = 'Mute';
  }
  if (videoEnabled && localStream) {
    localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
    localVideo.srcObject = null;
    videoEnabled = false;
    toggleVideoBtn.classList.remove('active');
    toggleVideoBtn.querySelector('span').textContent = 'Turn on';
  }
  if (isScreenSharing && screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
    isScreenSharing = false;
    shareScreenBtn.classList.remove('active');
  }
  callActive.classList.add('hidden');
  callButtonsIncoming.classList.add('hidden');
  callButtonsIdle.classList.remove('hidden');
  isInCall = false;
}

/* ============================================================
   VIDEO
   ============================================================ */

toggleVideoBtn?.addEventListener('click', async () => {
  if (!videoEnabled) {
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      const track = vs.getVideoTracks()[0];
      if (!localStream) localStream = new MediaStream();
      localStream.addTrack(track);
      if (peerConnection) peerConnection.addTrack(track, localStream);
      else if (incomingPeerCall && incomingPeerCall.peerConnection) incomingPeerCall.peerConnection.addTrack(track, localStream);
      localVideo.srcObject = localStream;
      videoOffline.classList.add('hidden');
      videoEnabled = true;
      toggleVideoBtn.classList.add('active');
      toggleVideoBtn.querySelector('span').textContent = 'Turn off';
      if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify({ type: 'video-request' }));
    } catch (e) {
      showToast('Camera denied', 'error');
    }
  } else {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
    }
    localVideo.srcObject = null;
    videoEnabled = false;
    toggleVideoBtn.classList.remove('active');
    toggleVideoBtn.querySelector('span').textContent = 'Turn on';
    if (!remoteVideo.srcObject || remoteVideo.srcObject.getVideoTracks().length === 0) {
      videoOffline.classList.remove('hidden');
    }
  }
});

/* ============================================================
   SCREEN SHARE
   ============================================================ */

shareScreenBtn?.addEventListener('click', async () => {
  if (isScreenSharing) {
    if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; }
    isScreenSharing = false;
    shareScreenBtn.classList.remove('active');
    return;
  }
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = screenStream.getVideoTracks()[0];
    if (peerConnection) {
      const senders = peerConnection.getSenders();
      const vs = senders.find(s => s.track && s.track.kind === 'video');
      if (vs) await vs.replaceTrack(track);
      else peerConnection.addTrack(track, screenStream);
    }
    localVideo.srcObject = screenStream;
    isScreenSharing = true;
    shareScreenBtn.classList.add('active');
    track.onended = () => {
      isScreenSharing = false;
      shareScreenBtn.classList.remove('active');
      localVideo.srcObject = localStream;
    };
  } catch (e) {
    showToast('Screen share cancelled', 'error');
  }
});

/* ============================================================
   MENU / RESET
   ============================================================ */

menuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('hidden');
});
document.addEventListener('click', () => menuDropdown?.classList.add('hidden'));

resetBtn?.addEventListener('click', () => {
  if (confirm('Disconnect and return home?')) { cleanup(); goBackHome(); }
});
backBtn?.addEventListener('click', () => {
  if (confirm('Disconnect and return home?')) { cleanup(); goBackHome(); }
});

function cleanup() {
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  if (screenStream) screenStream.getTracks().forEach(t => t.stop());
  if (peerConnection) { try { peerConnection.close(); } catch {} }
  if (incomingPeerCall) { try { incomingPeerCall.close(); } catch {} }
  if (callTimerInterval) clearInterval(callTimerInterval);
  stopRingtone();
  peerConnection = null;
  dataChannel = null;
  localStream = null;
  remoteStream = null;
  incomingPeerCall = null;
  isInCall = false;
  micMuted = false;
  videoEnabled = false;
  isScreenSharing = false;
  screenStream = null;
  incomingFileChunks = [];
  isReceivingFile = false;
}

function goBackHome() {
  mainScreen.classList.add('hidden');
  callerScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  setConnPill(false);
  loadContacts();
}

function setConnPill(connected) {
  if (connected) {
    connPill.classList.add('connected');
    connText.textContent = 'Connected';
  } else {
    connPill.classList.remove('connected');
    connText.textContent = 'Connecting';
  }
}

console.log('SoloDS v16 loaded');
