const Player = require('./Player');
const Bot = require('./Bot');
const PickupManager = require('./PickupManager');
const {
  TICK_RATE,
  SCORE_PER_PICKUP,
  ORBIT_SPEED,
  ORBIT_RADIUS_BASE,
  ORBIT_RADIUS_STEP,
  ORBIT_ITEM_RADIUS,
  MAP_WIDTH,
  MAP_HEIGHT,
} = require('../../../shared/constants');

class Room {
  constructor(io) {
    this.io = io;
    this.players = new Map();
    this.pickups = new PickupManager();
    this.orbitClock = 0;
    this.lastHit = null;
    this.tickIntervalMs = 1000 / TICK_RATE;
    
    // Spawn initial bots
    this.spawnBots();
  }

  addPlayer(socketId, name) {
    // Determine the skinId with the least usage to avoid duplicates
    const skinCounts = [0, 0, 0, 0];
    for (const p of this.players.values()) {
      if (p.skinId >= 0 && p.skinId < 4) {
        skinCounts[p.skinId]++;
      }
    }
    const minCount = Math.min(...skinCounts);
    const candidates = [];
    for (let i = 0; i < 4; i++) {
      if (skinCounts[i] === minCount) {
        candidates.push(i);
      }
    }
    const chosenSkinId = candidates[Math.floor(Math.random() * candidates.length)];

    const player = new Player(socketId, name, chosenSkinId);
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  spawnBots() {
    const activeBots = Array.from(this.players.values()).filter(p => p.isBot);
    const botsNeeded = 5 - activeBots.length;
    if (botsNeeded <= 0) return;

    const botNames = [
      'AlphaBot', 'BetaBot', 'DeltaBot', 'ShadowSpinner', 'NeonBlade', 
      'OrbitKing', 'ZeroGravity', 'StarChaser', 'SonicBlade', 'CyberSpinner'
    ];

    for (let i = 0; i < botsNeeded; i++) {
      const botId = `bot_${Math.random().toString(36).substr(2, 9)}`;
      const name = `[BOT] ${botNames[Math.floor(Math.random() * botNames.length)]}`;
      
      const skinCounts = [0, 0, 0, 0];
      for (const p of this.players.values()) {
        if (p.skinId >= 0 && p.skinId < 4) {
          skinCounts[p.skinId]++;
        }
      }
      const minCount = Math.min(...skinCounts);
      const candidates = [];
      for (let s = 0; s < 4; s++) {
        if (skinCounts[s] === minCount) {
          candidates.push(s);
        }
      }
      const chosenSkinId = candidates[Math.floor(Math.random() * candidates.length)];
      
      const bot = new Bot(botId, name, chosenSkinId);
      bot.addOrbit();
      this.players.set(botId, bot);
    }
  }

  handleInput(socketId, x, y, boost) {
    const player = this.players.get(socketId);
    if (!player) return;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    player.setInput(x, y);
    player.setBoost(!!boost);
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
          player.addOrbit(pickup.type || 'normal');
        }
      }
    }
    this.pickups.fill();
  }

  checkOrbitCollisions() {
    const orbits = [];

    for (const player of this.players.values()) {
      const total = player.orbits.length;
      player.orbits.forEach((orbit, index) => {
        const angleOffset = (index / total) * Math.PI * 2;
        const angle = angleOffset + this.orbitClock;
        const radius = ORBIT_RADIUS_BASE + orbit.ring * ORBIT_RADIUS_STEP;
        orbits.push({
          player,
          orbit,
          x: player.x + Math.cos(angle) * radius,
          y: player.y + Math.sin(angle) * radius,
          radius: ORBIT_ITEM_RADIUS,
        });
      });
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
          a.orbit.hp -= 1;
          b.orbit.hp -= 1;

          if (a.orbit.hp <= 0) {
            a.player.removeOrbit(a.orbit);
          }
          if (b.orbit.hp <= 0) {
            b.player.removeOrbit(b.orbit);
          }
        }
      }
    }
  }

  checkPlayerHits() {
    const orbits = [];

    for (const player of this.players.values()) {
      const total = player.orbits.length;
      player.orbits.forEach((orbit, index) => {
        const angleOffset = (index / total) * Math.PI * 2;
        const angle = angleOffset + this.orbitClock;
        const radius = ORBIT_RADIUS_BASE + orbit.ring * ORBIT_RADIUS_STEP;
        orbits.push({
          player,
          orbit,
          x: player.x + Math.cos(angle) * radius,
          y: player.y + Math.sin(angle) * radius,
          radius: ORBIT_ITEM_RADIUS,
        });
      });
    }

    for (const orbit of orbits) {
      for (const target of this.players.values()) {
        if (target.id === orbit.player.id) continue;
        if (!orbit.player.orbits.includes(orbit.orbit)) continue;

        const dx = orbit.x - target.x;
        const dy = orbit.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (target.protectionTicks > 0) {
          continue;
        }
        if (dist < orbit.radius + target.radius) {
          orbit.player.removeOrbit(orbit.orbit);
          orbit.player.kills += 1;
          
          this.io.to(target.id).emit('gameOver', {
            score: target.score,
            kills: target.kills,
            killedBy: orbit.player.name,
            x: target.x,
            y: target.y,
            skinId: target.skinId
          });

          // Drop target's orbits as pickups on the ground around target
          target.orbits.forEach((orb) => {
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 50;
            const px = Math.min(Math.max(target.x + Math.cos(angle) * dist, 0), MAP_WIDTH);
            const py = Math.min(Math.max(target.y + Math.sin(angle) * dist, 0), MAP_HEIGHT);
            this.pickups.spawnAt(px, py);
          });

          this.lastHit = {
            targetId: target.id,
            attackerId: orbit.player.id,
            attackerName: orbit.player.name,
          };

          this.removePlayer(target.id);
          return;
        }
      }
    }
  }

  tick() {
    this.orbitClock += ORBIT_SPEED;
    for (const player of this.players.values()) {
      if (player.isBot) {
        player.updateAI(this);
      }
      player.update();
    }
    this.checkCollisions();
    this.checkOrbitCollisions();
    this.checkPlayerHits();
    this.spawnBots();
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
