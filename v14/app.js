/* ============================================================
   SoloDS NextLast v14 — Final
   Features: 3-panel PC layout · Mobile tabs · File sharing ·
   5 themes · Auto-copy + toast · Better ringtone · All v13 features
   ============================================================ */

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
let currentShareCode = '';
let currentTheme = 'midnight';

// File transfer state
let incomingFile = null;
let incomingFileChunks = [];
let incomingFileSize = 0;
let incomingFileName = '';
let incomingFileType = '';
let isReceivingFile = false;

const CHUNK_SIZE = 16 * 1024; // 16KB chunks
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

/* ============================================================
   DOM REFERENCES
   ============================================================ */

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
const shareCodeBtn = document.getElementById('shareCodeBtn');
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
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');

const callButtonsIdle = document.getElementById('callButtonsIdle');
const callButtonsIncoming = document.getElementById('callButtonsIncoming');
const callActive = document.getElementById('callActive');
const startCallBtn = document.getElementById('startCallBtn');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const hangupBtn = document.getElementById('hangupBtn');
const muteMicBtn = document.getElementById('muteMicBtn');
const callTimer = document.getElementById('callTimer');
const callStatus = document.getElementById('callStatus');
const callStatusText = document.getElementById('callStatusText');

const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const videoOffline = document.getElementById('videoOffline');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const remoteAudio = document.getElementById('remoteAudio');

const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const resetBtn = document.getElementById('resetBtn');

const saveContactModal = document.getElementById('saveContactModal');
const saveContactName = document.getElementById('saveContactName');
const saveContactPaste = document.getElementById('saveContactPaste');
const saveContactBtn = document.getElementById('saveContactBtn');
const skipSaveBtn = document.getElementById('skipSaveBtn');

const themeBtnHome = document.getElementById('themeBtnHome');
const themeBtnMain = document.getElementById('themeBtnMain');
const themeModal = document.getElementById('themeModal');
const closeThemeModal = document.getElementById('closeThemeModal');

const pasteSheetOverlay = document.getElementById('pasteSheetOverlay');
const closePasteSheet = document.getElementById('closePasteSheet');

const toastContainer = document.getElementById('toastContainer');
const previewOverlay = document.getElementById('previewOverlay');
const previewContent = document.getElementById('previewContent');
const previewClose = document.getElementById('previewClose');

/* ============================================================
   THEME
   ============================================================ */

function loadTheme() {
  const theme = localStorage.getItem('solods_theme') || 'midnight';
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  updateThemeModalActive();
}

function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('solods_theme', theme);
  updateThemeModalActive();
  showToast('Theme changed', 'info');
}

function updateThemeModalActive() {
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.themeChoice === currentTheme);
  });
}

function openThemeModal() { themeModal.classList.remove('hidden'); }
function closeThemeModalFn() { themeModal.classList.add('hidden'); }

themeBtnHome?.addEventListener('click', openThemeModal);
themeBtnMain?.addEventListener('click', openThemeModal);
closeThemeModal?.addEventListener('click', closeThemeModalFn);

themeModal?.addEventListener('click', (e) => {
  if (e.target === themeModal) closeThemeModalFn();
});

document.querySelectorAll('.theme-option').forEach(opt => {
  opt.addEventListener('click', () => {
    setTheme(opt.dataset.themeChoice);
    setTimeout(closeThemeModalFn, 300);
  });
});

/* ============================================================
   TOASTS
   ============================================================ */

function showToast(msg, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ============================================================
   INIT
   ============================================================ */

window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadContacts();
  setupMobileTabs();
  
  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    partnerCodeInput.value = decodeURIComponent(hash.substring(1));
    setStatus('📥 Code detected from link');
    showLanding();
  }
});

/* ============================================================
   MOBILE TABS
   ============================================================ */

function setupMobileTabs() {
  const tabs = document.querySelectorAll('.mobile-tab');
  const panels = document.querySelectorAll('.panel');
  
  // Set chat active by default on mobile
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
        if (p.dataset.panel === target) {
          p.classList.add('active-panel');
        }
      });
    });
  });
}

/* ============================================================
   CONTACTS
   ============================================================ */

function getContacts() {
  try {
    return JSON.parse(localStorage.getItem('solods_contacts') || '[]');
  } catch { return []; }
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
    const openPaste = confirm(`Open saved paste URL?\n\n${contact.pasteUrl}\n\nClick OK to open in new tab.`);
    if (openPaste) window.open(contact.pasteUrl, '_blank');
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

/* ============================================================
   HELPERS
   ============================================================ */

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
  return navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '✅ Copied!';
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    }
    showToast('✅ Copied to clipboard', 'success');
    return true;
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    showToast('✅ Copied to clipboard', 'success');
    return false;
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

