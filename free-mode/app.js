/* ============================================================
   SoloDS Free Demo — app.js
   5-min session · 1 MB file cap · 3-layer device lock
   Upgrade → https://softappweber.github.io/nextlast/website/
   ============================================================ */

const DEV_BYPASS = false;

const DEMO_LIMIT_SECONDS = 5 * 60;
const DEMO_STORAGE_KEY = 'solods_demo_v1';
const DEMO_DB_NAME = 'solods_demo_db';
const DEMO_COOKIE_NAME = 'solods_demo_fp';
const MAX_FILE_SIZE = 1 * 1024 * 1024;
const CHUNK_SIZE = 16 * 1024;
const UPGRADE_URL = 'https://softappweber.github.io/nextlast/website/';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
  ]
};

let myName = '';
let demoSessionId = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let callTimerInterval = null;
let callStartTime = 0;
let micMuted = false;
let videoEnabled = false;
let ringtoneCtx = null;
let ringtoneInterval = null;
let currentTheme = 'midnight';
let demoPeer = null;
let currentCall = null;
let sessionActive = false;
let demoStartTime = 0;
let demoInterval = null;
let fingerprint = '';
let isCallerMode = false;

let incomingFileChunks = [];
let incomingFileSize = 0;
let isReceivingFile = false;
let screenStream = null;
let isScreenSharing = false;

/* ============================================================
   FINGERPRINT
   ============================================================ */

async function generateFingerprint() {
  const components = [
    navigator.userAgent || '',
    navigator.language || '',
    navigator.languages ? navigator.languages.join(',') : '',
    screen.width + 'x' + screen.height,
    screen.colorDepth || '',
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || '',
    navigator.platform || '',
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    canvasFp(),
    webglFp()
  ];
  return (await sha256(components.join('|'))).substring(0, 24);
}

function canvasFp() {
  try {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 50;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = '#069';
    ctx.fillText('SoloDS-fp-2026', 2, 15);
    return c.toDataURL().substring(0, 100);
  } catch (e) { return 'canvas-na'; }
}

function webglFp() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return 'webgl-na';
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    if (d) return gl.getParameter(d.UNMASKED_VENDOR_WEBGL) + '|' + gl.getParameter(d.UNMASKED_RENDERER_WEBGL);
    return 'webgl-no-debug';
  } catch (e) { return 'webgl-na'; }
}

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
   INDEXEDDB
   ============================================================ */

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DEMO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('demo')) db.createObjectStore('demo', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key) {
  try {
    const db = await openDB();
    return new Promise(res => {
      const tx = db.transaction('demo', 'readonly');
      const r = tx.objectStore('demo').get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    });
  } catch { return null; }
}

async function dbSet(key, value) {
  try {
    const db = await openDB();
    return new Promise(res => {
      const tx = db.transaction('demo', 'readwrite');
      tx.objectStore('demo').put({ id: key, ...value });
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  } catch { return false; }
}

/* ============================================================
   COOKIE
   ============================================================ */

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const parts = document.cookie.split(';');
  for (const p of parts) {
    const [k, v] = p.trim().split('=');
    if (k === name) return decodeURIComponent(v || '');
  }
  return '';
}

/* ============================================================
   DEMO STATE
   ============================================================ */

async function checkDemoStatus() {
  fingerprint = await generateFingerprint();

  if (DEV_BYPASS) {
    return { used: false, tamper: false, fingerprint };
  }

  let lsData = null;
  try { lsData = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || 'null'); } catch {}

  const dbData = await dbGet('main');
  const cookieFp = getCookie(DEMO_COOKIE_NAME);

  const used = (lsData && lsData.used === true) ||
               (dbData && dbData.used === true) ||
               (cookieFp === fingerprint);

  let tamper = false;
  if (lsData && lsData.firstSeen && Date.now() < lsData.firstSeen) tamper = true;
  if (dbData && dbData.firstSeen && Date.now() < dbData.firstSeen) tamper = true;

  return { used, tamper, fingerprint };
}

async function markDemoUsed() {
  if (DEV_BYPASS) return;

  const now = Date.now();
  const existing = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || 'null');
  const existingDb = await dbGet('main');

  const data = {
    used: true,
    fingerprint,
    firstSeen: (existing && existing.firstSeen) || (existingDb && existingDb.firstSeen) || now,
    completedAt: now
  };

  try { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data)); } catch {}
  await dbSet('main', data);
  setCookie(DEMO_COOKIE_NAME, fingerprint, 3650);
}

