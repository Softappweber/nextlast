// SoloDS NextLast v8 - Modern UI + Code Exchange + Voice

let myName = '';
let partnerName = '';
let myCode = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let pendingOffer = null;

// DOM
const landingScreen = document.getElementById('landingScreen');
const mainScreen = document.getElementById('mainScreen');
const userNameInput = document.getElementById('userName');
const createCodeBtn = document.getElementById('createCodeBtn');
const shareCard = document.getElementById('shareCard');
const myCodeDisplay = document.getElementById('myCodeDisplay');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const joinCard = document.getElementById('joinCard');
const partnerCodeInput = document.getElementById('partnerCodeInput');
const connectBtn = document.getElementById('connectBtn');
const answerCard = document.getElementById('answerCard');
const myAnswerDisplay = document.getElementById('myAnswerDisplay');
const copyAnswerBtn = document.getElementById('copyAnswerBtn');
const finishCard = document.getElementById('finishCard');
const answerCodeInput = document.getElementById('answerCodeInput');
const finishBtn = document.getElementById('finishBtn');
const errorBox = document.getElementById('errorBox');

const connPill = document.getElementById('connPill');
const connText = document.getElementById('connText');
const partnerAvatar = document.getElementById('partnerAvatar');
const partnerNameDisplay = document.getElementById('partnerNameDisplay');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const startCallBtn = document.getElementById('startCallBtn');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const hangupBtn = document.getElementById('hangupBtn');
const callStatus = document.getElementById('callStatus');
const callStatusText = document.getElementById('callStatusText');
const remoteAudio = document.getElementById('remoteAudio');
const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const resetBtn = document.getElementById('resetBtn');

// ==================
// INIT
// ==================
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('solods_v8');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      myName = s.myName;
      partnerName = s.partnerName;
      userNameInput.value = myName;
    } catch {}
  }
  
  // Handle URL hash (backward compat)
  const hash = window.location.hash;
  if (hash && hash.length > 1) {
    partnerCodeInput.value = decodeURIComponent(hash.substring(1));
  }
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  setTimeout(() => errorBox.classList.add('hidden'), 5000);
}

// ==================
// STEP 1: CREATE CODE (Offer)
// ==================
createCodeBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim().toLowerCase();
  
  if (!name || name.length < 3) {
    showError('Please enter a valid name (3+ characters)');
    return;
  }
  
  myName = name;
  createCodeBtn.disabled = true;
  createCodeBtn.querySelector('span').textContent = 'Requesting mic...';
  
  try {
    // Ask mic permission first
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true,
        autoGainControl: true 
      } 
    });
    
    createCodeBtn.querySelector('span').textContent = 'Creating code...';
    
    createPeerConnection();
    
    // Add audio tracks BEFORE creating offer
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
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
    
    // Show code
    myCodeDisplay.textContent = myCode;
    shareCard.classList.remove('hidden');
    joinCard.classList.remove('hidden');
    createCodeBtn.disabled = false;
    createCodeBtn.querySelector('span').textContent = 'Generate Connection Code';
    
    addSystemMessage('📤 Code ready! Send it to your partner.');
    
  } catch (error) {
    console.error(error);
    createCodeBtn.disabled = false;
    createCodeBtn.querySelector('span').textContent = 'Generate Connection Code';
    
    if (error.name === 'NotAllowedError') {
      showError('Microphone access is required for voice calls');
    } else {
      showError('Error: ' + error.message);
    }
  }
});

copyCodeBtn.addEventListener('click', () => {
  copyToClipboard(myCode, copyCodeBtn, 'Copy Code');
});

// ==================
// STEP 3: PASTE PARTNER CODE → CREATE ANSWER
// ==================
connectBtn.addEventListener('click', async () => {
  const code = partnerCodeInput.value.trim();
  
  if (!code) {
    showError('Please paste your partner\'s code');
    return;
  }
  
  connectBtn.disabled = true;
  connectBtn.querySelector('span').textContent = 'Connecting...';
  
  try {
    const data = decode(code);
    
    if (data.type !== 'offer') {
      throw new Error('This is not a valid partner code');
    }
    
    partnerName = data.from || 'Partner';
    pendingOffer = data;
    
    // Ask mic permission
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true } 
    });
    
    createPeerConnection();
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
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
    answerCard.classList.remove('hidden');
    
    connectBtn.disabled = false;
    connectBtn.querySelector('span').textContent = 'Connect & Generate Answer';
    
    addSystemMessage('📤 Answer code ready! Send back to partner.');
    
  } catch (error) {
    console.error(error);
    connectBtn.disabled = false;
    connectBtn.querySelector('span').textContent = 'Connect & Generate Answer';
    showError('Invalid code. Please check and try again.');
  }
});

copyAnswerBtn.addEventListener('click', () => {
  copyToClipboard(myAnswerDisplay.textContent, copyAnswerBtn, 'Copy Answer Code');
});

