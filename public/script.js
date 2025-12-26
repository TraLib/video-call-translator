const socket = io();
const peers = {};
let localStream;

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

async function joinRoom() {
  const roomId = document.getElementById("roomId").value;
  socket.emit("join-room", roomId);

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  addVideo("me", localStream);

  socket.on("existing-users", users => {
    users.forEach(id => createPeer(id, true));
  });

  socket.on("user-joined", id => {
    createPeer(id, false);
  });

  socket.on("signal", handleSignal);
}

function createPeer(id, initiator) {
  const pc = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach(track =>
    pc.addTrack(track, localStream)
  );

  pc.ontrack = e => addVideo(id, e.streams[0]);

  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", {
        target: id,
        data: { candidate: e.candidate }
      });
    }
  };

  if (initiator) {
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit("signal", {
        target: id,
        data: { sdp: offer }
      });
    });
  }

  peers[id] = pc;
}

function handleSignal({ sender, data }) {
  let pc = peers[sender];
  if (!pc) pc = createPeer(sender, false);

  if (data.sdp) {
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    if (data.sdp.type === "offer") {
      pc.createAnswer().then(answer => {
        pc.setLocalDescription(answer);
        socket.emit("signal", {
          target: sender,
          data: { sdp: answer }
        });
      });
    }
  }

  if (data.candidate) {
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
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
