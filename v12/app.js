// SoloDS NextLast v12

let myName = '';
let partnerName = '';
let myCode = '';
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

// DOM
const homeScreen = document.getElementById('homeScreen');
const landingScreen = document.getElementById('landingScreen');
const connectingScreen = document.getElementById('connectingScreen');
const mainScreen = document.getElementById('mainScreen');

const contactsList = document.getElementById('contactsList');
const emptyState = document.getElementById('emptyState');
const addContactBtn = document.getElementById('addContactBtn');
const backHomeBtn = document.getElementById('backHomeBtn');

const statusMessage = document.getElementById('statusMessage');
const userNameInput = document.getElementById('userName');
const createCodeBtn = document.getElementById('createCodeBtn');
const codeArea = document.getElementById('codeArea');
const myCodeDisplay = document.getElementById('myCodeDisplay');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const sharePasteBtn = document.getElementById('sharePasteBtn');
const pasteMenu = document.getElementById('pasteMenu');
const partnerCodeInput = document.getElementById('partnerCodeInput');
const connectBtn = document.getElementById('connectBtn');
const answerArea = document.getElementById('answerArea');
const myAnswerDisplay = document.getElementById('myAnswerDisplay');
const copyAnswerBtn = document.getElementById('copyAnswerBtn');
const shareAnswerBtn = document.getElementById('shareAnswerBtn');
const answerCodeInput = document.getElementById('answerCodeInput');
const finishBtn = document.getElementById('finishBtn');
const errorBox = document.getElementById('errorBox');

const backBtn = document.getElementById('backBtn');
const connPill = document.getElementById('connPill');
const connText = document.getElementById('connText');
const chatChip = document.getElementById('chatChip');
const partnerAvatar = document.getElementById('partnerAvatar');
const partnerNameDisplay = document.getElementById('partnerNameDisplay');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');

const callButtonsIdle = document.getElementById('callButtonsIdle');
const callButtonsIncoming = document.getElementById('callButtonsIncoming');
const callActive = document.getElementById('callActive');
const startCallBtn = document.getElementById('startCallBtn');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const hangupBtn = document.getElementById('hangupBtn');
const muteMicBtn = document.getElementById('muteMicBtn');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const callTimer = document.getElementById('callTimer');
const callStatus = document.getElementById('callStatus');
const callStatusText = document.getElementById('callStatusText');

const videoPanel = document.getElementById('videoPanel');
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const videoPlaceholder = document.getElementById('videoPlaceholder');
const remoteAudio = document.getElementById('remoteAudio');

const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const resetBtn = document.getElementById('resetBtn');

const saveContactModal = document.getElementById('saveContactModal');
const saveContactName = document.getElementById('saveContactName');
const saveContactPaste = document.getElementById('saveContactPaste');
const saveContactBtn = document.getElementById('saveContactBtn');
const skipSaveBtn = document.getElementById('skipSaveBtn');

const themeToggle = document.getElementById('themeToggle');
const themeToggleMain = document.getElementById('themeToggleMain');

// ==================
// THEME
// ==================
function loadTheme() {
  const theme = localStorage.getItem('solods_theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  }
}

function toggleTheme() {
  if (document.body.classList.contains('light-theme')) {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    localStorage.setItem('solods_theme', 'dark');
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
    localStorage.setItem('solods_theme', 'light');
  }
}

themeToggle?.addEventListener('click', toggleTheme);
themeToggleMain?.addEventListener('click', toggleTheme);

// ==================
// INIT
// ==================
window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadContacts();
  
  // Check URL hash for auto-fill
  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    partnerCodeInput.value = decodeURIComponent(hash.substring(1));
    setStatus('📥 Code detected from link — paste partner code');
    showLanding();
  }
});

// ==================
// CONTACTS
// ==================
function getContacts() {
  try {
    return JSON.parse(localStorage.getItem('solods_contacts') || '[]');
  } catch {
    return [];
  }
}

