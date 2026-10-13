/* ============================================================
   SoloDS v16 — app.js
   Host types ID → Go Online → receives calls on ?call=ID
   Caller opens ?call=ID → connects to host
   Code exchange as backup
   ============================================================ */

const ICE_CONFIG = {
  iceServers: [
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
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

const PEER_PREFIX = 'solods-';
const PEER_SUFFIX = '-main';

let mode = 'landing'; // 'host' | 'caller'
let myId = '';
let partnerId = '';
let myPeer = null;
let incomingCall = null;
let currentCall = null;
let activeConn = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let callTimerInterval = null;
let callStartTime = 0;
let micMuted = false;
let videoEnabled = false;
let ringtoneCtx = null;
let ringtoneInterval = null;

/* ============================================================
   THEME
   ============================================================ */

function loadTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem('solods_theme') || 'light'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', saved);
}

function openThemePopup() {
  const p = document.getElementById('themePopup');
  if (!p) return;
  p.classList.add('show');
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.themeChoice === cur);
  });
}

function closeThemePopup() {
  const p = document.getElementById('themePopup');
  if (p) p.classList.remove('show');
}

function bindThemeEvents() {
  const t = document.getElementById('themeToggleBtn');
  if (t) t.addEventListener('click', openThemePopup);
  const c = document.getElementById('closeThemeBtn');
  if (c) c.addEventListener('click', closeThemePopup);

  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.themeChoice;
      document.documentElement.setAttribute('data-theme', theme);
      try { localStorage.setItem('solods_theme', theme); } catch (e) {}
      document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', el.dataset.themeChoice === theme);
      });
    });
  });

  const overlay = document.getElementById('themePopup');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target.id === 'themePopup') closeThemePopup();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeThemePopup();
  });
}

/* ============================================================
   INIT — detect mode from URL
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  bindThemeEvents();
  bindMobileTabs();
  bindAppEvents();
  detectMode();
});

function detectMode() {
  const params = new URLSearchParams(window.location.search);
  const callTarget = (params.get('call') || '').trim().toLowerCase();

  if (callTarget) {
    mode = 'caller';
    partnerId = callTarget;
    startCallerMode();
  } else {
    mode = 'host';
    startHostMode();
  }
}

/* ============================================================
   HOST MODE
   ============================================================ */

function startHostMode() {
  showScreen('landingScreen');

  const saved = (() => {
    try { return localStorage.getItem('solods_host_id') || ''; } catch (e) { return ''; }
  })();
  const input = document.getElementById('userName');
  if (saved && input) input.value = saved;
}

async function goOnline() {
  const input = document.getElementById('userName');
  if (!input) return;
  const id = input.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!id || id.length < 3) {
    showToast('Enter your ID (3+ characters)', 'error');
    return;
  }

  myId = id;
  try { localStorage.setItem('solods_host_id', myId); } catch (e) {}

  const btn = document.getElementById('goOnlineBtn');
  if (btn) {
    btn.disabled = true;
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Connecting...';
  }

  try {
    const peerId = PEER_PREFIX + myId + PEER_SUFFIX;

    myPeer = new Peer(peerId, {
      debug: 1,
      config: ICE_CONFIG
    });

    myPeer.on('open', () => {
      showScreen('appScreen');
      setConnStatus('Online');
      updateHostUI();

      addSystemMessage('You are online as "' + myId + '"');
      addSystemMessage('Share your link: ' + window.location.origin + window.location.pathname + '?call=' + myId);
      addSystemMessage('Keep this page open to receive calls.');

      showToast('Online — ready to receive calls', 'success');
    });

    myPeer.on('call', (call) => {
      handleIncomingCall(call);
    });

    myPeer.on('connection', (conn) => {
      activeConn = conn;
      setupDataChannel();
    });

    myPeer.on('error', (err) => {
      console.error('Peer error:', err);
      if (err.type === 'unavailable-id') {
        showToast('This ID is already online on another device', 'error');
      } else if (err.type === 'network') {
        showToast('Network error. Check your internet.', 'error');
      } else {
        showToast('Connection error: ' + err.type, 'error');
      }
      if (btn) {
        btn.disabled = false;
        const span = btn.querySelector('span');
        if (span) span.textContent = 'Go Online';
      }
    });

    myPeer.on('disconnected', () => {
      setTimeout(() => {
        if (myPeer && !myPeer.destroyed) {
          try { myPeer.reconnect(); } catch (e) {}
        }
      }, 2000);
    });

  } catch (e) {
    console.error('Go online failed:', e);
    showToast('Failed to go online', 'error');
    if (btn) {
      btn.disabled = false;
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Go Online';
    }
  }
}

