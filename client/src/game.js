const scoreEl = document.getElementById('score');
const orbitCountEl = document.getElementById('orbitCount');
const coordsEl = document.getElementById('coords');
const directionEl = document.getElementById('direction');
const hitMessageEl = document.getElementById('hitMessage');
const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');

const MAP_WIDTH = 3000;
const MAP_HEIGHT = 3000;

let canvas;
let ctx;
let socketApi;
let inputVector = { x: 0, y: 0 };
let useKeyboard = false;
let useJoystick = false;
let gameStarted = false;
let hitTimer = 0;
let activePointerId = null;

const controls = {
  w: false,
  a: false,
  s: false,
  d: false,
  ArrowUp: false,
  ArrowLeft: false,
  ArrowDown: false,
  ArrowRight: false,
};

function updateInputVectorFromKeyboard() {
  const x = (controls.d || controls.ArrowRight ? 1 : 0) - (controls.a || controls.ArrowLeft ? 1 : 0);
  const y = (controls.s || controls.ArrowDown ? 1 : 0) - (controls.w || controls.ArrowUp ? 1 : 0);
  const length = Math.hypot(x, y);
  if (length > 0) {
    inputVector.x = x / length;
    inputVector.y = y / length;
  } else {
    inputVector.x = 0;
    inputVector.y = 0;
  }
}

window.addEventListener('keydown', (e) => {
  const key = e.key;
  if (key in controls) {
    controls[key] = true;
    useKeyboard = true;
    updateInputVectorFromKeyboard();
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key;
  if (key in controls) {
    controls[key] = false;
    updateInputVectorFromKeyboard();
    e.preventDefault();
  }
});

function resetStick() {
  if (!stickEl) return;
  stickEl.style.transform = 'translate(0px, 0px)';
}

function setJoystickDirection(dx, dy) {
  const maxRadius = 40;
  const distance = Math.min(Math.hypot(dx, dy), maxRadius);
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  if (stickEl) {
    stickEl.style.transform = `translate(${x}px, ${y}px)`;
  }
  const norm = distance > 8 ? 1 : 0;
  inputVector.x = norm * Math.cos(angle);
  inputVector.y = norm * Math.sin(angle);
}

function onJoystickPointerDown(e) {
  if (!joystickEl) return;
  useJoystick = true;
  activePointerId = e.pointerId;
  joystickEl.setPointerCapture(activePointerId);
  const rect = joystickEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  setJoystickDirection(e.clientX - centerX, e.clientY - centerY);
  e.preventDefault();
}

function onJoystickPointerMove(e) {
  if (!useJoystick || e.pointerId !== activePointerId) return;
  const rect = joystickEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  setJoystickDirection(e.clientX - centerX, e.clientY - centerY);
  e.preventDefault();
}

function onJoystickPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  useJoystick = false;
  activePointerId = null;
  inputVector.x = 0;
  inputVector.y = 0;
  resetStick();
  e.preventDefault();
}

if (joystickEl) {
  joystickEl.addEventListener('pointerdown', onJoystickPointerDown);
  joystickEl.addEventListener('pointermove', onJoystickPointerMove);
  joystickEl.addEventListener('pointerup', onJoystickPointerUp);
  joystickEl.addEventListener('pointercancel', onJoystickPointerUp);
  joystickEl.addEventListener('lostpointercapture', onJoystickPointerUp);
}

function drawPlayer(ctx, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#f2e6d8';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6b8f71';
  ctx.stroke();
  ctx.restore();
}

function drawMoon(ctx, x, y, r, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#a8ffb0');
  grad.addColorStop(1, '#1f9e3d');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0e5c22';
  ctx.stroke();
  ctx.restore();
}

function drawGrid(ctx, camX, camY) {
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const grid = 60;
  const offsetX = camX % grid;
  const offsetY = camY % grid;

  for (let x = -offsetX; x < canvas.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = -offsetY; y < canvas.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawMapBounds(ctx, camX, camY) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 150, 0, 0.8)';
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.strokeRect(-camX, -camY, MAP_WIDTH, MAP_HEIGHT);
  ctx.restore();
}