function saveContacts(contacts) {
  localStorage.setItem('solods_contacts', JSON.stringify(contacts));
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
  
  contacts.forEach((contact) => {
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = `
      <div class="contact-avatar">${(contact.name || '?').charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(contact.name)}</div>
        <div class="contact-meta">${contact.pasteUrl ? escapeHtml(contact.pasteUrl) : formatTime(contact.lastConnected)}</div>
      </div>
      <svg class="contact-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    item.addEventListener('click', () => connectToContact(contact));
    contactsList.appendChild(item);
  });
}

function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function connectToContact(contact) {
  partnerName = contact.name;
  isSavedPartner = true;
  myName = contact.myName || 'me';
  
  showLanding();
  userNameInput.value = myName;
  setStatus(`📇 Contact "${contact.name}" loaded`);
  
  if (contact.pasteUrl) {
    const openPaste = confirm(`Open saved paste URL?\n\n${contact.pasteUrl}\n\nClick OK to open it in a new tab.`);
    if (openPaste) {
      window.open(contact.pasteUrl, '_blank');
    }
  }
}

addContactBtn.addEventListener('click', () => {
  isSavedPartner = false;
  partnerName = '';
  showLanding();
});

backHomeBtn.addEventListener('click', () => showHome());

function showHome() {
  homeScreen.classList.remove('hidden');
  landingScreen.classList.add('hidden');
  connectingScreen.classList.add('hidden');
  mainScreen.classList.add('hidden');
  loadContacts();
}

function showLanding() {
  homeScreen.classList.add('hidden');
  landingScreen.classList.remove('hidden');
  connectingScreen.classList.add('hidden');
  mainScreen.classList.add('hidden');
  
  codeArea.classList.add('hidden');
  answerArea.classList.add('hidden');
  partnerCodeInput.value = '';
  answerCodeInput.value = '';
  myCodeDisplay.textContent = '';
  myAnswerDisplay.textContent = '';
}

// ==================
// HELPERS
// ==================
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  setTimeout(() => errorBox.classList.add('hidden'), 5000);
}

function setStatus(msg) {
  statusMessage.textContent = msg;
}

function encode(obj) {
  const json = JSON.stringify(obj);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(str) {
  str = str.replace(/\s+/g, '');
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const json = decodeURIComponent(escape(atob(str)));
  return JSON.parse(json);
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => { btn.innerHTML = original; }, 2000);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

// ==================
// PASTEBIN SHARE
// ==================
const PASTE_SITES = {
  rentry: { url: 'https://rentry.co', name: 'Rentry.co' },
  dpaste: { url: 'https://dpaste.org', name: 'dpaste.org' },
  binpaste: { url: 'https://binpaste.xyz', name: 'BinPaste.xyz' },
  justpaste: { url: 'https://justpaste.it', name: 'JustPaste.it' }
};

sharePasteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  pasteMenu.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  pasteMenu.classList.add('hidden');
  menuDropdown.classList.add('hidden');
});

document.querySelectorAll('.paste-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const site = btn.dataset.site;
    const siteInfo = PASTE_SITES[site];
    
    // Copy code to clipboard
    navigator.clipboard.writeText(myCode || myAnswerDisplay.textContent).then(() => {
      // Open paste site in new tab
      window.open(siteInfo.url, '_blank');
      
      // Show instructions
      alert(`✅ Code copied to clipboard!\n\n📋 On ${siteInfo.name}:\n1. Paste code (Ctrl+V / Cmd+V)\n2. Create your paste\n3. Copy the URL\n4. Send URL to partner`);
      
      pasteMenu.classList.add('hidden');
    }).catch(() => {
      // Fallback
      window.open(siteInfo.url, '_blank');
    });
  });
});

// ==================
// STEP 1: GENERATE CODE
// ==================
createCodeBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim().toLowerCase();
  
  if (!name || name.length < 3) {
    showError('Enter a valid name (3+ characters)');
    return;
  }
  
  myName = name;
  createCodeBtn.disabled = true;
  createCodeBtn.querySelector('span').textContent = 'Requesting mic...';
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true,
        autoGainControl: true 
      },
      video: false
    });
    
    // Mute audio by default
    localStream.getAudioTracks().forEach(t => {
      t.enabled = false;
    });
    
    createCodeBtn.querySelector('span').textContent = 'Creating code...';
    
    createPeerConnection();
    
    localStream.getAudioTracks().forEach(t => {
      peerConnection.addTrack(t, localStream);
    });
    
    createDataChannel();
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGathering();
    
    const offerData = {
      type: 'offer',
      sdp: peerConnection.localDescription,
      from: myName
    };
    
    myCode = encode(offerData);
    
    myCodeDisplay.textContent = myCode;
    codeArea.classList.remove('hidden');
    
    createCodeBtn.disabled = false;
    createCodeBtn.querySelector('span').textContent = 'Generate Connection Code';
    
    setStatus('✅ Code ready — share with partner');
    
  } catch (error) {
    createCodeBtn.disabled = false;
    createCodeBtn.querySelector('span').textContent = 'Generate Connection Code';
    showError(error.name === 'NotAllowedError' ? 'Microphone access required' : error.message);
  }
});

copyCodeBtn.addEventListener('click', () => copyToClipboard(myCode, copyCodeBtn));

// ==================
// STEP 2: PASTE PARTNER CODE
// ==================
connectBtn.addEventListener('click', async () => {
  const code = partnerCodeInput.value.trim();
  
  if (!code) {
    showError('Paste your partner\'s code');
    return;
  }
  
  connectBtn.disabled = true;
  connectBtn.querySelector('span').textContent = 'Connecting...';
  
  try {
    const data = decode(code);
    
    if (data.type !== 'offer') throw new Error('Not a valid partner code');
    
    partnerName = data.from || 'Partner';
    
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
      
      localStream.getAudioTracks().forEach(t => {
        t.enabled = false;
      });
    }
    
    createPeerConnection();
    
    localStream.getAudioTracks().forEach(t => {
      peerConnection.addTrack(t, localStream);
    });
    
    await peerConnection.setRemoteDescription(data.sdp);
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await waitForIceGathering();
    
    const answerData = {
      type: 'answer',
      sdp: peerConnection.localDescription,
      from: myName
    };
    
    const answerCode = encode(answerData);
    myAnswerDisplay.textContent = answerCode;
    answerArea.classList.remove('hidden');
    
    connectBtn.disabled = false;
    connectBtn.querySelector('span').textContent = 'Generate Answer Code';
    
    setStatus('📤 Answer code ready — share back');
    
  } catch (error) {
    connectBtn.disabled = false;
    connectBtn.querySelector('span').textContent = 'Generate Answer Code';
    showError('Invalid code. Check and try again.');
  }
});

copyAnswerBtn.addEventListener('click', () => copyToClipboard(myAnswerDisplay.textContent, copyAnswerBtn));

shareAnswerBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  // Reuse paste menu — will show options
  const menu = document.getElementById('pasteMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  } else {
    // No menu yet, show alert
    const choice = prompt('Which pastebin?\n1. Rentry.co\n2. dpaste.org\n3. BinPaste.xyz\n4. JustPaste.it\n\nEnter number:');
    const sites = ['rentry', 'dpaste', 'binpaste', 'justpaste'];
    if (choice && sites[choice - 1]) {
      navigator.clipboard.writeText(myAnswerDisplay.textContent).then(() => {
        window.open(PASTE_SITES[sites[choice - 1]].url, '_blank');
      });
    }
  }
});

// ==================
// STEP 3: COMPLETE
// ==================
finishBtn.addEventListener('click', async () => {
  const code = answerCodeInput.value.trim();
  
  if (!code) {
    showError('Paste the answer code');
    return;
  }
  
  finishBtn.disabled = true;
  finishBtn.querySelector('span').textContent = 'Completing...';
  
  try {
    const data = decode(code);
    
    if (data.type !== 'answer') throw new Error('Not a valid answer code');
    if (!peerConnection) throw new Error('Connection lost. Please refresh.');
    
    markStep(2, 'done');
    
    await peerConnection.setRemoteDescription(data.sdp);
    
    setStatus('🔄 Establishing connection...');
    showConnectingScreen();
    
  } catch (error) {
    finishBtn.disabled = false;
    finishBtn.querySelector('span').textContent = 'Complete Connection';
    showError(error.message);
  }
});

// ==================
// PEER CONNECTION
// ==================
function createPeerConnection() {
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ]
  };
  
  peerConnection = new RTCPeerConnection(config);
  
  peerConnection.onicecandidate = (event) => {
    if (!event.candidate) markStep(3, 'done');
  };
  
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    
    if (state === 'connected') {
      connPill.classList.add('connected');
      connText.textContent = 'Connected';
      chatChip.textContent = 'ONLINE';
    } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
      connPill.classList.remove('connected');
      connText.textContent = 'Disconnected';
      chatChip.textContent = 'OFFLINE';
    }
  };
  
  peerConnection.ontrack = (event) => {
    if (event.track.kind === 'audio') {
      if (!remoteStream) remoteStream = new MediaStream();
      remoteStream.addTrack(event.track);
      remoteAudio.srcObject = remoteStream;
    } else if (event.track.kind === 'video') {
      if (!remoteStream) remoteStream = new MediaStream();
      remoteStream.addTrack(event.track);
      remoteVideo.srcObject = remoteStream;
      videoPanel.classList.remove('hidden');
      videoPlaceholder.classList.add('hidden');
    }
  };
  
  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };
}

function createDataChannel() {
  dataChannel = peerConnection.createDataChannel('chat');
  setupDataChannel();
}

function setupDataChannel() {
  dataChannel.onopen = () => {
    markStep(4, 'done');
    setTimeout(() => switchToMainScreen(), 700);
  };
  
  dataChannel.onclose = () => {
    addSystemMessage('Connection closed');
  };
  
  dataChannel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleDataMessage(data);
    } catch {
      addMessage(event.data, 'received');
    }
  };
}

function handleDataMessage(data) {
  switch(data.type) {
    case 'message':
      addMessage(data.text, 'received');
      break;
    case 'call-request':
      showIncomingCall();
      break;
    case 'call-accept':
      startCallUI();
      break;
    case 'call-reject':
      endCall(false);
      addSystemMessage('Call rejected');
      break;
    case 'call-end':
      endCall(false);
      addSystemMessage('Partner ended the call');
      break;
    case 'video-request':
      // Partner wants video — show panel
      videoPanel.classList.remove('hidden');
      break;
  }
}

function waitForIceGathering() {
  return new Promise((resolve) => {
    if (peerConnection.iceGatheringState === 'complete') resolve();
    else {
      peerConnection.addEventListener('icegatheringstatechange', () => {
        if (peerConnection.iceGatheringState === 'complete') resolve();
      });
      setTimeout(resolve, 3000);
    }
  });
}

// ==================
// CONNECTING SCREEN
// ==================
function showConnectingScreen() {
  landingScreen.classList.add('hidden');
  connectingScreen.classList.remove('hidden');
  
  document.querySelectorAll('.conn-step').forEach(s => {
    s.classList.remove('done', 'active');
  });
  
  markStep(1, 'done');
  if (peerConnection.remoteDescription) markStep(2, 'done');
}

function markStep(num, state) {
  const step = document.querySelector(`.conn-step[data-step="${num}"]`);
  if (!step) return;
  
  if (state === 'done') {
    step.classList.add('done');
    step.querySelector('.step-check').textContent = '✓';
  }
}

function switchToMainScreen() {
  connectingScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  
  partnerNameDisplay.textContent = partnerName;
  partnerAvatar.textContent = (partnerName || '?').charAt(0).toUpperCase();
  
  addSystemMessage('Connected to ' + partnerName);
  
  if (!isSavedPartner) {
    setTimeout(() => {
      saveContactModal.classList.remove('hidden');
      saveContactName.value = partnerName;
    }, 1500);
  }
}

// ==================
// SAVE CONTACT
// ==================
saveContactBtn.addEventListener('click', () => {
  const name = saveContactName.value.trim().toLowerCase();
  if (!name) {
    alert('Enter a name');
    return;
  }
  
  const contacts = getContacts();
  const existing = contacts.findIndex(c => c.name.toLowerCase() === name);
  
  const contact = {
    name: name,
    myName: myName,
    partnerName: partnerName,
    pasteUrl: saveContactPaste.value.trim(),
    lastConnected: Date.now(),
    createdAt: existing >= 0 ? contacts[existing].createdAt : Date.now()
  };
  
  if (existing >= 0) {
    contacts[existing] = contact;
  } else {
    contacts.push(contact);
  }
  
  saveContacts(contacts);
  saveContactModal.classList.add('hidden');
  partnerName = name;
  partnerNameDisplay.textContent = name;
  isSavedPartner = true;
  addSystemMessage('Contact saved as "' + name + '"');
});

skipSaveBtn.addEventListener('click', () => {
  saveContactModal.classList.add('hidden');
});

// ==================
// CHAT
// ==================
sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'message', text }));
    addMessage(text, 'sent');
    messageInput.value = '';
  } else {
    addSystemMessage('Not connected');
  }
}

function addMessage(text, type) {
  const div = document.createElement('div');
  div.className = 'message ' + type;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'message system';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ==================
// RINGTONE (Web Audio API)
// ==================
function startRingtone() {
  try {
    stopRingtone();
    
    ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playTone = () => {
      const now = ringtoneCtx.currentTime;
      
      [0, 0.4].forEach((offset) => {
        const osc = ringtoneCtx.createOscillator();
        const gain = ringtoneCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = 850;
        
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.3, now + offset + 0.05);
        gain.gain.linearRampToValueAtTime(0.3, now + offset + 0.25);
        gain.gain.linearRampToValueAtTime(0, now + offset + 0.3);
        
        osc.connect(gain);
        gain.connect(ringtoneCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.35);
      });
    };
    
    playTone();
    ringtoneInterval = setInterval(playTone, 1500);
    
  } catch (e) {
    console.log('Ringtone error:', e);
  }
}

function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
  if (ringtoneCtx) {
    try { ringtoneCtx.close(); } catch {}
    ringtoneCtx = null;
  }
}

// ==================
// CALLS
// ==================
startCallBtn.addEventListener('click', () => {
  if (!dataChannel || dataChannel.readyState !== 'open') return;
  
  if (localStream) {
    localStream.getAudioTracks().forEach(t => t.enabled = true);
  }
  micMuted = false;
  muteMicBtn.classList.remove('muted');
  muteMicBtn.querySelector('span').textContent = 'Mute';
  
  dataChannel.send(JSON.stringify({ type: 'call-request' }));
  
  callButtonsIdle.classList.add('hidden');
  callStatus.classList.remove('hidden');
  callStatusText.textContent = 'Calling ' + partnerName + '...';
  isInCall = true;
});

function showIncomingCall() {
  callButtonsIdle.classList.add('hidden');
  callButtonsIncoming.classList.remove('hidden');
  callStatus.classList.remove('hidden');
  callStatusText.textContent = partnerName + ' is calling...';
  
  startRingtone();
}

acceptCallBtn.addEventListener('click', () => {
  stopRingtone();
  
  if (localStream) {
    localStream.getAudioTracks().forEach(t => t.enabled = true);
  }
  micMuted = false;
  muteMicBtn.classList.remove('muted');
  muteMicBtn.querySelector('span').textContent = 'Mute';
  
  dataChannel.send(JSON.stringify({ type: 'call-accept' }));
  startCallUI();
});

rejectCallBtn.addEventListener('click', () => {
  stopRingtone();
  dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  callButtonsIncoming.classList.add('hidden');
  callButtonsIdle.classList.remove('hidden');
  callStatus.classList.add('hidden');
});

function startCallUI() {
  stopRingtone();
  
  callButtonsIdle.classList.add('hidden');
  callButtonsIncoming.classList.add('hidden');
  callStatus.classList.add('hidden');
  callActive.classList.remove('hidden');
  
  callStartTime = Date.now();
  callTimer.textContent = '00:00';
  
  if (callTimerInterval) clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    callTimer.textContent = `${mins}:${secs}`;
  }, 1000);
  
  isInCall = true;
  addSystemMessage('Call started');
}

muteMicBtn.addEventListener('click', () => {
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

toggleVideoBtn.addEventListener('click', async () => {
  if (!videoEnabled) {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      const videoTrack = videoStream.getVideoTracks()[0];
      
      if (!localStream) localStream = new MediaStream();
      localStream.addTrack(videoTrack);
      
      peerConnection.addTrack(videoTrack, localStream);
      
      localVideo.srcObject = localStream;
      videoPanel.classList.remove('hidden');
      videoPlaceholder.classList.add('hidden');
      
      videoEnabled = true;
      toggleVideoBtn.classList.add('active');
      
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'video-request' }));
      }
      
      addSystemMessage('Video enabled');
      
    } catch (err) {
      alert('Camera access denied or not available');
    }
  } else {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => {
        t.stop();
        localStream.removeTrack(t);
      });
    }
    
    localVideo.srcObject = null;
    videoEnabled = false;
    toggleVideoBtn.classList.remove('active');
    
    // Hide video panel only if no remote video
    if (!remoteVideo.srcObject || remoteVideo.srcObject.getVideoTracks().length === 0) {
      videoPanel.classList.add('hidden');
    }
    
    addSystemMessage('Video disabled');
  }
});

hangupBtn.addEventListener('click', () => {
  dataChannel.send(JSON.stringify({ type: 'call-end' }));
  endCall(true);
});

function endCall(notify) {
  stopRingtone();
  
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  
  if (localStream) {
    localStream.getAudioTracks().forEach(t => {
      t.enabled = false;
    });
  }
  micMuted = true;
  muteMicBtn.classList.add('muted');
  muteMicBtn.querySelector('span').textContent = 'Mute';
  
  if (videoEnabled && localStream) {
    localStream.getVideoTracks().forEach(t => {
      t.stop();
      localStream.removeTrack(t);
    });
    localVideo.srcObject = null;
    videoEnabled = false;
    toggleVideoBtn.classList.remove('active');
  }
  
  callActive.classList.add('hidden');
  callButtonsIncoming.classList.add('hidden');
  callButtonsIdle.classList.remove('hidden');
  callStatus.classList.add('hidden');
  
  isInCall = false;
  
  if (notify) addSystemMessage('Call ended');
}

// ==================
// MENU / RESET
// ==================
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('hidden');
});

resetBtn.addEventListener('click', () => {
  if (confirm('Disconnect and return home?')) {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (peerConnection) peerConnection.close();
    if (callTimerInterval) clearInterval(callTimerInterval);
    stopRingtone();
    
    peerConnection = null;
    dataChannel = null;
    localStream = null;
    remoteStream = null;
    isInCall = false;
    micMuted = false;
    videoEnabled = false;
    
    showHome();
  }
});

backBtn.addEventListener('click', () => {
  if (confirm('Return home? Connection will close.')) {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    stopRingtone();
    
    peerConnection = null;
    dataChannel = null;
    localStream = null;
    remoteStream = null;
    isInCall = false;
    
    showHome();
  }
});

console.log('SoloDS NextLast v12 loaded');
