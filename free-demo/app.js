/* ============================================================
   SoloDS Basic — Unlimited Calling
   No timer. No limits. Lifetime access.
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

let myName = '';
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
let demoPeer = null;
let currentCall = null;

/* INIT */
window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  setupMobileTabs();

  const savedName = localStorage.getItem('solods_basic_name');
  if (savedName) {
    document.getElementById('userName').value = savedName;
  }

  document.getElementById('startBtn').addEventListener('click', startBasic);
  document.getElementById('userName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startBasic();
  });
});

/* START */
async function startBasic() {
  const name = document.getElementById('userName').value.trim();
  if (!name || name.length < 2) {
    showToast('Enter your name (2+ characters)', 'error');
    return;
  }

  myName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  localStorage.setItem('solods_basic_name', myName);

  document.getElementById('landingScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  document.getElementById('partnerNameDisplay').textContent = myName;
  document.getElementById('partnerAvatar').textContent = myName.charAt(0).toUpperCase();

  addSystemMessage('Welcome, ' + myName + '. Unlimited calling active.');
  addSystemMessage('Share your link with anyone to start talking.');

  setupPeer();
}

/* PEER */
async function setupPeer() {
  const peerId = 'solods-basic-' + myName + '-' + Math.random().toString(36).substr(2, 5);

  try {
    demoPeer = new Peer(peerId, {
      debug: 1,
      config: ICE_CONFIG
    });

    demoPeer.on('open', (id) => {
      addSystemMessage('Your ID: ' + myName);
      setConnStatus('Online');
    });

    demoPeer.on('error', (err) => {
      console.error('Peer error:', err);
      setConnStatus('Offline');
    });

    demoPeer.on('call', (call) => {
      handleIncomingCall(call);
    });

    demoPeer.on('connection', (conn) => {
      dataChannel = conn;
      setupDataChannel();
    });
  } catch (e) {
    console.error('Peer init failed:', e);
  }
}

/* CALLS */
function handleIncomingCall(call) {
  currentCall = call;
  document.getElementById('callIdle').classList.add('hidden');
  document.getElementById('callIncoming').classList.remove('hidden');
  document.getElementById('callStatus').classList.remove('hidden');
  document.getElementById('callStatusText').textContent = 'Incoming call...';
  startRingtone();

  if (window.innerWidth <= 900) {
    document.querySelector('.mobile-tab[data-tab="voice"]')?.click();
  }
}

document.getElementById('acceptCallBtn')?.addEventListener('click', async () => {
  stopRingtone();
  document.getElementById('callIncoming').classList.add('hidden');
  document.getElementById('callStatus').classList.add('hidden');

  if (!currentCall) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });

    localStream.getAudioTracks().forEach(t => { t.enabled = true; });
    currentCall.answer(localStream);
    bindCallEvents(currentCall);
  } catch (e) {
    showToast('Mic access required', 'error');
  }
});

document.getElementById('rejectCallBtn')?.addEventListener('click', () => {
  stopRingtone();
  if (currentCall) {
    try { currentCall.close(); } catch (e) {}
    currentCall = null;
  }
  document.getElementById('callIncoming').classList.add('hidden');
  document.getElementById('callIdle').classList.remove('hidden');
  document.getElementById('callStatus').classList.add('hidden');
});

document.getElementById('startCallBtn')?.addEventListener('click', () => {
  showToast('Share your ID with a friend to test', 'info');
});

function bindCallEvents(call) {
  call.on('stream', (stream) => {
    remoteStream = stream;
    const audio = document.getElementById('remoteAudio');
    if (audio) audio.srcObject = stream;

    if (stream.getVideoTracks().length > 0) {
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) remoteVideo.srcObject = stream;
      document.getElementById('videoOffline')?.classList.add('hidden');
    }

    startCallUI();
  });

  call.on('close', () => { endCall(); });
}

function startCallUI() {
  document.getElementById('callIdle').classList.add('hidden');
  document.getElementById('callIncoming').classList.add('hidden');
  document.getElementById('callStatus').classList.add('hidden');
  document.getElementById('callActive').classList.remove('hidden');

  callStartTime = Date.now();
  if (callTimerInterval) clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    document.getElementById('callTimer').textContent = mins + ':' + secs;
  }, 1000);

  isInCall = true;
  addSystemMessage('Call started — unlimited time');
}

