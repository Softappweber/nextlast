// SoloDS NextLast - P2P Communication
// Private Line. No Server. No Middleman.

let myId = '';
let partnerId = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let reconnectAttempts = 0;

// DOM Elements
const registrationScreen = document.getElementById('registrationScreen');
const mainScreen = document.getElementById('mainScreen');
const userIdInput = document.getElementById('userId');
const partnerIdInput = document.getElementById('partnerId');
const registerBtn = document.getElementById('registerBtn');
const registerError = document.getElementById('registerError');
const myIdDisplay = document.getElementById('myIdDisplay');
const connectionStatus = document.getElementById('connectionStatus');
const partnerStatus = document.getElementById('partnerStatus');
const pairingPanel = document.getElementById('pairingPanel');
const partnerIdInputField = document.getElementById('partnerIdInput');
const pairBtn = document.getElementById('pairBtn');
const chatPanel = document.getElementById('chatPanel');
const partnerIdDisplay = document.getElementById('partnerIdDisplay');
const chatStatus = document.getElementById('chatStatus');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const startCallBtn = document.getElementById('startCallBtn');
const hangupBtn = document.getElementById('hangupBtn');
const callStatus = document.getElementById('callStatus');
const callStatusText = document.getElementById('callStatusText');
const audioContainer = document.getElementById('audioContainer');
const remoteAudio = document.getElementById('remoteAudio');
const reconnectBtn = document.getElementById('reconnectBtn');

// Check if user already registered
window.addEventListener('DOMContentLoaded', () => {
  const savedId = localStorage.getItem('solods_my_id');
  const savedPartnerId = localStorage.getItem('solods_partner_id');
  
  if (savedId) {
    myId = savedId;
    partnerId = savedPartnerId || '';
    showMainScreen();
    
    if (partnerId) {
      setupPairedConnection();
    }
  }
});

// Register button
registerBtn.addEventListener('click', () => {
  const id = userIdInput.value.trim().toLowerCase();
  const pId = partnerIdInput.value.trim().toLowerCase();
  
  if (!id) {
    registerError.textContent = 'Please enter an ID';
    return;
  }
  
  if (id.length < 3) {
    registerError.textContent = 'ID must be at least 3 characters';
    return;
  }
  
  if (!/^[a-z0-9]+$/.test(id)) {
    registerError.textContent = 'Only letters and numbers allowed';
    return;
  }
  
  if (pId && pId === id) {
    registerError.textContent = 'Your ID and partner ID cannot be same';
    return;
  }
  
  myId = id;
  partnerId = pId;
  
  localStorage.setItem('solods_my_id', myId);
  if (partnerId) {
    localStorage.setItem('solods_partner_id', partnerId);
  }
  
  showMainScreen();
  
  if (partnerId) {
    setupPairedConnection();
  }
});

// Show main screen
function showMainScreen() {
  registrationScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  myIdDisplay.textContent = myId;
  
  if (partnerId) {
    pairingPanel.classList.add('hidden');
    chatPanel.classList.remove('hidden');
    partnerIdDisplay.textContent = partnerId;
  }
}

// Pair button
pairBtn.addEventListener('click', () => {
  const pId = partnerIdInputField.value.trim().toLowerCase();
  
  if (!pId) {
    alert('Please enter partner ID');
    return;
  }
  
  if (pId === myId) {
    alert('Cannot pair with yourself');
    return;
  }
  
  partnerId = pId;
  localStorage.setItem('solods_partner_id', partnerId);
  
  pairingPanel.classList.add('hidden');
  chatPanel.classList.remove('hidden');
  partnerIdDisplay.textContent = partnerId;
  
  setupPairedConnection();
});

// Setup paired connection
function setupPairedConnection() {
  connectionStatus.textContent = '🟡 Connecting...';
  connectionStatus.className = 'connecting';
  
  // For v1, we use URL hash for signaling
  // Both devices must be paired manually first time
  
  const savedConnection = localStorage.getItem('solods_connection_' + partnerId);
  
  if (savedConnection) {
    // Auto-reconnect attempt
    createPeerConnection();
    addSystemMessage('Attempting to reconnect with ' + partnerId + '...');
  } else {
    // First time pairing
    createPeerConnection();
    createDataChannel();
    addSystemMessage('Paired with ' + partnerId);
    addSystemMessage('Waiting for ' + partnerId + ' to connect...');
    createAndDisplayOffer();
  }
}

// Create peer connection
function createPeerConnection() {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };
  
  peerConnection = new RTCPeerConnection(configuration);
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('ICE candidate gathered');
    }
  };
  
  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;
    console.log('Connection state:', state);
    
    if (state === 'connected') {
      connectionStatus.textContent = '🟢 Connected';
      connectionStatus.className = 'connected';
      chatStatus.classList.add('connected');
      addSystemMessage('Connected with ' + partnerId);
      
      // Save connection
      saveConnectionState();
    } else if (state === 'failed' || state === 'disconnected') {
      connectionStatus.textContent = '🔴 Disconnected';
      connectionStatus.className = '';
      chatStatus.classList.remove('connected');
      reconnectBtn.classList.remove('hidden');
    }
  };
  
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    remoteAudio.srcObject = remoteStream;
    audioContainer.classList.remove('hidden');
    callStatusText.textContent = 'Voice call active';
  };
  
  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };
}

// Create data channel
function createDataChannel() {
  dataChannel = peerConnection.createDataChannel('chat');
  setupDataChannel();
}

