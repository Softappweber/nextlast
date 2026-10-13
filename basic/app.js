/* ============================================================
   SoloDS v16 — Approved ID Edition
   Whitelist security · TURN for cross-network · Code exchange backup
   ============================================================ */

/* ============================================================
   🔐 APPROVED IDS — EDIT THIS LIST ONLY
   Only IDs present here can go online.
   ============================================================ */

const APPROVED_IDS = [
  'vikaas66',
  'sushant',
  'chinu',
  // Add more approved customer IDs here
];

/* ============================================================
   TURN + STUN for cross-network reliability
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

/* ============================================================
   GLOBAL STATE
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

let myPublicSlug = '';
let myPublicPeer = null;
let isOnline = false;
let incomingPeerCall = null;
let isCallerMode = false;
let callerTargetName = '';
let callerTargetSlug = '';
let callerPeer = null;

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
   DOM REFERENCES
   ============================================================ */

const homeScreen = document.getElementById('homeScreen');
const landingScreen = document.getElementById('landingScreen');
const connectingScreen = document.getElementById('connectingScreen');
const mainScreen = document.getElementById('mainScreen');
const callerScreen = document.getElementById('callerScreen');

const contactsList = document.getElementById('contactsList');
const emptyState = document.getElementById('emptyState');
const addContactBtn = document.getElementById('addContactBtn');
const backHomeBtn = document.getElementById('backHomeBtn');

const onlineCard = document.getElementById('onlineCard');
const onlineDot = document.getElementById('onlineDot');
const onlineLabel = document.getElementById('onlineLabel');
const onlineSub = document.getElementById('onlineSub');
const goOnlineBtn = document.getElementById('goOnlineBtn');

const linkCard = document.getElementById('linkCard');
const myPublicLink = document.getElementById('myPublicLink');
const copyPublicLink = document.getElementById('copyPublicLink');
const sharePublicLink = document.getElementById('sharePublicLink');

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
const shareScreenBtn = document.getElementById('shareScreenBtn');
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

const callerAvatar = document.getElementById('callerAvatar');
const callerName = document.getElementById('callerName');
const callerStatus = document.getElementById('callerStatus');
const callerCallBtn = document.getElementById('callerCallBtn');
const callerVideoBtn = document.getElementById('callerVideoBtn');
const callerTargetNameEl = document.getElementById('callerTargetName');
const callerCancelBtn = document.getElementById('callerCancelBtn');

const incomingCallModal = document.getElementById('incomingCallModal');
const incomingAvatar = document.getElementById('incomingAvatar');
const incomingName = document.getElementById('incomingName');
const incomingAcceptBtn = document.getElementById('incomingAcceptBtn');
const incomingRejectBtn = document.getElementById('incomingRejectBtn');

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
  checkPublicLinkInURL();
});

function checkPublicLinkInURL() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  let targetSlug = params.get('call');
  if (!targetSlug && hash.startsWith('#call=')) {
    targetSlug = hash.substring(6);
  }
  if (targetSlug) {
    enterCallerMode(targetSlug.toLowerCase());
  }
}

/* ============================================================
   GO ONLINE / OFFLINE (with whitelist)
   ============================================================ */

goOnlineBtn.addEventListener('click', async () => {
  if (isOnline) {
    goOffline();
  } else {
    await goOnline();
  }
});

