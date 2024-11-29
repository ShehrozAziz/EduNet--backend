const express = require("express");
const http = require("http")
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Handle room joining
    socket.on("join-room", (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        socket.to(roomId).emit("user-connected", socket.id); // Notify others in the room
    });

    // Handle signaling messages
    socket.on("signal", (data) => {
        const { roomId, signalData, targetId } = data;
        socket.to(targetId).emit("signal", { signalData, senderId: socket.id });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        io.emit("user-disconnected", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server running on port 3000");
});
