const Player = require('./Player');
const PickupManager = require('./PickupManager');
const {
  TICK_RATE,
  SCORE_PER_PICKUP,
  ORBIT_SPEED,
  ORBIT_RADIUS_BASE,
  ORBIT_RADIUS_STEP,
  ORBIT_ITEM_RADIUS,
} = require('../../../shared/constants');

class Room {
  constructor(io) {
    this.io = io;
    this.players = new Map();
    this.pickups = new PickupManager();
    this.orbitClock = 0;
    this.lastHit = null;
    this.tickIntervalMs = 1000 / TICK_RATE;
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
    if (typeof x !== 'number' || typeof y !== 'number') return;
    player.setInput(x, y);
  }

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

  checkOrbitCollisions() {
    const orbits = [];

    for (const player of this.players.values()) {
      for (const orbit of player.orbits) {
        const angle = orbit.angle + this.orbitClock * (orbit.ring === 0 ? 1 : -1);
        const radius = ORBIT_RADIUS_BASE + orbit.ring * ORBIT_RADIUS_STEP;
        orbits.push({
          player,
          orbit,
          x: player.x + Math.cos(angle) * radius,
          y: player.y + Math.sin(angle) * radius,
          radius: ORBIT_ITEM_RADIUS,
        });
      }
    }

    for (let i = 0; i < orbits.length; i++) {
      for (let j = i + 1; j < orbits.length; j++) {
        const a = orbits[i];
        const b = orbits[j];
        if (a.player.id === b.player.id) continue;

        if (!a.player.orbits.includes(a.orbit) || !b.player.orbits.includes(b.orbit)) {
          continue;
        }

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < a.radius + b.radius) {
          const loser = a.player.id < b.player.id ? b : a;
          loser.player.removeOrbit(loser.orbit);
        }
      }
    }
  }

  checkPlayerHits() {
    const orbits = [];

    for (const player of this.players.values()) {
      for (const orbit of player.orbits) {
        const angle = orbit.angle + this.orbitClock * (orbit.ring === 0 ? 1 : -1);
        const radius = ORBIT_RADIUS_BASE + orbit.ring * ORBIT_RADIUS_STEP;
        orbits.push({
          player,
          orbit,
          x: player.x + Math.cos(angle) * radius,
          y: player.y + Math.sin(angle) * radius,
          radius: ORBIT_ITEM_RADIUS,
        });
      }
    }

    for (const orbit of orbits) {
      for (const target of this.players.values()) {
        if (target.id === orbit.player.id) continue;
        if (!orbit.player.orbits.includes(orbit.orbit)) continue;

        const dx = orbit.x - target.x;
        const dy = orbit.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < orbit.radius + target.radius) {
          orbit.player.removeOrbit(orbit.orbit);
          this.lastHit = {
            targetId: target.id,
            attackerId: orbit.player.id,
            attackerName: orbit.player.name,
          };
          return;
        }
      }
    }
  }

  tick() {
    this.orbitClock += ORBIT_SPEED;
    for (const player of this.players.values()) {
      player.update();
    }
    this.checkCollisions();
    this.checkOrbitCollisions();
    this.checkPlayerHits();
    this.broadcastState();
  }

  broadcastState() {
    const state = {
      players: Array.from(this.players.values()).map(p => p.toJSON()),
      pickups: this.pickups.list(),
      orbitClock: this.orbitClock,
      lastHit: this.lastHit,
    };
    this.io.emit('state', state);
    this.lastHit = null;
  }

  start() {
    this.interval = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  stop() {
    clearInterval(this.interval);
  }
}

module.exports = Room;