function endCall() {
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  if (localStream) {
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
  }
  micMuted = true;
  document.getElementById('muteMicBtn')?.classList.add('muted');

  document.getElementById('callActive').classList.add('hidden');
  document.getElementById('callIncoming').classList.add('hidden');
  document.getElementById('callIdle').classList.remove('hidden');
  document.getElementById('callStatus').classList.add('hidden');
  isInCall = false;
}

document.getElementById('hangupBtn')?.addEventListener('click', () => {
  if (currentCall) {
    try { currentCall.close(); } catch (e) {}
    currentCall = null;
  }
  endCall();
});

document.getElementById('muteMicBtn')?.addEventListener('click', () => {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !micMuted);
  const btn = document.getElementById('muteMicBtn');
  btn.classList.toggle('muted', micMuted);
  btn.querySelector('span').textContent = micMuted ? 'Unmute' : 'Mute';
});

document.getElementById('toggleVideoBtn')?.addEventListener('click', async () => {
  if (!videoEnabled) {
    try {
      const vs = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = vs.getVideoTracks()[0];
      if (!localStream) localStream = new MediaStream();
      localStream.addTrack(track);

      const lv = document.getElementById('localVideo');
      if (lv) lv.srcObject = localStream;
      document.getElementById('videoOffline')?.classList.add('hidden');

      videoEnabled = true;
      document.getElementById('toggleVideoBtn').classList.add('active');
      document.getElementById('toggleVideoBtn').querySelector('span').textContent = 'Turn Off';
    } catch (e) {
      showToast('Camera access denied', 'error');
    }
  } else {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
    }
    document.getElementById('localVideo').srcObject = null;
    videoEnabled = false;
    document.getElementById('toggleVideoBtn').classList.remove('active');
    document.getElementById('toggleVideoBtn').querySelector('span').textContent = 'Turn On';
    document.getElementById('videoOffline')?.classList.remove('hidden');
  }
});

/* DATA */
function setupDataChannel() {
  if (!dataChannel) return;
  if (dataChannel.on) {
    dataChannel.on('data', (data) => handleIncomingData(data));
    dataChannel.on('open', () => addSystemMessage('Chat ready'));
  } else {
    dataChannel.onmessage = (e) => handleIncomingData(e.data);
    dataChannel.onopen = () => addSystemMessage('Chat ready');
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
  } catch (e) {
    showToast('Not connected', 'error');
  }
}

function addMessage(text, type) {
  const div = document.createElement('div');
  div.className = 'message ' + type;
  div.textContent = text;
  const cm = document.getElementById('chatMessages');
  cm.appendChild(div);
  cm.scrollTop = cm.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'message system';
  div.textContent = text;
  const cm = document.getElementById('chatMessages');
  cm.appendChild(div);
  cm.scrollTop = cm.scrollHeight;
}

function setConnStatus(text) {
  document.getElementById('connText').textContent = text;
}

/* RINGTONE */
function startRingtone() {
  try {
    stopRingtone();
    ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = () => {
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
    playTone();
    ringtoneInterval = setInterval(playTone, 2200);
  } catch (e) {}
}

function stopRingtone() {
  if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null; }
  if (ringtoneCtx) { try { ringtoneCtx.close(); } catch (e) {} ringtoneCtx = null; }
}

/* MOBILE TABS */
function setupMobileTabs() {
  const tabs = document.querySelectorAll('.mobile-tab');
  const panels = document.querySelectorAll('.panel');

  if (window.innerWidth <= 900) {
    document.querySelector('.panel-chat')?.classList.add('active-panel');
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

/* THEME */
function loadTheme() {
  const saved = localStorage.getItem('solods_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function openThemePopup() {
  document.getElementById('themePopup').classList.add('show');
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.themeChoice === current);
  });
}

function closeThemePopup() {
  document.getElementById('themePopup').classList.remove('show');
}

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

document.getElementById('themePopup')?.addEventListener('click', (e) => {
  if (e.target.id === 'themePopup') closeThemePopup();
});

/* TOASTS */
function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  const c = document.getElementById('toastContainer');
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(-20px)';
    t.style.transition = 'all .3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/* GO HOME */
function goHome() {
  if (currentCall) { try { currentCall.close(); } catch (e) {} }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (demoPeer) { try { demoPeer.destroy(); } catch (e) {} demoPeer = null; }
  stopRingtone();

  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('landingScreen').classList.remove('hidden');
}

console.log('SoloDS Basic loaded');