// Setup data channel
function setupDataChannel() {
  dataChannel.onopen = () => {
    addSystemMessage('Connection established!');
  };
  
  dataChannel.onclose = () => {
    addSystemMessage('Connection closed.');
  };
  
  dataChannel.onmessage = (event) => {
    addMessage(event.data, 'received');
  };
}

// Create and display offer
async function createAndDisplayOffer() {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Wait for ICE gathering
    await waitForIceGathering();
    
    const connectionData = {
      type: 'offer',
      sdp: peerConnection.localDescription
    };
    
    // Store the offer for partner to retrieve
    const encodedOffer = btoa(JSON.stringify(connectionData));
    localStorage.setItem('solods_offer_' + myId, encodedOffer);
    
    // Check for partner's offer
    checkForPartnerConnection();
    
  } catch (error) {
    console.error('Create offer error:', error);
  }
}

// Check for partner connection
function checkForPartnerConnection() {
  const partnerOffer = localStorage.getItem('solods_offer_' + partnerId);
  
  if (partnerOffer) {
    try {
      const connectionData = JSON.parse(atob(partnerOffer));
      acceptOffer(connectionData);
    } catch (error) {
      console.error('Parse partner offer error:', error);
    }
  } else {
    // Poll for partner offer
    let attempts = 0;
    const pollInterval = setInterval(() => {
      attempts++;
      const pOffer = localStorage.getItem('solods_offer_' + partnerId);
      
      if (pOffer) {
        clearInterval(pollInterval);
        try {
          const connectionData = JSON.parse(atob(pOffer));
          acceptOffer(connectionData);
        } catch (error) {
          console.error('Parse partner offer error:', error);
        }
      } else if (attempts > 30) {
        clearInterval(pollInterval);
        addSystemMessage('Partner not found. Make sure both IDs are correct.');
      }
    }, 2000);
  }
}

// Accept offer
async function acceptOffer(connectionData) {
  try {
    await peerConnection.setRemoteDescription(connectionData.sdp);
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    const answerData = {
      type: 'answer',
      sdp: peerConnection.localDescription
    };
    
    const encodedAnswer = btoa(JSON.stringify(answerData));
    localStorage.setItem('solods_answer_' + myId, encodedAnswer);
    
    checkForPartnerAnswer();
    
  } catch (error) {
    console.error('Accept offer error:', error);
  }
}

// Check for partner answer
function checkForPartnerAnswer() {
  const partnerAnswer = localStorage.getItem('solods_answer_' + partnerId);
  
  if (partnerAnswer) {
    try {
      const answerData = JSON.parse(atob(partnerAnswer));
      peerConnection.setRemoteDescription(answerData.sdp);
      addSystemMessage('Connection established!');
    } catch (error) {
      console.error('Parse answer error:', error);
    }
  } else {
    let attempts = 0;
    const pollInterval = setInterval(() => {
      attempts++;
      const pAnswer = localStorage.getItem('solods_answer_' + partnerId);
      
      if (pAnswer) {
        clearInterval(pollInterval);
        try {
          const answerData = JSON.parse(atob(pAnswer));
          peerConnection.setRemoteDescription(answerData.sdp);
          addSystemMessage('Connection established!');
        } catch (error) {
          console.error('Parse answer error:', error);
        }
      } else if (attempts > 30) {
        clearInterval(pollInterval);
      }
    }, 2000);
  }
}

// Save connection state
function saveConnectionState() {
  const connectionState = {
    connected: true,
    timestamp: Date.now()
  };
  localStorage.setItem('solods_connection_' + partnerId, JSON.stringify(connectionState));
}

// Wait for ICE gathering
function waitForIceGathering() {
  return new Promise((resolve) => {
    if (peerConnection.iceGatheringState === 'complete') {
      resolve();
    } else {
      peerConnection.addEventListener('icegatheringstatechange', () => {
        if (peerConnection.iceGatheringState === 'complete') {
          resolve();
        }
      });
      setTimeout(resolve, 3000);
    }
  });
}

// Send message
sendMessageBtn.addEventListener('click', () => {
  const message = messageInput.value.trim();
  
  if (!message) return;
  
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(message);
    addMessage(message, 'sent');
    messageInput.value = '';
  } else {
    addSystemMessage('Not connected. Waiting for partner...');
  }
});

// Enter key to send
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessageBtn.click();
  }
});

// Add message to chat
function addMessage(text, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + type;
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add system message
function addSystemMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message system';
  messageDiv.textContent = '🔹 ' + text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Start voice call
startCallBtn.addEventListener('click', async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    startCallBtn.classList.add('hidden');
    hangupBtn.classList.remove('hidden');
    callStatus.classList.remove('hidden');
    callStatusText.textContent = '📞 Calling...';
    isInCall = true;
    
  } catch (error) {
    console.error('Call error:', error);
    alert('Unable to access microphone. Please check permissions.');
  }
});

// Hang up
hangupBtn.addEventListener('click', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  
  startCallBtn.classList.remove('hidden');
  hangupBtn.classList.add('hidden');
  callStatus.classList.add('hidden');
  audioContainer.classList.add('hidden');
  isInCall = false;
  
  addSystemMessage('Call ended.');
});

// Reconnect button
reconnectBtn.addEventListener('click', () => {
  reconnectBtn.classList.add('hidden');
  createPeerConnection();
  createDataChannel();
  createAndDisplayOffer();
});

console.log('SoloDS NextLast loaded');
console.log('My ID:', myId || 'Not registered');