async function goOnline() {
  let name = localStorage.getItem('solods_myname');

  if (!name) {
    name = prompt('Enter your approved SoloDS ID:');
    if (!name || name.length < 2) {
      showToast('Please enter a valid ID', 'error');
      return;
    }
    name = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // 🔐 WHITELIST CHECK
  if (!APPROVED_IDS.includes(name)) {
    showToast('Invalid ID. Contact SoloDS for access.', 'error', 5000);
    localStorage.removeItem('solods_myname');
    return;
  }

  localStorage.setItem('solods_myname', name);
  myName = name;
  myPublicSlug = name;

  goOnlineBtn.disabled = true;
  goOnlineBtn.querySelector('span').textContent = 'Connecting...';

  try {
    const peerId = 'solods-' + myPublicSlug;

    myPublicPeer = new Peer(peerId, {
      debug: 1,
      config: ICE_CONFIG
    });

    myPublicPeer.on('open', () => {
      isOnline = true;
      updateOnlineUI(true);
      goOnlineBtn.disabled = false;
      goOnlineBtn.querySelector('span').textContent = 'Go Offline';
      goOnlineBtn.classList.add('offline-btn');

      const publicUrl = getPublicUrl(myPublicSlug);
      myPublicLink.textContent = publicUrl;
      linkCard.classList.remove('hidden');

      showToast('You are online!', 'success');
    });

    myPublicPeer.on('call', (call) => {
      incomingPeerCall = call;
      showIncomingCallModal(call.metadata?.name || 'Someone');
      startRingtone();
    });

    myPublicPeer.on('connection', (conn) => {
      dataChannel = conn;
      setupPeerDataChannel();
    });

    myPublicPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'unavailable-id') {
        showToast('This ID is already online', 'error');
      } else if (err.type === 'network') {
        showToast('Network error', 'error');
      } else {
        showToast('Connection error: ' + err.type, 'error');
      }
      goOffline();
    });

    myPublicPeer.on('disconnected', () => {
      setTimeout(() => {
        if (myPublicPeer && !myPublicPeer.destroyed) {
          myPublicPeer.reconnect();
        }
      }, 2000);
    });

  } catch (error) {
    console.error(error);
    showToast('Failed to go online', 'error');
    goOnlineBtn.disabled = false;
    goOnlineBtn.querySelector('span').textContent = 'Go Online';
  }
}

function goOffline() {
  if (myPublicPeer) {
    try { myPublicPeer.destroy(); } catch {}
    myPublicPeer = null;
  }
  isOnline = false;
  updateOnlineUI(false);
  goOnlineBtn.disabled = false;
  goOnlineBtn.querySelector('span').textContent = 'Go Online';
  goOnlineBtn.classList.remove('offline-btn');
  linkCard.classList.add('hidden');
}

function updateOnlineUI(online) {
  if (online) {
    onlineDot.classList.add('active');
    onlineLabel.textContent = 'Online';
    onlineSub.textContent = 'Anyone with your link can call';
    onlineCard.classList.add('online');
  } else {
    onlineDot.classList.remove('active');
    onlineLabel.textContent = 'Offline';
    onlineSub.textContent = 'Go online to receive calls';
    onlineCard.classList.remove('online');
  }
}

function getPublicUrl(slug) {
  const base = window.location.origin + window.location.pathname;
  return base + '?call=' + slug;
}

/* ============================================================
   PUBLIC LINK
   ============================================================ */

copyPublicLink.addEventListener('click', () => {
  const url = myPublicLink.textContent;
  navigator.clipboard.writeText(url).then(() => {
    showToast('✅ Link copied', 'success');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ Link copied', 'success');
  });
});

sharePublicLink.addEventListener('click', async () => {
  const url = myPublicLink.textContent;
  if (navigator.share) {
    try { await navigator.share({ title: 'Call me on SoloDS', url }); } catch {}
  } else {
    copyPublicLink.click();
  }
});

/* ============================================================
   CALLER MODE
   ============================================================ */

function enterCallerMode(targetSlug) {
  isCallerMode = true;
  callerTargetSlug = targetSlug;
  callerTargetName = targetSlug;

  homeScreen.classList.add('hidden');
  landingScreen.classList.add('hidden');
  connectingScreen.classList.add('hidden');
  mainScreen.classList.add('hidden');
  callerScreen.classList.remove('hidden');

  callerAvatar.textContent = targetSlug.charAt(0).toUpperCase();
  callerName.textContent = targetSlug;
  callerTargetNameEl.textContent = targetSlug;
  callerStatus.textContent = 'Connecting...';

  const callerId = 'solods-caller-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

  callerPeer = new Peer(callerId, { debug: 1, config: ICE_CONFIG });

  callerPeer.on('open', () => {
    callerStatus.textContent = 'Ready to call';
    callerCallBtn.disabled = false;
    callerVideoBtn.disabled = false;
  });

  callerPeer.on('error', (err) => {
    console.error('Caller peer error:', err);
    if (err.type === 'peer-unavailable') {
      callerStatus.textContent = targetSlug + ' is offline';
      showToast(targetSlug + ' is not online right now', 'error');
    } else {
      callerStatus.textContent = 'Connection error';
    }
  });
}