/* ============================================================
   INIT
   ============================================================ */

window.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  setupMobileTabs();

  const params = new URLSearchParams(window.location.search);
  isCallerMode = !!params.get('call');

  if (!isCallerMode) {
    const status = await checkDemoStatus();
    if (status.used || status.tamper) {
      document.getElementById('blockedBox').classList.remove('hidden');
      document.getElementById('startBox').classList.add('hidden');
    }
  }

  document.getElementById('startBtn').addEventListener('click', startDemo);
  document.getElementById('userName').addEventListener('keypress', e => {
    if (e.key === 'Enter') startDemo();
  });
  document.getElementById('backBtn').addEventListener('click', () => {
    if (confirm('End demo and return home?')) {
      cleanup();
      if (isCallerMode) {
        window.location.href = window.location.pathname;
      } else {
        endDemo('manual');
      }
    }
  });
  document.getElementById('closeThemeModal').addEventListener('click', closeThemeModal);
  document.getElementById('themeBtnMain').addEventListener('click', openThemeModal);
  document.getElementById('closeUpgrade').addEventListener('click', () => {
    document.getElementById('upgradeModal').classList.add('hidden');
    location.reload();
  });

  bindAppEvents();

  if (isCallerMode) {
    autoJoinAsCaller();
  }
});

/* ============================================================
   THEME
   ============================================================ */

function loadTheme() {
  const saved = localStorage.getItem('solods_theme') || 'midnight';
  currentTheme = saved;
  document.body.setAttribute('data-theme', saved);
}

function openThemeModal() {
  document.getElementById('themeModal').classList.remove('hidden');
  updateThemeActive();
}
function closeThemeModal() {
  document.getElementById('themeModal').classList.add('hidden');
}
function updateThemeActive() {
  document.querySelectorAll('.theme-option').forEach(o => {
    o.classList.toggle('active', o.dataset.themeChoice === currentTheme);
  });
}

document.querySelectorAll('.theme-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = btn.dataset.themeChoice;
    currentTheme = t;
    document.body.setAttribute('data-theme', t);
    try { localStorage.setItem('solods_theme', t); } catch {}
    updateThemeActive();
  });
});

/* ============================================================
   CALLER AUTO-JOIN
   ============================================================ */

async function autoJoinAsCaller() {
  const params = new URLSearchParams(window.location.search);
  const targetId = (params.get('call') || '').trim().toLowerCase();
  if (!targetId) return;

  document.getElementById('landingScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('partnerNameDisplay').textContent = 'Caller';
  document.getElementById('partnerAvatar').textContent = 'C';

  const banner = document.getElementById('demoBanner');
  if (banner) banner.classList.add('hidden');

  const startCallBtn = document.getElementById('startCallBtn');
  if (startCallBtn) {
    startCallBtn.style.display = 'none';
  }

  addSystemMessage('Connecting to ' + targetId + '…');
  setConnStatus('Requesting microphone…');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });
    localStream.getAudioTracks().forEach(t => { t.enabled = true; });
  } catch (e) {
    console.error('Mic error:', e);
    addSystemMessage('Microphone access needed to call');
    setConnStatus('Mic blocked');
    showToast('Allow microphone and refresh', 'error', 6000);

    const chatPanel = document.querySelector('.panel-chat .chat-messages');
    if (chatPanel) {
      const retry = document.createElement('div');
      retry.className = 'message system';
      retry.textContent = 'Tap here to retry microphone access';
      retry.style.cursor = 'pointer';
      retry.style.textDecoration = 'underline';
      retry.addEventListener('click', () => {
        location.reload();
      });
      chatPanel.appendChild(retry);
    }
    return;
  }

  setConnStatus('Calling…');

  try {
    const peerId = 'solods-demo-' + targetId;
    const callerPeerId = 'solods-caller-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    demoPeer = new Peer(callerPeerId, { debug: 1, config: ICE_CONFIG });

    demoPeer.on('open', () => {
      const call = demoPeer.call(peerId, localStream);
      if (!call) {
        addSystemMessage('Could not reach host');
        setConnStatus('Offline');
        return;
      }
      currentCall = call;

      call.on('stream', (stream) => {
        remoteStream = stream;
        document.getElementById('remoteAudio').srcObject = stream;
        if (stream.getVideoTracks().length > 0) {
          document.getElementById('remoteVideo').srcObject = stream;
          document.getElementById('videoOffline').classList.add('hidden');
        }
        startCallUI();
        addSystemMessage('Connected');
        setConnStatus('Connected');
      });

      call.on('close', () => {
        endCall();
        addSystemMessage('Call ended');
        setConnStatus('Offline');
      });

      const conn = demoPeer.connect(peerId);
      if (conn) {
        dataChannel = conn;
        setupPeerDataChannel();
      }
    });

    demoPeer.on('error', (err) => {
      console.error('Caller peer error:', err);
      if (err.type === 'peer-unavailable') {
        addSystemMessage('Host is offline — ask them to start their demo');
        showToast('Host is offline', 'error', 5000);
        setConnStatus('Offline');
      } else {
        addSystemMessage('Connection error: ' + err.type);
        setConnStatus('Error');
      }
    });

  } catch (e) {
    console.error(e);
    addSystemMessage('Connection failed');
    setConnStatus('Error');
  }
}