function updateHostUI() {
  const pn = document.getElementById('partnerNameDisplay');
  if (pn) pn.textContent = myId;
  const pa = document.getElementById('partnerAvatar');
  if (pa) pa.textContent = myId.charAt(0).toUpperCase();
  const pl = document.getElementById('partnerLabel');
  if (pl) pl.textContent = 'Signed in as';
  const rc = document.getElementById('roleChip');
  if (rc) rc.textContent = 'HOST';
  const mc = document.getElementById('modeChip');
  if (mc) mc.textContent = 'ONLINE';
}

/* ============================================================
   CALLER MODE
   ============================================================ */

function startCallerMode() {
  showScreen('callerScreen');

  const av = document.getElementById('callerAvatar');
  if (av) av.textContent = partnerId.charAt(0).toUpperCase();
  const nm = document.getElementById('callerName');
  if (nm) nm.textContent = partnerId;
  const tt = document.getElementById('callerTargetName');
  if (tt) tt.textContent = partnerId;
  const st = document.getElementById('callerStatus');
  if (st) st.textContent = 'Connecting...';

  const callerPeerId = PEER_PREFIX + 'caller-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

  try {
    myPeer = new Peer(callerPeerId, {
      debug: 1,
      config: ICE_CONFIG
    });

    myPeer.on('open', () => {
      const st = document.getElementById('callerStatus');
      if (st) st.textContent = 'Ready to call';
      const cb = document.getElementById('callerCallBtn');
      if (cb) cb.disabled = false;
      const vb = document.getElementById('callerVideoBtn');
      if (vb) vb.disabled = false;
    });

    myPeer.on('error', (err) => {
      console.error('Caller peer error:', err);
      if (err.type === 'peer-unavailable') {
        const st = document.getElementById('callerStatus');
        if (st) st.textContent = partnerId + ' is offline';
        showToast(partnerId + ' is not online right now', 'error');
      } else {
        const st = document.getElementById('callerStatus');
        if (st) st.textContent = 'Connection error';
      }
    });

  } catch (e) {
    console.error('Caller peer init failed:', e);
  }
}

async function makeCall(withVideo) {
  if (!myPeer) return;

  const st = document.getElementById('callerStatus');
  if (st) st.textContent = 'Requesting mic...';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: withVideo ? { width: 640, height: 480 } : false
    });

    if (withVideo) videoEnabled = true;

    const targetPeerId = PEER_PREFIX + partnerId + PEER_SUFFIX;

    if (st) st.textContent = 'Calling ' + partnerId + '...';

    const call = myPeer.call(targetPeerId, localStream);

    if (!call) {
      showToast('Could not reach ' + partnerId, 'error');
      if (st) st.textContent = 'Call failed';
      return;
    }

    currentCall = call;

    call.on('stream', (remoteStreamObj) => {
      remoteStream = remoteStreamObj;
      const audio = document.getElementById('remoteAudio');
      if (audio) audio.srcObject = remoteStreamObj;

      if (remoteStreamObj.getVideoTracks().length > 0) {
        const rv = document.getElementById('remoteVideo');
        if (rv) rv.srcObject = remoteStreamObj;
        const vo = document.getElementById('videoOffline');
        if (vo) vo.classList.add('hidden');
      }

      showScreen('appScreen');
      updateCallerUI();
      startCallUI();
      addSystemMessage('Connected to ' + partnerId);
      showToast('Connected!', 'success');
    });

    call.on('close', () => {
      endCall();
    });

    // Also open data channel for chat
    const dataConn = myPeer.connect(targetPeerId);
    if (dataConn) {
      activeConn = dataConn;
      setupDataChannel();
    }

  } catch (e) {
    console.error('Make call failed:', e);
    if (e.name === 'NotAllowedError') {
      if (st) st.textContent = 'Mic access required';
    } else {
      if (st) st.textContent = 'Failed to call';
    }
  }
}

