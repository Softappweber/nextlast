/* ============================================================
   SoloDS NextLast v19 — Round 1
   Bug fixes + contacts sidebar + name modal
   ============================================================ */

/* ============================================================
   CONFIG
   ============================================================ */

const CONFIG = {
  TURN_WORKER: 'https://shy-bar-bad0.softappweber.workers.dev/turn-credentials',
  TURN_FETCH_TIMEOUT_MS: 3000,

  OPENRELAY_FALLBACK: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
    ],
    iceCandidatePoolSize: 10
  },

  CHUNK_SIZE: 16 * 1024,
  MAX_FILE_SIZE: 200 * 1024 * 1024,

  VANISH_TTL_MS: 15000,
  CAPTION_LANG: 'en-US',

  // Giphy public beta key (well-known, safe for browser use)
  GIPHY_KEY: 'dc6zaTOxFJmzC',
  GIPHY_BASE: 'https://api.giphy.com/v1/gifs',

  VIDEO_MAX_BITRATE: 2500000,
  VIDEO_IDEAL_WIDTH: 1280,
  VIDEO_IDEAL_HEIGHT: 720,

  FEATURES: {
    reactions: true,
    replies: true,
    voiceNotes: true,
    vanish: true,
    captions: true,
    callReactions: true,
    richEmoji: true,
    gifs: true,
    stickers: false   // flip true when sticker files exist in /stickers/
  }
};

let ICE_CONFIG = CONFIG.OPENRELAY_FALLBACK;

/* ============================================================
   STATE
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

let screenStream = null;
let isScreenSharing = false;

let vanishMode = false;
let replyTarget = null;
let captionsOn = false;
let captionsRec = null;
let mediaRecorder = null;
let recordingChunks = [];
let recordingStream = null;
let reactionTargetMsgId = null;
let raisedHand = false;

let currentEmojiCat = 'smileys';
let currentStickerCat = 'reactions';
let gifSearchTimer = null;

// Contacts & modal state
let contacts = [];
let activeContactId = null;
let editingContactId = null;
let deletingContactId = null;
let videoSenderRef = null;

/* ============================================================
   DOM REFS
   ============================================================ */

const $ = (id) => document.getElementById(id);

const homeScreen = $('homeScreen');
const landingScreen = $('landingScreen');
const connectingScreen = $('connectingScreen');
const mainScreen = $('mainScreen');
const callerScreen = $('callerScreen');

const contactsBtnHome = $('contactsBtnHome');
const contactsSidebar = $('contactsSidebar');
const contactsClose = $('contactsClose');
const contactsSidebarList = $('contactsSidebarList');
const contactsSidebarEmpty = $('contactsSidebarEmpty');
const contactsAddBtn = $('contactsAddBtn');
const contactsExportBtn = $('contactsExportBtn');
const contactsImportBtn = $('contactsImportBtn');
const contactsImportInput = $('contactsImportInput');

const contactsAddModal = $('contactsAddModal');
const contactNameInput = $('contactNameInput');
const contactUrlInput = $('contactUrlInput');
const contactImageInput = $('contactImageInput');
const contactCancelBtn = $('contactCancelBtn');
const contactSaveBtn = $('contactSaveBtn');

const contactDetailModal = $('contactDetailModal');
const contactDetailAvatar = $('contactDetailAvatar');
const contactDetailName = $('contactDetailName');
const contactDetailUrl = $('contactDetailUrl');
const contactDetailCallBtn = $('contactDetailCallBtn');
const contactDetailCopyBtn = $('contactDetailCopyBtn');
const contactDetailOpenBtn = $('contactDetailOpenBtn');
const contactDetailEditBtn = $('contactDetailEditBtn');
const contactDetailDeleteBtn = $('contactDetailDeleteBtn');
const contactDetailClose = $('contactDetailClose');

const contactEditModal = $('contactEditModal');
const contactEditNameInput = $('contactEditNameInput');
const contactEditUrlInput = $('contactEditUrlInput');
const contactEditImageInput = $('contactEditImageInput');
const contactEditCancelBtn = $('contactEditCancelBtn');
const contactEditSaveBtn = $('contactEditSaveBtn');

const contactDeleteModal = $('contactDeleteModal');
const contactDeleteName = $('contactDeleteName');
const contactDeleteCancel = $('contactDeleteCancel');
const contactDeleteConfirm = $('contactDeleteConfirm');

const nameModal = $('nameModal');
const nameModalTitle = $('nameModalTitle');
const nameModalSub = $('nameModalSub');
const nameModalInput = $('nameModalInput');
const nameModalCancel = $('nameModalCancel');
const nameModalSave = $('nameModalSave');

const statusMessage = $('statusMessage');
const userNameInput = $('userName');
const createCodeBtn = $('createCodeBtn');
const codeArea = $('codeArea');
const myCodeDisplay = $('myCodeDisplay');
const copyCodeBtn = $('copyCodeBtn');
const shareCodeBtn = $('shareCodeBtn');
const partnerCodeInput = $('partnerCodeInput');
const connectBtn = $('connectBtn');
const answerArea = $('answerArea');
const myAnswerDisplay = $('myAnswerDisplay');
const copyAnswerBtn = $('copyAnswerBtn');
const shareAnswerBtn = $('shareAnswerBtn');
const answerCodeInput = $('answerCodeInput');
const finishBtn = $('finishBtn');
const errorBox = $('errorBox');

const backHomeBtn = $('backHomeBtn');
const onlineCard = $('onlineCard');
const onlineDot = $('onlineDot');
const onlineLabel = $('onlineLabel');
const onlineSub = $('onlineSub');
const goOnlineBtn = $('goOnlineBtn');
const manualCodeBtn = $('manualCodeBtn');

const backBtn = $('backBtn');
const connPill = $('connPill');
const connText = $('connText');
const chatChip = $('chatChip');
const partnerAvatar = $('partnerAvatar');
const partnerNameDisplay = $('partnerNameDisplay');
const themeBtnHome = $('themeBtnHome');
const themeBtnMain = $('themeBtnMain');
const menuBtn = $('menuBtn');
const menuDropdown = $('menuDropdown');
const resetBtn = $('resetBtn');
const contactsBtn = $('contactsBtn');

const chatMessages = $('chatMessages');
const messageInput = $('messageInput');
const sendMessageBtn = $('sendMessageBtn');
const attachBtn = $('attachBtn');
const voiceBtn = $('voiceBtn');
const emojiBtn = $('emojiBtn');
const gifBtn = $('gifBtn');
const stickerBtn = $('stickerBtn');
const fileInput = $('fileInput');
const vanishToggle = $('vanishToggle');
const replyBar = $('replyBar');
const replyBarQuote = $('replyBarQuote');
const replyBarCancel = $('replyBarCancel');

const callButtonsIdle = $('callButtonsIdle');
const callButtonsIncoming = $('callButtonsIncoming');
const callActive = $('callActive');
const startCallBtn = $('startCallBtn');
const acceptCallBtn = $('acceptCallBtn');
const rejectCallBtn = $('rejectCallBtn');
const hangupBtn = $('hangupBtn');
const muteMicBtn = $('muteMicBtn');
const shareScreenBtn = $('shareScreenBtn');
const raiseHandBtn = $('raiseHandBtn');
const callTimer = $('callTimer');
const callStatus = $('callStatus');
const callStatusText = $('callStatusText');

