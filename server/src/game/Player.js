const { MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS, PLAYER_SPEED, ORBIT_RADIUS_BASE, ORBIT_RADIUS_STEP, SPAWN_PROTECTION_TICKS } = require('../../../shared/constants');

class Player {
  constructor(id, name = 'Player', skinId = 0) {
    this.id = id;
    this.name = name;
    this.skinId = skinId;
    this.x = Math.random() * MAP_WIDTH;
    this.y = Math.random() * MAP_HEIGHT;
    this.radius = PLAYER_RADIUS;
    this.score = 0;
    this.kills = 0;
    this.stamina = 100;
    this.isBoosting = false;
    this.input = { x: this.x, y: this.y };
    this.angle = 0;
    this.orbits = [];
    this.protectionTicks = SPAWN_PROTECTION_TICKS;
  }

  setInput(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    this.input = {
      x: Math.min(Math.max(x, 0), MAP_WIDTH),
      y: Math.min(Math.max(y, 0), MAP_HEIGHT),
    };
  }

  setBoost(boost) {
    this.isBoosting = boost;
  }

  update() {
    // 1. Calculate speed based on boosting state and stamina
    let currentSpeed = PLAYER_SPEED;
    if (this.isBoosting && this.stamina > 0) {
      currentSpeed = PLAYER_SPEED * 1.8; // 1.8x speed boost
      this.stamina = Math.max(0, this.stamina - 1.5); // Consume 1.5 stamina per tick (~45/s)
    } else {
      this.stamina = Math.min(100, this.stamina + 0.6); // Recover 0.6 stamina per tick (~18/s)
    }

    if (this.protectionTicks > 0) {
      this.protectionTicks = Math.max(0, this.protectionTicks - 1);
    }

    const dx = this.input.x - this.x;
    const dy = this.input.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.angle = Math.atan2(dy, dx);
    }
    if (dist > currentSpeed) {
      this.x += (dx / dist) * currentSpeed;
      this.y += (dy / dist) * currentSpeed;
    } else {
      this.x = this.input.x;
      this.y = this.input.y;
    }
  }

  addOrbit(type = 'normal') {
    this.orbits.push({
      angle: Math.random() * Math.PI * 2,
      ring: this.orbits.length % 2,
      type,
      hp: type === 'strong' ? 2 : 1,
    });
  }

  removeOrbit(orbit) {
    const index = this.orbits.indexOf(orbit);
    if (index !== -1) {
      this.orbits.splice(index, 1);
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      radius: this.radius,
      score: this.score,
      kills: this.kills,
      angle: this.angle,
      orbits: this.orbits,
      skinId: this.skinId,
      stamina: this.stamina,
      isBoosting: this.isBoosting,
      isProtected: this.protectionTicks > 0,
    };
  }
}

module.exports = Player;
