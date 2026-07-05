const SERVER_URL = import.meta.env.VITE_SERVER_URL || window.location.origin;
const socket = io(SERVER_URL);
let myId = null;
let serverState = {
  players: [],
  pickups: [],
  orbitClock: 0,
};
let statusCallback = null;
let connected = false;
let pendingJoinName = null;

function updateStatus(text) {
  if (typeof statusCallback === 'function') {
    statusCallback(text);
  }
}

let gameOverCallback = null;

socket.on('connect', () => {
  connected = true;
  updateStatus('Kết nối tới server');
  if (pendingJoinName) {
    socket.emit('join', pendingJoinName);
  }
});

socket.on('connect_error', () => {
  updateStatus('Không thể kết nối server');
});

socket.on('disconnect', () => {
  updateStatus('Đã ngắt kết nối');
});

socket.on('joined', (data) => {
  myId = data.id;
  updateStatus('Đã vào game');
});

socket.on('hit', (payload) => {
  if (payload && typeof payload === 'object') {
    serverState.lastHit = payload;
  }
});

socket.on('state', (state) => {
  serverState = state;
});

socket.on('gameOver', (data) => {
  if (typeof gameOverCallback === 'function') {
    gameOverCallback(data);
  }
});

export function initSocket(statusFn) {
  statusCallback = statusFn;
  return {
    joinGame: (name) => {
      pendingJoinName = name;
      if (connected) {
        socket.emit('join', pendingJoinName);
      }
    },
    emitInput: ({ x, y, boost }) => {
      if (!myId) return;
      socket.emit('input', { x, y, boost });
    },
    getState: () => serverState,
    getMyId: () => myId,
    isConnected: () => connected,
    onGameOver: (cb) => {
      gameOverCallback = cb;
    },
  };
}
