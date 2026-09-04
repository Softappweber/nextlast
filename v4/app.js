// SoloDS NextLast v4 - With Compression
// Short Code = Compressed Connection Data

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
const connectBtn = document.getElementById('connectBtn');
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

// Check saved
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('solods_v4');
  if (saved) {
    const s = JSON.parse(saved);
    myName = s.myName;
    partnerName = s.partnerName;
    showMain();
  }
});

// Register - Create Connection Code
registerBtn.addEventListener('click', async () => {
  const name = userNameInput.value.trim();
  const pname = partnerNameInput.value.trim();
  
  if (!name) {
    errorEl.textContent = 'Enter your name';
    return;
  }
  
  myName = name;
  partnerName = pname || 'Friend';
  
  localStorage.setItem('solods_v4', JSON.stringify({ myName, partnerName }));
  
  codeCard.classList.remove('hidden');
  codeDisplay.textContent = 'CREATING...';
  
  // Create WebRTC offer and compress it
  await createOffer();
});

// Create offer and compress to short code
async function createOffer() {
  try {
    createPeerConnection();
    createDataChannel();
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    await waitForIceGathering();
    
    const fullData = JSON.stringify({
      type: 'offer',
      sdp: peerConnection.localDescription
    });
    
    // Compress to short code
    myCode = compressData(fullData);
    
    codeDisplay.textContent = myCode;
    
  } catch (error) {
    console.error(error);
    codeDisplay.textContent = 'ERROR';
  }
}

// Compress long data to short code
function compressData(longString) {
  try {
    // Use base64 + compression
    const compressed = pako.deflate(longString, { to: 'string' });
    const base64 = btoa(compressed);
    // Make it URL safe and shorter
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    // Fallback - just base64
    return btoa(longString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}

// Decompress short code to long data
function decompressData(shortCode) {
  try {
    const base64 = shortCode.replace(/-/g, '+').replace(/_/g, '/');
    const compressed = atob(base64);
    return pako.inflate(compressed, { to: 'string' });
  } catch (e) {
    // Fallback
    const base64 = shortCode.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  }
}

// Copy code
copyCodeBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(myCode).then(() => {
    copyCodeBtn.textContent = '✅ Copied!';
    setTimeout(() => copyCodeBtn.textContent = '📋 Copy Code', 2000);
  });
});

// Connect with partner code
connectBtn.addEventListener('click', async () => {
  const pcode = partnerCodeInput.value.trim();
  
  if (!pcode) {
    alert('Enter partner code');
    return;
  }
  
  try {
    const fullData = decompressData(pcode);
    const data = JSON.parse(fullData);
    
    showMain();
    
    await peerConnection.setRemoteDescription(data.sdp);
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    await waitForIceGathering();
    
    const answerData = JSON.stringify({
      type: 'answer',
      sdp: peerConnection.localDescription
    });
    
    const answerCode = compressData(answerData);
    
    // Show answer code to send back
    addSystemMsg('Answer code created. Send back to partner:');
    addSystemMsg(answerCode);
    
    // For demo, auto-connect if possible
    statusText.textContent = '🟡 Waiting...';
    
  } catch (error) {
    console.error(error);
    alert('Invalid code');
  }
});

function showMain() {
  registrationScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  myNameDisplay.textContent = myName;
  partnerNameDisplay.textContent = partnerName;
  
  if (!peerConnection) {
    createPeerConnection();
    createDataChannel();
  }
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
      handleMessage(data);
    } catch {
      addMsg(event.data, 'received');
    }
  };
}

function handleMessage(data) {
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

// Wait for ICE
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

// Messaging
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

// Voice calls
startCallBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    
    dataChannel.send(JSON.stringify({ type: 'call-start' }));
    
    startCallBtn.classList.add('hidden');
    hangupBtn.classList.remove('hidden');
    callStatus.textContent = '📞 Calling...';
    isInCall = true;
  } catch {
    alert('Microphone access needed');
  }
});

function incomingCall() {
  startCallBtn.classList.add('hidden');
  acceptBtn.classList.remove('hidden');
  rejectBtn.classList.remove('hidden');
  callStatus.textContent = '📞 ' + partnerName + ' is calling...';
}

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

rejectBtn.addEventListener('click', () => {
  dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  acceptBtn.classList.add('hidden');
  rejectBtn.classList.add('hidden');
  startCallBtn.classList.remove('hidden');
  callStatus.textContent = '';
});

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

console.log('SoloDS NextLast v4 loaded');