/* ============================================================
   START DEMO (HOST)
   ============================================================ */

async function startDemo() {
  const name = document.getElementById('userName').value.trim();
  if (!name || name.length < 2) {
    showToast('Enter your name', 'error');
    return;
  }

  myName = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  const status = await checkDemoStatus();
  if (status.used || status.tamper) {
    document.getElementById('blockedBox').classList.remove('hidden');
    document.getElementById('startBox').classList.add('hidden');
    return;
  }

  const tag = Math.random().toString(36).substring(2, 6);
  demoSessionId = myName + '-' + tag;

  document.getElementById('landingScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('partnerNameDisplay').textContent = myName;
  document.getElementById('partnerAvatar').textContent = myName.charAt(0).toUpperCase();
  document.getElementById('demoBanner').classList.remove('hidden');

  const shareUrl = window.location.origin + window.location.pathname + '?call=' + demoSessionId;

  addShareIdBlock(demoSessionId, shareUrl);

  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('Demo link copied — send to your friend', 'success', 5000);
  } catch (e) {
    showToast('Tap the ID box to copy', 'info', 4000);
  }

  demoStartTime = Date.now();
  sessionActive = true;
  startDemoTimer();

  try {
    const peerId = 'solods-demo-' + demoSessionId;
    demoPeer = new Peer(peerId, { debug: 1, config: ICE_CONFIG });

    demoPeer.on('open', () => {
      setConnStatus('Online');
      addSystemMessage('You are online. Waiting for friend to join…');
    });

    demoPeer.on('error', (err) => {
      console.error('Peer error:', err);
      setConnStatus('Offline');
      if (err.type === 'unavailable-id') {
        addSystemMessage('ID conflict. Restart the demo.');
      }
    });

    demoPeer.on('call', (call) => {
      currentCall = call;
      document.getElementById('callButtonsIdle').classList.add('hidden');
      document.getElementById('callButtonsIncoming').classList.remove('hidden');
      document.getElementById('callStatus').classList.remove('hidden');
      document.getElementById('callStatusText').textContent = 'Incoming call';
      startRingtone();
    });

    demoPeer.on('connection', (conn) => {
      dataChannel = conn;
      setupPeerDataChannel();
    });

  } catch (e) {
    console.error(e);
    addSystemMessage('Connection failed. Try refreshing.');
  }
}

/* ============================================================
   DEMO TIMER
   ============================================================ */

function startDemoTimer() {
  if (demoInterval) clearInterval(demoInterval);
  demoInterval = setInterval(() => {
    if (!sessionActive) return;
    const elapsed = Math.floor((Date.now() - demoStartTime) / 1000);
    const remaining = Math.max(0, DEMO_LIMIT_SECONDS - elapsed);
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const str = m + ':' + String(s).padStart(2, '0');

    const banner = document.getElementById('demoBanner');
    const timeEl = document.getElementById('demoTime');
    if (timeEl) timeEl.textContent = str;
    if (banner) banner.classList.toggle('warning', remaining <= 60);

    if (remaining <= 0) endDemo('timeout');
  }, 1000);
}

async function endDemo(reason) {
  if (!sessionActive) return;
  sessionActive = false;

  if (demoInterval) { clearInterval(demoInterval); demoInterval = null; }
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }

  await markDemoUsed();
  cleanup();

  const banner = document.getElementById('demoBanner');
  if (banner) banner.classList.add('hidden');

  const modal = document.getElementById('upgradeModal');
  if (modal) modal.classList.remove('hidden');
}

