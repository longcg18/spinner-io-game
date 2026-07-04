const { MAP_WIDTH, MAP_HEIGHT, PICKUP_RADIUS, PICKUP_COUNT } = require('../../shared/constants');

class PickupManager {
  constructor() {
    this.pickups = new Map(); // id -> { id, x, y, radius }
    this.nextId = 1;
    this.fill();
  }

  spawnOne() {
    const id = this.nextId++;
    this.pickups.set(id, {
      id,
      x: Math.random() * MAP_WIDTH,
      y: Math.random() * MAP_HEIGHT,
      radius: PICKUP_RADIUS,
    });
  }

  fill() {
    while (this.pickups.size < PICKUP_COUNT) this.spawnOne();
  }

  remove(id) {
    this.pickups.delete(id);
  }

  list() {
    return Array.from(this.pickups.values());
  }
}

module.exports = PickupManager;
