const socket = io();
let localStream;
let peer;
let recognition;

async function joinRoom() {
  const roomId = document.getElementById("roomId").value;
  socket.emit("join-room", roomId);

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  document.getElementById("localVideo").srcObject = localStream;

  createPeer();

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

  startSpeechRecognition();
}

function createPeer() {
  peer = new RTCPeerConnection();

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
