// File này PHẢI giống nhau ở cả client và server.
// Copy y hệt file này vào cả client/src/shared/ và server/src/shared/
// (hoặc dùng symlink / npm workspace nếu bạn setup monorepo có build tool).

module.exports = {
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 3000,

  PLAYER_RADIUS: 18,
  PLAYER_SPEED: 4.5,          // pixel / tick

  PICKUP_RADIUS: 14,
  PICKUP_COUNT: 60,           // số pickup luôn tồn tại trên map

  ORBIT_RADIUS_BASE: 45,
  ORBIT_RADIUS_STEP: 18,
  ORBIT_SPEED: 0.03,          // radian / tick

  TICK_RATE: 30,              // số lần server tính state / giây
  SCORE_PER_PICKUP: 10,
};
