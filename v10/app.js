// SoloDS NextLast v10 - Fixed Connection State

let myName = '';
let partnerName = '';
let myCode = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;

// DOM
const landingScreen = document.getElementById('landingScreen');
const connectingScreen = document.getElementById('connectingScreen');
const mainScreen = document.getElementById('mainScreen');
const statusBanner = document.getElementById('statusBanner');
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
const connPill = document.getElementById('connPill');
const connText = document.getElementById('connText');
const chatChip = document.getElementById('chatChip');
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
  const saved = localStorage.getItem('solods_v10');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      myName = s.myName;
      userNameInput.value = myName;
    } catch {}
  }
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  setTimeout(() => errorBox.classList.add('hidden'), 5000);
}

function setStatus(msg) {
  statusMessage.textContent = msg;
}

// ==================
// URL-SAFE BASE64
// ==================
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
// STEP 1: GENERATE CODE (Offerer)
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
      } 
    });
    
    createCodeBtn.querySelector('span').textContent = 'Creating code...';
    
    createPeerConnection();
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
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
    addSystemMessage('Code ready. Send to partner.');
    
  } catch (error) {
    createCodeBtn.disabled = false;
    createCodeBtn.querySelector('span').textContent = 'Generate Connection Code';
    showError(error.name === 'NotAllowedError' ? 'Microphone access required' : error.message);
  }
});

copyCodeBtn.addEventListener('click', () => copyToClipboard(myCode, copyCodeBtn));

// ==================
// STEP 2: PASTE PARTNER CODE → GENERATE ANSWER (Answerer)
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
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
    }
    
    createPeerConnection();
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    
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
    addSystemMessage('Answer code ready. Send back to partner.');
    
  } catch (error) {
    connectBtn.disabled = false;
    connectBtn.querySelector('span').textContent = 'Generate Answer Code';
    showError('Invalid code. Check and try again.');
  }
});

copyAnswerBtn.addEventListener('click', () => copyToClipboard(myAnswerDisplay.textContent, copyAnswerBtn));

// ==================
// STEP 3: COMPLETE CONNECTION (Offerer)
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
    
    // Mark step 2 done
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
    if (event.candidate) {
      console.log('ICE candidate');
    } else {
      // ICE gathering complete
      markStep(3, 'done');
    }
  };
  
  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE state:', peerConnection.iceConnectionState);
  };
  
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    console.log('Connection state:', state);
    
    if (state === 'connected') {
      // Only consider connected when data channel is open
      connPill.classList.add('connected');
      connText.textContent = 'Connected';
      chatChip.textContent = 'ONLINE';
    } else if (state === 'connecting' || state === 'new') {
      connPill.classList.remove('connected');
      connText.textContent = 'Connecting';
      chatChip.textContent = 'CONNECTING';
    } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
      connPill.classList.remove('connected');
      connText.textContent = 'Disconnected';
      chatChip.textContent = 'OFFLINE';
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
    console.log('Data channel OPEN — connection is truly ready');
    markStep(4, 'done');
    
    // Now switch to main screen — connection is truly ready
    setTimeout(() => {
      switchToMainScreen();
    }, 700);
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
      callStatusText.textContent = 'Call connected';
      callStatus.classList.remove('hidden');
      isInCall = true;
      break;
    case 'call-reject':
      endCall();
      addSystemMessage('Call rejected');
      break;
    case 'call-end':
      endCall();
      addSystemMessage('Partner ended the call');
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
  
  // Reset steps
  document.querySelectorAll('.conn-step').forEach(s => {
    s.classList.remove('done', 'active');
  });
  
  // Mark steps based on state
  markStep(1, 'done'); // Local offer/answer already created
  if (peerConnection.remoteDescription) {
    markStep(2, 'done');
  }
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
  addSystemMessage('Connection established');
  
  localStorage.setItem('solods_v10', JSON.stringify({ myName, partnerName }));
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
// VOICE CALLS
// ==================
startCallBtn.addEventListener('click', () => {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    addSystemMessage('Not connected');
    return;
  }
  
  dataChannel.send(JSON.stringify({ type: 'call-request' }));
  callStatus.classList.remove('hidden');
  callStatusText.textContent = 'Calling ' + partnerName + '...';
  startCallBtn.classList.add('hidden');
  hangupBtn.classList.remove('hidden');
  isInCall = true;
});

function showIncomingCall() {
  callStatus.classList.remove('hidden');
  callStatusText.textContent = partnerName + ' is calling...';
  startCallBtn.classList.add('hidden');
  acceptCallBtn.classList.remove('hidden');
  rejectCallBtn.classList.remove('hidden');
}

acceptCallBtn.addEventListener('click', () => {
  if (dataChannel) dataChannel.send(JSON.stringify({ type: 'call-accept' }));
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  hangupBtn.classList.remove('hidden');
  callStatusText.textContent = 'Call connected';
  isInCall = true;
});

rejectCallBtn.addEventListener('click', () => {
  if (dataChannel) dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  startCallBtn.classList.remove('hidden');
  callStatus.classList.add('hidden');
});

hangupBtn.addEventListener('click', () => {
  if (dataChannel) dataChannel.send(JSON.stringify({ type: 'call-end' }));
  endCall();
  addSystemMessage('Call ended');
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
  if (confirm('Reset connection?')) {
    localStorage.removeItem('solods_v10');
    location.reload();
  }
});

console.log('SoloDS NextLast v10 loaded');