const remoteVideo = $('remoteVideo');
const localVideo = $('localVideo');
const videoOffline = $('videoOffline');
const toggleVideoBtn = $('toggleVideoBtn');
const remoteAudio = $('remoteAudio');
const captionsToggle = $('captionsToggle');
const captionsBox = $('captionsBox');

const saveContactModal = $('saveContactModal');
const saveContactName = $('saveContactName');
const saveContactPaste = $('saveContactPaste');
const saveContactBtn = $('saveContactBtn');
const skipSaveBtn = $('skipSaveBtn');

const themeModal = $('themeModal');
const closeThemeModal = $('closeThemeModal');
const pasteSheetOverlay = $('pasteSheetOverlay');
const closePasteSheet = $('closePasteSheet');
const toastContainer = $('toastContainer');

const callerAvatar = $('callerAvatar');
const callerName = $('callerName');
const callerStatus = $('callerStatus');
const callerCallBtn = $('callerCallBtn');
const callerVideoBtn = $('callerVideoBtn');
const callerTargetNameEl = $('callerTargetName');
const callerCancelBtn = $('callerCancelBtn');

const incomingCallModal = $('incomingCallModal');
const incomingAvatar = $('incomingAvatar');
const incomingName = $('incomingName');
const incomingAcceptBtn = $('incomingAcceptBtn');
const incomingRejectBtn = $('incomingRejectBtn');

const emojiPicker = $('emojiPicker');
const reactionLayer = $('reactionLayer');
const emojiPickerPanel = $('emojiPickerPanel');
const emojiPanelClose = $('emojiPanelClose');
const emojiCats = $('emojiCats');
const emojiGrid = $('emojiGrid');
const gifPanel = $('gifPanel');
const gifCloseBtn = $('gifCloseBtn');
const gifSearchInput = $('gifSearchInput');
const gifResults = $('gifResults');
const stickerPanel = $('stickerPanel');
const stickerCloseBtn = $('stickerCloseBtn');
const stickerCats = $('stickerCats');
const stickerGrid = $('stickerGrid');

/* ============================================================
   BOOT
   ============================================================ */

window.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  loadContacts();
  setupMobileTabs();
  setupV19UI();
  setupContactsUI();

  if (CONFIG.FEATURES.stickers) {
    stickerBtn.style.display = '';
    stickerPanel.style.display = '';
  }

  ICE_CONFIG = await fetchIceConfig();
  checkPublicLinkInURL();

  console.log('SoloDS NextLast v19 — Round 1 loaded');
});

async function fetchIceConfig() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.TURN_FETCH_TIMEOUT_MS);
    const res = await fetch(CONFIG.TURN_WORKER, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('TURN worker ' + res.status);
    const data = await res.json();

    let iceServers;
    if (Array.isArray(data.iceServers) && data.iceServers.length) {
      iceServers = data.iceServers;
    } else if (data.urls) {
      iceServers = [{ urls: data.urls, username: data.username, credential: data.credential }];
    } else {
      throw new Error('TURN payload missing');
    }

    iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      ...iceServers
    ];
    console.log('[TURN] Cloudflare credentials loaded');
    return { iceServers, iceCandidatePoolSize: 10 };
  } catch (e) {
    console.warn('[TURN] Cloudflare fetch failed, using OpenRelay:', e.message);
    return CONFIG.OPENRELAY_FALLBACK;
  }
}

/* ============================================================
   HELPERS
   ============================================================ */

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' min ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' hr ago';
  const days = Math.floor(hours / 24);
  return days + ' day' + (days > 1 ? 's' : '') + ' ago';
}

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

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  setTimeout(() => errorBox.classList.add('hidden'), 5000);
}

function setStatus(msg) { statusMessage.textContent = msg; }

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
    showToast('Copied', 'success');
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
    showToast('Copied', 'success');
    return false;
  });
}

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
   NAME MODAL
   ============================================================ */

let nameModalResolve = null;

function openNameModal({ title = 'Your name', sub = 'This is how others will see you.', prefill = '' } = {}) {
  nameModalTitle.textContent = title;
  nameModalSub.textContent = sub;
  nameModalInput.value = prefill || '';
  nameModal.classList.remove('hidden');
  setTimeout(() => nameModalInput.focus(), 100);

  return new Promise((resolve) => {
    nameModalResolve = resolve;
  });
}

function closeNameModal() {
  nameModal.classList.add('hidden');
  if (nameModalResolve) {
    nameModalResolve(null);
    nameModalResolve = null;
  }
}

nameModalCancel?.addEventListener('click', closeNameModal);
nameModal?.addEventListener('click', (e) => {
  if (e.target === nameModal) closeNameModal();
});

nameModalSave?.addEventListener('click', () => {
  const name = nameModalInput.value.trim();
  if (!name || name.length < 2) {
    nameModalInput.focus();
    return;
  }
  nameModal.classList.add('hidden');
  if (nameModalResolve) {
    nameModalResolve(name);
    nameModalResolve = null;
  }
});

nameModalInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    nameModalSave.click();
  }
});

/* ============================================================
   PUBLIC LINK ENTRY
   ============================================================ */

function checkPublicLinkInURL() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  let targetSlug = params.get('call');
  if (!targetSlug && hash.startsWith('#call=')) {
    targetSlug = hash.substring(6);
  }
  if (targetSlug) {
    enterCallerMode(targetSlug);
  }
}

/* ============================================================
   GO ONLINE (with proper name modal)
   ============================================================ */

goOnlineBtn.addEventListener('click', async () => {
  if (isOnline) {
    goOffline();
  } else {
    await goOnline();
  }
});

