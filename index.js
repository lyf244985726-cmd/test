const p2p = new P2PManager();
let isHost = false;
let playerName = '';
let roomId = '';
let players = [];

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const joinSection = document.getElementById('joinSection');
const roomIdInput = document.getElementById('roomIdInput');
const playerNameInput = document.getElementById('playerNameInput');
const confirmJoinBtn = document.getElementById('confirmJoinBtn');
const errorDiv = document.getElementById('error');

function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.remove('hidden');
}

function hideError() {
  errorDiv.classList.add('hidden');
}

createBtn.addEventListener('click', async () => {
  hideError();
  playerName = playerNameInput.value.trim() || '房主';
  roomId = generateRoomId();
  
  try {
    await p2p.init(true, roomId);
    isHost = true;
    players = [{ id: p2p.peer.id, name: playerName, ready: true }];
    saveGameState();
    window.location.href = `game.html?room=${roomId}&name=${encodeURIComponent(playerName)}&host=true`;
  } catch (err) {
    showError('创建房间失败: ' + err.message);
  }
});

joinBtn.addEventListener('click', () => {
  joinSection.classList.remove('hidden');
  createBtn.classList.add('hidden');
  joinBtn.classList.add('hidden');
});

confirmJoinBtn.addEventListener('click', async () => {
  hideError();
  const roomIdVal = roomIdInput.value.trim();
  playerName = playerNameInput.value.trim() || '玩家';
  
  if (!roomIdVal) {
    showError('请输入房间ID');
    return;
  }

  try {
    await p2p.init(false);
    const conn = await p2p.connectToHost(roomIdVal);
    roomId = roomIdVal;
    window.location.href = `game.html?room=${roomId}&name=${encodeURIComponent(playerName)}&host=false`;
  } catch (err) {
    showError('加入房间失败: ' + err.message);
  }
});

function generateRoomId() {
  return 'avalon-' + Math.random().toString(36).substr(2, 8);
}

function saveGameState() {
  localStorage.setItem('avalon_roomId', roomId);
  localStorage.setItem('avalon_playerName', playerName);
  localStorage.setItem('avalon_isHost', isHost);
  localStorage.setItem('avalon_players', JSON.stringify(players));
}

const urlParams = new URLSearchParams(window.location.search);
const urlRoomId = urlParams.get('room');
const urlName = urlParams.get('name');
const urlHost = urlParams.get('host');

if (urlRoomId) {
  roomIdInput.value = urlRoomId;
  if (urlName) playerNameInput.value = decodeURIComponent(urlName);
  if (urlHost === 'false') {
    joinSection.classList.remove('hidden');
    createBtn.classList.add('hidden');
    joinBtn.classList.add('hidden');
  }
}
