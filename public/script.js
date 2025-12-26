const socket = io();
let localStream;
let peer;
let recognition;

/* ======================
   JOIN ROOM + VIDEO CALL
====================== */
async function joinRoom() {
  const roomId = document.getElementById("roomId").value;
  if (!roomId) {
    alert("Enter Room ID");
    return;
  }

  socket.emit("join-room", roomId);

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  document.getElementById("localVideo").srcObject = localStream;

  createPeer();
  setupSocketSignals();
  startSpeechRecognition();
}

/* ======================
   WEBRTC PEER
====================== */
function createPeer() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(track =>
    peer.addTrack(track, localStream)
  );

  peer.ontrack = e => {
    document.getElementById("remoteVideo").srcObject = e.streams[0];
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { candidate: e.candidate });
    }
  };

  peer.createOffer().then(offer => {
    peer.setLocalDescription(offer);
    socket.emit("signal", { sdp: offer });
  });
}

/* ======================
   SOCKET SIGNALS
====================== */
function setupSocketSignals() {
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
}

/* ======================
   SPEECH → SEND TEXT
====================== */
function startSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.lang = document.getElementById("lang").value;

  recognition.onresult = e => {
    const text = e.results[e.results.length - 1][0].transcript;

    // 🔥 THIS WAS MISSING
    socket.emit("translated-text", {
      text: text,
      lang: recognition.lang
    });
  };

  recognition.start();
}

/* ======================
   RECEIVE → TRANSLATE → SPEAK
====================== */
socket.on("translated-text", async data => {
  const myLang = document.getElementById("lang").value.split("-")[0];
  const fromLang = data.lang.split("-")[0];

  // Prevent echo
  if (fromLang === myLang) return;

  const res = await fetch("https://libretranslate.de/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: data.text,
      source: fromLang,
      target: myLang,
      format: "text"
    })
  });

  const result = await res.json();
  speak(result.translatedText, myLang);
});

/* ======================
   TEXT → SPEECH
====================== */
function speak(text, lang) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = lang;
  speechSynthesis.speak(msg);
}