function updateCallerUI() {
  const pn = document.getElementById('partnerNameDisplay');
  if (pn) pn.textContent = partnerId;
  const pa = document.getElementById('partnerAvatar');
  if (pa) pa.textContent = partnerId.charAt(0).toUpperCase();
  const pl = document.getElementById('partnerLabel');
  if (pl) pl.textContent = 'Calling';
  const rc = document.getElementById('roleChip');
  if (rc) rc.textContent = 'CALLER';
  const mc = document.getElementById('modeChip');
  if (mc) mc.textContent = 'IN CALL';
}

/* ============================================================
   INCOMING CALL (host side)
   ============================================================ */

function handleIncomingCall(call) {
  incomingCall = call;

  const callIdle = document.getElementById('callIdle');
  const callInc = document.getElementById('callIncoming');
  const callStat = document.getElementById('callStatus');
  const hint = document.getElementById('callIdleHint');

  if (callIdle) callIdle.classList.add('hidden');
  if (hint) hint.classList.add('hidden');
  if (callInc) callInc.classList.remove('hidden');
  if (callStat) callStat.classList.remove('hidden');

  const st = document.getElementById('callStatusText');
  if (st) st.textContent = 'Incoming call...';

  startRingtone();

  if (window.innerWidth <= 900) {
    const vt = document.querySelector('.mobile-tab[data-tab="voice"]');
    if (vt) vt.click();
  }
}

async function acceptIncomingCall() {
  stopRingtone();

  const callInc = document.getElementById('callIncoming');
  const callStat = document.getElementById('callStatus');
  if (callInc) callInc.classList.add('hidden');
  if (callStat) callStat.classList.add('hidden');

  if (!incomingCall) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });

    localStream.getAudioTracks().forEach(t => { t.enabled = true; });

    incomingCall.answer(localStream);
    currentCall = incomingCall;

    incomingCall.on('stream', (stream) => {
      remoteStream = stream;
      const audio = document.getElementById('remoteAudio');
      if (audio) audio.srcObject = stream;

      if (stream.getVideoTracks().length > 0) {
        const rv = document.getElementById('remoteVideo');
        if (rv) rv.srcObject = stream;
        const vo = document.getElementById('videoOffline');
        if (vo) vo.classList.add('hidden');
      }

      startCallUI();
      addSystemMessage('Call started');
    });

    incomingCall.on('close', () => {
      endCall();
    });

  } catch (e) {
    console.error('Accept call failed:', e);
    showToast('Mic access required', 'error');
  }
}

function rejectIncomingCall() {
  stopRingtone();
  if (incomingCall) {
    try { incomingCall.close(); } catch (e) {}
    incomingCall = null;
  }

  const callIdle = document.getElementById('callIdle');
  const callInc = document.getElementById('callIncoming');
  const callStat = document.getElementById('callStatus');
  const hint = document.getElementById('callIdleHint');

  if (callIdle) callIdle.classList.remove('hidden');
  if (callInc) callInc.classList.add('hidden');
  if (callStat) callStat.classList.add('hidden');
  if (hint) hint.classList.remove('hidden');
}

/* ============================================================
   CALL UI
   ============================================================ */

function startCallUI() {
  const callIdle = document.getElementById('callIdle');
  const callInc = document.getElementById('callIncoming');
  const callStat = document.getElementById('callStatus');
  const callAct = document.getElementById('callActive');
  const hint = document.getElementById('callIdleHint');

  if (callIdle) callIdle.classList.add('hidden');
  if (callInc) callInc.classList.add('hidden');
  if (callStat) callStat.classList.add('hidden');
  if (hint) hint.classList.add('hidden');
  if (callAct) callAct.classList.remove('hidden');

  callStartTime = Date.now();
  if (callTimerInterval) clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    const el = Math.floor((Date.now() - callStartTime) / 1000);
    const m = String(Math.floor(el / 60)).padStart(2, '0');
    const s = String(el % 60).padStart(2, '0');
    const t = document.getElementById('callTimer');
    if (t) t.textContent = m + ':' + s;
  }, 1000);

  isInCall = true;
}

