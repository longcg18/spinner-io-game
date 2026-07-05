import player1ImgSrc from '../assets/images/player1.png';
import player2ImgSrc from '../assets/images/player2.png';
import player3ImgSrc from '../assets/images/player3.png';
import player4ImgSrc from '../assets/images/player4.png';

const scoreEl = document.getElementById('score');
const orbitCountEl = document.getElementById('orbitCount');
const killsCountEl = document.getElementById('killsCount');
const coordsEl = document.getElementById('coords');
const directionEl = document.getElementById('direction');
const hitMessageEl = document.getElementById('hitMessage');
const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
const boostBtnEl = document.getElementById('boostBtn');
const hintEl = document.getElementById('hint');

const playerSkins = [];
const skinSrcs = [player1ImgSrc, player2ImgSrc, player3ImgSrc, player4ImgSrc];

skinSrcs.forEach((src) => {
  const img = new Image();
  img.onload = () => {
    img.loaded = true;
  };
  img.src = src;
  playerSkins.push(img);
});

const MAP_WIDTH = 3000;
const MAP_HEIGHT = 3000;

let canvas;
let ctx;
let socketApi;
let inputVector = { x: 0, y: 0 };
let mouse = { x: 0, y: 0 };
let useKeyboard = false;
let useJoystick = false;
let gameStarted = false;
let isBoosting = false;
let hitTimer = 0;
let activePointerId = null;
let boostPointerId = null;
let particles = [];
let flashOpacity = 0;
let lastCamX = 0;
let lastCamY = 0;
let isTouchDevice = false;

// Client-side interpolation: stores smoothed display positions for each entity
const renderPositions = new Map(); // id -> { x, y }
const LERP_ALPHA = 0.25; // how quickly display catches up to server position (0-1)

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
  if (e.code === 'Space' || e.code === 'ShiftLeft') {
    isBoosting = true;
    e.preventDefault();
    return;
  }
  const key = e.key.toLowerCase();
  if (key in controls) {
    controls[key] = true;
    useKeyboard = true;
    updateInputVectorFromKeyboard();
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ShiftLeft') {
    isBoosting = false;
    e.preventDefault();
    return;
  }
  const key = e.key.toLowerCase();
  if (key in controls) {
    controls[key] = false;
    updateInputVectorFromKeyboard();
    e.preventDefault();
  }
});

// ── Touch device detection & mobile controls visibility ──
function showMobileControls() {
  if (joystickEl) joystickEl.style.display = 'flex';
  if (boostBtnEl) boostBtnEl.style.display = 'flex';
  if (hintEl) hintEl.style.display = 'none';
}

function detectTouchDevice() {
  if (isTouchDevice) return;
  isTouchDevice = true;
  showMobileControls();
}

// Show on first touch (handles touch laptops / hybrid devices gracefully)
window.addEventListener('touchstart', detectTouchDevice, { once: true });
// Also check immediately using pointer media query
if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
  isTouchDevice = true;
  // Defer until DOM is ready (called at module init time)
  requestAnimationFrame(showMobileControls);
}

function resetStick() {
  if (!stickEl) return;
  stickEl.style.transform = 'translate(-50%, -50%)';
}

function setJoystickDirection(dx, dy) {
  const maxRadius = 45;
  const distance = Math.min(Math.hypot(dx, dy), maxRadius);
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  if (stickEl) {
    stickEl.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
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

// ── Boost button (mobile) ──
function onBoostDown(e) {
  isBoosting = true;
  boostPointerId = e.pointerId;
  if (boostBtnEl) {
    boostBtnEl.classList.add('active');
    boostBtnEl.setPointerCapture(boostPointerId);
  }
  e.preventDefault();
}

function onBoostUp(e) {
  if (e.pointerId !== boostPointerId) return;
  isBoosting = false;
  boostPointerId = null;
  if (boostBtnEl) boostBtnEl.classList.remove('active');
  e.preventDefault();
}

if (boostBtnEl) {
  boostBtnEl.addEventListener('pointerdown', onBoostDown);
  boostBtnEl.addEventListener('pointerup', onBoostUp);
  boostBtnEl.addEventListener('pointercancel', onBoostUp);
  boostBtnEl.addEventListener('lostpointercapture', onBoostUp);
}

function drawPlayer(ctx, x, y, radius, name, angle, skinId) {
  ctx.save();
  
  // Draw name above the circle
  if (name) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(name, x, y - radius - 6);
  }

  // Get matching skin image
  const skin = (skinId >= 0 && skinId < playerSkins.length) ? playerSkins[skinId] : null;

  if (skin && skin.loaded) {
    // Draw rotated image
    ctx.save();
    ctx.translate(x, y);
    // Align standard direction (East) to asset direction (North)
    ctx.rotate(angle + Math.PI / 2);
    ctx.drawImage(skin, -radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  } else {
    // Fallback main circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f2e6d8';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#6b8f71';
    ctx.stroke();

    // Fallback first letter inside the circle
    if (name) {
      const letter = name.charAt(0).toUpperCase();
      ctx.fillStyle = '#2b241f';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, x, y + 1); // small offset for visual alignment
    }
  }

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

function drawShuriken(ctx, x, y, r, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Set neon glow effect
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#00f0ff'; // Neon Cyan

  // Draw 4-pointed star
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const midAngle = angle + Math.PI / 4;

    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;

    const mx = Math.cos(midAngle) * (r * 0.35);
    const my = Math.sin(midAngle) * (r * 0.35);

    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
    ctx.lineTo(mx, my);
  }
  ctx.closePath();

  // Gradient fill for metallic look
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#e0f7fa');
  grad.addColorStop(0.5, '#00b8d4');
  grad.addColorStop(1, '#006064');
  ctx.fillStyle = grad;
  ctx.fill();

  // Sharp edge stroke
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#00ffff';
  ctx.stroke();

  // Draw center hole
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#2b241f'; // Match map background color
  ctx.shadowBlur = 0; // No glow in the hole
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#00b8d4';
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
    if (killsCountEl) killsCountEl.textContent = '0';
    coordsEl.textContent = '--';
    directionEl.textContent = '--';
    return;
  }

  scoreEl.textContent = me.score;
  orbitCountEl.textContent = me.orbits.length;
  if (killsCountEl) killsCountEl.textContent = me.kills || 0;
  coordsEl.textContent = `${Math.round(me.x)}, ${Math.round(me.y)}`;
  directionEl.textContent = getCardinalDirection(me.angle);

  const staminaBarEl = document.getElementById('staminaBar');
  if (staminaBarEl) {
    staminaBarEl.style.width = `${Math.round(me.stamina)}%`;
  }

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

  socketApi.emitInput({ x: targetX, y: targetY, boost: isBoosting });
}