callerCallBtn.addEventListener('click', () => startCallAsCaller(false));
callerVideoBtn.addEventListener('click', () => startCallAsCaller(true));

async function startCallAsCaller(withVideo) {
  if (!callerPeer) return;

  callerStatus.textContent = 'Requesting mic...';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: withVideo ? { width: 640, height: 480 } : false
    });

    if (withVideo) videoEnabled = true;

    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
    callerStatus.textContent = 'Calling ' + callerTargetName + '...';

    const peerId = 'solods-' + callerTargetSlug;

    const call = callerPeer.call(peerId, localStream, {
      metadata: { name: localStorage.getItem('solods_myname') || 'Anonymous' }
    });

    if (!call) {
      showToast('Failed to initiate call', 'error');
      callerStatus.textContent = 'Call failed';
      return;
    }

    incomingPeerCall = call;

    call.on('stream', (remoteStreamObj) => {
      remoteStream = remoteStreamObj;
      remoteAudio.srcObject = remoteStream;

      if (remoteStreamObj.getVideoTracks().length > 0) {
        remoteVideo.srcObject = remoteStreamObj;
        videoOffline.classList.add('hidden');
      }

      callerScreen.classList.add('hidden');
      mainScreen.classList.remove('hidden');

      partnerName = callerTargetName;
      partnerNameDisplay.textContent = partnerName;
      partnerAvatar.textContent = partnerName.charAt(0).toUpperCase();

      if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);

      startCallUI();
      addSystemMessage('Connected to ' + partnerName);
      showToast('Connected!', 'success');
    });

    call.on('close', () => {
      endCall(true);
      showHome();
    });

  } catch (error) {
    console.error(error);
    if (error.name === 'NotAllowedError') {
      callerStatus.textContent = 'Mic access required';
    } else {
      callerStatus.textContent = 'Failed to call';
    }
  }
}

callerCancelBtn.addEventListener('click', () => {
  if (callerPeer) { try { callerPeer.destroy(); } catch {} callerPeer = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  isCallerMode = false;
  callerScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
});

/* ============================================================
   INCOMING CALL MODAL
   ============================================================ */

function showIncomingCallModal(callerNameText) {
  incomingAvatar.textContent = callerNameText.charAt(0).toUpperCase();
  incomingName.textContent = callerNameText;
  incomingCallModal.classList.remove('hidden');
}

incomingAcceptBtn.addEventListener('click', async () => {
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

    incomingPeerCall.on('stream', (remoteStreamObj) => {
      remoteStream = remoteStreamObj;
      remoteAudio.srcObject = remoteStream;

      if (remoteStreamObj.getVideoTracks().length > 0) {
        remoteVideo.srcObject = remoteStreamObj;
        videoOffline.classList.add('hidden');
      }

      homeScreen.classList.add('hidden');
      mainScreen.classList.remove('hidden');

      partnerName = incomingPeerCall.metadata?.name || 'Caller';
      partnerNameDisplay.textContent = partnerName;
      partnerAvatar.textContent = partnerName.charAt(0).toUpperCase();

      startCallUI();
      addSystemMessage('Connected to ' + partnerName);
    });

    incomingPeerCall.on('close', () => {
      endCall(true);
      if (isOnline) {
        homeScreen.classList.remove('hidden');
        mainScreen.classList.add('hidden');
      } else {
        showHome();
      }
    });

  } catch (error) {
    console.error(error);
    showToast('Failed to accept call', 'error');
  }
});

incomingRejectBtn.addEventListener('click', () => {
  stopRingtone();
  incomingCallModal.classList.add('hidden');
  if (incomingPeerCall) {
    try { incomingPeerCall.close(); } catch {}
    incomingPeerCall = null;
  }
});