/* ============================================================
   PASTE BOTTOM SHEET
   ============================================================ */

const PASTE_SITES = {
  rentry: { url: 'https://rentry.co' },
  dpaste: { url: 'https://dpaste.org' },
  binpaste: { url: 'https://binpaste.xyz' },
  justpaste: { url: 'https://justpaste.it' }
};

function openPasteSheet(codeToShare) {
  currentShareCode = codeToShare;
  
  navigator.clipboard.writeText(codeToShare).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = codeToShare;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  });
  
  pasteSheetOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePasteSheetFn() {
  pasteSheetOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

shareCodeBtn?.addEventListener('click', () => openPasteSheet(myCode));
shareAnswerBtn?.addEventListener('click', () => openPasteSheet(myAnswerDisplay.textContent));
closePasteSheet?.addEventListener('click', closePasteSheetFn);

pasteSheetOverlay?.addEventListener('click', (e) => {
  if (e.target === pasteSheetOverlay) closePasteSheetFn();
});

document.querySelectorAll('.sheet-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const site = btn.dataset.site;
    const siteInfo = PASTE_SITES[site];
    
    navigator.clipboard.writeText(currentShareCode).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = currentShareCode;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
    });
    
    window.open(siteInfo.url, '_blank');
    closePasteSheetFn();
  });
});

/* ============================================================
   STEP 1: GENERATE CODE
   ============================================================ */

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
    
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
    
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
    
    // Auto-copy on generate
    copyToClipboard(myCode, copyCodeBtn);
    
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

/* ============================================================
   STEP 2: PASTE PARTNER CODE
   ============================================================ */

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
      localStream.getAudioTracks().forEach(t => { t.enabled = false; });
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
    
    copyToClipboard(answerCode, copyAnswerBtn);
    
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

/* ============================================================
   STEP 3: COMPLETE
   ============================================================ */

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

/* ============================================================
   PEER CONNECTION
   ============================================================ */

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
      videoOffline.classList.add('hidden');
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
    // Handle binary or text
    if (typeof event.data === 'string') {
      try {
        const data = JSON.parse(event.data);
        handleDataMessage(data);
      } catch {
        addMessage(event.data, 'received');
      }
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
      // Partner enabled video
      videoOffline.classList.add('hidden');
      break;
    case 'file-start':
      handleFileStart(data);
      break;
    case 'file-chunk':
      handleFileChunk(data);
      break;
    case 'file-end':
      handleFileEnd(data);
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

/* ============================================================
   CONNECTING SCREEN
   ============================================================ */

function showConnectingScreen() {
  landingScreen.classList.add('hidden');
  connectingScreen.classList.remove('hidden');
  
  document.querySelectorAll('.conn-step').forEach(s => s.classList.remove('done'));
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
  
  // Setup mobile tabs after screen shown
  if (window.innerWidth <= 900) {
    document.querySelector('.panel-chat')?.classList.add('active-panel');
  }
  
  if (!isSavedPartner) {
    setTimeout(() => {
      saveContactModal.classList.remove('hidden');
      saveContactName.value = partnerName;
    }, 1500);
  }
}

/* ============================================================
   SAVE CONTACT
   ============================================================ */

saveContactBtn.addEventListener('click', () => {
  const name = saveContactName.value.trim().toLowerCase();
  if (!name) { alert('Enter a name'); return; }
  
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
  
  if (existing >= 0) contacts[existing] = contact;
  else contacts.push(contact);
  
  saveContacts(contacts);
  saveContactModal.classList.add('hidden');
  partnerName = name;
  partnerNameDisplay.textContent = name;
  isSavedPartner = true;
  addSystemMessage('Contact saved as "' + name + '"');
  showToast('Contact saved', 'success');
});

skipSaveBtn.addEventListener('click', () => {
  saveContactModal.classList.add('hidden');
});

/* ============================================================
   CHAT
   ============================================================ */

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

/* ============================================================
   FILE SHARING
   ============================================================ */

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) sendFile(file);
  fileInput.value = '';
});

