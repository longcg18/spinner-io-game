const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const Room = require('./game/Room');
const { PORT } = require('../config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Serve client build
app.use(express.static(path.join(__dirname, '../../public')));

const room = new Room(io);

io.on('connection', (socket) => {
  console.log('Người chơi kết nối:', socket.id);

  socket.on('join', (name) => {
    const player = room.addPlayer(socket.id, name);
    socket.emit('joined', { id: player.id });
  });

  socket.on('input', ({ x, y }) => {
    room.handleInput(socket.id, x, y);
  });

  socket.on('disconnect', () => {
    console.log('Người chơi rời đi:', socket.id);
    room.removePlayer(socket.id);
  });
});

room.start();

server.listen(PORT, () => {
  console.log(`Server đang chạy tại port ${PORT}`);
});
