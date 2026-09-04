// SoloDS NextLast v2
// Simple Code-Based Connection

let myId = '';
let partnerId = '';
let pairCode = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let incomingCall = false;

// DOM Elements
const registrationScreen = document.getElementById('registrationScreen');
const mainScreen = document.getElementById('mainScreen');
const userIdInput = document.getElementById('userId');
const partnerIdInput = document.getElementById('partnerId');
const pairCodeInput = document.getElementById('pairCode');
const connectBtn = document.getElementById('connectBtn');
const registerError = document.getElementById('registerError');
const myIdDisplay = document.getElementById('myIdDisplay');
const partnerIdDisplay = document.getElementById('partnerIdDisplay');
const connectionStatus = document.getElementById('connectionStatus');
const chatStatus = document.getElementById('chatStatus');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const startCallBtn = document.getElementById('startCallBtn');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const hangupBtn = document.getElementById('hangupBtn');
const callStatus = document.getElementById('callStatus');
const callStatusText = document.getElementById('callStatusText');
const audioContainer = document.getElementById('audioContainer');
const remoteAudio = document.getElementById('remoteAudio');

// Check for saved session
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('solods_v2_session');
  if (saved) {
    const session = JSON.parse(saved);
    myId = session.myId;
    partnerId = session.partnerId;
    pairCode = session.pairCode;
    showMainScreen();
  }
});

// Connect button
connectBtn.addEventListener('click', () => {
  const id = userIdInput.value.trim().toLowerCase();
  const pId = partnerIdInput.value.trim().toLowerCase();
  const code = pairCodeInput.value.trim().toUpperCase();
  
  if (!id || !pId || !code) {
    registerError.textContent = 'All fields are required';
    return;
  }
  
  if (id === pId) {
    registerError.textContent = 'Your ID and partner ID cannot be same';
    return;
  }
  
  if (code.length < 3) {
    registerError.textContent = 'Code must be at least 3 characters';
    return;
  }
  
  myId = id;
  partnerId = pId;
  pairCode = code;
  
  localStorage.setItem('solods_v2_session', JSON.stringify({ myId, partnerId, pairCode }));
  
  showMainScreen();
  setupConnection();
});

function showMainScreen() {
  registrationScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  myIdDisplay.textContent = myId;
  partnerIdDisplay.textContent = partnerId;
}

function setupConnection() {
  connectionStatus.textContent = '🟡 Connecting...';
  connectionStatus.className = 'connecting';
  
  createPeerConnection();
  createDataChannel();
  
  addSystemMessage('Looking for ' + partnerId + ' with code ' + pairCode + '...');
  
  // Auto-create offer
  setTimeout(() => {
    createOffer();
  }, 1000);
}

function createPeerConnection() {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  peerConnection = new RTCPeerConnection(configuration);
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('ICE candidate ready');
    }
  };
  
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    
    if (state === 'connected') {
      connectionStatus.textContent = '🟢 Connected';
      connectionStatus.className = 'connected';
      chatStatus.classList.add('connected');
      addSystemMessage('✅ Connected!');
    } else if (state === 'failed' || state === 'disconnected') {
      connectionStatus.textContent = '🔴 Disconnected';
      connectionStatus.className = '';
      chatStatus.classList.remove('connected');
    }
  };
  
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    remoteAudio.srcObject = remoteStream;
    audioContainer.classList.remove('hidden');
    callStatusText.textContent = '🔊 Voice connected';
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
      
      if (data.type === 'call-start') {
        incomingCall = true;
        startCallBtn.classList.add('hidden');
        acceptCallBtn.classList.remove('hidden');
        rejectCallBtn.classList.remove('hidden');
        callStatus.classList.remove('hidden');
        callStatusText.textContent = '📞 ' + partnerId + ' is calling...';
      } else if (data.type === 'call-accept') {
        callStatusText.textContent = '✅ Call accepted';
      } else if (data.type === 'call-reject') {
        endCall();
        addSystemMessage('❌ Call rejected');
      } else if (data.type === 'call-end') {
        endCall();
        addSystemMessage('📞 Call ended');
      } else if (data.type === 'message') {
        addMessage(data.text, 'received');
      }
    } catch {
      addMessage(event.data, 'received');
    }
  };
}

async function createOffer() {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('Offer created');
  } catch (error) {
    console.error('Offer error:', error);
  }
}

// Send message
sendMessageBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;
  
  if (dataChannel && dataChannel.readyState === 'open') {
    const data = JSON.stringify({ type: 'message', text: message });
    dataChannel.send(data);
    addMessage(message, 'sent');
    messageInput.value = '';
  } else {
    addSystemMessage('Not connected yet');
  }
}

// Start call
startCallBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({ type: 'call-start' }));
    }
    
    startCallBtn.classList.add('hidden');
    hangupBtn.classList.remove('hidden');
    callStatus.classList.remove('hidden');
    callStatusText.textContent = '📞 Calling...';
    isInCall = true;
    
  } catch (error) {
    alert('Microphone access denied');
  }
});

// Accept call
acceptCallBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true }
    });
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    if (dataChannel) {
      dataChannel.send(JSON.stringify({ type: 'call-accept' }));
    }
    
    acceptCallBtn.classList.add('hidden');
    rejectCallBtn.classList.add('hidden');
    hangupBtn.classList.remove('hidden');
    callStatusText.textContent = '🔊 Connected';
    isInCall = true;
    
  } catch (error) {
    alert('Microphone access denied');
  }
});

// Reject call
rejectCallBtn.addEventListener('click', () => {
  if (dataChannel) {
    dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  }
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  startCallBtn.classList.remove('hidden');
  callStatus.classList.add('hidden');
  incomingCall = false;
});

// Hang up
hangupBtn.addEventListener('click', () => {
  if (dataChannel) {
    dataChannel.send(JSON.stringify({ type: 'call-end' }));
  }
  endCall();
});

function endCall() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  startCallBtn.classList.remove('hidden');
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  hangupBtn.classList.add('hidden');
  callStatus.classList.add('hidden');
  audioContainer.classList.add('hidden');
  isInCall = false;
  incomingCall = false;
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
  div.textContent = '🔹 ' + text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

console.log('SoloDS NextLast v2 loaded');
