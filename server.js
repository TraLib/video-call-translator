const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

io.on("connection", socket => {
  socket.on("join-room", roomId => {
    const clients = io.sockets.adapter.rooms.get(roomId);
    const numClients = clients ? clients.size : 0;

    socket.join(roomId);

    if (numClients === 0) {
      socket.emit("created");
    } else {
      socket.emit("joined");
      socket.to(roomId).emit("ready");
    }

    socket.on("signal", data => {
      socket.to(roomId).emit("signal", data);
    });

    socket.on("translated-text", data => {
      socket.to(roomId).emit("translated-text", data);
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
