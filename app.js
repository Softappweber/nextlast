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
let connectionCode = '';

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
  
  createPeerConnection();
  createDataChannel();
  
  addSystemMessage('Paired with ' + partnerId);
  
  // Check if we have saved connection
  const savedCode = localStorage.getItem('solods_code_' + partnerId);
  
  if (savedCode) {
    addSystemMessage('Found saved connection. Attempting to reconnect...');
    // Try to use saved code to reconnect
    showCodeInput(savedCode);
  } else {
    // First time - generate code
    generateConnectionCode();
  }
}

// Generate connection code
function generateConnectionCode() {
  connectionCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  addSystemMessage('📋 YOUR CONNECTION CODE: ' + connectionCode);
  addSystemMessage('Enter this code on your partner\'s device');
  
  // Show code input
  showCodeInput(null);
}

// Show code input for manual exchange
function showCodeInput(existingCode) {
  const codeInputDiv = document.createElement('div');
  codeInputDiv.className = 'code-exchange';
  codeInputDiv.id = 'codeExchange';
  codeInputDiv.innerHTML = `
    <div style="margin: 15px 0; padding: 15px; background: rgba(0,212,255,0.1); border: 1px solid #00d4ff; border-radius: 8px;">
      <h3 style="color: #00d4ff; margin-bottom: 10px;">🔑 Connection Code Exchange</h3>
      ${existingCode ? 
        `<p style="font-size: 14px; color: #ccc; margin-bottom: 10px;">Saved code found: <strong style="color: #00d4ff;">${existingCode}</strong></p>
         <p style="font-size: 12px; color: #888; margin-bottom: 10px;">Enter partner's code below or use saved code</p>` :
        `<p style="font-size: 14px; color: #ccc; margin-bottom: 10px;">Your code: <strong style="color: #00d4ff; font-size: 18px;">${connectionCode}</strong></p>
         <p style="font-size: 12px; color: #888; margin-bottom: 10px;">1. Tell your partner this code<br>2. Enter their code below</p>`
      }
      <input type="text" id="partnerCodeInput" placeholder="Enter partner's code" maxlength="6" 
             style="width: 100%; padding: 10px; border: 1px solid #00d4ff; border-radius: 4px; background: rgba(0,0,0,0.5); color: #fff; font-size: 16px; text-transform: uppercase; margin-bottom: 10px;">
      <button id="submitCodeBtn" class="btn-primary" style="padding: 10px;">Connect</button>
    </div>
  `;
  
  // Insert after chat header
  const chatHeader = document.querySelector('.chat-header');
  chatHeader.after(codeInputDiv);
  
  // Add event listener
  document.getElementById('submitCodeBtn').addEventListener('click', () => {
    const partnerCode = document.getElementById('partnerCodeInput').value.trim().toUpperCase();
    
    if (!partnerCode) {
      alert('Please enter partner\'s code');
      return;
    }
    
    if (partnerCode.length < 4) {
      alert('Invalid code');
      return;
    }
    
    // Save partner code
    localStorage.setItem('solods_code_' + partnerId, partnerCode);
    
    // Remove code exchange UI
    document.getElementById('codeExchange').remove();
    
    addSystemMessage('✅ Codes exchanged! Establishing connection...');
    
    // Now create offer with code
    createOfferWithCode(partnerCode);
  });
  
  // Auto-fill if existing code
  if (existingCode) {
    document.getElementById('partnerCodeInput').value = existingCode;
  }
}

// Create offer with code
async function createOfferWithCode(partnerCode) {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    await waitForIceGathering();
    
    // Store offer in a way partner can find using code
    const connectionData = {
      type: 'offer',
      sdp: peerConnection.localDescription,
      myId: myId,
      partnerCode: partnerCode
    };
    
    const encodedData = btoa(JSON.stringify(connectionData));
    
    // Store locally
    localStorage.setItem('solods_offer_' + connectionCode, encodedData);
    
    addSystemMessage('⏳ Waiting for partner to connect...');
    
    // In real P2P without server, we need both devices to exchange codes
    // For v1, we simulate by storing in localStorage (same device)
    // For cross-device, we need manual code entry on both sides
    
  } catch (error) {
    console.error('Create offer error:', error);
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
      addSystemMessage('✅ Connected with ' + partnerId + '!');
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
    addSystemMessage('💬 Chat ready!');
  };
  
  dataChannel.onclose = () => {
    addSystemMessage('Connection closed.');
  };
  
  dataChannel.onmessage = (event) => {
    addMessage(event.data, 'received');
  };
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
    addSystemMessage('Not connected yet. Wait for connection...');
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
  generateConnectionCode();
});

console.log('SoloDS NextLast loaded');
