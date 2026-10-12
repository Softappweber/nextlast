// SoloDS NextLast v7 - Link-Based Connection with Voice

let myName = '';
let partnerName = '';
let peerConnection = null;
let dataChannel = null;
let localStream = null;
let remoteStream = null;
let isInCall = false;
let pendingOffer = null;
let pendingAnswer = null;

// DOM
const registrationScreen = document.getElementById('registrationScreen');
const mainScreen = document.getElementById('mainScreen');
const userIdInput = document.getElementById('userId');
const registerBtn = document.getElementById('registerBtn');
const registerError = document.getElementById('registerError');
const linkBox = document.getElementById('linkBox');
const myLinkText = document.getElementById('myLinkText');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const joinBox = document.getElementById('joinBox');
const acceptConnectBtn = document.getElementById('acceptConnectBtn');
const answerBox = document.getElementById('answerBox');
const answerLinkText = document.getElementById('answerLinkText');
const copyAnswerBtn = document.getElementById('copyAnswerBtn');
const reconnectBox = document.getElementById('reconnectBox');
const regTitle = document.getElementById('regTitle');
const regHint = document.getElementById('regHint');

const myNameDisplay = document.getElementById('myNameDisplay');
const partnerNameDisplay = document.getElementById('partnerNameDisplay');
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
const resetBtn = document.getElementById('resetBtn');

// ========================
// INITIAL LOAD
// ========================
window.addEventListener('DOMContentLoaded', async () => {
  // Check for saved session
  const savedSession = localStorage.getItem('solods_v7_session');
  
  // Check URL hash (incoming link)
  const hash = window.location.hash;
  
  if (hash && hash.length > 1) {
    // Someone opened a connection link
    await handleIncomingLink(hash.substring(1));
    return;
  }
  
  if (savedSession) {
    const session = JSON.parse(savedSession);
    myName = session.myName;
    partnerName = session.partnerName;
    
    // Show reconnect option
    regTitle.textContent = 'Welcome Back, ' + myName;
    regHint.textContent = 'Reconnecting to ' + partnerName + '...';
    reconnectBox.style.display = 'block';
    
    // Auto-attempt reconnect
    setTimeout(() => {
      attemptAutoReconnect();
    }, 1000);
    return;
  }
  
  // Fresh start
  registerBtn.onclick = registerUser;
});

// ========================
// USER REGISTRATION - CREATE OFFER
// ========================
async function registerUser() {
  const name = userIdInput.value.trim().toLowerCase();
  
  if (!name) {
    registerError.textContent = 'Please enter your name';
    return;
  }
  
  if (name.length < 3) {
    registerError.textContent = 'Name must be at least 3 characters';
    return;
  }
  
  if (!/^[a-z0-9]+$/.test(name)) {
    registerError.textContent = 'Only letters and numbers allowed';
    return;
  }
  
  myName = name;
  
  try {
    // Ask for microphone NOW (before connection)
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true,
        autoGainControl: true 
      } 
    });
    
    // Create peer connection
    createPeerConnection();
    
    // Add audio track BEFORE creating offer
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Create data channel
    createDataChannel();
    
    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGathering();
    
    // Encode offer into link
    const offerData = {
      type: 'offer',
      sdp: peerConnection.localDescription,
      from: myName
    };
    
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(offerData))));
    const baseUrl = window.location.href.split('#')[0];
    const link = baseUrl + '#offer=' + encoded;
    
    // Show link
    myLinkText.value = link;
    linkBox.style.display = 'block';
    registerBtn.disabled = true;
    
    addSystemMessage('📤 Link created! Send to your partner.');
    
  } catch (error) {
    console.error('Registration error:', error);
    if (error.name === 'NotAllowedError') {
      registerError.textContent = 'Microphone access required for voice calls';
    } else {
      registerError.textContent = 'Error: ' + error.message;
    }
  }
}