/* ============================================================
   PEERJS DATA CHANNEL
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
        <div class="contact-meta">${contact.slug ? '@' + escapeHtml(contact.slug) : (contact.pasteUrl ? escapeHtml(contact.pasteUrl) : formatTime(contact.lastConnected))}</div>
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
  if (contact.slug) { enterCallerMode(contact.slug); return; }
  partnerName = contact.name;
  isSavedPartner = true;
  myName = contact.myName || 'me';
  showLanding();
  userNameInput.value = myName;
  setStatus(`Contact "${contact.name}" loaded`);
  if (contact.pasteUrl) {
    const openPaste = confirm(`Open saved paste URL?\n\n${contact.pasteUrl}`);
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
  callerScreen.classList.add('hidden');
  loadContacts();
}

function showLanding() {
  homeScreen.classList.add('hidden');
  landingScreen.classList.remove('hidden');
  connectingScreen.classList.add('hidden');
  mainScreen.classList.add('hidden');
  callerScreen.classList.add('hidden');
  codeArea.classList.add('hidden');
  answerArea.classList.add('hidden');
  partnerCodeInput.value = '';
  answerCodeInput.value = '';
  myCodeDisplay.textContent = '';
  myAnswerDisplay.textContent = '';
}

/* ============================================================
   MOBILE TABS
   ============================================================ */

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
    showToast('✅ Copied', 'success');
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
    showToast('✅ Copied', 'success');
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
   PASTE SHEET
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
   CODE EXCHANGE — STEP 1
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
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
    createCodeBtn.querySelector('span').textContent = 'Creating code...';

    createPeerConnection();
    localStream.getAudioTracks().forEach(t => peerConnection.addTrack(t, localStream));
    createDataChannel();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGathering();

    const offerData = { type: 'offer', sdp: peerConnection.localDescription, from: myName };
    myCode = encode(offerData);
    myCodeDisplay.textContent = myCode;
    codeArea.classList.remove('hidden');

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
   CODE EXCHANGE — STEP 2
   ============================================================ */