function getCardinalDirection(angle) {
  const deg = ((angle * 180) / Math.PI + 360) % 360;
  if (deg >= 45 && deg < 135) return 'S';
  if (deg >= 135 && deg < 225) return 'W';
  if (deg >= 225 && deg < 315) return 'N';
  return 'E';
}

function updateHud(state, myId) {
  const me = state.players.find(p => p.id === myId);
  if (!me) {
    scoreEl.textContent = '0';
    orbitCountEl.textContent = '0';
    coordsEl.textContent = '--';
    directionEl.textContent = '--';
    return;
  }

  scoreEl.textContent = me.score;
  orbitCountEl.textContent = me.orbits.length;
  coordsEl.textContent = `${Math.round(me.x)}, ${Math.round(me.y)}`;
  directionEl.textContent = getCardinalDirection(me.angle);

  if (state.lastHit && state.lastHit.targetId === myId) {
    hitMessageEl.textContent = `Bị ${state.lastHit.attackerName} đánh trúng! Điểm: ${me.score} - Vệ tinh: ${me.orbits.length}`;
    hitTimer = 120;
  }
}

function updateHitMessage() {
  if (hitTimer > 0) {
    hitTimer -= 1;
  }
  if (hitTimer <= 0) {
    hitMessageEl.textContent = '';
  }
}

function sendInput() {
  const myId = socketApi.getMyId();
  const state = socketApi.getState();
  if (!myId || state.players.length === 0) return;

  const me = state.players.find(p => p.id === myId);
  if (!me) return;

  let targetX = me.x;
  let targetY = me.y;

  if (useKeyboard || useJoystick) {
    const speedRange = 180;
    targetX += inputVector.x * speedRange;
    targetY += inputVector.y * speedRange;
  }

  targetX = Math.min(Math.max(targetX, 0), MAP_WIDTH);
  targetY = Math.min(Math.max(targetY, 0), MAP_HEIGHT);

  socketApi.emitInput({ x: targetX, y: targetY });
}

function drawScene(t) {
  const state = socketApi.getState();
  const myId = socketApi.getMyId();
  const me = state.players.find(p => p.id === myId);

  if (!me) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText('Đang kết nối tới server...', 24, 42);
    return;
  }

  const camX = me.x - canvas.width / 2;
  const camY = me.y - canvas.height / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, camX, camY);
  drawMapBounds(ctx, camX, camY);

  for (const pickup of state.pickups) {
    const bob = Math.sin(t / 400 + pickup.id.charCodeAt(0)) * 4;
    drawMoon(ctx, pickup.x - camX, pickup.y - camY + bob, pickup.radius, t / 900);
  }

  for (const player of state.players) {
    drawPlayer(ctx, player.x - camX, player.y - camY, player.radius);
    for (const orbit of player.orbits) {
      const angle = orbit.angle + state.orbitClock * (orbit.ring === 0 ? 1 : -1);
      const radius = 45 + orbit.ring * 18;
      const ox = player.x + Math.cos(angle) * radius - camX;
      const oy = player.y + Math.sin(angle) * radius - camY;
      drawMoon(ctx, ox, oy, 11, angle);
    }
  }

  updateHud(state, myId);
  updateHitMessage();
}

function loop(t) {
  drawScene(t);
  requestAnimationFrame(loop);
}

export function startGame({ canvas: gameCanvas, ctx: gameCtx, socketApi: api }) {
  canvas = gameCanvas;
  ctx = gameCtx;
  socketApi = api;
  gameStarted = false;
  mouse = { x: canvas.width / 2, y: canvas.height / 2 };

  setInterval(() => {
    if (gameStarted) sendInput();
  }, 100);

  requestAnimationFrame(loop);
}

export function setGameStarted(value) {
  gameStarted = value;
}
