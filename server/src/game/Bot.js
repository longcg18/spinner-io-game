const Player = require('./Player');

class Bot extends Player {
  constructor(id, name, skinId) {
    super(id, name, skinId);
    this.isBot = true;
    this.decisionTimer = 0;
  }

  updateAI(room) {
    this.decisionTimer--;
    if (this.decisionTimer <= 0) {
      // Make a new decision every 15-30 frames (~500ms - 1s) to simulate human reaction delay
      this.decisionTimer = 15 + Math.floor(Math.random() * 15);

      let targetX = this.x;
      let targetY = this.y;

      // 1. Scan for the nearest player/other bot
      let closestPlayer = null;
      let minPlayerDist = Infinity;

      for (const other of room.players.values()) {
        if (other.id === this.id) continue;
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minPlayerDist) {
          minPlayerDist = dist;
          closestPlayer = other;
        }
      }

      // If a target is close enough (within 450 pixels)
      if (closestPlayer && minPlayerDist < 450) {
        // If we have more orbits, chase them!
        if (this.orbits.length > closestPlayer.orbits.length) {
          targetX = closestPlayer.x;
          targetY = closestPlayer.y;
          this.isBoosting = this.stamina > 30; // Boost when chasing if we have enough stamina
        } else {
          // Otherwise, run away from them in the opposite direction!
          const dx = closestPlayer.x - this.x;
          const dy = closestPlayer.y - this.y;
          targetX = this.x - dx * 2;
          targetY = this.y - dy * 2;
          this.isBoosting = this.stamina > 20; // Boost to escape!
        }
      } else {
        this.isBoosting = false; // Rest and recover stamina when collecting/wandering
        // 2. Otherwise, look for the nearest pickup
        let closestPickup = null;
        let minPickupDist = Infinity;

        for (const pickup of room.pickups.list()) {
          const dx = pickup.x - this.x;
          const dy = pickup.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < minPickupDist) {
            minPickupDist = dist;
            closestPickup = pickup;
          }
        }

        if (closestPickup) {
          targetX = closestPickup.x;
          targetY = closestPickup.y;
        } else {
          // Random wander if no pickups or players
          targetX = this.x + (Math.random() - 0.5) * 400;
          targetY = this.y + (Math.random() - 0.5) * 400;
        }
      }

      this.setInput(targetX, targetY);
    }
  }
}

module.exports = Bot;