async function sendFile(file) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    showToast('Not connected', 'error');
    return;
  }
  
  if (file.size > MAX_FILE_SIZE) {
    showToast('File too large (max 500MB)', 'error');
    return;
  }
  
  try {
    // Send file metadata
    dataChannel.send(JSON.stringify({
      type: 'file-start',
      name: file.name,
      size: file.size,
      mimeType: file.type
    }));
    
    // Wait for metadata to send
    await new Promise(r => setTimeout(r, 200));
    
    // Send file in chunks
    const arrayBuffer = await file.arrayBuffer();
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
    let offset = 0;
    let chunkIndex = 0;
    
    // Show sending message
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message sent';
    msgDiv.innerHTML = `
      <div class="file-attach">
        <div class="file-icon">📎</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-size">Sending... <span id="progress-${Date.now()}">0%</span></div>
        </div>
      </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const progressSpan = msgDiv.querySelector('span[id^="progress-"]');
    
    while (offset < arrayBuffer.byteLength) {
      const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
      
      // Convert to base64
      const base64Chunk = arrayBufferToBase64(chunk);
      
      dataChannel.send(JSON.stringify({
        type: 'file-chunk',
        data: base64Chunk,
        index: chunkIndex
      }));
      
      offset += CHUNK_SIZE;
      chunkIndex++;
      
      // Update progress
      const progress = Math.min(100, Math.round((offset / arrayBuffer.byteLength) * 100));
      if (progressSpan) progressSpan.textContent = progress + '%';
      
      // Small delay for backpressure
      if (chunkIndex % 10 === 0) await new Promise(r => setTimeout(r, 10));
    }
    
    // Send end signal
    dataChannel.send(JSON.stringify({
      type: 'file-end',
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks: chunkIndex
    }));
    
    if (progressSpan) progressSpan.textContent = 'Sent ✓';
    
    showToast('File sent: ' + file.name, 'success');
    
  } catch (error) {
    console.error('File send error:', error);
    showToast('Failed to send file', 'error');
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function handleFileStart(data) {
  incomingFile = {
    name: data.name,
    size: data.size,
    mimeType: data.mimeType
  };
  incomingFileChunks = [];
  incomingFileSize = data.size;
  incomingFileName = data.name;
  incomingFileType = data.mimeType;
  isReceivingFile = true;
  
  // Show receiving message
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message received';
  msgDiv.id = 'receiving-file';
  msgDiv.innerHTML = `
    <div class="file-attach">
      <div class="file-icon">📥</div>
      <div class="file-info">
        <div class="file-name">${escapeHtml(data.name)}</div>
        <div class="file-size">Receiving... <span id="recv-progress">0%</span></div>
      </div>
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleFileChunk(data) {
  if (!isReceivingFile) return;
  
  incomingFileChunks.push(data.data);
  
  const received = incomingFileChunks.length;
  const total = Math.ceil(incomingFileSize / CHUNK_SIZE);
  const progress = Math.min(100, Math.round((received / total) * 100));
  
  const progressSpan = document.getElementById('recv-progress');
  if (progressSpan) progressSpan.textContent = progress + '%';
}

function handleFileEnd(data) {
  isReceivingFile = false;
  
  const msgDiv = document.getElementById('receiving-file');
  if (msgDiv) msgDiv.remove();
  
  // Assemble file
  try {
    const buffers = incomingFileChunks.map(base64ToArrayBuffer);
    const blob = new Blob(buffers, { type: data.mimeType });
    const url = URL.createObjectURL(blob);
    
    // Create message
    const div = document.createElement('div');
    div.className = 'message received';
    
    const isImage = data.mimeType.startsWith('image/');
    const isVideo = data.mimeType.startsWith('video/');
    
    if (isImage) {
      div.innerHTML = `
        <div class="file-attach">
          <div class="file-info">
            <div class="file-name">${escapeHtml(data.name)}</div>
            <div class="file-size">${formatBytes(data.size)}</div>
          </div>
        </div>
        <img src="${url}" alt="${escapeHtml(data.name)}">
      `;
      const img = div.querySelector('img');
      img.addEventListener('click', () => openPreview(url, 'image'));
    } else if (isVideo) {
      div.innerHTML = `
        <div class="file-attach">
          <div class="file-info">
            <div class="file-name">${escapeHtml(data.name)}</div>
            <div class="file-size">${formatBytes(data.size)}</div>
          </div>
        </div>
        <video src="${url}" controls style="max-width:100%;border-radius:10px;margin-top:4px;"></video>
      `;
    } else {
      div.innerHTML = `
        <div class="file-attach">
          <div class="file-icon">📎</div>
          <div class="file-info">
            <div class="file-name">${escapeHtml(data.name)}</div>
            <div class="file-size">${formatBytes(data.size)} · <a href="${url}" download="${escapeHtml(data.name)}" style="color:inherit;font-weight:700;">Download</a></div>
          </div>
        </div>
      `;
    }
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    showToast('File received: ' + data.name, 'success');
    
  } catch (error) {
    console.error('File assembly error:', error);
    showToast('Failed to receive file', 'error');
  }
  
  // Reset
  incomingFile = null;
  incomingFileChunks = [];
}

/* ============================================================
   PREVIEW
   ============================================================ */

function openPreview(url, type) {
  previewContent.innerHTML = '';
  if (type === 'image') {
    const img = document.createElement('img');
    img.src = url;
    previewContent.appendChild(img);
  }
  previewOverlay.classList.remove('hidden');
}

previewClose.addEventListener('click', () => {
  previewOverlay.classList.add('hidden');
  previewContent.innerHTML = '';
});

previewOverlay.addEventListener('click', (e) => {
  if (e.target === previewOverlay) {
    previewOverlay.classList.add('hidden');
    previewContent.innerHTML = '';
  }
});

/* ============================================================
   RINGTONE (Better — Nokia-style 2-tone)
   ============================================================ */

function startRingtone() {
  try {
    stopRingtone();
    ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playTone = () => {
      if (!ringtoneCtx) return;
      const now = ringtoneCtx.currentTime;
      
      // Nokia-style pattern: 3 quick pulses
      const pulses = [
        { time: 0.0, freq: 1000, dur: 0.1 },
        { time: 0.15, freq: 800, dur: 0.1 },
        { time: 0.3, freq: 1000, dur: 0.1 },
        { time: 0.5, freq: 1000, dur: 0.1 },
        { time: 0.65, freq: 800, dur: 0.1 },
        { time: 0.8, freq: 1000, dur: 0.1 }
      ];
      
      pulses.forEach(p => {
        const osc = ringtoneCtx.createOscillator();
        const gain = ringtoneCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = p.freq;
        
        gain.gain.setValueAtTime(0, now + p.time);
        gain.gain.linearRampToValueAtTime(0.25, now + p.time + 0.01);
        gain.gain.linearRampToValueAtTime(0.25, now + p.time + p.dur - 0.01);
        gain.gain.linearRampToValueAtTime(0, now + p.time + p.dur);
        
        osc.connect(gain);
        gain.connect(ringtoneCtx.destination);
        osc.start(now + p.time);
        osc.stop(now + p.time + p.dur + 0.05);
      });
    };
    
    playTone();
    ringtoneInterval = setInterval(playTone, 2200);
    
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

/* ============================================================
   CALLS
   ============================================================ */

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
  
  // On mobile, switch to voice tab
  if (window.innerWidth <= 900) {
    document.querySelector('.mobile-tab[data-tab="voice"]')?.click();
  }
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

hangupBtn.addEventListener('click', () => {
  if (dataChannel) dataChannel.send(JSON.stringify({ type: 'call-end' }));
  endCall(true);
});

function endCall(notify) {
  stopRingtone();
  
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  
  if (localStream) {
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
  }
  micMuted = true;
  muteMicBtn.classList.add('muted');
  muteMicBtn.querySelector('span').textContent = 'Mute';
  
  callActive.classList.add('hidden');
  callButtonsIncoming.classList.add('hidden');
  callButtonsIdle.classList.remove('hidden');
  callStatus.classList.add('hidden');
  
  isInCall = false;
  if (notify) addSystemMessage('Call ended');
}

/* ============================================================
   VIDEO
   ============================================================ */

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
      videoOffline.classList.add('hidden');
      
      videoEnabled = true;
      toggleVideoBtn.classList.add('active');
      toggleVideoBtn.querySelector('span').textContent = 'Turn Off';
      
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'video-request' }));
      }
      
      addSystemMessage('Video enabled');
      
    } catch (err) {
      showToast('Camera access denied', 'error');
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
    toggleVideoBtn.querySelector('span').textContent = 'Turn On';
    
    // Show offline if no remote video
    if (!remoteVideo.srcObject || remoteVideo.srcObject.getVideoTracks().length === 0) {
      videoOffline.classList.remove('hidden');
    }
    
    addSystemMessage('Video disabled');
  }
});

/* ============================================================
   MENU / RESET
   ============================================================ */

menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
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
    isReceivingFile = false;
    incomingFileChunks = [];
    
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

console.log('SoloDS NextLast v14 loaded');
console.log('Themes: midnight · daylight · ocean · sunset · forest');
