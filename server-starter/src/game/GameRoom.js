const Player = require('./Player');
const PickupManager = require('./PickupManager');
const { TICK_RATE, SCORE_PER_PICKUP, ORBIT_SPEED } = require('../../shared/constants');

class GameRoom {
  constructor(io) {
    this.io = io;
    this.players = new Map(); // socketId -> Player
    this.pickups = new PickupManager();
    this.tickIntervalMs = 1000 / TICK_RATE;
    this.orbitClock = 0;
  }

  addPlayer(socketId, name) {
    const player = new Player(socketId, name);
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  handleInput(socketId, x, y) {
    const player = this.players.get(socketId);
    if (!player) return;
    // Validate kiểu dữ liệu — không tin tưởng mù quáng dữ liệu từ client
    if (typeof x !== 'number' || typeof y !== 'number') return;
    player.setInput(x, y);
  }

  // Va chạm kiểu duyệt toàn bộ — đủ dùng cho vài chục người chơi + vài chục pickup.
  // Khi scale lên nhiều entity hơn, thay bằng spatial hashing (chia map thành ô lưới).
  checkCollisions() {
    for (const player of this.players.values()) {
      for (const pickup of this.pickups.list()) {
        const dx = pickup.x - player.x;
        const dy = pickup.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pickup.radius + player.radius) {
          this.pickups.remove(pickup.id);
          player.score += SCORE_PER_PICKUP;
          player.addOrbit();
        }
      }
    }
    this.pickups.fill();
  }

  tick() {
    this.orbitClock += ORBIT_SPEED;

    for (const player of this.players.values()) {
      player.update();
    }
    this.checkCollisions();

    this.broadcastState();
  }

  broadcastState() {
    const state = {
      players: Array.from(this.players.values()).map(p => p.toJSON()),
      pickups: this.pickups.list(),
      orbitClock: this.orbitClock,
    };
    this.io.emit('state', state);
  }

  start() {
    this.interval = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  stop() {
    clearInterval(this.interval);
  }
}

module.exports = GameRoom;