connectBtn.addEventListener('click', async () => {
  const code = partnerCodeInput.value.trim();
  if (!code) { showError('Paste your partner\'s code'); return; }

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
    localStream.getAudioTracks().forEach(t => peerConnection.addTrack(t, localStream));

    await peerConnection.setRemoteDescription(data.sdp);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await waitForIceGathering();

    const answerData = { type: 'answer', sdp: peerConnection.localDescription, from: myName };
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
   CODE EXCHANGE — STEP 3
   ============================================================ */

finishBtn.addEventListener('click', async () => {
  const code = answerCodeInput.value.trim();
  if (!code) { showError('Paste the answer code'); return; }

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
   WEBRTC PEER CONNECTION
   ============================================================ */

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(ICE_CONFIG);

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
  dataChannel.onclose = () => addSystemMessage('Connection closed');
  dataChannel.onmessage = (event) => {
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
    case 'message': addMessage(data.text, 'received'); break;
    case 'call-request': showIncomingCallInPanel(); break;
    case 'call-accept': startCallUI(); break;
    case 'call-reject': endCall(false); addSystemMessage('Call rejected'); break;
    case 'call-end': endCall(false); addSystemMessage('Partner ended the call'); break;
    case 'video-request': videoOffline.classList.add('hidden'); break;
    case 'file-start': handleFileStart(data); break;
    case 'file-chunk': handleFileChunk(data); break;
    case 'file-end': handleFileEnd(data); break;
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
  if (peerConnection?.remoteDescription) markStep(2, 'done');
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
  if (window.innerWidth <= 900) {
    document.querySelector('.panel-chat')?.classList.add('active-panel');
  }
  if (!isSavedPartner && !isCallerMode) {
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
    slug: isCallerMode ? callerTargetSlug : '',
    lastConnected: Date.now(),
    createdAt: existing >= 0 ? contacts[existing].createdAt : Date.now()
  };
  if (existing >= 0) contacts[existing] = contact;
  else contacts.push(contact);
  saveContacts(contacts);
  saveContactModal.classList.add('hidden');
  isSavedPartner = true;
  showToast('Contact saved', 'success');
});

skipSaveBtn.addEventListener('click', () => saveContactModal.classList.add('hidden'));

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
  } else if (sendViaDataChannel({ type: 'message', text })) {
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
  if (file.size > MAX_FILE_SIZE) { showToast('File too large (max 500MB)', 'error'); return; }

  const payloadStart = JSON.stringify({
    type: 'file-start', name: file.name, size: file.size, mimeType: file.type
  });

  if (!(dataChannel?.readyState === 'open') && !sendViaDataChannel(payloadStart)) {
    showToast('Not connected', 'error'); return;
  }

  try {
    if (dataChannel?.readyState === 'open') dataChannel.send(payloadStart);
    await new Promise(r => setTimeout(r, 200));

    const arrayBuffer = await file.arrayBuffer();
    let offset = 0;
    let chunkIndex = 0;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message sent';
    msgDiv.innerHTML = `
      <div class="file-attach">
        <div class="file-icon">📎</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-size">Sending... <span id="progress-${Date.now()}">0%</span></div>
        </div>
      </div>`;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const progressSpan = msgDiv.querySelector('span[id^="progress-"]');

    while (offset < arrayBuffer.byteLength) {
      const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
      const base64Chunk = arrayBufferToBase64(chunk);
      const chunkPayload = JSON.stringify({ type: 'file-chunk', data: base64Chunk, index: chunkIndex });
      if (dataChannel?.readyState === 'open') dataChannel.send(chunkPayload);
      else sendViaDataChannel(chunkPayload);
      offset += CHUNK_SIZE;
      chunkIndex++;
      const progress = Math.min(100, Math.round((offset / arrayBuffer.byteLength) * 100));
      if (progressSpan) progressSpan.textContent = progress + '%';
      if (chunkIndex % 10 === 0) await new Promise(r => setTimeout(r, 10));
    }

    const endPayload = JSON.stringify({
      type: 'file-end', name: file.name, size: file.size, mimeType: file.type, totalChunks: chunkIndex
    });
    if (dataChannel?.readyState === 'open') dataChannel.send(endPayload);
    else sendViaDataChannel(endPayload);

    if (progressSpan) progressSpan.textContent = 'Sent ✓';
    showToast('File sent: ' + file.name, 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to send file', 'error');
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
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
    </div>`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleFileChunk(data) {
  if (!isReceivingFile) return;
  incomingFileChunks.push(data.data);
  const total = Math.ceil(incomingFileSize / CHUNK_SIZE);
  const progress = Math.min(100, Math.round((incomingFileChunks.length / total) * 100));
  const progressSpan = document.getElementById('recv-progress');
  if (progressSpan) progressSpan.textContent = progress + '%';
}

function handleFileEnd(data) {
  isReceivingFile = false;
  const msgDiv = document.getElementById('receiving-file');
  if (msgDiv) msgDiv.remove();

  try {
    const buffers = incomingFileChunks.map(base64ToArrayBuffer);
    const blob = new Blob(buffers, { type: data.mimeType });
    const url = URL.createObjectURL(blob);

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
        <img src="${url}" alt="${escapeHtml(data.name)}">`;
    } else if (isVideo) {
      div.innerHTML = `
        <div class="file-attach">
          <div class="file-info">
            <div class="file-name">${escapeHtml(data.name)}</div>
            <div class="file-size">${formatBytes(data.size)}</div>
          </div>
        </div>
        <video src="${url}" controls style="max-width:100%;border-radius:10px;margin-top:4px;"></video>`;
    } else {
      div.innerHTML = `
        <div class="file-attach">
          <div class="file-icon">📎</div>
          <div class="file-info">
            <div class="file-name">${escapeHtml(data.name)}</div>
            <div class="file-size">${formatBytes(data.size)} · <a href="${url}" download="${escapeHtml(data.name)}" style="color:inherit;font-weight:700;">Download</a></div>
          </div>
        </div>`;
    }
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    showToast('File received: ' + data.name, 'success');
  } catch (error) {
    console.error(error);
    showToast('Failed to receive file', 'error');
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
    const playTone = () => {
      if (!ringtoneCtx) return;
      const now = ringtoneCtx.currentTime;
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
  } catch (e) { console.log('Ringtone error:', e); }
}

function stopRingtone() {
  if (ringtoneInterval) { clearInterval(ringtoneInterval); ringtoneInterval = null; }
  if (ringtoneCtx) { try { ringtoneCtx.close(); } catch {} ringtoneCtx = null; }
}

/* ============================================================
   CALLS
   ============================================================ */

startCallBtn.addEventListener('click', () => {
  if (!dataChannel || dataChannel.readyState !== 'open') return;
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
  micMuted = false;
  muteMicBtn.classList.remove('muted');
  muteMicBtn.querySelector('span').textContent = 'Mute';
  dataChannel.send(JSON.stringify({ type: 'call-request' }));
  callButtonsIdle.classList.add('hidden');
  callStatus.classList.remove('hidden');
  callStatusText.textContent = 'Calling ' + partnerName + '...';
  isInCall = true;
});

function showIncomingCallInPanel() {
  callButtonsIdle.classList.add('hidden');
  callButtonsIncoming.classList.remove('hidden');
  callStatus.classList.remove('hidden');
  callStatusText.textContent = partnerName + ' is calling...';
  startRingtone();
  if (window.innerWidth <= 900) {
    document.querySelector('.mobile-tab[data-tab="voice"]')?.click();
  }
}

acceptCallBtn.addEventListener('click', () => {
  stopRingtone();
  if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = true);
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
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'call-end' }));
  }
  if (incomingPeerCall) {
    try { incomingPeerCall.close(); } catch {}
    incomingPeerCall = null;
  }
  endCall(true);
});

