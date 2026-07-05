const { MAP_WIDTH, MAP_HEIGHT, PICKUP_RADIUS, PICKUP_COUNT, STRONG_PICKUP_CHANCE } = require('../../../shared/constants');

class PickupManager {
  constructor() {
    this.pickups = new Map();
    this.fill();
  }

  spawnOne() {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.pickups.set(id, {
      id,
      x: Math.random() * MAP_WIDTH,
      y: Math.random() * MAP_HEIGHT,
      radius: PICKUP_RADIUS,
      type: Math.random() < STRONG_PICKUP_CHANCE ? 'strong' : 'normal',
    });
  }

  fill() {
    while (this.pickups.size < PICKUP_COUNT) {
      this.spawnOne();
    }
  }

  spawnAt(x, y) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.pickups.set(id, {
      id,
      x,
      y,
      radius: PICKUP_RADIUS,
      type: Math.random() < STRONG_PICKUP_CHANCE ? 'strong' : 'normal',
    });
  }

  remove(id) {
    this.pickups.delete(id);
  }

  list() {
    return Array.from(this.pickups.values());
  }
}

module.exports = PickupManager;
