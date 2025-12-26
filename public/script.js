const socket = io();
let localStream;
let peers = {};
let recognition;

async function joinRoom() {
  const roomId = roomIdInput.value;
  if (!roomId) return alert("Enter Room Code");

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  addVideo(socket.id, localStream);

  socket.emit("join-room", roomId);

  socket.on("all-users", users => {
    users.forEach(createPeer);
  });

  socket.on("signal", async ({ from, data }) => {
    if (!peers[from]) createPeer(from, true);

    if (data.sdp) {
      await peers[from].setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (data.sdp.type === "offer") {
        const answer = await peers[from].createAnswer();
        await peers[from].setLocalDescription(answer);
        socket.emit("signal", { to: from, data: { sdp: peers[from].localDescription }});
      }
    } else if (data.candidate) {
      await peers[from].addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });

  socket.on("user-left", id => {
    if (peers[id]) peers[id].close();
    document.getElementById(id)?.remove();
    delete peers[id];
  });

  startSpeechRecognition();
}

function createPeer(id, incoming = false) {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => addVideo(id, e.streams[0]);

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { to: id, data: { candidate: e.candidate }});
    }
  };

  peers[id] = pc;

  if (!incoming) {
    pc.createOffer().then(o => {
      pc.setLocalDescription(o);
      socket.emit("signal", { to: id, data: { sdp: o }});
    });
  }
}

function addVideo(id, stream) {
  if (document.getElementById(id)) return;

  const box = document.createElement("div");
  box.className = "video-box";
  box.id = id;

  const video = document.createElement("video");
  video.autoplay = true;
  video.srcObject = stream;

  const sub = document.createElement("div");
  sub.className = "subtitle";
  sub.innerText = "";

  box.append(video, sub);
  videos.appendChild(box);
}

/* SUBTITLES + BETTER ACCURACY */
function startSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = true;
  recognition.lang = lang.value;

  recognition.onresult = e => {
    const text = e.results[e.results.length - 1][0].transcript;

    document.querySelector(`#${socket.id} .subtitle`).innerText = text;

    socket.emit("translated-text", {
      text,
      lang: recognition.lang
    });
  };

  recognition.start();
}

socket.on("translated-text", async data => {
  const myLang = lang.value.split("-")[0];
  const fromLang = data.lang.split("-")[0];
  if (myLang === fromLang) return;

  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(data.text)}&langpair=${fromLang}|${myLang}`
  );
  const json = await res.json();

  speechSynthesis.speak(new SpeechSynthesisUtterance(json.responseData.translatedText));
});

/* CONTROLS */
function toggleMic() {
  localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
}

function toggleCamera() {
  localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
}

function endCall() {
  Object.values(peers).forEach(p => p.close());
  localStream.getTracks().forEach(t => t.stop());
  location.reload();
}
