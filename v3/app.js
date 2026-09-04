// SoloDS NextLast v3
// Short Code + P2P + Text + Voice

let myName = '';
let partnerName = '';
let myCode = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;

// DOM
const registrationScreen = document.getElementById('registrationScreen');
const mainScreen = document.getElementById('mainScreen');
const userNameInput = document.getElementById('userName');
const partnerNameInput = document.getElementById('partnerName');
const registerBtn = document.getElementById('registerBtn');
const errorEl = document.getElementById('error');
const codeCard = document.getElementById('codeCard');
const codeDisplay = document.getElementById('codeDisplay');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const partnerCodeInput = document.getElementById('partnerCode');
const connectWithCodeBtn = document.getElementById('connectWithCodeBtn');
const myNameDisplay = document.getElementById('myNameDisplay');
const partnerNameDisplay = document.getElementById('partnerNameDisplay');
const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');
const chatDot = document.getElementById('chatDot');
const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const startCallBtn = document.getElementById('startCallBtn');
const acceptBtn = document.getElementById('acceptBtn');
const rejectBtn = document.getElementById('rejectBtn');
const hangupBtn = document.getElementById('hangupBtn');
const callStatus = document.getElementById('callStatus');
const remoteAudio = document.getElementById('remoteAudio');

// Check saved session
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('solods_v3');
  if (saved) {
    const s = JSON.parse(saved);
    myName = s.myName;
    partnerName = s.partnerName;
    myCode = s.myCode;
    showMain();
  }
});

// Register
registerBtn.addEventListener('click', () => {
  const name = userNameInput.value.trim();
  const pname = partnerNameInput.value.trim();
  
  if (!name) {
    errorEl.textContent = 'Enter your name';
    return;
  }
  
  myName = name;
  partnerName = pname || 'Friend';
  
  // Generate short code
  myCode = generateShortCode();
  
  localStorage.setItem('solods_v3', JSON.stringify({ myName, partnerName, myCode }));
  
  codeCard.classList.remove('hidden');
  codeDisplay.textContent = myCode;
});

// Generate short code
function generateShortCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Copy code
copyCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(myCode).then(() => {
    copyCodeBtn.textContent = '✅ Copied!';
    setTimeout(() => copyCodeBtn.textContent = '📋 Copy Code', 2000);
  });
});

// Connect with partner code
connectWithCodeBtn.addEventListener('click', () => {
  const pcode = partnerCodeInput.value.trim().toUpperCase();
  
  if (!pcode) {
    alert('Enter partner code');
    return;
  }
  
  // In v3, code contains compressed connection data
  try {
    const connectionData = decompressCode(pcode);
    showMain();
    connectWithData(connectionData);
  } catch {
    alert('Invalid code. Ask partner for their code.');
  }
});

// Show main screen
function showMain() {
  registrationScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  myNameDisplay.textContent = myName;
  partnerNameDisplay.textContent = partnerName;
  setupConnection();
}

// Setup P2P connection
function setupConnection() {
  createPeerConnection();
  createDataChannel();
  addSystemMsg('Ready to connect...');
}

function createPeerConnection() {
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  peerConnection = new RTCPeerConnection(config);
  
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    
    if (state === 'connected') {
      statusPill.classList.add('connected');
      statusText.textContent = '🟢 Connected';
      chatDot.classList.add('connected');
      addSystemMsg('✅ Connected!');
    } else if (state === 'failed' || state === 'disconnected') {
      statusPill.classList.remove('connected');
      statusText.textContent = '🔴 Disconnected';
      chatDot.classList.remove('connected');
    }
  };
  
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    remoteAudio.srcObject = remoteStream;
    remoteAudio.classList.remove('hidden');
    callStatus.textContent = '🔊 Voice connected';
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
    addSystemMsg('💬 Chat ready');
  };
  
  dataChannel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleDataMessage(data);
    } catch {
      addMsg(event.data, 'received');
    }
  };
}

function handleDataMessage(data) {
  switch(data.type) {
    case 'message':
      addMsg(data.text, 'received');
      break;
    case 'call-start':
      incomingCall();
      break;
    case 'call-accept':
      callStatus.textContent = '✅ Call accepted';
      break;
    case 'call-reject':
      endCall();
      addSystemMsg('❌ Call rejected');
      break;
    case 'call-end':
      endCall();
      addSystemMsg('📞 Call ended');
      break;
  }
}

// Send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'message', text }));
    addMsg(text, 'sent');
    messageInput.value = '';
  }
}

// Start call
startCallBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    
    if (dataChannel) {
      dataChannel.send(JSON.stringify({ type: 'call-start' }));
    }
    
    startCallBtn.classList.add('hidden');
    hangupBtn.classList.remove('hidden');
    callStatus.textContent = '📞 Calling...';
    isInCall = true;
  } catch {
    alert('Microphone access needed');
  }
});

// Incoming call
function incomingCall() {
  startCallBtn.classList.add('hidden');
  acceptBtn.classList.remove('hidden');
  rejectBtn.classList.remove('hidden');
  callStatus.textContent = '📞 ' + partnerName + ' is calling...';
}

// Accept call
acceptBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    
    dataChannel.send(JSON.stringify({ type: 'call-accept' }));
    
    acceptBtn.classList.add('hidden');
    rejectBtn.classList.add('hidden');
    hangupBtn.classList.remove('hidden');
    callStatus.textContent = '🔊 Connected';
    isInCall = true;
  } catch {
    alert('Microphone access needed');
  }
});

// Reject call
rejectBtn.addEventListener('click', () => {
  dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  acceptBtn.classList.add('hidden');
  rejectBtn.classList.add('hidden');
  startCallBtn.classList.remove('hidden');
  callStatus.textContent = '';
});

// Hang up
hangupBtn.addEventListener('click', () => {
  dataChannel.send(JSON.stringify({ type: 'call-end' }));
  endCall();
});

function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  startCallBtn.classList.remove('hidden');
  acceptBtn.classList.add('hidden');
  rejectBtn.classList.add('hidden');
  hangupBtn.classList.add('hidden');
  remoteAudio.classList.add('hidden');
  callStatus.textContent = '';
  isInCall = false;
}

// Compress / Decompress (placeholder - v3 uses short code + manual exchange)
function decompressCode(code) {
  // For v3, code is just identifier. Actual connection needs manual exchange.
  // This is simplified for now.
  return { code };
}

function connectWithData(data) {
  addSystemMsg('Connected with code: ' + data.code);
  addSystemMsg('Note: For full connection, both must exchange full data.');
}

function addMsg(text, type) {
  const div = document.createElement('div');
  div.className = 'msg ' + type;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addSystemMsg(text) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = '🔹 ' + text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

console.log('SoloDS NextLast v3 loaded');
