const socket = io();
let localStream;
let peer;
let recognition;
let isCaller = false;

/* JOIN ROOM */
async function joinRoom() {
  const roomId = document.getElementById("roomId").value;
  if (!roomId) return alert("Enter room code");

  socket.emit("join-room", roomId);

  socket.on("created", () => isCaller = true);
  socket.on("joined", () => isCaller = false);
  socket.on("ready", () => {
    if (isCaller) createOffer();
  });

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  document.getElementById("localVideo").srcObject = localStream;

  createPeer();
  startSpeechRecognition();
}

/* WEBRTC */
function createPeer() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.ontrack = e => {
    document.getElementById("remoteVideo").srcObject = e.streams[0];
  };

  peer.onicecandidate = e => {
    if (e.candidate) socket.emit("signal", { candidate: e.candidate });
  };
}

async function createOffer() {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("signal", { sdp: offer });
}

socket.on("signal", async data => {
  if (data.sdp) {
    await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (data.sdp.type === "offer") {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("signal", { sdp: peer.localDescription });
    }
  } else if (data.candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

/* SPEECH RECOGNITION */
function startSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.lang = document.getElementById("lang").value;

  recognition.onresult = e => {
    const text = e.results[e.results.length - 1][0].transcript;
    socket.emit("translated-text", {
      text,
      lang: recognition.lang
    });
  };

  recognition.start();
}

/* TRANSLATE + SPEAK */
socket.on("translated-text", async data => {
  const myLang = document.getElementById("lang").value.split("-")[0];
  const fromLang = data.lang.split("-")[0];
  if (myLang === fromLang) return;

  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(data.text)}&langpair=${fromLang}|${myLang}`
  );
  const json = await res.json();
  speak(json.responseData.translatedText, myLang);
});

function speak(text, lang) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = lang;
  speechSynthesis.speak(msg);
}

/* CONTROLS */
function toggleMic() {
  localStream.getAudioTracks()[0].enabled =
    !localStream.getAudioTracks()[0].enabled;
}

function toggleCamera() {
  localStream.getVideoTracks()[0].enabled =
    !localStream.getVideoTracks()[0].enabled;
}

function endCall() {
  peer.close();
  localStream.getTracks().forEach(t => t.stop());
  location.reload();
}