// ========================
// HANDLE INCOMING LINK (Partner sends link)
// ========================
async function handleIncomingLink(encoded) {
  try {
    // Parse hash
    let data;
    if (encoded.startsWith('offer=')) {
      data = JSON.parse(decodeURIComponent(escape(atob(encoded.substring(6)))));
    } else if (encoded.startsWith('answer=')) {
      data = JSON.parse(decodeURIComponent(escape(atob(encoded.substring(7)))));
    } else {
      throw new Error('Invalid link format');
    }
    
    if (data.type === 'offer') {
      // We received an offer - show accept button
      pendingOffer = data;
      partnerName = data.from || 'Partner';
      
      regTitle.textContent = 'Connection Request';
      regHint.textContent = partnerName + ' wants to connect with you';
      joinBox.style.display = 'block';
      
      acceptConnectBtn.onclick = acceptConnection;
      
    } else if (data.type === 'answer') {
      // We received an answer - complete the connection
      pendingAnswer = data;
      
      if (!peerConnection) {
        regTitle.textContent = 'Connection Info';
        regHint.textContent = 'Loading...';
        alert('Please refresh. Connection state lost.');
        return;
      }
      
      await peerConnection.setRemoteDescription(data.sdp);
      addSystemMessage('✅ Connection established!');
      
      // Save session
      saveSession();
      
      // Switch to main screen
      setTimeout(() => {
        showMainScreen();
      }, 500);
    }
    
  } catch (error) {
    console.error('Link error:', error);
    alert('Invalid or corrupted link. Please ask partner to resend.');
  }
}

// ========================
// ACCEPT CONNECTION (Create Answer)
// ========================
async function acceptConnection() {
  const name = userIdInput.value.trim().toLowerCase();
  
  if (!name) {
    registerError.textContent = 'Please enter your name';
    return;
  }
  
  myName = name;
  
  try {
    // Ask for microphone
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true 
      } 
    });
    
    // Create peer connection
    createPeerConnection();
    
    // Add audio tracks
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    // Set remote offer
    await peerConnection.setRemoteDescription(pendingOffer.sdp);
    
    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await waitForIceGathering();
    
    // Encode answer into link
    const answerData = {
      type: 'answer',
      sdp: peerConnection.localDescription,
      from: myName
    };
    
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(answerData))));
    const baseUrl = window.location.href.split('#')[0];
    const answerLink = baseUrl + '#answer=' + encoded;
    
    // Show answer link
    joinBox.style.display = 'none';
    answerBox.style.display = 'block';
    answerLinkText.value = answerLink;
    
    // Create data channel listener
    peerConnection.ondatachannel = (event) => {
      dataChannel = event.channel;
      setupDataChannel();
    };
    
    addSystemMessage('📤 Answer link created! Send back to partner.');
    
  } catch (error) {
    console.error('Accept error:', error);
    registerError.textContent = 'Microphone access required';
  }
}

// ========================
// AUTO RECONNECT
// ========================
async function attemptAutoReconnect() {
  try {
    const savedSession = JSON.parse(localStorage.getItem('solods_v7_session') || '{}');
    
    if (!savedSession.myName) return;
    
    // Get microphone
    localStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { echoCancellation: true, noiseSuppression: true } 
    });
    
    createPeerConnection();
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
    
    createDataChannel();
    
    // Create new offer for reconnection
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGathering();
    
    const offerData = {
      type: 'offer',
      sdp: peerConnection.localDescription,
      from: myName,
      reconnect: true
    };
    
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(offerData))));
    const baseUrl = window.location.href.split('#')[0];
    const link = baseUrl + '#offer=' + encoded;
    
    // Show link
    myLinkText.value = link;
    linkBox.style.display = 'block';
    reconnectBox.style.display = 'none';
    
    addSystemMessage('📤 Reconnect link ready. Send to partner.');
    
  } catch (error) {
    console.error('Reconnect error:', error);
    regHint.textContent = 'Microphone required. Please click below.';
    registerBtn.textContent = 'Retry Connection';
    registerBtn.onclick = registerUser;
  }
}