function endCall(notify) {
  stopRingtone();
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = false; });
  micMuted = true;
  muteMicBtn.classList.add('muted');
  muteMicBtn.querySelector('span').textContent = 'Mute';

  if (videoEnabled && localStream) {
    localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
    localVideo.srcObject = null;
    videoEnabled = false;
    toggleVideoBtn.classList.remove('active');
    toggleVideoBtn.querySelector('span').textContent = 'Turn On';
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
      if (peerConnection) {
        peerConnection.addTrack(videoTrack, localStream);
      } else if (incomingPeerCall && incomingPeerCall.peerConnection) {
        incomingPeerCall.peerConnection.addTrack(videoTrack, localStream);
      }
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
      localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
    }
    localVideo.srcObject = null;
    videoEnabled = false;
    toggleVideoBtn.classList.remove('active');
    toggleVideoBtn.querySelector('span').textContent = 'Turn On';
    if (!remoteVideo.srcObject || remoteVideo.srcObject.getVideoTracks().length === 0) {
      videoOffline.classList.remove('hidden');
    }
    addSystemMessage('Video disabled');
  }
});

/* ============================================================
   SCREEN SHARING
   ============================================================ */

shareScreenBtn.addEventListener('click', async () => {
  if (isScreenSharing) {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      screenStream = null;
    }
    isScreenSharing = false;
    shareScreenBtn.classList.remove('active');
    addSystemMessage('Screen sharing stopped');
    return;
  }

  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' },
      audio: false
    });
    const screenTrack = screenStream.getVideoTracks()[0];

    if (peerConnection) {
      const senders = peerConnection.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(screenTrack);
      } else {
        peerConnection.addTrack(screenTrack, screenStream);
      }
    }

    localVideo.srcObject = screenStream;
    isScreenSharing = true;
    shareScreenBtn.classList.add('active');

    screenTrack.onended = () => {
      isScreenSharing = false;
      shareScreenBtn.classList.remove('active');
      localVideo.srcObject = localStream;
      addSystemMessage('Screen sharing stopped');
    };

    addSystemMessage('Screen sharing started');
    showToast('Screen sharing started', 'success');
  } catch (error) {
    console.error(error);
    showToast('Screen share cancelled', 'error');
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
    cleanup();
    showHome();
  }
});

backBtn.addEventListener('click', () => {
  if (confirm('Return home? Connection will close.')) {
    cleanup();
    showHome();
  }
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

console.log('SoloDS v16 — Approved ID Edition loaded');