async function goOnline() {
  let name = localStorage.getItem('solods_myname') || '';

  // Always show modal — prefill if we have a stored name
  const entered = await openNameModal({
    title: name ? 'Confirm your name' : 'Your name',
    sub: name
      ? 'Your stored name is below. Change it or continue.'
      : 'This is how others will see you when they open your link.',
    prefill: name
  });

  if (!entered) return; // user cancelled

  name = entered.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!name || name.length < 2) {
    showToast('Enter a valid name (2+ letters or numbers)', 'error');
    return;
  }

  localStorage.setItem('solods_myname', name);
  myName = name;
  myPublicSlug = name;

  goOnlineBtn.disabled = true;
  goOnlineBtn.querySelector('span').textContent = 'Connecting...';

  try {
    const peerId = 'solods-' + myPublicSlug;
    myPublicPeer = new Peer(peerId, { debug: 1, config: ICE_CONFIG });

    myPublicPeer.on('open', () => {
      isOnline = true;
      updateOnlineUI(true);
      goOnlineBtn.disabled = false;
      goOnlineBtn.querySelector('span').textContent = 'Go Offline';
      goOnlineBtn.classList.add('offline-btn');

      showToast('You are online as ' + myPublicSlug, 'success');

      // Jump to main screen — show YOUR name
      partnerName = myPublicSlug;
      switchToMainScreen({ showSaveContact: false, selfView: true });
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
        showToast('This name is taken. Try another.', 'error');
        goOffline();
      } else if (err.type === 'network') {
        showToast('Network error. Check internet.', 'error');
        goOffline();
      } else if (err.type === 'peer-unavailable') {
        showToast('That person is offline', 'error');
      } else {
        showToast('Connection error: ' + err.type, 'error');
        goOffline();
      }
    });

    myPublicPeer.on('disconnected', () => {
      setTimeout(() => {
        if (myPublicPeer && !myPublicPeer.destroyed) {
          myPublicPeer.reconnect();
        }
      }, 2000);
    });

  } catch (error) {
    console.error('Go online error:', error);
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

/* ============================================================
   SWITCH TO MAIN SCREEN
   ============================================================ */

function switchToMainScreen({ showSaveContact = true, selfView = false } = {}) {
  homeScreen.classList.add('hidden');
  landingScreen.classList.add('hidden');
  connectingScreen.classList.add('hidden');
  callerScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');

  const displayName = selfView ? (myName || 'You') : (partnerName || '—');
  partnerNameDisplay.textContent = displayName;
  partnerAvatar.textContent = (displayName || '?').charAt(0).toUpperCase();

  // Update the label above the name
  const partnerLabel = document.querySelector('.partner-label');
  if (partnerLabel) {
    partnerLabel.textContent = selfView ? 'Signed in as' : 'Connected with';
  }

  // "Signed in as" already comes from HTML but ensure it's right

  if (window.innerWidth <= 900) {
    document.querySelector('.panel-chat')?.classList.add('active-panel');
  }

  if (showSaveContact && !isSavedPartner && !isCallerMode && partnerName && partnerName !== '—') {
    setTimeout(() => {
      saveContactModal.classList.remove('hidden');
      saveContactName.value = partnerName;
    }, 1500);
  }
}

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
      video: withVideo ? {
        width: { ideal: CONFIG.VIDEO_IDEAL_WIDTH },
        height: { ideal: CONFIG.VIDEO_IDEAL_HEIGHT }
      } : false
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
      const label = document.querySelector('.partner-label');
      if (label) label.textContent = 'Connected with';

      if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = true; });

      startCallUI();
      addSystemMessage('Connected to ' + partnerName);
      showToast('Connected!', 'success');
    });

    call.on('close', () => { endCall(true); showHome(); });
    call.on('error', (err) => { console.error('Call error:', err); });

  } catch (error) {
    console.error('Call start error:', error);
    callerStatus.textContent = error.name === 'NotAllowedError' ? 'Mic access required' : 'Failed to call';
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
      const label = document.querySelector('.partner-label');
      if (label) label.textContent = 'Connected with';

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
    console.error('Accept call error:', error);
    showToast('Failed to accept call', 'error');
  }
});

incomingRejectBtn.addEventListener('click', () => {
  stopRingtone();
  incomingCallModal.classList.add('hidden');
  if (incomingPeerCall) { try { incomingPeerCall.close(); } catch {} incomingPeerCall = null; }
});

/* ============================================================
   PEER DATA CHANNEL
   ============================================================ */