/* ============================================================
   PEER DATA
   ============================================================ */

function setupPeerDataChannel() {
  if (!dataChannel) return;
  dataChannel.on('open', () => addSystemMessage('Chat ready'));
  dataChannel.on('data', (data) => {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      handleDataMessage(parsed);
    } catch {
      addMessage(data, 'received');
    }
  });
  dataChannel.on('close', () => addSystemMessage('Connection closed'));
}

function handleDataMessage(data) {
  if (data.type === 'message') addMessage(data.text, 'received');
  else if (data.type === 'file-start') handleFileStart(data);
  else if (data.type === 'file-chunk') handleFileChunk(data);
  else if (data.type === 'file-end') handleFileEnd(data);
}

/* ============================================================
   APP EVENTS
   ============================================================ */

function bindAppEvents() {
  document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
  });
  document.getElementById('attachBtn').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) sendFile(f);
    e.target.value = '';
  });

  document.getElementById('startCallBtn').addEventListener('click', () => {
    showToast('Share your demo link with a friend to test', 'info');
  });
  document.getElementById('acceptCallBtn').addEventListener('click', acceptIncomingCall);
  document.getElementById('rejectCallBtn').addEventListener('click', () => {
    stopRingtone();
    if (currentCall) { try { currentCall.close(); } catch {} currentCall = null; }
    document.getElementById('callButtonsIncoming').classList.add('hidden');
    document.getElementById('callButtonsIdle').classList.remove('hidden');
    document.getElementById('callStatus').classList.add('hidden');
  });
  document.getElementById('hangupBtn').addEventListener('click', () => {
    if (currentCall) { try { currentCall.close(); } catch {} currentCall = null; }
    endCall();
  });
  document.getElementById('muteMicBtn').addEventListener('click', () => {
    if (!localStream) return;
    micMuted = !micMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !micMuted);
    const btn = document.getElementById('muteMicBtn');
    btn.classList.toggle('muted', micMuted);
    btn.querySelector('span').textContent = micMuted ? 'Unmute' : 'Mute';
  });
  document.getElementById('toggleVideoBtn').addEventListener('click', toggleVideo);
  document.getElementById('shareScreenBtn').addEventListener('click', toggleScreenShare);
}

/* ============================================================
   CALLS
   ============================================================ */

async function acceptIncomingCall() {
  stopRingtone();
  document.getElementById('callButtonsIncoming').classList.add('hidden');
  document.getElementById('callStatus').classList.add('hidden');
  if (!currentCall) return;

  try {
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
    }
    localStream.getAudioTracks().forEach(t => t.enabled = true);
    currentCall.answer(localStream);

    currentCall.on('stream', (stream) => {
      remoteStream = stream;
      document.getElementById('remoteAudio').srcObject = stream;
      if (stream.getVideoTracks().length > 0) {
        document.getElementById('remoteVideo').srcObject = stream;
        document.getElementById('videoOffline').classList.add('hidden');
      }
      startCallUI();
    });

    currentCall.on('close', () => endCall());
  } catch (e) {
    showToast('Mic access required', 'error');
  }
}

function startCallUI() {
  document.getElementById('callButtonsIdle').classList.add('hidden');
  document.getElementById('callButtonsIncoming').classList.add('hidden');
  document.getElementById('callStatus').classList.add('hidden');
  document.getElementById('callActive').classList.remove('hidden');

  callStartTime = Date.now();
  if (callTimerInterval) clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    const el = Math.floor((Date.now() - callStartTime) / 1000);
    const m = String(Math.floor(el / 60)).padStart(2, '0');
    const s = String(el % 60).padStart(2, '0');
    document.getElementById('callTimer').textContent = m + ':' + s;
  }, 1000);

  isInCall = true;
}

function endCall() {
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = false);
  micMuted = true;
  document.getElementById('muteMicBtn')?.classList.add('muted');

  document.getElementById('callActive').classList.add('hidden');
  document.getElementById('callButtonsIncoming').classList.add('hidden');

  if (!isCallerMode) {
    document.getElementById('callButtonsIdle').classList.remove('hidden');
  } else {
    document.getElementById('callButtonsIdle').classList.add('hidden');
  }

  document.getElementById('callStatus').classList.add('hidden');
  isInCall = false;
}

