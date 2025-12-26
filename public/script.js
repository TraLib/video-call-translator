const socket = io();
const peers = {};
let localStream;
let recognition;

async function joinRoom() {
  const roomId = document.getElementById("roomId").value;
  socket.emit("join-room", roomId);

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  addVideo("me", localStream);
  startSpeech();

  socket.on("user-joined", id => createPeer(id, true));
  socket.on("signal", handleSignal);
}

function createPeer(id, initiator) {
  const pc = new RTCPeerConnection();

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => addVideo(id, e.streams[0]);

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", {
        target: id,
        candidate: e.candidate
      });
    }
  };

  if (initiator) {
    pc.createOffer().then(o => {
      pc.setLocalDescription(o);
      socket.emit("signal", { target: id, sdp: o });
    });
  }

  peers[id] = pc;
}

function handleSignal({ sender, signal }) {
  if (!peers[sender]) createPeer(sender, false);
  const pc = peers[sender];

  if (signal.sdp) {
    pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    if (signal.sdp.type === "offer") {
      pc.createAnswer().then(a => {
        pc.setLocalDescription(a);
        socket.emit("signal", { target: sender, sdp: a });
      });
    }
  }

  if (signal.candidate) {
    pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
  }
}

function addVideo(id, stream) {
  if (document.getElementById(id)) return;

  const box = document.createElement("div");
  box.className = "video-box";
  box.id = id;

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;

  const subtitle = document.createElement("div");
  subtitle.className = "subtitle";

  box.appendChild(video);
  box.appendChild(subtitle);
  document.getElementById("video-grid").appendChild(box);
}

function startSpeech() {
  recognition = new webkitSpeechRecognition();
  recognition.lang = document.getElementById("language").value;
  recognition.continuous = true;

  recognition.onresult = e => {
    const text = e.results[e.results.length - 1][0].transcript;
    socket.emit("translated-text", text);
    showSubtitle("me", text);
  };

  recognition.start();

  socket.on("translated-text", text => {
    showSubtitle("remote", text);
  });
}

function showSubtitle(id, text) {
  const box = document.getElementById(id);
  if (box) box.querySelector(".subtitle").innerText = text;
}

// Controls
function toggleMic() {
  localStream.getAudioTracks()[0].enabled ^= true;
}

function toggleCam() {
  localStream.getVideoTracks()[0].enabled ^= true;
}

function endCall() {
  location.reload();
}