function endCall() {
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  if (localStream) {
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
  }
  micMuted = true;
  const mm = document.getElementById('muteMicBtn');
  if (mm) mm.classList.add('muted');

  const callAct = document.getElementById('callActive');
  const callInc = document.getElementById('callIncoming');
  const callStat = document.getElementById('callStatus');
  const hint = document.getElementById('callIdleHint');

  if (callAct) callAct.classList.add('hidden');
  if (callInc) callInc.classList.add('hidden');
  if (callStat) callStat.classList.add('hidden');
  if (hint) hint.classList.remove('hidden');

  isInCall = false;
  currentCall = null;
  incomingCall = null;
}

function hangupCall() {
  if (currentCall) {
    try { currentCall.close(); } catch (e) {}
  }
  endCall();
}

function toggleMute() {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(t => { t.enabled = !micMuted; });
  const btn = document.getElementById('muteMicBtn');
  if (!btn) return;
  btn.classList.toggle('muted', micMuted);
  const span = btn.querySelector('span');
  if (span) span.textContent = micMuted ? 'Unmute' : 'Mute';
}

async function toggleVideo() {
  const btn = document.getElementById('toggleVideoBtn');
  if (!btn) return;

  if (!videoEnabled) {
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = vs.getVideoTracks()[0];
      if (!localStream) localStream = new MediaStream();
      localStream.addTrack(track);

      // Add track to active call if any
      if (currentCall && currentCall.peerConnection) {
        try { currentCall.peerConnection.addTrack(track, localStream); } catch (e) {}
      }

      const lv = document.getElementById('localVideo');
      if (lv) lv.srcObject = localStream;
      const vo = document.getElementById('videoOffline');
      if (vo) vo.classList.add('hidden');

      videoEnabled = true;
      btn.classList.add('active');
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Turn Off';
    } catch (e) {
      showToast('Camera access denied', 'error');
    }
  } else {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
    }
    const lv = document.getElementById('localVideo');
    if (lv) lv.srcObject = null;
    videoEnabled = false;
    btn.classList.remove('active');
    const span = btn.querySelector('span');
    if (span) span.textContent = 'Turn On';
    const vo = document.getElementById('videoOffline');
    if (vo) vo.classList.remove('hidden');
  }
}

/* ============================================================
   DATA CHANNEL (chat / files)
   ============================================================ */

function setupDataChannel() {
  if (!activeConn) return;

  if (activeConn.on) {
    activeConn.on('data', handleIncomingData);
    activeConn.on('open', () => {
      addSystemMessage('Chat ready');
      updateChatChip('ONLINE');
    });
  } else {
    activeConn.onmessage = (e) => handleIncomingData(e.data);
    activeConn.onopen = () => {
      addSystemMessage('Chat ready');
      updateChatChip('ONLINE');
    };
  }
}

function handleIncomingData(data) {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (parsed.type === 'message') addMessage(parsed.text, 'received');
  } catch (e) {
    addMessage(data, 'received');
  }
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const payload = JSON.stringify({ type: 'message', text });
  try {
    if (activeConn) {
      if (activeConn.send) activeConn.send(payload);
      else if (activeConn.open) activeConn.send(payload);
    }
    addMessage(text, 'sent');
    input.value = '';
  } catch (e) {
    showToast('Not connected', 'error');
  }
}

function addMessage(text, type) {
  const cm = document.getElementById('chatMessages');
  if (!cm) return;
  const div = document.createElement('div');
  div.className = 'message ' + type;
  div.textContent = text;
  cm.appendChild(div);
  cm.scrollTop = cm.scrollHeight;
}

function addSystemMessage(text) {
  const cm = document.getElementById('chatMessages');
  if (!cm) return;
  const div = document.createElement('div');
  div.className = 'message system';
  div.textContent = text;
  cm.appendChild(div);
  cm.scrollTop = cm.scrollHeight;
}

function updateChatChip(text) {
  const c = document.getElementById('chatChip');
  if (c) c.textContent = text;
}

function setConnStatus(text) {
  const el = document.getElementById('connText');
  if (el) el.textContent = text;
  const pill = document.getElementById('connPill');
  if (pill) {
    if (text === 'Online' || text === 'Connected' || text === 'In call') {
      pill.classList.add('connected');
    } else {
      pill.classList.remove('connected');
    }
  }
}

/* ============================================================
   CODE EXCHANGE (backup)
   ============================================================ */

