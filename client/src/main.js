import { startGame, setGameStarted, triggerDeathEffect } from './game.js';
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
const playerNameInput = document.getElementById('playerNameInput');
const gameStats = document.getElementById('gameStats');
const killedByEl = document.getElementById('killedBy');
const finalScoreEl = document.getElementById('finalScore');
const finalKillsEl = document.getElementById('finalKills');

const socketApi = initSocket((text) => {
  statusEl.textContent = text;
});

startButton.addEventListener('click', () => {
  if (!socketApi.isConnected()) {
    statusEl.textContent = 'Đang kết nối tới server...';
    return;
  }

  let name = playerNameInput.value.trim();
  if (!name) {
    name = `Người chơi ${Math.floor(Math.random() * 1000)}`;
  }

  socketApi.joinGame(name);
  if (startOverlay) startOverlay.style.display = 'none';
  startButton.disabled = true;
  startButton.textContent = 'Đang chơi';
  setGameStarted(true);
});

socketApi.onGameOver((data) => {
  // 1. Play screen flash and particle explosion immediately
  triggerDeathEffect(data.x, data.y, data.skinId);
  
  // 2. Wait 1.5s for explosion animation to play before showing stats overlay
  setTimeout(() => {
    setGameStarted(false);
    
    // Display stats
    killedByEl.textContent = data.killedBy || 'Kẻ vô danh';
    finalScoreEl.textContent = data.score || 0;
    finalKillsEl.textContent = data.kills || 0;
    
    // Show stats UI
    gameStats.style.display = 'block';
    if (startOverlay) startOverlay.style.display = 'flex';
    
    // Reset start button
    startButton.disabled = false;
    startButton.textContent = 'Chơi lại';
  }, 1500);
});

startGame({ canvas, ctx, socketApi });
