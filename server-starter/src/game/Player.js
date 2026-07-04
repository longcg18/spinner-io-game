const { MAP_WIDTH, MAP_HEIGHT, PLAYER_RADIUS, PLAYER_SPEED } = require('../../shared/constants');

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name || 'Player';
    this.x = Math.random() * MAP_WIDTH;
    this.y = Math.random() * MAP_HEIGHT;
    this.radius = PLAYER_RADIUS;
    this.score = 0;
    this.orbits = []; // { angle, ring }

    // input hiện tại (server chỉ tin cái này, không tin vị trí client tự báo)
    this.targetX = this.x;
    this.targetY = this.y;
  }

  setInput(x, y) {
    // Chặn input bất thường (vd client gửi toạ độ ngoài map để cheat)
    this.targetX = Math.max(0, Math.min(MAP_WIDTH, x));
    this.targetY = Math.max(0, Math.min(MAP_HEIGHT, y));
  }

  update() {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > PLAYER_SPEED) {
      this.x += (dx / dist) * PLAYER_SPEED;
      this.y += (dy / dist) * PLAYER_SPEED;
    } else {
      this.x = this.targetX;
      this.y = this.targetY;
    }

    // Giữ trong map
    this.x = Math.max(0, Math.min(MAP_WIDTH, this.x));
    this.y = Math.max(0, Math.min(MAP_HEIGHT, this.y));
  }

  addOrbit() {
    this.orbits.push({
      angle: Math.random() * Math.PI * 2,
      ring: this.orbits.length % 2,
    });
  }

  toJSON() {
    // Chỉ gửi những gì client cần để vẽ — không gửi thông tin thừa
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      radius: this.radius,
      score: this.score,
      orbits: this.orbits,
    };
  }
}

module.exports = Player;