let codeModePeer = null;
let codeModeConn = null;
let codeModeChannel = null;
let codeModeIsOfferer = false;

async function generateOfferCode() {
  const btn = document.getElementById('genOfferBtn');
  const out = document.getElementById('offerValue');
  const copyBtn = document.getElementById('copyOfferBtn');

  if (btn) btn.disabled = true;

  try {
    codeModeIsOfferer = true;

    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    codeModePeer = pc;

    localStream.getAudioTracks().forEach(t => pc.addTrack(t, localStream));
    codeModeChannel = pc.createDataChannel('chat');
    setupCodeDataChannel();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);

    const data = btoa(unescape(encodeURIComponent(JSON.stringify({
      t: 'o',
      sdp: pc.localDescription
    }))));

    if (out) {
      out.textContent = data;
      out.classList.remove('hidden');
    }
    if (copyBtn) copyBtn.classList.remove('hidden');

    showToast('Offer code ready. Send to partner.', 'success');
  } catch (e) {
    console.error('Offer generation failed:', e);
    showToast('Failed to generate code', 'error');
  }

  if (btn) btn.disabled = false;
}

async function generateAnswerCode() {
  const input = document.getElementById('partnerOffer');
  const out = document.getElementById('answerValue');
  const copyBtn = document.getElementById('copyAnswerBtn');
  const btn = document.getElementById('answerBtn');

  if (!input || !input.value.trim()) {
    showToast('Paste partner offer code first', 'error');
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(input.value.trim()))));
    if (parsed.t !== 'o') throw new Error('Not an offer code');

    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
    }

    const pc = new RTCPeerConnection(ICE_CONFIG);
    codeModePeer = pc;

    localStream.getAudioTracks().forEach(t => pc.addTrack(t, localStream));
    pc.ondatachannel = (e) => {
      codeModeChannel = e.channel;
      setupCodeDataChannel();
    };

    await pc.setRemoteDescription(parsed.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIce(pc);

    const data = btoa(unescape(encodeURIComponent(JSON.stringify({
      t: 'a',
      sdp: pc.localDescription
    }))));

    if (out) {
      out.textContent = data;
      out.classList.remove('hidden');
    }
    if (copyBtn) copyBtn.classList.remove('hidden');

    showToast('Answer code ready. Send back to partner.', 'success');
  } catch (e) {
    console.error('Answer generation failed:', e);
    showToast('Invalid offer code', 'error');
  }

  if (btn) btn.disabled = false;
}

async function completeConnection() {
  const input = document.getElementById('partnerAnswer');
  const btn = document.getElementById('completeBtn');

  if (!input || !input.value.trim()) {
    showToast('Paste partner answer code first', 'error');
    return;
  }

  if (!codeModePeer) {
    showToast('Generate offer first', 'error');
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(input.value.trim()))));
    if (parsed.t !== 'a') throw new Error('Not an answer code');

    await codeModePeer.setRemoteDescription(parsed.sdp);
    showToast('Connecting...', 'success');

    codeModePeer.onconnectionstatechange = () => {
      if (codeModePeer.connectionState === 'connected') {
        showScreen('appScreen');
        const pl = document.getElementById('partnerLabel');
        if (pl) pl.textContent = 'Connected via code';
        const rc = document.getElementById('roleChip');
        if (rc) rc.textContent = 'PAIRED';
        setConnStatus('Connected');
        addSystemMessage('Connected via code exchange');
      }
    };

    codeModePeer.ontrack = (e) => {
      remoteStream = e.streams[0];
      const audio = document.getElementById('remoteAudio');
      if (audio) audio.srcObject = e.streams[0];
    };
  } catch (e) {
    console.error('Complete failed:', e);
    showToast('Invalid answer code', 'error');
  }

  if (btn) btn.disabled = false;
}

function setupCodeDataChannel() {
  if (!codeModeChannel) return;
  codeModeChannel.onopen = () => {
    activeConn = codeModeChannel;
    addSystemMessage('Chat ready');
  };
  codeModeChannel.onmessage = (e) => handleIncomingData(e.data);
}