async function toggleVideo() {
  const btn = document.getElementById('toggleVideoBtn');
  if (!videoEnabled) {
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      const track = vs.getVideoTracks()[0];
      if (!localStream) localStream = new MediaStream();
      localStream.addTrack(track);
      if (currentCall?.peerConnection) currentCall.peerConnection.addTrack(track, localStream);
      document.getElementById('localVideo').srcObject = localStream;
      document.getElementById('videoOffline').classList.add('hidden');
      videoEnabled = true;
      btn.classList.add('active');
      btn.querySelector('span').textContent = 'Turn Off';
    } catch { showToast('Camera denied', 'error'); }
  } else {
    if (localStream) localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
    document.getElementById('localVideo').srcObject = null;
    videoEnabled = false;
    btn.classList.remove('active');
    btn.querySelector('span').textContent = 'Turn On';
    document.getElementById('videoOffline').classList.remove('hidden');
  }
}

async function toggleScreenShare() {
  const btn = document.getElementById('shareScreenBtn');
  if (isScreenSharing) {
    if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; }
    isScreenSharing = false;
    btn.classList.remove('active');
    return;
  }
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = screenStream.getVideoTracks()[0];
    if (currentCall?.peerConnection) {
      const senders = currentCall.peerConnection.getSenders();
      const vs = senders.find(s => s.track && s.track.kind === 'video');
      if (vs) await vs.replaceTrack(track);
      else currentCall.peerConnection.addTrack(track, screenStream);
    }
    document.getElementById('localVideo').srcObject = screenStream;
    isScreenSharing = true;
    btn.classList.add('active');
    track.onended = () => {
      isScreenSharing = false;
      btn.classList.remove('active');
      document.getElementById('localVideo').srcObject = localStream;
    };
  } catch { showToast('Screen share cancelled', 'error'); }
}

/* ============================================================
   CHAT
   ============================================================ */

function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text) return;

  const payload = JSON.stringify({ type: 'message', text });
  try {
    if (dataChannel) {
      if (dataChannel.send) dataChannel.send(payload);
      else if (dataChannel.open) dataChannel.send(payload);
    }
    addMessage(text, 'sent');
    input.value = '';
  } catch { showToast('Not connected', 'error'); }
}

function addMessage(text, type) {
  const d = document.createElement('div');
  d.className = 'message ' + type;
  d.textContent = text;
  const cm = document.getElementById('chatMessages');
  cm.appendChild(d);
  cm.scrollTop = cm.scrollHeight;
}

function addSystemMessage(text) {
  const d = document.createElement('div');
  d.className = 'message system';
  d.textContent = text;
  const cm = document.getElementById('chatMessages');
  cm.appendChild(d);
  cm.scrollTop = cm.scrollHeight;
}

function setConnStatus(t) {
  document.getElementById('connText').textContent = t;
}

/* ============================================================
   SHARE ID BLOCK
   ============================================================ */

function addShareIdBlock(id, fullUrl) {
  const cm = document.getElementById('chatMessages');
  const block = document.createElement('div');
  block.className = 'share-id-block';
  block.innerHTML = `
    <div class="share-id-label">YOUR DEMO ID</div>
    <div class="share-id-value">${esc(id)}</div>
    <div class="share-id-hint">Tap to copy · Send to a friend</div>
  `;

  block.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('Link copied', 'success', 2000);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = fullUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Link copied', 'success', 2000);
    }
  });

  cm.appendChild(block);
  cm.scrollTop = cm.scrollHeight;
}

/* ============================================================
   FILE TRANSFER — 1 MB cap
   ============================================================ */

