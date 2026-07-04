const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const GameRoom = require('./game/GameRoom');

const PORT = process.env.PORT || 7860; // 7860 để tương thích nếu deploy lên HF Spaces

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // Thu hẹp lại thành domain thật của bạn khi deploy production
});

app.get('/', (req, res) => {
  res.send('Orbit IO server đang chạy 🎮');
});

const room = new GameRoom(io);

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