function waitIce(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') finish();
    });
    setTimeout(finish, 3000);
  });
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
      const now = ringtoneCtx.currentTime;
      [0, 0.15, 0.3, 0.5, 0.65, 0.8].forEach((offset, i) => {
        const osc = ringtoneCtx.createOscillator();
        const gain = ringtoneCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i % 2 === 0 ? 1000 : 800;
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.25, now + offset + 0.01);
        gain.gain.linearRampToValueAtTime(0, now + offset + 0.1);
        osc.connect(gain);
        gain.connect(ringtoneCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.15);
      });
    };
    play();
    ringtoneInterval = setInterval(play, 2200);
  } catch (e) {}
}

function stopRingtone() {
  if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null; }
  if (ringtoneCtx) { try { ringtoneCtx.close(); } catch (e) {} ringtoneCtx = null; }
}

/* ============================================================
   SCREEN / TABS / TOAST
   ============================================================ */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  window.scrollTo(0, 0);
}

function bindMobileTabs() {
  const tabs = document.querySelectorAll('.mobile-tab');
  const panels = document.querySelectorAll('.panel');

  if (window.innerWidth <= 900) {
    const cp = document.querySelector('.panel-chat');
    if (cp) cp.classList.add('active-panel');
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      panels.forEach(p => {
        p.classList.remove('active-panel');
        if (p.dataset.panel === target) p.classList.add('active-panel');
      });
    });
  });
}

function bindAppEvents() {
  const goBtn = document.getElementById('goOnlineBtn');
  if (goBtn) goBtn.addEventListener('click', goOnline);

  const un = document.getElementById('userName');
  if (un) {
    un.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') goOnline();
    });
  }

  const ct = document.getElementById('codeToggleBtn');
  if (ct) ct.addEventListener('click', () => {
    const box = document.getElementById('codeExchangeBox');
    if (box) box.classList.toggle('hidden');
  });

  const gen = document.getElementById('genOfferBtn');
  if (gen) gen.addEventListener('click', generateOfferCode);

  const ans = document.getElementById('answerBtn');
  if (ans) ans.addEventListener('click', generateAnswerCode);

  const comp = document.getElementById('completeBtn');
  if (comp) comp.addEventListener('click', completeConnection);

  const co = document.getElementById('copyOfferBtn');
  if (co) co.addEventListener('click', () => {
    const v = document.getElementById('offerValue');
    if (v) copyToClipboard(v.textContent);
  });

  const ca = document.getElementById('copyAnswerBtn');
  if (ca) ca.addEventListener('click', () => {
    const v = document.getElementById('answerValue');
    if (v) copyToClipboard(v.textContent);
  });

  const cc = document.getElementById('callerCallBtn');
  if (cc) cc.addEventListener('click', () => makeCall(false));

  const cv = document.getElementById('callerVideoBtn');
  if (cv) cv.addEventListener('click', () => makeCall(true));

  const sc = document.getElementById('startCallBtn');
  if (sc) sc.addEventListener('click', () => {
    showToast('Waiting for someone to call you', 'info');
  });

  const ac = document.getElementById('acceptCallBtn');
  if (ac) ac.addEventListener('click', acceptIncomingCall);

  const rj = document.getElementById('rejectCallBtn');
  if (rj) rj.addEventListener('click', rejectIncomingCall);

  const hu = document.getElementById('hangupBtn');
  if (hu) hu.addEventListener('click', hangupCall);

  const mu = document.getElementById('muteMicBtn');
  if (mu) mu.addEventListener('click', toggleMute);

  const tv = document.getElementById('toggleVideoBtn');
  if (tv) tv.addEventListener('click', toggleVideo);

  const sb = document.getElementById('sendBtn');
  if (sb) sb.addEventListener('click', sendMessage);

  const mi = document.getElementById('messageInput');
  if (mi) {
    mi.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  const hb = document.getElementById('homeBtn');
  if (hb) hb.addEventListener('click', () => {
    if (myPeer) { try { myPeer.destroy(); } catch (e) {} myPeer = null; }
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (currentCall) { try { currentCall.close(); } catch (e) {} }
    stopRingtone();
    window.location.href = window.location.pathname;
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied!', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    showToast('Copied!', 'success');
  });
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-20px)';
    t.style.transition = 'all .3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

window.openThemePopup = openThemePopup;
window.closeThemePopup = closeThemePopup;

console.log('SoloDS v16 loaded');