async function sendFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    showToast('Demo limit is 1 MB — upgrade to Pro for unlimited', 'error', 5000);
    return;
  }

  const start = JSON.stringify({ type: 'file-start', name: file.name, size: file.size, mimeType: file.type });
  try {
    if (dataChannel) {
      if (dataChannel.send) dataChannel.send(start);
      else if (dataChannel.open) dataChannel.send(start);
    }
    await new Promise(r => setTimeout(r, 150));

    const buf = await file.arrayBuffer();
    let off = 0, idx = 0;
    const msg = document.createElement('div');
    msg.className = 'message sent';
    msg.textContent = 'Sending ' + file.name + '...';
    document.getElementById('chatMessages').appendChild(msg);

    while (off < buf.byteLength) {
      const chunk = buf.slice(off, off + CHUNK_SIZE);
      const b64 = bufToB64(chunk);
      const p = JSON.stringify({ type: 'file-chunk', data: b64, index: idx });
      if (dataChannel) {
        if (dataChannel.send) dataChannel.send(p);
        else if (dataChannel.open) dataChannel.send(p);
      }
      off += CHUNK_SIZE;
      idx++;
    }

    const end = JSON.stringify({ type: 'file-end', name: file.name, size: file.size, mimeType: file.type });
    if (dataChannel) {
      if (dataChannel.send) dataChannel.send(end);
      else if (dataChannel.open) dataChannel.send(end);
    }

    msg.textContent = 'Sent: ' + file.name;
    showToast('File sent', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to send file', 'error');
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
  isReceivingFile = true;
  const m = document.createElement('div');
  m.className = 'message received';
  m.id = 'recv-file';
  m.textContent = 'Receiving ' + data.name + '...';
  document.getElementById('chatMessages').appendChild(m);
}

function handleFileChunk(data) {
  if (!isReceivingFile) return;
  incomingFileChunks.push(data.data);
}

function handleFileEnd(data) {
  isReceivingFile = false;
  const m = document.getElementById('recv-file');
  if (m) m.remove();
  try {
    const buffers = incomingFileChunks.map(b64ToBuf);
    const blob = new Blob(buffers, { type: data.mimeType });
    const url = URL.createObjectURL(blob);
    const d = document.createElement('div');
    d.className = 'message received';
    const isImg = data.mimeType.startsWith('image/');
    if (isImg) d.innerHTML = `<div>${esc(data.name)}</div><img src="${url}" style="max-width:100%;border-radius:8px;margin-top:6px;">`;
    else d.innerHTML = `<div>${esc(data.name)}</div><a href="${url}" download="${esc(data.name)}" style="color:inherit;font-weight:700;font-size:12px;">Download</a>`;
    document.getElementById('chatMessages').appendChild(d);
    showToast('File received', 'success');
  } catch (e) { console.error(e); }
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
      [0, .15, .3, .5, .65, .8].forEach((o, i) => {
        const osc = ringtoneCtx.createOscillator();
        const g = ringtoneCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i % 2 === 0 ? 1000 : 800;
        g.gain.setValueAtTime(0, t + o);
        g.gain.linearRampToValueAtTime(.25, t + o + .01);
        g.gain.linearRampToValueAtTime(0, t + o + .1);
        osc.connect(g); g.connect(ringtoneCtx.destination);
        osc.start(t + o); osc.stop(t + o + .15);
      });
    };
    play();
    ringtoneInterval = setInterval(play, 2200);
  } catch {}
}

function stopRingtone() {
  if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null; }
  if (ringtoneCtx) { try { ringtoneCtx.close(); } catch {} ringtoneCtx = null; }
}

/* ============================================================
   MOBILE TABS
   ============================================================ */

function setupMobileTabs() {
  const tabs = document.querySelectorAll('.mobile-tab');
  const panels = document.querySelectorAll('.panel');
  if (window.innerWidth <= 900) document.querySelector('.panel-chat')?.classList.add('active-panel');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      const target = t.dataset.tab;
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      panels.forEach(p => {
        p.classList.remove('active-panel');
        if (p.dataset.panel === target) p.classList.add('active-panel');
      });
    });
  });
}

/* ============================================================
   HELPERS
   ============================================================ */

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function showToast(msg, type = 'info', duration = 3000) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-20px)';
    t.style.transition = 'all .3s';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

function cleanup() {
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  if (screenStream) screenStream.getTracks().forEach(t => t.stop());
  if (peerConnection) { try { peerConnection.close(); } catch {} }
  if (currentCall) { try { currentCall.close(); } catch {} }
  if (demoPeer) { try { demoPeer.destroy(); } catch {} demoPeer = null; }
  stopRingtone();
  peerConnection = null;
  dataChannel = null;
  localStream = null;
  remoteStream = null;
  currentCall = null;
  isInCall = false;
  micMuted = false;
  videoEnabled = false;
  isScreenSharing = false;
  screenStream = null;
  incomingFileChunks = [];
  isReceivingFile = false;
}

window.addEventListener('beforeunload', () => {
  if (sessionActive && !isCallerMode) markDemoUsed();
});

console.log('SoloDS Free Demo loaded');