// ==================
// STEP 5: FINISH (Paste partner's answer)
// ==================
finishBtn.addEventListener('click', async () => {
  const code = answerCodeInput.value.trim();
  
  if (!code) {
    showError('Please paste the answer code');
    return;
  }
  
  finishBtn.disabled = true;
  finishBtn.querySelector('span').textContent = 'Completing...';
  
  try {
    const data = decode(code);
    
    if (data.type !== 'answer') {
      throw new Error('This is not a valid answer code');
    }
    
    if (!peerConnection) {
      throw new Error('Connection state lost. Please start over.');
    }
    
    await peerConnection.setRemoteDescription(data.sdp);
    
    addSystemMessage('✅ Connection complete!');
    
    // Save session
    localStorage.setItem('solods_v8', JSON.stringify({ myName, partnerName }));
    
    // Switch to main screen
    setTimeout(() => showMainScreen(), 800);
    
  } catch (error) {
    console.error(error);
    finishBtn.disabled = false;
    finishBtn.querySelector('span').textContent = 'Complete Connection';
    showError(error.message || 'Invalid answer code');
  }
});

// ==================
// HELPERS: ENCODE / DECODE
// ==================
function encode(obj) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

function decode(str) {
  // Clean the string
  str = str.replace(/\s+/g, '');
  return JSON.parse(decodeURIComponent(escape(atob(str))));
}

function copyToClipboard(text, btn, originalText) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => { btn.innerHTML = original; }, 2000);
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
}

// ==================
// MAIN SCREEN
// ==================
function showMainScreen() {
  landingScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  
  partnerNameDisplay.textContent = partnerName;
  partnerAvatar.textContent = (partnerName || '?').charAt(0).toUpperCase();
  
  addSystemMessage('🔗 Connected to ' + partnerName);
}

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
    if (event.candidate) {
      console.log('ICE candidate');
    }
  };
  
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    console.log('Connection:', state);
    
    if (state === 'connected') {
      connPill.classList.add('connected');
      connText.textContent = 'Connected';
      addSystemMessage('✅ Connected!');
    } else if (state === 'failed' || state === 'disconnected') {
      connPill.classList.remove('connected');
      connText.textContent = 'Disconnected';
    }
  };
  
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    remoteAudio.srcObject = remoteStream;
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
    addSystemMessage('💬 Chat ready');
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
      callStatusText.textContent = '🔊 Call connected';
      callStatus.classList.remove('hidden');
      isInCall = true;
      break;
    case 'call-reject':
      endCall();
      addSystemMessage('❌ Call rejected');
      break;
    case 'call-end':
      endCall();
      addSystemMessage('📞 Partner ended the call');
      break;
  }
}

function waitForIceGathering() {
  return new Promise((resolve) => {
    if (peerConnection.iceGatheringState === 'complete') {
      resolve();
    } else {
      peerConnection.addEventListener('icegatheringstatechange', () => {
        if (peerConnection.iceGatheringState === 'complete') resolve();
      });
      setTimeout(resolve, 3000);
    }
  });
}

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
    addSystemMessage('Not connected yet');
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
// VOICE CALLS
// ==================
startCallBtn.addEventListener('click', () => {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    addSystemMessage('Not connected yet');
    return;
  }
  
  dataChannel.send(JSON.stringify({ type: 'call-request' }));
  callStatus.classList.remove('hidden');
  callStatusText.textContent = '📞 Calling ' + partnerName + '...';
  startCallBtn.classList.add('hidden');
  hangupBtn.classList.remove('hidden');
  isInCall = true;
});

function showIncomingCall() {
  callStatus.classList.remove('hidden');
  callStatusText.textContent = '📞 ' + partnerName + ' is calling...';
  startCallBtn.classList.add('hidden');
  acceptCallBtn.classList.remove('hidden');
  rejectCallBtn.classList.remove('hidden');
}

acceptCallBtn.addEventListener('click', () => {
  if (dataChannel) {
    dataChannel.send(JSON.stringify({ type: 'call-accept' }));
  }
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  hangupBtn.classList.remove('hidden');
  callStatusText.textContent = '🔊 Call connected';
  isInCall = true;
});

rejectCallBtn.addEventListener('click', () => {
  if (dataChannel) {
    dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  }
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  startCallBtn.classList.remove('hidden');
  callStatus.classList.add('hidden');
});

hangupBtn.addEventListener('click', () => {
  if (dataChannel) {
    dataChannel.send(JSON.stringify({ type: 'call-end' }));
  }
  endCall();
  addSystemMessage('📞 Call ended');
});

function endCall() {
  startCallBtn.classList.remove('hidden');
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  hangupBtn.classList.add('hidden');
  callStatus.classList.add('hidden');
  isInCall = false;
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
  if (confirm('Reset connection? This will clear your session.')) {
    localStorage.removeItem('solods_v8');
    location.reload();
  }
});

console.log('SoloDS NextLast v8 loaded');
