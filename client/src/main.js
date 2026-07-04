import { startGame, setGameStarted } from './game.js';
import { initSocket } from './network/socket.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resize();
window.addEventListener('resize', resize);

const statusEl = document.getElementById('status');
const startButton = document.getElementById('startButton');
const startOverlay = document.getElementById('startOverlay');
const socketApi = initSocket((text) => {
  statusEl.textContent = text;
});

startButton.addEventListener('click', () => {
  if (!socketApi.isConnected()) {
    statusEl.textContent = 'Đang kết nối tới server...';
    return;
  }

  socketApi.joinGame(`Người chơi ${Math.floor(Math.random() * 1000)}`);
  if (startOverlay) startOverlay.style.display = 'none';
  startButton.disabled = true;
  startButton.textContent = 'Đang chơi';
  setGameStarted(true);
});

startGame({ canvas, ctx, socketApi });