// ========================
// PEER CONNECTION
// ========================
function createPeerConnection() {
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };
  
  peerConnection = new RTCPeerConnection(config);
  
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
      addSystemMessage('✅ Connected with ' + partnerName + '!');
      saveSession();
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
    addSystemMessage('💬 Chat ready!');
  };
  
  dataChannel.onclose = () => {
    addSystemMessage('Connection closed.');
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
      callStatusText.textContent = '✅ Call accepted';
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

// ========================
// WAIT FOR ICE
// ========================
function waitForIceGathering() {
  return new Promise((resolve) => {
    if (peerConnection.iceGatheringState === 'complete') {
      resolve();
    } else {
      const check = () => {
        if (peerConnection.iceGatheringState === 'complete') {
          resolve();
        }
      };
      peerConnection.addEventListener('icegatheringstatechange', check);
      setTimeout(resolve, 3000);
    }
  });
}

// ========================
// MAIN SCREEN
// ========================
function showMainScreen() {
  registrationScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
  myNameDisplay.textContent = myName;
  partnerNameDisplay.textContent = partnerName;
}

function saveSession() {
  localStorage.setItem('solods_v7_session', JSON.stringify({
    myName: myName,
    partnerName: partnerName
  }));
}

// ========================
// MESSAGING
// ========================
sendMessageBtn.onclick = sendMessage;
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ type: 'message', text: text }));
    addMessage(text, 'sent');
    messageInput.value = '';
  } else {
    addSystemMessage('Not connected yet.');
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
  div.textContent = '🔹 ' + text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ========================
// VOICE CALL
// ========================
startCallBtn.onclick = () => {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    alert('Not connected yet');
    return;
  }
  
  dataChannel.send(JSON.stringify({ type: 'call-request' }));
  callStatus.classList.remove('hidden');
  callStatusText.textContent = '📞 Calling ' + partnerName + '...';
  startCallBtn.classList.add('hidden');
  hangupBtn.classList.remove('hidden');
  isInCall = true;
};

function showIncomingCall() {
  callStatus.classList.remove('hidden');
  callStatusText.textContent = '📞 ' + partnerName + ' is calling...';
  startCallBtn.classList.add('hidden');
  acceptCallBtn.classList.remove('hidden');
  rejectCallBtn.classList.remove('hidden');
}

acceptCallBtn.onclick = () => {
  if (dataChannel) {
    dataChannel.send(JSON.stringify({ type: 'call-accept' }));
  }
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  hangupBtn.classList.remove('hidden');
  callStatusText.textContent = '🔊 Call connected';
  isInCall = true;
};

rejectCallBtn.onclick = () => {
  if (dataChannel) {
    dataChannel.send(JSON.stringify({ type: 'call-reject' }));
  }
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  startCallBtn.classList.remove('hidden');
  callStatus.classList.add('hidden');
};

hangupBtn.onclick = () => {
  if (dataChannel) {
    dataChannel.send(JSON.stringify({ type: 'call-end' }));
  }
  endCall();
  addSystemMessage('📞 Call ended');
};

function endCall() {
  startCallBtn.classList.remove('hidden');
  acceptCallBtn.classList.add('hidden');
  rejectCallBtn.classList.add('hidden');
  hangupBtn.classList.add('hidden');
  callStatus.classList.add('hidden');
  isInCall = false;
}

// ========================
// RESET
// ========================
resetBtn.onclick = () => {
  if (confirm('Reset and pair with new partner? This will clear saved session.')) {
    localStorage.removeItem('solods_v7_session');
    window.location.hash = '';
    window.location.reload();
  }
};

// ========================
// COPY BUTTONS
// ========================
copyLinkBtn.onclick = () => {
  myLinkText.select();
  document.execCommand('copy');
  navigator.clipboard.writeText(myLinkText.value);
  copyLinkBtn.textContent = '✅ Copied!';
  setTimeout(() => copyLinkBtn.textContent = '📋 Copy Link', 2000);
};

copyAnswerBtn.onclick = () => {
  answerLinkText.select();
  document.execCommand('copy');
  navigator.clipboard.writeText(answerLinkText.value);
  copyAnswerBtn.textContent = '✅ Copied!';
  setTimeout(() => copyAnswerBtn.textContent = '📋 Copy Answer Link', 2000);
};

console.log('SoloDS NextLast v7 loaded');
