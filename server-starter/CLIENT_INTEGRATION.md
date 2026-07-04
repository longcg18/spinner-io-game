# Nối client demo vào server Socket.io

## 1. Cài socket.io-client bên client

Nếu client dùng bundler (Vite/Webpack):
```
npm install socket.io-client
```

Nếu client vẫn là 1 file HTML thuần (như bản demo ban đầu), thêm script CDN vào `<head>`:
```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
```

## 2. Thay đổi tư duy quan trọng nhất

Bản demo cũ: client tự tính vị trí player, tự check va chạm, tự spawn pickup.

Bản có server: client **KHÔNG tính gì cả** — chỉ làm 2 việc:
1. Gửi vị trí chuột lên server (input)
2. Nhận state mới nhất từ server rồi vẽ lại

## 3. Code mẫu thay thế phần logic cũ trong file HTML

Thay toàn bộ phần `update()`, `checkCollisions()`, `pickups`, `orbits` cũ bằng:

```javascript
const socket = io('http://localhost:7860'); // đổi thành URL server khi deploy

let serverState = { players: [], pickups: [] };
let myId = null;

socket.on('connect', () => {
  socket.emit('join', 'Người chơi ' + Math.floor(Math.random() * 1000));
});

socket.on('joined', (data) => {
  myId = data.id;
});

socket.on('state', (state) => {
  serverState = state; // cập nhật state mới nhất, dùng để vẽ ở vòng lặp render
});

// Gửi input định kỳ — không cần gửi mỗi frame, 10 lần/giây là đủ mượt
setInterval(() => {
  socket.emit('input', { x: mouse.x + cameraOffsetX, y: mouse.y + cameraOffsetY });
}, 100);
```

## 4. Sửa vòng lặp render để vẽ từ `serverState` thay vì biến local

```javascript
function loop(t) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = serverState.players.find(p => p.id === myId);
  if (!me) {
    requestAnimationFrame(loop);
    return; // chưa join xong thì chưa vẽ
  }

  // Camera đơn giản: lệch canvas theo vị trí player để player luôn ở giữa màn hình
  const camX = me.x - canvas.width / 2;
  const camY = me.y - canvas.height / 2;

  // Vẽ pickup (trừ camera offset)
  for (const p of serverState.pickups) {
    drawMoon(p.x - camX, p.y - camY, p.radius, t / 900);
  }

  // Vẽ tất cả người chơi (không chỉ mình)
  for (const player of serverState.players) {
    drawPlayer(player.x - camX, player.y - camY);
    for (const o of player.orbits) {
      const angle = o.angle + serverState.orbitClock * (o.ring === 0 ? 1 : -1);
      const radius = 45 + o.ring * 18;
      const ox = player.x + Math.cos(angle) * radius - camX;
      const oy = player.y + Math.sin(angle) * radius - camY;
      drawMoon(ox, oy, 11, angle);
    }
  }

  requestAnimationFrame(loop);
}
```

Lưu ý: biến `cameraOffsetX/Y` trong bước gửi input ở trên chính là `camX/camY` — vì
chuột đang ở toạ độ màn hình (screen space), còn server làm việc bằng toạ độ map
(world space), cần cộng offset để chuyển đổi.

## 5. Chạy thử local

```bash
# Terminal 1
cd server
npm install
npm run dev

# Terminal 2: mở file client bằng Live Server hoặc
npx serve client
```

Mở 2 tab trình duyệt cùng lúc — bạn sẽ thấy 2 nhân vật, mỗi tab điều khiển 1 nhân vật,
và pickup được đồng bộ giữa cả 2 tab. Đó chính là multiplayer thật.