function setupPeerDataChannel() {
  if (!dataChannel) return;
  dataChannel.on('open', () => {
    addSystemMessage('Chat ready');
    if (!isOnline) switchToMainScreen({ showSaveContact: false });
  });
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
   CONTACTS — storage
   ============================================================ */

function loadContactsFromStorage() {
  try {
    return JSON.parse(localStorage.getItem('solods_contacts_v2') || '[]');
  } catch { return []; }
}

function saveContactsToStorage(list) {
  localStorage.setItem('solods_contacts_v2', JSON.stringify(list));
}

/* ============================================================
   CONTACTS — rendering
   ============================================================ */

function renderContactsSidebar() {
  contacts = loadContactsFromStorage();

  if (!contacts.length) {
    contactsSidebarList.innerHTML = '';
    contactsSidebarEmpty.classList.remove('hidden');
    return;
  }

  contactsSidebarEmpty.classList.add('hidden');
  contactsSidebarList.innerHTML = '';

  // Sort: most recently updated first
  const sorted = [...contacts].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  sorted.forEach(c => {
    const item = document.createElement('div');
    item.className = 'sidebar-contact';
    item.dataset.id = c.id;

    const avatar = avatarFor(c);
    const imgTag = c.image
      ? `<img src="${escapeHtml(c.image)}" alt="" onerror="this.style.display='none';this.parentNode.textContent='${escapeHtml((c.name || '?')[0].toUpperCase())}'">`
      : escapeHtml((c.name || '?').charAt(0).toUpperCase());

    item.innerHTML = `
      <div class="sidebar-contact-avatar">${imgTag}</div>
      <div class="sidebar-contact-info">
        <div class="sidebar-contact-name">${escapeHtml(c.name)}</div>
        <div class="sidebar-contact-url">${escapeHtml(shortenUrl(c.url))}</div>
      </div>
    `;

    item.addEventListener('click', () => openContactDetail(c.id));
    contactsSidebarList.appendChild(item);
  });
}

function shortenUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/**
 * Deterministic auto-avatar color from URL slug.
 * Returns the color pair for gradient (as CSS string).
 */
function avatarFor(contact) {
  // Simple deterministic hue from the URL string
  const s = contact.url || contact.name || '';
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 70% 60%), hsl(${hue2} 70% 55%))`;
}

/* ============================================================
   CONTACTS — open/close sidebar
   ============================================================ */

function openContactsSidebar() {
  renderContactsSidebar();
  contactsSidebar.classList.remove('hidden');
}

function closeContactsSidebar() {
  contactsSidebar.classList.add('hidden');
}

contactsBtnHome?.addEventListener('click', openContactsSidebar);
contactsBtn?.addEventListener('click', openContactsSidebar);
contactsClose?.addEventListener('click', closeContactsSidebar);

/* ============================================================
   CONTACTS — add
   ============================================================ */

function openAddContactModal() {
  contactNameInput.value = '';
  contactUrlInput.value = '';
  contactImageInput.value = '';
  contactsAddModal.classList.remove('hidden');
  setTimeout(() => contactNameInput.focus(), 100);
}

contactsAddBtn?.addEventListener('click', openAddContactModal);
contactCancelBtn?.addEventListener('click', () => contactsAddModal.classList.add('hidden'));

contactsAddModal?.addEventListener('click', (e) => {
  if (e.target === contactsAddModal) contactsAddModal.classList.add('hidden');
});

contactSaveBtn?.addEventListener('click', () => {
  const name = contactNameInput.value.trim();
  const url = contactUrlInput.value.trim();
  const image = contactImageInput.value.trim();

  if (!name) { showToast('Name is required', 'error'); contactNameInput.focus(); return; }
  if (!url) { showToast('URL is required', 'error'); contactUrlInput.focus(); return; }

  const list = loadContactsFromStorage();
  list.push({
    id: uid(),
    name,
    url: normalizeUrl(url),
    image: image || '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  saveContactsToStorage(list);
  contactsAddModal.classList.add('hidden');
  renderContactsSidebar();
  showToast('Contact added', 'success');
});

function normalizeUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  return 'https://' + url;
}

/* ============================================================
   CONTACTS — detail view
   ============================================================ */

function openContactDetail(id) {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  activeContactId = id;

  contactDetailAvatar.textContent = (c.name || '?').charAt(0).toUpperCase();
  if (c.image) {
    contactDetailAvatar.innerHTML = `<img src="${escapeHtml(c.image)}" alt="">`;
  } else {
    contactDetailAvatar.textContent = (c.name || '?').charAt(0).toUpperCase();
  }

  contactDetailName.textContent = c.name;
  contactDetailUrl.textContent = c.url;

  // Show "Call" only if the URL contains a recognizable SoloDS slug
  const slug = extractSlug(c.url);
  if (slug) {
    contactDetailCallBtn.style.display = '';
  } else {
    contactDetailCallBtn.style.display = 'none';
  }

  contactDetailModal.classList.remove('hidden');
}

function extractSlug(url) {
  // Looks for last path segment, e.g. tinyurl.com/sushant → "sushant"
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    if (!seg) return null;
    // Basic slug sanity: alphanumeric, dashes, underscores, 2-30 chars
    if (/^[a-z0-9_-]{2,30}$/i.test(seg)) return seg.toLowerCase();
    return null;
  } catch {
    return null;
  }
}

contactDetailClose?.addEventListener('click', () => contactDetailModal.classList.add('hidden'));

contactDetailModal?.addEventListener('click', (e) => {
  if (e.target === contactDetailModal) contactDetailModal.classList.add('hidden');
});

contactDetailCopyBtn?.addEventListener('click', () => {
  const c = contacts.find(x => x.id === activeContactId);
  if (!c) return;
  copyToClipboard(c.url, null);
});

contactDetailOpenBtn?.addEventListener('click', () => {
  const c = contacts.find(x => x.id === activeContactId);
  if (!c) return;
  window.open(c.url, '_blank', 'noopener');
});

contactDetailCallBtn?.addEventListener('click', () => {
  const c = contacts.find(x => x.id === activeContactId);
  if (!c) return;
  const slug = extractSlug(c.url);
  if (!slug) {
    showToast('This URL doesn\'t look like a SoloDS link', 'error');
    return;
  }
  contactDetailModal.classList.add('hidden');
  closeContactsSidebar();
  enterCallerMode(slug);
});

/* ============================================================
   CONTACTS — edit
   ============================================================ */

contactDetailEditBtn?.addEventListener('click', () => {
  const c = contacts.find(x => x.id === activeContactId);
  if (!c) return;
  editingContactId = c.id;
  contactEditNameInput.value = c.name;
  contactEditUrlInput.value = c.url;
  contactEditImageInput.value = c.image || '';
  contactDetailModal.classList.add('hidden');
  contactEditModal.classList.remove('hidden');
});

contactEditCancelBtn?.addEventListener('click', () => {
  contactEditModal.classList.add('hidden');
  editingContactId = null;
});

contactEditModal?.addEventListener('click', (e) => {
  if (e.target === contactEditModal) {
    contactEditModal.classList.add('hidden');
    editingContactId = null;
  }
});

contactEditSaveBtn?.addEventListener('click', () => {
  const name = contactEditNameInput.value.trim();
  const url = contactEditUrlInput.value.trim();
  const image = contactEditImageInput.value.trim();

  if (!name || !url) { showToast('Name and URL required', 'error'); return; }

  const list = loadContactsFromStorage();
  const idx = list.findIndex(x => x.id === editingContactId);
  if (idx < 0) { contactEditModal.classList.add('hidden'); return; }

  list[idx].name = name;
  list[idx].url = normalizeUrl(url);
  list[idx].image = image;
  list[idx].updatedAt = Date.now();

  saveContactsToStorage(list);
  contactEditModal.classList.add('hidden');
  editingContactId = null;
  renderContactsSidebar();
  showToast('Contact updated', 'success');
});

/* ============================================================
   CONTACTS — delete
   ============================================================ */

contactDetailDeleteBtn?.addEventListener('click', () => {
  const c = contacts.find(x => x.id === activeContactId);
  if (!c) return;
  deletingContactId = c.id;
  contactDeleteName.textContent = c.name;
  contactDetailModal.classList.add('hidden');
  contactDeleteModal.classList.remove('hidden');
});

contactDeleteCancel?.addEventListener('click', () => {
  contactDeleteModal.classList.add('hidden');
  deletingContactId = null;
});

contactDeleteModal?.addEventListener('click', (e) => {
  if (e.target === contactDeleteModal) {
    contactDeleteModal.classList.add('hidden');
    deletingContactId = null;
  }
});

contactDeleteConfirm?.addEventListener('click', () => {
  const list = loadContactsFromStorage();
  const filtered = list.filter(x => x.id !== deletingContactId);
  saveContactsToStorage(filtered);
  contactDeleteModal.classList.add('hidden');
  deletingContactId = null;
  activeContactId = null;
  renderContactsSidebar();
  showToast('Contact deleted', 'info');
});

/* ============================================================
   CONTACTS — export / import
   ============================================================ */

contactsExportBtn?.addEventListener('click', () => {
  const list = loadContactsFromStorage();
  if (!list.length) { showToast('No contacts to export', 'error'); return; }

  const payload = {
    version: 1,
    exported: new Date().toISOString(),
    contacts: list
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'solods-contacts-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Exported ' + list.length + ' contact(s)', 'success');
});

contactsImportBtn?.addEventListener('click', () => contactsImportInput.click());

contactsImportInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  contactsImportInput.value = '';
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      const incoming = Array.isArray(parsed) ? parsed : parsed.contacts;
      if (!Array.isArray(incoming)) throw new Error('Bad format');

      // Merge: existing kept, incoming added/updated by (name, url)
      const existing = loadContactsFromStorage();
      const byKey = new Map();
      [...existing, ...incoming].forEach(c => {
        const key = ((c.name || '') + '|' + (c.url || '')).toLowerCase();
        const withId = {
          id: c.id || uid(),
          name: c.name || 'Unnamed',
          url: normalizeUrl(c.url || ''),
          image: c.image || '',
          createdAt: c.createdAt || Date.now(),
          updatedAt: Date.now()
        };
        byKey.set(key, withId);
      });

      const merged = [...byKey.values()];
      saveContactsToStorage(merged);
      renderContactsSidebar();
      showToast('Imported — ' + merged.length + ' total contacts', 'success');
    } catch (err) {
      console.error('Import error:', err);
      showToast('Invalid contact file', 'error');
    }
  };
  reader.readAsText(file);
});

/* ============================================================
   SETUP CONTACTS UI (wiring that needs to run on boot)
   ============================================================ */

function setupContactsUI() {
  // Initial render so sidebar is ready when opened
  contacts = loadContactsFromStorage();
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
  navigator.clipboard.writeText(codeToShare).catch(() => {});
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
    const siteInfo = PASTE_SITES[btn.dataset.site];
    navigator.clipboard.writeText(currentShareCode).catch(() => {});
    window.open(siteInfo.url, '_blank');
    closePasteSheetFn();
  });
});

/* ============================================================
   MANUAL CODE — STEP 1
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
   MANUAL CODE — STEP 2
   ============================================================ */

connectBtn.addEventListener('click', async () => {
  const code = partnerCodeInput.value.trim();
  if (!code) { showError("Paste your partner's code"); return; }

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
   MANUAL CODE — STEP 3
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
      // Apply bitrate limit as soon as a video sender exists
      setTimeout(applyVideoBitrate, 500);
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
    setTimeout(() => switchToMainScreen({ showSaveContact: true }), 700);
  };
  dataChannel.onclose = () => addSystemMessage('Connection closed');
  dataChannel.onmessage = (event) => {
    if (typeof event.data === 'string') {
      try { handleDataMessage(JSON.parse(event.data)); }
      catch { addMessage(event.data, 'received'); }
    }
  };
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

/**
 * Apply high-bitrate cap on the outgoing video sender.
 * Fixes poor video quality on most networks.
 */
function applyVideoBitrate() {
  const pc = peerConnection || incomingPeerCall?.peerConnection;
  if (!pc) return;
  try {
    const senders = pc.getSenders();
    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
    if (!videoSender) return;
    const params = videoSender.getParameters();
    if (!params.encodings || !params.encodings.length) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = CONFIG.VIDEO_MAX_BITRATE;
    videoSender.setParameters(params);
    videoSenderRef = videoSender;
    console.log('[video] maxBitrate set to', CONFIG.VIDEO_MAX_BITRATE);
  } catch (e) {
    console.warn('[video] bitrate apply failed', e);
  }
}

/* ============================================================
   DATA MESSAGE ROUTER
   ============================================================ */

function handleDataMessage(data) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'message':        addMessage(data.text, 'received', data); break;
    case 'call-request':   showIncomingCallInPanel(); break;
    case 'call-accept':    startCallUI(); break;
    case 'call-reject':    endCall(false); addSystemMessage('Call rejected'); break;
    case 'call-end':       endCall(false); addSystemMessage('Partner ended the call'); break;
    case 'video-request':  videoOffline.classList.add('hidden'); break;
    case 'file-start':     handleFileStart(data); break;
    case 'file-chunk':     handleFileChunk(data); break;
    case 'file-end':       handleFileEnd(data); break;
    case 'reaction':       applyReaction(data); break;
    case 'reply':          addMessage(data.text, 'received', data); break;
    case 'voice-note':     renderIncomingVoiceNote(data); break;
    case 'vanish-toggle':  applyVanishToggle(data); break;
    case 'caption':        renderCaption(data, false); break;
    case 'call-reaction':  renderCallReaction(data, false); break;
    case 'gif':            addGifMessage(data, 'received'); break;
    case 'sticker':        addStickerMessage(data, 'received'); break;
  }
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

/* ============================================================
   SAVE CONTACT (from incoming call)
   ============================================================ */

saveContactBtn.addEventListener('click', () => {
  const name = saveContactName.value.trim();
  if (!name) { alert('Enter a name'); return; }

  const list = loadContactsFromStorage();
  list.push({
    id: uid(),
    name,
    url: saveContactPaste.value.trim() || ('solods:' + (partnerName || 'unknown')),
    image: '',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  saveContactsToStorage(list);

  saveContactModal.classList.add('hidden');
  isSavedPartner = true;
  showToast('Contact saved', 'success');
});

skipSaveBtn.addEventListener('click', () => saveContactModal.classList.add('hidden'));

/* ============================================================
   CHAT — send + render
   ============================================================ */

sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  if (replyTarget) {
    const payload = {
      type: 'reply',
      id: uid(),
      text,
      replyTo: replyTarget.id,
      replyPreview: replyTarget.preview,
      vanish: vanishMode,
      ts: Date.now()
    };
    if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
    else if (!sendViaDataChannel(payload)) { addSystemMessage('Not connected'); return; }
    addMessage(text, 'sent', payload);
    clearReplyTarget();
  } else {
    const payload = { type: 'message', text, id: uid(), vanish: vanishMode, ts: Date.now() };
    if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
    else if (!sendViaDataChannel(payload)) { addSystemMessage('Not connected'); return; }
    addMessage(text, 'sent', payload);
  }
  messageInput.value = '';
}

/**
 * Chat render — always wraps in .msg-wrap so replies/reactions stack.
 * meta: { id, replyPreview, replyTo, vanish, ts }
 */
function addMessage(text, type, meta = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + (type === 'sent' ? 'sent' : 'received');

  const msgId = meta.id || uid();
  wrap.dataset.id = msgId;

  const msg = document.createElement('div');
  msg.className = 'message ' + type;

  if (meta.replyPreview || meta.replyTo) {
    msg.classList.add('has-reply');
    const quote = document.createElement('div');
    quote.className = 'message-quote';
    quote.textContent = meta.replyPreview || '…';
    msg.appendChild(quote);
  }

  const textNode = document.createElement('div');
  textNode.textContent = text;
  msg.appendChild(textNode);
  wrap.appendChild(msg);

  const metaRow = document.createElement('div');
  metaRow.className = 'msg-meta';

  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  metaRow.appendChild(time);

  const replyBtn = document.createElement('button');
  replyBtn.className = 'msg-reply-btn';
  replyBtn.title = 'Reply';
  replyBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M9 17l-6-6 6-6M3 11h12a6 6 0 016 6v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  replyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setReplyTarget(msgId, text.slice(0, 80));
  });
  metaRow.appendChild(replyBtn);
  wrap.appendChild(metaRow);

  const reactionsRow = document.createElement('div');
  reactionsRow.className = 'msg-reactions';
  wrap.appendChild(reactionsRow);

  msg.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openEmojiPicker(msgId, e.clientX, e.clientY);
  });

  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (meta.vanish) scheduleVanish(wrap);
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
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    showToast('File too large (max ' + formatBytes(CONFIG.MAX_FILE_SIZE) + ')', 'error');
    return;
  }

  const payloadStart = JSON.stringify({
    type: 'file-start', name: file.name, size: file.size, mimeType: file.type
  });

  if (!(dataChannel?.readyState === 'open') && !sendViaDataChannel(payloadStart)) {
    showToast('Not connected', 'error');
    return;
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
      const chunk = arrayBuffer.slice(offset, offset + CONFIG.CHUNK_SIZE);
      const base64Chunk = arrayBufferToBase64(chunk);
      const chunkPayload = JSON.stringify({ type: 'file-chunk', data: base64Chunk, index: chunkIndex });

      if (dataChannel?.readyState === 'open') dataChannel.send(chunkPayload);
      else sendViaDataChannel(chunkPayload);

      offset += CONFIG.CHUNK_SIZE;
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
    console.error('File send error:', error);
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
  const total = Math.ceil(incomingFileSize / CONFIG.CHUNK_SIZE);
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
    console.error('File assembly error:', error);
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
  if (window.innerWidth <= 900) document.querySelector('.mobile-tab[data-tab="voice"]')?.click();
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
    callTimer.textContent =
      String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' +
      String(elapsed % 60).padStart(2, '0');
  }, 1000);

  isInCall = true;
  addSystemMessage('Call started');
}

muteMicBtn.addEventListener('click', () => {
  if (!localStream) return;
  micMuted = !micMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !micMuted);
  muteMicBtn.classList.toggle('muted', micMuted);
  muteMicBtn.querySelector('span').textContent = micMuted ? 'Unmute' : 'Mute';
});

hangupBtn.addEventListener('click', () => {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'call-end' }));
  }
  if (incomingPeerCall) { try { incomingPeerCall.close(); } catch {} incomingPeerCall = null; }
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
        video: {
          width: { ideal: CONFIG.VIDEO_IDEAL_WIDTH },
          height: { ideal: CONFIG.VIDEO_IDEAL_HEIGHT }
        }
      });
      const videoTrack = videoStream.getVideoTracks()[0];

      if (!localStream) localStream = new MediaStream();
      localStream.addTrack(videoTrack);

      if (peerConnection) peerConnection.addTrack(videoTrack, localStream);
      else if (incomingPeerCall && incomingPeerCall.peerConnection) {
        incomingPeerCall.peerConnection.addTrack(videoTrack, localStream);
      }

      localVideo.srcObject = localStream;
      videoOffline.classList.add('hidden');
      videoEnabled = true;
      toggleVideoBtn.classList.add('active');
      toggleVideoBtn.querySelector('span').textContent = 'Turn Off';

      // Apply high bitrate once sender exists
      setTimeout(applyVideoBitrate, 300);

      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'video-request' }));
      }
      addSystemMessage('Video enabled');
    } catch (err) {
      showToast('Camera access denied', 'error');
    }
  } else {
    if (localStream) localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
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
    if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); screenStream = null; }
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
      const videoSender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (videoSender) await videoSender.replaceTrack(screenTrack);
      else peerConnection.addTrack(screenTrack, screenStream);
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
  } catch (error) {
    console.error('Screen share error:', error);
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

document.addEventListener('click', () => menuDropdown.classList.add('hidden'));

resetBtn.addEventListener('click', () => {
  if (confirm('Disconnect and return home?')) { cleanup(); showHome(); }
});

backBtn.addEventListener('click', () => {
  if (confirm('Return home? Connection will close.')) { cleanup(); showHome(); }
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
  videoSenderRef = null;

  replyTarget = null;
  replyBar?.classList.add('hidden');
  mediaRecorder = null;
  recordingChunks = [];
  if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()); recordingStream = null; }
  raisedHand = false;
  raiseHandBtn?.classList.remove('raised');
}

/* ============================================================
   EMOJI REACTIONS
   ============================================================ */

const REACTION_EMOJI = ['👍','❤️','😂','😮','😢','🔥','🎉','👏','🙏','✅'];

function openEmojiPicker(msgId, x, y) {
  reactionTargetMsgId = msgId;
  emojiPicker.innerHTML = '';

  REACTION_EMOJI.forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-choice';
    btn.textContent = em;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sendReaction(msgId, em);
      closeEmojiPicker();
    });
    emojiPicker.appendChild(btn);
  });

  const pw = 280, ph = 160;
  const px = Math.min(x, window.innerWidth - pw - 10);
  const py = Math.min(y, window.innerHeight - ph - 10);
  emojiPicker.style.left = px + 'px';
  emojiPicker.style.top = py + 'px';
  emojiPicker.classList.add('open');
}

function closeEmojiPicker() {
  emojiPicker.classList.remove('open');
  reactionTargetMsgId = null;
}

document.addEventListener('click', (e) => {
  if (emojiPicker.classList.contains('open') && !emojiPicker.contains(e.target)) {
    closeEmojiPicker();
  }
});

function sendReaction(msgId, emoji) {
  const payload = { type: 'reaction', id: msgId, emoji };
  if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
  else sendViaDataChannel(payload);
  applyReaction(payload);
}

function applyReaction(data) {
  const wrap = chatMessages.querySelector(`.msg-wrap[data-id="${data.id}"]`);
  if (!wrap) {
    console.warn('[reaction] no message found for id', data.id);
    return;
  }

  const reactionsRow = wrap.querySelector('.msg-reactions');
  if (!reactionsRow) return;

  const existing = Array.from(reactionsRow.children).find(c => c.dataset.emoji === data.emoji);
  if (existing) { existing.remove(); return; }

  const chip = document.createElement('span');
  chip.className = 'reaction-chip';
  chip.dataset.emoji = data.emoji;
  chip.textContent = data.emoji;
  chip.addEventListener('click', () => sendReaction(data.id, data.emoji));
  reactionsRow.appendChild(chip);
}

/* ============================================================
   REPLIES
   ============================================================ */

function setReplyTarget(id, preview) {
  replyTarget = { id, preview };
  replyBarQuote.textContent = preview;
  replyBar.classList.remove('hidden');
  messageInput.focus();
}

function clearReplyTarget() {
  replyTarget = null;
  replyBar.classList.add('hidden');
}

replyBarCancel?.addEventListener('click', clearReplyTarget);

/* ============================================================
   VOICE NOTES
   ============================================================ */

function pickAudioMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find(t => window.MediaRecorder?.isTypeSupported(t)) || '';
}

async function startVoiceRecording() {
  if (mediaRecorder) return;
  if (!dataChannel || dataChannel.readyState !== 'open') {
    showToast('Not connected', 'error');
    return;
  }

  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    const mime = pickAudioMime();
    mediaRecorder = new MediaRecorder(recordingStream, mime ? { mimeType: mime } : undefined);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) recordingChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      if (recordingStream) { recordingStream.getTracks().forEach(t => t.stop()); recordingStream = null; }
      mediaRecorder = null;
      recordingChunks = [];
      voiceBtn.classList.remove('recording');
      if (blob.size < 800) return;
      await sendVoiceNote(blob);
    };

    mediaRecorder.start();
    voiceBtn.classList.add('recording');
    showToast('Recording… release to send');

  } catch (e) {
    console.warn('Voice record error:', e);
    showToast('Mic access denied', 'error');
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch {}
  }
}

voiceBtn?.addEventListener('mousedown', (e) => { e.preventDefault(); startVoiceRecording(); });
voiceBtn?.addEventListener('mouseup', (e) => { e.preventDefault(); stopVoiceRecording(); });
voiceBtn?.addEventListener('mouseleave', () => stopVoiceRecording());
voiceBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceRecording(); }, { passive: false });
voiceBtn?.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceRecording(); }, { passive: false });

async function sendVoiceNote(blob) {
  const buf = await blob.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);
  const payload = { type: 'voice-note', id: uid(), mime: blob.type || 'audio/webm', data: b64 };

  if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
  else sendViaDataChannel(payload);
  renderVoiceNote(payload, 'sent');
}

function renderIncomingVoiceNote(data) { renderVoiceNote(data, 'received'); }

function renderVoiceNote(data, direction) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + direction;
  wrap.dataset.id = data.id || uid();

  const msg = document.createElement('div');
  msg.className = 'message voice-note ' + direction;

  const audioSrc = 'data:' + (data.mime || 'audio/webm') + ';base64,' + data.data;
  msg.innerHTML = `
    <div class="voice-bubble">
      <div class="voice-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="2"/>
          <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <audio controls preload="metadata" src="${audioSrc}"></audio>
    </div>
  `;
  wrap.appendChild(msg);

  const metaRow = document.createElement('div');
  metaRow.className = 'msg-meta';
  metaRow.innerHTML = `<span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
  wrap.appendChild(metaRow);

  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ============================================================
   VANISH MODE
   ============================================================ */