function drawScene(t) {
  const state = socketApi.getState();
  const myId = socketApi.getMyId();
  const me = state.players.find(p => p.id === myId);

  let camX = lastCamX;
  let camY = lastCamY;

  if (me) {
    const targetCamX = me.x - canvas.width / 2;
    const targetCamY = me.y - canvas.height / 2;
    // Smooth camera toward player position
    lastCamX += (targetCamX - lastCamX) * LERP_ALPHA;
    lastCamY += (targetCamY - lastCamY) * LERP_ALPHA;
    camX = lastCamX;
    camY = lastCamY;
  } else if (!gameStarted) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = '#2b241f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Arial';
    ctx.fillText('Đang kết nối tới server...', 24, 42);
    ctx.restore();
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, camX, camY);
  drawMapBounds(ctx, camX, camY);

  for (const pickup of state.pickups) {
    const bob = Math.sin(t / 400 + pickup.id.charCodeAt(0)) * 4;
    drawShuriken(ctx, pickup.x - camX, pickup.y - camY + bob, pickup.radius, t / 1200);
  }

  // Interpolate and render all players
  // Also clean up entries for players no longer in state
  const activeIds = new Set(state.players.map(p => p.id));
  for (const id of renderPositions.keys()) {
    if (!activeIds.has(id)) renderPositions.delete(id);
  }

  for (const player of state.players) {
    // Get or initialize smooth display position
    if (!renderPositions.has(player.id)) {
      renderPositions.set(player.id, { x: player.x, y: player.y });
    }
    const rp = renderPositions.get(player.id);
    // Lerp display position toward server position
    rp.x += (player.x - rp.x) * LERP_ALPHA;
    rp.y += (player.y - rp.y) * LERP_ALPHA;

    const rx = rp.x - camX;
    const ry = rp.y - camY;

    drawPlayer(ctx, rx, ry, player.radius, player.name, player.angle, player.skinId);
    const total = player.orbits.length;
    player.orbits.forEach((orbit, index) => {
      const angleOffset = (index / total) * Math.PI * 2;
      const angle = angleOffset + state.orbitClock;
      const radius = 45 + orbit.ring * 18;
      const ox = rp.x + Math.cos(angle) * radius - camX;
      const oy = rp.y + Math.sin(angle) * radius - camY;
      drawShuriken(ctx, ox, oy, 11, angle * 1.5);
    });
  }

  // Update & Draw Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= p.decay;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.shadowBlur = 6;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - camX, p.y - camY, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw Screen Flash
  if (flashOpacity > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 0, 0, ${flashOpacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    flashOpacity = Math.max(0, flashOpacity - 0.02);
    ctx.restore();
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
  particles = [];
  flashOpacity = 0;
  mouse.x = canvas.width / 2;
  mouse.y = canvas.height / 2;

  setInterval(() => {
    if (gameStarted) sendInput();
  }, 50);

  requestAnimationFrame(loop);
}

export function setGameStarted(value) {
  gameStarted = value;
}

export function triggerDeathEffect(x, y, skinId) {
  flashOpacity = 0.8;
  particles = [];
  const skinColors = ['#00ffff', '#ff4500', '#e040fb', '#00ff00'];
  const color = skinColors[skinId] || '#ffffff';

  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 8;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + Math.random() * 5,
      alpha: 1.0,
      decay: 0.015 + Math.random() * 0.015,
      color: color
    });
  }
}
