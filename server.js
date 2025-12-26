const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

io.on("connection", socket => {

  socket.on("join-room", roomId => {
    socket.join(roomId);

    socket.to(roomId).emit("user-joined", socket.id);

    socket.on("signal", data => {
      socket.to(roomId).emit("signal", {
        sender: socket.id,
        signal: data
      });
    });

    socket.on("translated-text", data => {
      socket.to(roomId).emit("translated-text", data);
    });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-left", socket.id);
    });
  });

});

http.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