vanishToggle?.addEventListener('click', () => {
  vanishMode = !vanishMode;
  vanishToggle.classList.toggle('active', vanishMode);
  const payload = { type: 'vanish-toggle', on: vanishMode };
  if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
  else sendViaDataChannel(payload);
  addSystemMessage(vanishMode ? 'Vanish mode ON — new messages disappear in 15s' : 'Vanish mode OFF');
});

function applyVanishToggle(data) {
  vanishMode = !!data.on;
  vanishToggle?.classList.toggle('active', vanishMode);
  addSystemMessage(vanishMode ? 'Partner enabled vanish mode' : 'Partner disabled vanish mode');
}

function scheduleVanish(wrap) {
  setTimeout(() => {
    wrap.style.transition = 'opacity 0.4s';
    wrap.style.opacity = '0';
    setTimeout(() => wrap.remove(), 400);
  }, CONFIG.VANISH_TTL_MS);
}

/* ============================================================
   LIVE CAPTIONS
   ============================================================ */

function initCaptionsRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Live captions not supported in this browser', 'error'); return null; }

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
      const payload = { type: 'caption', text: finalText.trim(), final: true };
      if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
      else sendViaDataChannel(payload);
      renderCaption({ ...payload, self: true }, true);
    } else if (interim && captionsBox) {
      captionsBox.textContent = interim;
    }
  };

  rec.onerror = (e) => console.warn('[captions]', e.error);
  rec.onend = () => { if (captionsOn) { try { rec.start(); } catch {} } };

  return rec;
}

