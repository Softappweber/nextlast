// SoloDS NextLast - P2P Communication
// Private Line. No Server. No Middleman.

let myId = '';
let partnerId = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;

// DOM Elements
const registrationScreen = document.getElementById('registrationScreen');
const mainScreen = document.getElementById('mainScreen');
const userIdInput = document.getElementById('userId');
const partnerIdInput = document.getElementById('partnerId');
const registerBtn = document.getElementById('registerBtn');
const registerError = document.getElementById('registerError');
const myIdDisplay = document.getElementById('myIdDisplay');
const connectionStatus = document.getElementById('connectionStatus');
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
      showConnectionPanel();
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
    showConnectionPanel();
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
  
  showConnectionPanel();
});

// Show connection panel (create or join)
function showConnectionPanel() {
  createPeerConnection();
  createDataChannel();
  
  addSystemMessage('Paired with ' + partnerId);
  
  // Create connection panel UI
  const panelDiv = document.createElement('div');
  panelDiv.id = 'connectionPanel';
  panelDiv.innerHTML = `
    <div style="margin: 15px 0; padding: 15px; background: rgba(0,212,255,0.1); border: 1px solid #00d4ff; border-radius: 8px;">
      <h3 style="color: #00d4ff; margin-bottom: 15px; text-align: center;">🔗 Establish Connection</h3>
      
      <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <button id="createOfferBtn" class="btn-primary" style="flex: 1;">Create Connection Data</button>
        <button id="pasteOfferBtn" class="btn-secondary" style="flex: 1;">Paste Partner's Data</button>
      </div>
      
      <div id="offerArea" class="hidden" style="margin-bottom: 15px;">
        <p style="font-size: 13px; color: #ccc; margin-bottom: 8px;">Copy this data and send to partner:</p>
        <textarea id="offerText" readonly style="width: 100%; min-height: 100px; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #00d4ff; border-radius: 4px; color: #00ff88; font-size: 11px; font-family: monospace; box-sizing: border-box;"></textarea>
        <button id="copyOfferBtn" class="btn-secondary" style="margin-top: 8px;">📋 Copy Data</button>
      </div>
      
      <div id="pasteArea" class="hidden" style="margin-bottom: 15px;">
        <p style="font-size: 13px; color: #ccc; margin-bottom: 8px;">Paste partner's connection data:</p>
        <textarea id="pasteText" placeholder="Paste partner's data here..." style="width: 100%; min-height: 100px; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #ffc107; border-radius: 4px; color: #fff; font-size: 11px; font-family: monospace; box-sizing: border-box;"></textarea>
        <button id="connectBtn" class="btn-primary" style="margin-top: 8px;">Connect</button>
      </div>
    </div>
  `;
  
  const chatHeader = document.querySelector('.chat-header');
  chatHeader.after(panelDiv);
  
  // Create offer button
  document.getElementById('createOfferBtn').addEventListener('click', async () => {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      await waitForIceGathering();
      
      const connectionData = {
        type: 'offer',
        sdp: peerConnection.localDescription
      };
      
      const encodedData = btoa(JSON.stringify(connectionData));
      
      document.getElementById('offerArea').classList.remove('hidden');
      document.getElementById('offerText').value = encodedData;
      
      addSystemMessage('📤 Connection data created! Copy and send to partner.');
    } catch (error) {
      console.error('Create offer error:', error);
      addSystemMessage('❌ Error creating connection data');
    }
  });
  
  // Copy offer button
  document.getElementById('copyOfferBtn').addEventListener('click', () => {
    const offerText = document.getElementById('offerText');
    offerText.select();
    document.execCommand('copy');
    addSystemMessage('📋 Data copied! Send to partner.');
  });
  
  // Paste offer button
  document.getElementById('pasteOfferBtn').addEventListener('click', () => {
    document.getElementById('pasteArea').classList.remove('hidden');
    document.getElementById('offerArea').classList.add('hidden');
  });
  
  // Connect button (paste partner's data)
  document.getElementById('connectBtn').addEventListener('click', async () => {
    const pastedData = document.getElementById('pasteText').value.trim();
    
    if (!pastedData) {
      alert('Please paste partner\'s connection data');
      return;
    }
    
    try {
      const connectionData = JSON.parse(atob(pastedData));
      
      if (connectionData.type === 'offer') {
        await peerConnection.setRemoteDescription(connectionData.sdp);
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        await waitForIceGathering();
        
        const answerData = {
          type: 'answer',
          sdp: peerConnection.localDescription
        };
        
        const encodedAnswer = btoa(JSON.stringify(answerData));
        
        // Show answer to send back
        document.getElementById('offerArea').classList.remove('hidden');
        document.getElementById('offerText').value = encodedAnswer;
        
        addSystemMessage('📤 Answer created! Copy and send back to partner.');
      } else if (connectionData.type === 'answer') {
        await peerConnection.setRemoteDescription(connectionData.sdp);
        addSystemMessage('✅ Connection established!');
      }
      
    } catch (error) {
      console.error('Connect error:', error);
      alert('Invalid connection data');
    }
  });
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
      
      const panel = document.getElementById('connectionPanel');
      if (panel) panel.remove();
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
    addSystemMessage('Not connected yet. Establish connection first.');
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
  showConnectionPanel();
});

console.log('SoloDS NextLast loaded');
