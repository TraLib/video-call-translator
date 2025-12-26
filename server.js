const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

io.on("connection", socket => {
  socket.on("join-room", roomId => {
    socket.join(roomId);

    socket.on("signal", data => {
      socket.to(roomId).emit("signal", data);
    });

    socket.on("translated-text", text => {
      socket.to(roomId).emit("translated-text", text);
    });
  });
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