captionsToggle?.addEventListener('click', () => {
  captionsOn = !captionsOn;
  captionsToggle.classList.toggle('active', captionsOn);
  captionsBox?.classList.toggle('hidden', !captionsOn);

  if (captionsOn) {
    if (!captionsRec) captionsRec = initCaptionsRecognition();
    try { captionsRec?.start(); } catch {}
    showToast('Live captions on');
  } else {
    try { captionsRec?.stop(); } catch {}
    if (captionsBox) captionsBox.textContent = '';
    showToast('Live captions off');
  }
});

function renderCaption(data, self) {
  if (!captionsBox || !captionsOn) return;
  if (!data.final) { captionsBox.textContent = data.text; return; }
  captionsBox.textContent = (self ? 'You: ' : 'Peer: ') + data.text;
  setTimeout(() => {
    if (captionsBox && captionsBox.textContent.endsWith(data.text)) captionsBox.textContent = '';
  }, 3000);
}

/* ============================================================
   CALL REACTIONS + RAISE HAND
   ============================================================ */

document.querySelectorAll('.reaction-quick').forEach(btn => {
  btn.addEventListener('click', () => sendCallReaction(btn.dataset.reaction));
});

function sendCallReaction(emoji) {
  const payload = { type: 'call-reaction', emoji };
  if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
  else sendViaDataChannel(payload);
  renderCallReaction(payload, true);
}

