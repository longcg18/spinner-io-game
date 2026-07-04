const { MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS, PLAYER_SPEED, ORBIT_RADIUS_BASE, ORBIT_RADIUS_STEP } = require('../../../shared/constants');

class Player {
  constructor(id, name = 'Player') {
    this.id = id;
    this.name = name;
    this.x = Math.random() * MAP_WIDTH;
    this.y = Math.random() * MAP_HEIGHT;
    this.radius = PLAYER_RADIUS;
    this.score = 0;
    this.input = { x: this.x, y: this.y };
    this.angle = 0;
    this.orbits = [];
  }

  setInput(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    this.input = {
      x: Math.min(Math.max(x, 0), MAP_WIDTH),
      y: Math.min(Math.max(y, 0), MAP_HEIGHT),
    };
  }

  update() {
    const dx = this.input.x - this.x;
    const dy = this.input.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.angle = Math.atan2(dy, dx);
    }
    if (dist > PLAYER_SPEED) {
      this.x += (dx / dist) * PLAYER_SPEED;
      this.y += (dy / dist) * PLAYER_SPEED;
    } else {
      this.x = this.input.x;
      this.y = this.input.y;
    }
  }

  addOrbit() {
    this.orbits.push({
      angle: Math.random() * Math.PI * 2,
      ring: this.orbits.length % 2,
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
      angle: this.angle,
      orbits: this.orbits,
    };
  }
}

module.exports = Player;
