const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

io.on("connection", socket => {

  socket.on("join-room", roomId => {
    socket.join(roomId);

    // Send existing users to new user
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    socket.emit("existing-users", clients.filter(id => id !== socket.id));

    // Tell others a new user joined
    socket.to(roomId).emit("user-joined", socket.id);

    socket.on("signal", ({ target, data }) => {
      io.to(target).emit("signal", {
        sender: socket.id,
        data
      });
    });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-left", socket.id);
    });
  });

});

http.listen(3000, () => {
  console.log("Server running on port 3000");
});