function renderCallReaction(data) {
  if (!reactionLayer) return;
  const el = document.createElement('div');
  el.className = 'float-emoji';
  el.textContent = data.emoji;
  el.style.left = (10 + Math.random() * 80) + '%';
  el.style.bottom = '0';
  reactionLayer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('rise'));
  setTimeout(() => el.remove(), 2400);
}

raiseHandBtn?.addEventListener('click', () => {
  raisedHand = !raisedHand;
  raiseHandBtn.classList.toggle('raised', raisedHand);
  sendCallReaction(raisedHand ? '✋' : '👋');
});

/* ============================================================
   RICH EMOJI PICKER
   ============================================================ */

const EMOJI_DATA = {
  smileys: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  gestures: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾'],
  hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋'],
  animals: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🐺','🐴','🦄','🐝','🦋','🐌','🐞','🐢','🐍','🐙','🦑','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐘','🦒','🐪','🦌','🐕','🐈'],
  food: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥕','🧄','🧅','🥔','🍠','🥐','🍞','🥖','🥨','🧀','🥚','🍳','🥓','🥩','🍗','🍔','🍟','🍕','🥪','🌮','🌯','🥗','🍝','🍜','🍣','🍱','🍤','🍙','🍚','🍰','🎂','🍮','🍩','🍪','🍫','🍿','☕','🍵','🥤','🍺','🍻','🍷'],
  activities: ['⚽','🏀','🏈','⚾','🎾','🏐','🏓','🏸','🏒','🥅','⛳','🎣','🥊','🥋','🛹','🎿','🏂','🏋️','🤸','⛹️','🏌️','🧘','🏄','🏊','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🎖️','🎗️','🎫','🎪','🤹','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🎲','🎯','🎳','🎮','🎰','🧩'],
  objects: ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🕹️','💾','💿','📷','📸','📹','🎥','📞','☎️','📺','📻','🎙️','⏱️','⏰','⌛','⏳','🔋','🔌','💡','🔦','🕯️','💰','💳','💎','🔧','🔨','🛠️','⚙️','🔩','🧱','🧲','🔫','💣','🧨','🔪','🗡️','⚔️','🛡️','⚰️','🏺','🔮','📿','🔭','🔬','💊','💉','🩸','🧬','🧪','🌡️','🧹','🧴','🔑','🗝️','🚪','🛋️','🛏️','🧸','🎁','🎈','🎀','🎉'],
  symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🈳','🔣','ℹ️','🔤','🔡','🔠','🆖','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','➕','➖','➗','✖️','♾️','💲','💱','™️','©️','®️','➡️','⬅️','⬆️','⬇️','↗️','↘️','↙️','↖️','↕️','↔️','↪️','↩️','🔀','🔁','🔂','🔄','🔃','🔚','🔙','🔛','🔝','🔜','✔️','☑️','🔘','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔸','🔹','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','🔈','🔇','🔉','🔊','🔔','🔕','📣','📢','💬','💭','🗯️']
};

function toggleEmojiPanel() {
  const isHidden = emojiPickerPanel.classList.contains('hidden');
  gifPanel.classList.add('hidden');
  if (CONFIG.FEATURES.stickers) stickerPanel.classList.add('hidden');

  if (isHidden) {
    renderEmojiGrid(currentEmojiCat);
    emojiPickerPanel.classList.remove('hidden');
  } else {
    emojiPickerPanel.classList.add('hidden');
  }
}

function renderEmojiGrid(cat) {
  if (!emojiGrid) return;
  const list = EMOJI_DATA[cat] || EMOJI_DATA.smileys;
  emojiGrid.innerHTML = '';
  list.forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'emoji-grid-item';
    btn.textContent = em;
    btn.addEventListener('click', () => {
      const input = messageInput;
      const start = input.selectionStart || input.value.length;
      const end = input.selectionEnd || input.value.length;
      input.value = input.value.slice(0, start) + em + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start + em.length;
      input.focus();
    });
    emojiGrid.appendChild(btn);
  });
}

/* ============================================================
   GIF SEARCH (Giphy)
   ============================================================ */

function toggleGifPanel() {
  const isHidden = gifPanel.classList.contains('hidden');
  emojiPickerPanel.classList.add('hidden');
  if (CONFIG.FEATURES.stickers) stickerPanel.classList.add('hidden');

  if (isHidden) {
    gifPanel.classList.remove('hidden');
    gifSearchInput.focus();
    if (!gifResults.dataset.loaded) loadTrendingGifs();
  } else {
    gifPanel.classList.add('hidden');
  }
}

async function loadTrendingGifs() {
  if (!gifResults) return;
  gifResults.innerHTML = '<div class="gif-loading">Loading trending…</div>';
  try {
    const url = `${CONFIG.GIPHY_BASE}/trending?api_key=${CONFIG.GIPHY_KEY}&limit=20`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Giphy ' + res.status);
    const data = await res.json();
    renderGifResults(data.data || []);
    gifResults.dataset.loaded = '1';
  } catch (e) {
    console.warn('[gif] trending failed', e);
    gifResults.innerHTML = '<div class="gif-empty">Could not load GIFs.</div>';
  }
}

