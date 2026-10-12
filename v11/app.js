// SoloDS NextLast v11 - Contacts + Video + Mic Fix

let myName = '';
let partnerName = '';
let myCode = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let pendingOffer = null;
let callTimerInterval = null;
let callStartTime = 0;
let micMuted = false;
let videoEnabled = false;
let isSavedPartner = false;

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
const partnerCodeInput = document.getElementById('partnerCodeInput');
const connectBtn = document.getElementById('connectBtn');
const answerArea = document.getElementById('answerArea');
const myAnswerDisplay = document.getElementById('myAnswerDisplay');
const copyAnswerBtn = document.getElementById('copyAnswerBtn');
const answerCodeInput = document.getElementById('answerCodeInput');
const finishBtn = document.getElementById('finishBtn');
const errorBox = document.getElementById('errorBox');

const connectingSub = document.getElementById('connectingSub');

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
const remoteAudio = document.getElementById('remoteAudio');

const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const resetBtn = document.getElementById('resetBtn');

const saveContactModal = document.getElementById('saveContactModal');
const saveContactName = document.getElementById('saveContactName');
const saveContactBtn = document.getElementById('saveContactBtn');
const skipSaveBtn = document.getElementById('skipSaveBtn');

// ==================
// INIT
// ==================
window.addEventListener('DOMContentLoaded', () => {
  loadContacts();
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
  
  contacts.forEach((contact, index) => {
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = `
      <div class="contact-avatar">${(contact.name || '?').charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${escapeHtml(contact.name)}</div>
        <div class="contact-time">${formatTime(contact.lastConnected)}</div>
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
  
  // Check if codes are still usable
  // For v11: just show landing screen with codes pre-filled
  myName = contact.myName || 'me';
  userNameInput.value = myName;
  
  showLanding();
  setStatus('Saved contact loaded — generate fresh codes');
}

addContactBtn.addEventListener('click', () => {
  isSavedPartner = false;
  partnerName = '';
  showLanding();
});

backHomeBtn.addEventListener('click', () => {
  showHome();
});

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
  
  // Reset fields
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
    // ⭐ CRITICAL: Get mic AND video (video can be disabled later)
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true,
        autoGainControl: true 
      },
      video: false  // Don't ask video permission upfront
    });
    
    // ⭐ MUTE ALL AUDIO TRACKS BY DEFAULT
    localStream.getAudioTracks().forEach(t => {
      t.enabled = false;
    });
    
    createCodeBtn.querySelector('span').textContent = 'Creating code...';
    
    createPeerConnection();
    
    // Add audio tracks (muted)
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
    
    setStatus('✅ Code ready — send to partner');
    
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
      
      // ⭐ MUTE BY DEFAULT
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
    
    setStatus('📤 Answer code ready — send back to partner');
    
  } catch (error) {
    connectBtn.disabled = false;
    connectBtn.querySelector('span').textContent = 'Generate Answer Code';
    showError('Invalid code. Check and try again.');
  }
});

copyAnswerBtn.addEventListener('click', () => copyToClipboard(myAnswerDisplay.textContent, copyAnswerBtn));

// ==================
// STEP 3: COMPLETE CONNECTION
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
    
    setStatus('🔄 Establishing direct connection...');
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
    case 'video-toggle':
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
// SCREENS
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
    step.classList.remove('active');
    step.querySelector('.step-check').textContent = '✓';
  } else if (state === 'active') {
    step.classList.add('active');
    step.classList.remove('done');
    step.querySelector('.step-check').textContent = '●';
  }
}

function switchToMainScreen() {
  connectingScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  
  partnerNameDisplay.textContent = partnerName;
  partnerAvatar.textContent = (partnerName || '?').charAt(0).toUpperCase();
  
  addSystemMessage('Connected to ' + partnerName);
  
  // Show save contact modal if new partner
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
// CALLS
// ==================
startCallBtn.addEventListener('click', () => {
  if (!dataChannel || dataChannel.readyState !== 'open') return;
  
  // ⭐ UNMUTE MIC when calling
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
}

acceptCallBtn.addEventListener('click', () => {
  // ⭐ UNMUTE MIC
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
  dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  callButtonsIncoming.classList.add('hidden');
  callButtonsIdle.classList.remove('hidden');
  callStatus.classList.add('hidden');
});

function startCallUI() {
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
      
      videoEnabled = true;
      toggleVideoBtn.classList.add('active');
      
      // Notify partner
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'video-toggle' }));
      }
      
      addSystemMessage('Video enabled');
      
    } catch (err) {
      alert('Camera access denied');
    }
  } else {
    // Turn off video
    if (localStream) {
      localStream.getVideoTracks().forEach(t => {
        t.stop();
        localStream.removeTrack(t);
      });
    }
    
    localVideo.srcObject = null;
    videoPanel.classList.add('hidden');
    videoEnabled = false;
    toggleVideoBtn.classList.remove('active');
    
    addSystemMessage('Video disabled');
  }
});

hangupBtn.addEventListener('click', () => {
  dataChannel.send(JSON.stringify({ type: 'call-end' }));
  endCall(true);
});

function endCall(notify) {
  if (callTimerInterval) {
    clearInterval(callTimerInterval);
    callTimerInterval = null;
  }
  
  // ⭐ MUTE MIC when call ends
  if (localStream) {
    localStream.getAudioTracks().forEach(t => {
      t.enabled = false;
    });
  }
  micMuted = true;
  muteMicBtn.classList.add('muted');
  muteMicBtn.querySelector('span').textContent = 'Mute';
  
  // Stop video if enabled
  if (videoEnabled && localStream) {
    localStream.getVideoTracks().forEach(t => {
      t.stop();
      localStream.removeTrack(t);
    });
    localVideo.srcObject = null;
    videoPanel.classList.add('hidden');
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
// MENU
// ==================
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => {
  menuDropdown.classList.add('hidden');
});

resetBtn.addEventListener('click', () => {
  if (confirm('Disconnect and return home?')) {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    if (peerConnection) peerConnection.close();
    if (callTimerInterval) clearInterval(callTimerInterval);
    
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
  if (confirm('Return to home screen? Connection will close.')) {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    
    peerConnection = null;
    dataChannel = null;
    localStream = null;
    remoteStream = null;
    isInCall = false;
    
    showHome();
  }
});

console.log('SoloDS NextLast v11 loaded');
