
/* SoloDS Pro — browser-only prototype. PeerJS cloud signaling + public STUN.
   Customer ownership is NOT authenticated here. Do not sell IDs until an external
   trusted entitlement service validates them. TURN can be added to ICE_SERVERS. */
'use strict';
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const CONFIG = { host: '0.peerjs.com', port: 443, path: '/', secure: true, debug: 1, config: { iceServers: ICE_SERVERS } };
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const state = {
  peer: null, id: '', displayName: '', online: false, visitor: false, target: '',
  data: null, media: null, localStream: null, remoteStream: null, screenStream: null,
  activeGuest: '', currentCallName: '', incoming: null, pending: new Map(),
  messages: [], queue: [], audio: true, video: false, busy: false, connected: false,
  fileRx: new Map(), theme: localStorage.getItem('solods_theme') || 'dark'
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const cleanId = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
const safeName = s => String(s || '').trim().slice(0, 48);
const randomId = () => 'guest-' + crypto.randomUUID().slice(0, 12);
const fmtTime = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const notify = (message, type='info') => {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.className = 'toast show ' + type;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => node.classList.remove('show'), 4200);
};
const show = (selector, yes=true) => {
  const el = $(selector);
  if (el) el.classList.toggle('hidden', !yes);
};
const text = (selector, value) => { const el=$(selector); if(el) el.textContent=value; };
const setStatus = (message, type='') => {
  text('#connectionStatus', message);
  const dot = $('#statusDot');
  if (dot) dot.className = 'status-dot ' + type;
};
function applyTheme(name) {
  state.theme = name;
  document.documentElement.dataset.theme = name;
  localStorage.setItem('solods_theme', name);
  $$('.theme-option').forEach(el => el.classList.toggle('selected', el.dataset.theme === name));
}
function init() {
  applyTheme(state.theme);
  const params = new URLSearchParams(location.search);
  state.target = cleanId(params.get('call'));
  state.visitor = !!state.target;
  show('#ownerView', !state.visitor);
  show('#visitorView', state.visitor);
  show('#appShell', true);
  text('#copyrightYear', new Date().getFullYear());
  if (state.visitor) {
    text('#visitorTarget', state.target);
    text('#visitorHeading', 'Connect with ' + state.target);
    $('#visitorName').value = sessionStorage.getItem('solods_guest_name') || '';
    connectVisitor();
  } else {
    $('#ownerId').value = localStorage.getItem('solods_owner_id') || '';
    $('#ownerName').value = localStorage.getItem('solods_owner_name') || '';
    const savedId = cleanId($('#ownerId').value);
    if (savedId) setPersonalLink(savedId);
  }
  bindUI();
}
function bindUI() {
  $('#goOnline')?.addEventListener('click', goOnline);
  $('#goOffline')?.addEventListener('click', goOffline);
  $('#copyLink')?.addEventListener('click', copyLink);
  $('#visitorAudio')?.addEventListener('click', () => requestCall(false));
  $('#visitorVideo')?.addEventListener('click', () => requestCall(true));
  $('#visitorMessageBtn')?.addEventListener('click', sendVisitorMessage);
  $('#visitorMessage')?.addEventListener('keydown', e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendVisitorMessage(); } });
  $('#visitorName')?.addEventListener('change', e => sessionStorage.setItem('solods_guest_name', safeName(e.target.value)));
  $('#acceptCall')?.addEventListener('click', acceptIncoming);
  $('#declineCall')?.addEventListener('click', declineIncoming);
  $('#endCall')?.addEventListener('click', endCall);
  $('#muteMic')?.addEventListener('click', toggleMic);
  $('#toggleCamera')?.addEventListener('click', toggleCamera);
  $('#shareScreen')?.addEventListener('click', shareScreen);
  $('#sendFile')?.addEventListener('click', () => $('#fileInput')?.click());
  $('#fileInput')?.addEventListener('change', e => { if(e.target.files?.[0]) sendFile(e.target.files[0]); e.target.value=''; });
  $('#sendChat')?.addEventListener('click', sendChat);
  $('#chatInput')?.addEventListener('keydown', e => { if(e.key==='Enter') { e.preventDefault(); sendChat(); } });
  $('#busyToggle')?.addEventListener('change', e => { state.busy=e.target.checked; updateAvailability(); });
  $('#availabilitySelect')?.addEventListener('change', updateAvailability);
  $('#quickReply')?.addEventListener('change', e => { if(e.target.value) { sendToActive({type:'chat', text:e.target.value, name:state.displayName}); addChat(state.displayName,e.target.value,'self'); e.target.value=''; } });
  $('#clearInbox')?.addEventListener('click', () => { state.messages=[]; renderInbox(); notify('Inbox cleared'); });
  $$('.theme-option').forEach(el => el.addEventListener('click', () => applyTheme(el.dataset.theme)));
  $$('.nav-link').forEach(el => el.addEventListener('click', () => selectTab(el.dataset.tab)));
  $('#copyGuestLink')?.addEventListener('click', () => navigator.clipboard.writeText(location.href).then(() => notify('Link copied')));
  $('#visitorLeaveQueue')?.addEventListener('click', () => { sendVisitor({type:'cancel'}); show('#visitorWaiting',false); notify('Waiting request cancelled'); });
  $('#visitorEndCall')?.addEventListener('click', endCall);
  $('#visitorMute')?.addEventListener('click', toggleMic);
  $('#visitorCamera')?.addEventListener('click', toggleCamera);
  $('#visitorShare')?.addEventListener('click', shareScreen);
  $('#visitorFile')?.addEventListener('click', () => $('#fileInput')?.click());
  $('#visitorSendChat')?.addEventListener('click', sendChat);
  $('#visitorChatInput')?.addEventListener('keydown', e => { if(e.key==='Enter') { e.preventDefault(); sendChat(); } });
  window.addEventListener('beforeunload', () => { try { state.peer?.destroy(); } catch {} });
}
function selectTab(tab) {
  $$('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  $$('.tab-panel').forEach(el => el.classList.toggle('hidden', el.dataset.panel !== tab));
}
function personalUrl(id) {
  const url = new URL(location.href);
  url.search = '?call=' + encodeURIComponent(id);
  url.hash = '';
  return url.toString();
}
function setPersonalLink(id) {
  const url=personalUrl(id);
  text('#personalLink',url);
  const anchor=$('#personalLinkAnchor');
  if(anchor) anchor.href=url;
}
async function copyLink() {
  const id=cleanId($('#ownerId')?.value);
  if(!id) return notify('Enter your personal ID first','error');
  try { await navigator.clipboard.writeText(personalUrl(id)); notify('Personal link copied','success'); }
  catch { notify('Clipboard unavailable. Copy the displayed link manually.','error'); }
}
function createPeer(id) {
  if (typeof Peer === 'undefined') throw new Error('PeerJS library did not load');
  return new Peer(id, CONFIG);
}
function goOnline() {
  const id=cleanId($('#ownerId').value);
  const name=safeName($('#ownerName').value) || id;
  if(!id || id.startsWith('guest-')) return notify('Enter a valid personal ID','error');
  if(state.peer) state.peer.destroy();
  state.id=id; state.displayName=name;
  localStorage.setItem('solods_owner_id',id);
  localStorage.setItem('solods_owner_name',name);
  setStatus('Connecting…');
  try { state.peer=createPeer(id); } catch(e) { return notify(e.message,'error'); }
  attachPeerHandlers();
  state.peer.on('open', () => {
    state.online=true;
    setStatus('Online','online');
    show('#goOnline',false); show('#goOffline',true);
    text('#ownerOnlineLabel','Your personal link is active');
    setPersonalLink(id);
    updateAvailability();
    notify('You are online as '+id,'success');
  });
}
function goOffline() {
  endCall(false);
  for(const entry of state.pending.values()) try { entry.conn.close(); } catch {}
  state.pending.clear();
  state.peer?.destroy();
  state.peer=null; state.online=false;
  setStatus('Offline','offline');
  show('#goOnline',true); show('#goOffline',false);
  text('#ownerOnlineLabel','Go online to receive calls');
  renderQueue();
  notify('You are offline');
}
function connectVisitor() {
  state.id=randomId();
  state.displayName='Visitor';
  setStatus('Connecting…');
  try { state.peer=createPeer(state.id); } catch(e) { return notify(e.message,'error'); }
  attachPeerHandlers();
  state.peer.on('open', () => {
    state.online=true;
    setStatus('Ready','online');
    connectData(state.target);
  });
}
function attachPeerHandlers() {
  const peer=state.peer;
  peer.on('connection', conn => {
    if(state.visitor) { conn.close(); return; }
    attachOwnerData(conn);
  });
  peer.on('call', call => {
    if(state.visitor) {
      call.close();
      return;
    }
    // Calls are accepted only following an explicit visitor request.
    if(state.incoming?.peerId !== call.peer && state.activeGuest !== call.peer) { call.close(); return; }
    if(state.activeGuest && state.activeGuest !== call.peer) { call.close(); return; }
    state.media=call;
    if(state.localStream) {
      call.answer(state.localStream);
      attachMedia(call);
    } else {
      call.close();
    }
  });
  peer.on('error', err => {
    const code=err.type || '';
    if(code==='unavailable-id') {
      notify('That personal ID is already online.','error');
      if(!state.visitor) setStatus('ID unavailable','offline');
    } else if(code==='peer-unavailable') {
      if(state.visitor) {
        text('#visitorAvailability','Currently offline');
        notify('This person is not online. You can try again later.','error');
      } else notify('Peer is unavailable','error');
    } else notify('Connection issue: '+(err.message || code),'error');
  });
  peer.on('disconnected', () => setStatus('Reconnecting…'));
  peer.on('close', () => { state.online=false; setStatus('Offline','offline'); });
}
function connectData(target) {
  const conn=state.peer.connect(target,{reliable:true,metadata:{name:safeName($('#visitorName')?.value)||'Visitor'}});
  state.data=conn;
  conn.on('open', () => {
    text('#visitorAvailability','Available to connect');
    show('#visitorOffline',false);
    sendVisitor({type:'hello',name:getVisitorName()});
  });
  conn.on('data', handleVisitorData);
  conn.on('close', () => {
    if(state.data===conn) {
      text('#visitorAvailability','Connection closed');
      show('#visitorOffline',true);
      if(!state.media) notify('The customer is no longer connected','error');
    }
  });
  conn.on('error', () => notify('Could not connect to this personal link','error'));
}
function getVisitorName() {
  const name=safeName($('#visitorName')?.value)||'Visitor';
  sessionStorage.setItem('solods_guest_name',name);
  return name;
}
function sendVisitor(packet) {
  if(!state.data?.open) { notify('Not connected to the customer','error'); return false; }
  try { state.data.send(packet); return true; } catch { notify('Message could not be sent','error'); return false; }
}
function attachOwnerData(conn) {
  const id=conn.peer;
  state.pending.set(id,{conn,name:safeName(conn.metadata?.name)||'Visitor',time:Date.now(),status:'connected'});
  conn.on('open', () => {
    sendTo(conn,{type:'availability',status:state.activeGuest?'busy':state.busy?'busy':'available',name:state.displayName});
  });
  conn.on('data', packet => handleOwnerData(conn,packet));
  conn.on('close', () => {
    state.pending.delete(id);
    state.queue=state.queue.filter(item=>item.peerId!==id);
    if(state.incoming?.peerId===id) { state.incoming=null; show('#incomingPanel',false); }
    renderQueue();
  });
  conn.on('error', () => {
    state.pending.delete(id);
    renderQueue();
  });
}
function sendTo(conn,packet) { try { if(conn?.open) conn.send(packet); } catch {} }
function sendToActive(packet) {
  const entry=state.pending.get(state.activeGuest);
  if(entry) sendTo(entry.conn,packet);
  else if(state.visitor) sendVisitor(packet);
}
function handleOwnerData(conn,packet) {
  if(!packet || typeof packet!=='object') return;
  const entry=state.pending.get(conn.peer);
  if(!entry) return;
  const name=safeName(packet.name)||entry.name;
  entry.name=name;
  if(packet.type==='hello') {
    sendTo(conn,{type:'availability',status:state.activeGuest||state.busy?'busy':'available',name:state.displayName});
  } else if(packet.type==='request-call') {
    const wantsVideo=!!packet.video;
    const request={peerId:conn.peer,name,video:wantsVideo,time:Date.now()};
    if(state.activeGuest || state.incoming || state.busy || $('#availabilitySelect')?.value==='away') {
      if(!state.queue.some(q=>q.peerId===conn.peer)) state.queue.push(request);
      sendTo(conn,{type:'queued',position:state.queue.findIndex(q=>q.peerId===conn.peer)+1});
      notify('New waiting caller: '+name);
      renderQueue();
    } else {
      state.incoming=request;
      showIncoming();
    }
  } else if(packet.type==='visitor-message') {
    const message=String(packet.text||'').slice(0,1000).trim();
    if(!message) return;
    state.messages.unshift({name,text:message,time:Date.now(),peerId:conn.peer});
    renderInbox();
    sendTo(conn,{type:'message-received'});
    notify('New message from '+name,'success');
  } else if(packet.type==='cancel') {
    state.queue=state.queue.filter(q=>q.peerId!==conn.peer);
    if(state.incoming?.peerId===conn.peer) { state.incoming=null; show('#incomingPanel',false); }
    renderQueue();
  } else if(packet.type==='chat') {
    if(state.activeGuest===conn.peer) addChat(name,String(packet.text||'').slice(0,2000),'remote');
  } else if(packet.type==='file-meta' || packet.type==='file-chunk' || packet.type==='file-end') {
    if(state.activeGuest===conn.peer) receiveFile(packet);
  } else if(packet.type==='end-call') {
    if(state.activeGuest===conn.peer) endCall(false);
  }
}
function handleVisitorData(packet) {
  if(!packet || typeof packet!=='object') return;
  if(packet.type==='availability') {
    text('#visitorAvailability',packet.status==='busy'?'Currently busy':'Available to connect');
    text('#visitorHeading','Connect with '+(packet.name||state.target));
  } else if(packet.type==='queued') {
    show('#visitorWaiting',true);
    text('#queuePosition','You are in the waiting queue (#'+packet.position+')');
    notify('Your call request is waiting');
  } else if(packet.type==='ringing') {
    show('#visitorWaiting',true);
    text('#queuePosition','Calling… waiting for an answer');
  } else if(packet.type==='accepted') {
    show('#visitorWaiting',false);
    startVisitorMedia(!!packet.video);
  } else if(packet.type==='declined') {
    show('#visitorWaiting',false);
    notify('Call declined. You can send a message instead.','error');
  } else if(packet.type==='message-received') {
    notify('Your message was delivered','success');
    if($('#visitorMessage')) $('#visitorMessage').value='';
  } else if(packet.type==='chat') {
    addChat(packet.name||'Customer',String(packet.text||'').slice(0,2000),'remote');
  } else if(packet.type==='file-meta'||packet.type==='file-chunk'||packet.type==='file-end') {
    receiveFile(packet);
  } else if(packet.type==='end-call') {
    endCall(false);
  }
}
function requestCall(video) {
  if(!state.data?.open) return notify('Customer is offline or unreachable','error');
  state.video=video;
  sendVisitor({type:'request-call',name:getVisitorName(),video});
  show('#visitorWaiting',true);
  text('#queuePosition','Sending call request…');
}
function sendVisitorMessage() {
  const input=$('#visitorMessage');
  const message=String(input?.value||'').trim();
  if(!message) return notify('Write a message first','error');
  if(sendVisitor({type:'visitor-message',name:getVisitorName(),text:message})) notify('Sending message…');
}
function showIncoming() {
  if(!state.incoming) return;
  text('#incomingName',state.incoming.name);
  text('#incomingType',state.incoming.video?'Video call request':'Voice call request');
  show('#incomingPanel',true);
  const entry=state.pending.get(state.incoming.peerId);
  if(entry) sendTo(entry.conn,{type:'ringing'});
  notify('Incoming call from '+state.incoming.name,'success');
}
async function acceptIncoming() {
  const req=state.incoming;
  if(!req) return;
  try {
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:req.video});
    state.localStream=stream;
    state.activeGuest=req.peerId;
    state.currentCallName=req.name;
    state.video=req.video;
    state.incoming=null;
    show('#incomingPanel',false);
    show('#callPanel',true);
    text('#callPartnerName',req.name);
    attachLocalVideo(stream);
    const entry=state.pending.get(req.peerId);
    if(entry) sendTo(entry.conn,{type:'accepted',video:req.video});
    state.connected=true;
    updateAvailability();
    notify('Connecting call…','success');
  } catch(err) {
    notify('Microphone/camera access was not granted: '+err.message,'error');
  }
}
function declineIncoming() {
  if(!state.incoming) return;
  const entry=state.pending.get(state.incoming.peerId);
  if(entry) sendTo(entry.conn,{type:'declined'});
  state.incoming=null;
  show('#incomingPanel',false);
  promoteQueue();
}
function promoteQueue() {
  if(state.activeGuest||state.incoming||state.busy||$('#availabilitySelect')?.value==='away') return;
  while(state.queue.length) {
    const next=state.queue.shift();
    if(state.pending.get(next.peerId)?.conn.open) {
      state.incoming=next;
      showIncoming();
      break;
    }
  }
  renderQueue();
}
async function startVisitorMedia(video) {
  try {
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video});
    state.localStream=stream;
    state.video=video;
    attachLocalVideo(stream);
    show('#visitorCallPanel',true);
    state.media=state.peer.call(state.target,stream);
    attachMedia(state.media);
    state.connected=true;
    notify('Connecting…','success');
  } catch(err) {
    notify('Microphone/camera access was not granted: '+err.message,'error');
    sendVisitor({type:'end-call'});
  }
}
function attachMedia(call) {
  call.on('stream',stream => {
    state.remoteStream=stream;
    const video=state.visitor?$('#visitorRemoteVideo'):$('#remoteVideo');
    if(video) { video.srcObject=stream; video.play().catch(()=>{}); }
    text('#callState','Connected');
    text('#visitorCallState','Connected');
    notify('Call connected','success');
  });
  call.on('close',()=>endCall(false));
  call.on('error',err=>{notify('Media connection failed: '+err.message,'error');endCall(false);});
}
function attachLocalVideo(stream) {
  const video=state.visitor?$('#visitorLocalVideo'):$('#localVideo');
  if(video) {video.srcObject=stream;video.muted=true;video.play().catch(()=>{});}
}
function endCall(sendSignal=true) {
  if(sendSignal) sendToActive({type:'end-call'});
  const old=state.media;
  state.media=null;
  if(old) {try {old.close();} catch{}}
  state.localStream?.getTracks().forEach(t=>t.stop());
  state.screenStream?.getTracks().forEach(t=>t.stop());
  state.localStream=null; state.remoteStream=null; state.screenStream=null;
  state.activeGuest='';state.connected=false;state.video=false;
  show('#callPanel',false);show('#visitorCallPanel',false);
  text('#callState','Connecting…');
  text('#visitorCallState','Connecting…');
  for(const selector of ['#remoteVideo','#localVideo','#visitorRemoteVideo','#visitorLocalVideo']) {
    const el=$(selector);if(el) el.srcObject=null;
  }
  if(!state.visitor) {updateAvailability();promoteQueue();}
}
function toggleMic() {
  const track=state.localStream?.getAudioTracks()[0];
  if(!track) return notify('No active microphone','error');
  track.enabled=!track.enabled;
  state.audio=track.enabled;
  notify(track.enabled?'Microphone on':'Microphone muted');
}
async function toggleCamera() {
  const track=state.localStream?.getVideoTracks()[0];
  if(track) {
    track.enabled=!track.enabled;
    notify(track.enabled?'Camera on':'Camera off');
    return;
  }
  notify('Camera was not started for this call. Start a video call to use it.','error');
}
async function shareScreen() {
  if(!state.media||!state.localStream) return notify('Start a call first','error');
  if(!navigator.mediaDevices.getDisplayMedia) return notify('Screen sharing is unavailable in this browser','error');
  try {
    if(state.screenStream) {
      state.screenStream.getTracks().forEach(t=>t.stop());
      state.screenStream=null;
      const original=state.localStream.getVideoTracks()[0];
      const sender=state.media.peerConnection?.getSenders().find(s=>s.track?.kind==='video');
      if(sender&&original) await sender.replaceTrack(original);
      notify('Screen sharing stopped');
      return;
    }
    const stream=await navigator.mediaDevices.getDisplayMedia({video:true});
    const track=stream.getVideoTracks()[0];
    const sender=state.media.peerConnection?.getSenders().find(s=>s.track?.kind==='video');
    if(!sender) {stream.getTracks().forEach(t=>t.stop());return notify('Screen sharing requires a video call in this version','error');}
    await sender.replaceTrack(track);
    state.screenStream=stream;
    track.onended=()=>{if(state.screenStream)shareScreen();};
    notify('Screen sharing started','success');
  } catch(err) {notify('Screen sharing cancelled or unavailable','error');}
}
function sendChat() {
  const input=state.visitor?$('#visitorChatInput'):$('#chatInput');
  const message=String(input?.value||'').trim();
  if(!message) return;
  if(!state.connected) return notify('Start a call to chat','error');
  const packet={type:'chat',text:message,name:state.visitor?getVisitorName():state.displayName};
  if(state.visitor) sendVisitor(packet);else sendToActive(packet);
  addChat('You',message,'self');
  input.value='';
}
function addChat(name,message,kind='remote') {
  const html='<div class="chat-bubble '+(kind==='self'?'self':'remote')+'"><strong>'+esc(name)+'</strong><p>'+esc(message)+'</p><small>'+fmtTime(Date.now())+'</small></div>';
  const panel=state.visitor?$('#visitorChatMessages'):$('#chatMessages');
  if(panel) {panel.insertAdjacentHTML('beforeend',html);panel.scrollTop=panel.scrollHeight;}
}
function updateAvailability() {
  const availability=$('#availabilitySelect')?.value||'available';
  const status=state.activeGuest||state.busy||availability==='away'?'busy':'available';
  text('#availabilityLabel',state.activeGuest?'On a call':state.busy?'Do not disturb':availability==='away'?'Away':'Available');
  for(const entry of state.pending.values()) sendTo(entry.conn,{type:'availability',status,name:state.displayName});
  if(status==='available') promoteQueue();
}
function renderQueue() {
  text('#waitingCount',state.queue.length);
  const el=$('#waitingList');if(!el)return;
  if(!state.queue.length) {el.innerHTML='<div class="empty-state">No waiting callers right now.</div>';return;}
  el.innerHTML=state.queue.map(q=>'<div class="queue-item"><span class="avatar">'+esc(q.name.slice(0,1).toUpperCase())+'</span><div><strong>'+esc(q.name)+'</strong><small>'+(q.video?'Video':'Voice')+' · '+fmtTime(q.time)+'</small></div><span class="pill">Waiting</span></div>').join('');
}
function renderInbox() {
  text('#inboxCount',state.messages.length);
  const el=$('#inboxList');if(!el)return;
  if(!state.messages.length) {el.innerHTML='<div class="empty-state">No messages yet. Messages appear while you are online.</div>';return;}
  el.innerHTML=state.messages.map(m=>'<div class="inbox-item"><div class="inbox-head"><strong>'+esc(m.name)+'</strong><small>'+fmtTime(m.time)+'</small></div><p>'+esc(m.text)+'</p></div>').join('');
}
const CHUNK_SIZE=12*1024;
async function sendFile(file) {
  if(!state.connected) return notify('Start a call to transfer files','error');
  const conn=state.visitor?state.data:state.pending.get(state.activeGuest)?.conn;
  if(!conn?.open) return notify('Data connection is not available','error');
  if(file.size>50*1024*1024) return notify('This prototype supports files up to 50 MB','error');
  const id=crypto.randomUUID();
  sendTo(conn,{type:'file-meta',id,name:file.name,size:file.size,mime:file.type||'application/octet-stream'});
  try {
    const buffer=await file.arrayBuffer();
    for(let offset=0;offset<buffer.byteLength;offset+=CHUNK_SIZE) {
      while(conn.dataChannel?.bufferedAmount>256*1024) await new Promise(r=>setTimeout(r,30));
      if(!conn.open) throw new Error('Connection closed');
      const bytes=buffer.slice(offset,offset+CHUNK_SIZE);
      sendTo(conn,{type:'file-chunk',id,bytes});
      if(offset%(CHUNK_SIZE*40)===0) await new Promise(r=>setTimeout(r,0));
    }
    sendTo(conn,{type:'file-end',id});
    notify('File sent: '+file.name,'success');
    addTransfer(file.name,file.size,'Sent');
  } catch(err) {notify('File transfer interrupted: '+err.message,'error');}
}
function receiveFile(packet) {
  const id=String(packet.id||'');
  if(!id) return;
  if(packet.type==='file-meta') {
    const size=Number(packet.size);
    if(!Number.isFinite(size)||size<0||size>50*1024*1024) return;
    state.fileRx.set(id,{name:String(packet.name||'download').slice(0,120),mime:String(packet.mime||'application/octet-stream'),size,chunks:[],received:0});
  } else if(packet.type==='file-chunk') {
    const rx=state.fileRx.get(id);
    if(!rx) return;
    const bytes=packet.bytes;
    if(!(bytes instanceof ArrayBuffer)||rx.received+bytes.byteLength>rx.size) {state.fileRx.delete(id);return;}
    rx.chunks.push(bytes);rx.received+=bytes.byteLength;
  } else if(packet.type==='file-end') {
    const rx=state.fileRx.get(id);
    if(!rx) return;
    state.fileRx.delete(id);
    if(rx.received!==rx.size) return notify('Incomplete file received','error');
    const blob=new Blob(rx.chunks,{type:rx.mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=rx.name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    notify('File received: '+rx.name,'success');
    addTransfer(rx.name,rx.size,'Received');
  }
}
function addTransfer(name,size,status) {
  const el=state.visitor?$('#visitorTransfers'):$('#transferList');
  if(!el)return;
  const line=document.createElement('div');line.className='transfer-item';
  line.innerHTML='<span>📄 '+esc(name)+'</span><small>'+status+' · '+(size/1024/1024).toFixed(2)+' MB</small>';
  el.prepend(line);
}
document.addEventListener('DOMContentLoaded',init);