async function searchGifs(query) {
  if (!gifResults) return;
  gifResults.innerHTML = '<div class="gif-loading">Searching…</div>';
  try {
    const url = `${CONFIG.GIPHY_BASE}/search?api_key=${CONFIG.GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=20`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Giphy ' + res.status);
    const data = await res.json();
    renderGifResults(data.data || []);
  } catch (e) {
    console.warn('[gif] search failed', e);
    gifResults.innerHTML = '<div class="gif-empty">Search failed.</div>';
  }
}

function renderGifResults(results) {
  gifResults.innerHTML = '';
  if (!results.length) {
    gifResults.innerHTML = '<div class="gif-empty">No GIFs found.</div>';
    return;
  }

  results.forEach(g => {
    const preview = g.images?.fixed_height?.url || g.images?.fixed_height_small?.url;
    const full = g.images?.original?.url || preview;
    if (!full || !preview) return;

    const item = document.createElement('div');
    item.className = 'gif-item';
    item.innerHTML = `<img src="${preview}" alt="gif" loading="lazy">`;
    item.addEventListener('click', () => {
      sendGif(full, preview);
      gifPanel.classList.add('hidden');
    });
    gifResults.appendChild(item);
  });
}

function sendGif(url, preview) {
  const payload = { type: 'gif', id: uid(), url, preview, ts: Date.now() };
  if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
  else sendViaDataChannel(payload);
  addGifMessage(payload, 'sent');
}

function addGifMessage(data, direction) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + direction;
  wrap.dataset.id = data.id || uid();

  const msg = document.createElement('div');
  msg.className = 'message ' + direction;
  msg.style.padding = '4px';
  msg.style.background = 'transparent';
  msg.style.border = 'none';
  msg.style.boxShadow = 'none';

  const img = document.createElement('img');
  img.src = data.url;
  img.alt = 'GIF';
  img.style.maxWidth = '220px';
  img.style.borderRadius = '12px';
  img.style.display = 'block';
  img.loading = 'lazy';

  msg.appendChild(img);
  wrap.appendChild(msg);

  const metaRow = document.createElement('div');
  metaRow.className = 'msg-meta';
  metaRow.innerHTML = `<span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
  wrap.appendChild(metaRow);

  const reactionsRow = document.createElement('div');
  reactionsRow.className = 'msg-reactions';
  wrap.appendChild(reactionsRow);

  wrap.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openEmojiPicker(wrap.dataset.id, e.clientX, e.clientY);
  });

  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ============================================================
   STICKERS (disabled by default — flip FEATURES.stickers when files exist)
   ============================================================ */

const STICKER_DATA = {
  reactions: ['thumbsup', 'clap', 'laugh', 'wow', 'heart', 'fire', 'party', 'pray', 'ok', 'wave'],
  animals:   ['cat', 'dog', 'panda', 'fox', 'penguin', 'owl', 'bear', 'rabbit'],
  love:      ['hearteyes', 'kiss', 'hug', 'blush', 'cuddle', 'loveletter'],
  celebrate: ['cake', 'gift', 'candles', 'confetti', 'champagne', 'star', 'trophy', 'crown']
};

function toggleStickerPanel() {
  if (!CONFIG.FEATURES.stickers) return;
  const isHidden = stickerPanel.classList.contains('hidden');
  emojiPickerPanel.classList.add('hidden');
  gifPanel.classList.add('hidden');

  if (isHidden) {
    renderStickerGrid(currentStickerCat);
    stickerPanel.classList.remove('hidden');
  } else {
    stickerPanel.classList.add('hidden');
  }
}

function renderStickerGrid(cat) {
  if (!stickerGrid) return;
  const list = STICKER_DATA[cat] || STICKER_DATA.reactions;
  stickerGrid.innerHTML = '';
  list.forEach(name => {
    const src = 'stickers/' + cat + '/' + name + '.webp';
    const item = document.createElement('div');
    item.className = 'sticker-item';
    const img = document.createElement('img');
    img.src = src;
    img.alt = name;
    img.loading = 'lazy';
    img.onerror = () => { item.style.display = 'none'; };
    item.appendChild(img);
    item.addEventListener('click', () => {
      sendSticker(cat, name);
      stickerPanel.classList.add('hidden');
    });
    stickerGrid.appendChild(item);
  });
}

function sendSticker(cat, name) {
  const payload = { type: 'sticker', id: uid(), cat, name, ts: Date.now() };
  if (dataChannel && dataChannel.readyState === 'open') dataChannel.send(JSON.stringify(payload));
  else sendViaDataChannel(payload);
  addStickerMessage(payload, 'sent');
}

function addStickerMessage(data, direction) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + direction;
  wrap.dataset.id = data.id || uid();

  const msg = document.createElement('div');
  msg.className = 'message ' + direction;
  msg.style.padding = '4px';
  msg.style.background = 'transparent';
  msg.style.border = 'none';
  msg.style.boxShadow = 'none';

  const src = 'stickers/' + data.cat + '/' + data.name + '.webp';
  const img = document.createElement('img');
  img.src = src;
  img.alt = data.name;
  img.style.width = '120px';
  img.style.height = '120px';
  img.style.objectFit = 'contain';
  img.style.display = 'block';
  img.loading = 'lazy';

  msg.appendChild(img);
  wrap.appendChild(msg);

  const metaRow = document.createElement('div');
  metaRow.className = 'msg-meta';
  metaRow.innerHTML = `<span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
  wrap.appendChild(metaRow);

  const reactionsRow = document.createElement('div');
  reactionsRow.className = 'msg-reactions';
  wrap.appendChild(reactionsRow);

  wrap.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openEmojiPicker(wrap.dataset.id, e.clientX, e.clientY);
  });

  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* ============================================================
   SETUP v19 UI (wiring)
   ============================================================ */

function setupV19UI() {
  emojiBtn?.addEventListener('click', toggleEmojiPanel);
  gifBtn?.addEventListener('click', toggleGifPanel);
  stickerBtn?.addEventListener('click', toggleStickerPanel);

  emojiPanelClose?.addEventListener('click', () => emojiPickerPanel.classList.add('hidden'));
  gifCloseBtn?.addEventListener('click', () => gifPanel.classList.add('hidden'));
  stickerCloseBtn?.addEventListener('click', () => stickerPanel.classList.add('hidden'));

  emojiCats?.querySelectorAll('.emoji-cat').forEach(tab => {
    tab.addEventListener('click', () => {
      currentEmojiCat = tab.dataset.emojiCat;
      emojiCats.querySelectorAll('.emoji-cat').forEach(t => t.classList.toggle('active', t === tab));
      renderEmojiGrid(currentEmojiCat);
    });
  });

  stickerCats?.querySelectorAll('.sticker-cat').forEach(tab => {
    tab.addEventListener('click', () => {
      currentStickerCat = tab.dataset.stickerCat;
      stickerCats.querySelectorAll('.sticker-cat').forEach(t => t.classList.toggle('active', t === tab));
      renderStickerGrid(currentStickerCat);
    });
  });

  gifSearchInput?.addEventListener('input', () => {
    clearTimeout(gifSearchTimer);
    gifSearchTimer = setTimeout(() => {
      const q = gifSearchInput.value.trim();
      if (q.length >= 2) searchGifs(q);
    }, 400);
  });

  messageInput?.addEventListener('focus', () => {
    emojiPickerPanel.classList.add('hidden');
    gifPanel.classList.add('hidden');
    if (CONFIG.FEATURES.stickers) stickerPanel.classList.add('hidden');
  });
}

/* ============================================================
   END OF FILE
   ============================================================ */