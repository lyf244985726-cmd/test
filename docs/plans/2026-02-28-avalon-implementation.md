# Avalon Online Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个基于浏览器的多人在线阿瓦隆游戏，使用点对点连接

**Architecture:** 纯前端项目，包含首页（创建/加入房间）和游戏页面，使用PeerJS实现P2P联机，GitHub Pages部署

**Tech Stack:** HTML, CSS, JavaScript, PeerJS

---

### Task 1: 创建项目结构和首页

**Files:**
- Create: `index.html`
- Create: `style.css`

**Step 1: 创建 index.html 首页**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>阿瓦隆 Online</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>阿瓦隆 Online</h1>
    <div class="menu">
      <button id="createBtn">创建房间</button>
      <button id="joinBtn">加入房间</button>
    </div>
    <div id="joinSection" class="hidden">
      <input type="text" id="roomIdInput" placeholder="输入房间ID">
      <input type="text" id="playerNameInput" placeholder="你的名字">
      <button id="confirmJoinBtn">加入</button>
    </div>
    <div id="error" class="error hidden"></div>
  </div>
  <script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
  <script src="peer.js"></script>
  <script src="index.js"></script>
</body>
</html>
```

**Step 2: 创建 style.css 基础样式**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
}

.container {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 3rem;
  margin-bottom: 2rem;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.menu {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1rem;
}

button {
  padding: 1rem 2rem;
  font-size: 1.2rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: #4a5568;
  color: #fff;
  transition: all 0.3s;
}

button:hover {
  background: #667eea;
  transform: translateY(-2px);
}

input {
  padding: 0.8rem 1rem;
  font-size: 1rem;
  border: 2px solid #4a5568;
  border-radius: 8px;
  background: #2d3748;
  color: #fff;
  margin: 0.5rem;
}

.hidden {
  display: none !important;
}

.error {
  color: #fc8181;
  margin-top: 1rem;
}
```

**Step 3: 提交**

```bash
git add index.html style.css docs/plans/2026-02-28-avalon-design.md
git commit -m "feat: 创建项目基础结构和首页"
```

---

### Task 2: 实现 P2P 连接逻辑

**Files:**
- Create: `peer.js`

**Step 1: 创建 peer.js**

```javascript
class P2PManager {
  constructor() {
    this.peer = null;
    this.connections = [];
    this.hostConn = null;
    this.onMessage = null;
    this.onPeerConnected = null;
    this.onPeerDisconnected = null;
  }

  init(hostMode = false, roomId = null) {
    return new Promise((resolve, reject) => {
      const peerId = hostMode ? roomId : null;
      this.peer = new Peer(peerId);

      this.peer.on('open', (id) => {
        console.log('Peer connected:', id);
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.handleConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        reject(err);
      });
    });
  }

  connectToHost(hostId) {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(hostId);
      
      conn.on('open', () => {
        this.hostConn = conn;
        this.handleConnection(conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        reject(err);
      });
    });
  }

  handleConnection(conn) {
    this.connections.push(conn);
    
    conn.on('data', (data) => {
      if (this.onMessage) {
        this.onMessage(data, conn);
      }
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
      if (this.onPeerDisconnected) {
        this.onPeerDisconnected(conn.peer);
      }
    });

    if (this.onPeerConnected) {
      this.onPeerConnected(conn);
    }
  }

  send(data, conn = null) {
    if (conn) {
      conn.send(data);
    } else if (this.hostConn) {
      this.hostConn.send(data);
    } else {
      this.connections.forEach(c => c.send(data));
    }
  }

  broadcast(data) {
    this.connections.forEach(c => c.send(data));
    if (this.hostConn) {
      this.hostConn.send(data);
    }
  }

  getConnections() {
    return this.connections;
  }

  destroy() {
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

window.P2PManager = P2PManager;
```

**Step 2: 提交**

```bash
git add peer.js
git commit -m "feat: 实现P2P连接逻辑"
```

---

### Task 3: 实现首页逻辑

**Files:**
- Create: `index.js`

**Step 1: 创建 index.js**

```javascript
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

// 检查URL参数
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
```

**Step 2: 提交**

```bash
git add index.js
git commit -m "feat: 实现首页逻辑"
```

---

### Task 4: 创建游戏页面基础

**Files:**
- Create: `game.html`

**Step 1: 创建 game.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>阿瓦隆 - 游戏房间</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="game-container">
    <header>
      <h1>阿瓦隆 Online</h1>
      <div class="room-info">
        <span>房间ID: <strong id="roomIdDisplay">-</strong></span>
        <button id="copyLinkBtn">复制邀请链接</button>
      </div>
    </header>

    <main id="gameArea">
      <!-- 等待室 -->
      <section id="waitingRoom" class="screen">
        <h2>等待玩家加入</h2>
        <div id="playerList" class="player-list"></div>
        <div class="actions">
          <button id="startGameBtn" disabled>开始游戏</button>
        </div>
      </section>

      <!-- 角色分配 -->
      <section id="roleReveal" class="screen hidden">
        <h2>你的角色</h2>
        <div id="myRole" class="role-card"></div>
        <p id="roleDescription" class="role-desc"></p>
        <button id="confirmRoleBtn">确认</button>
      </section>

      <!-- 任务阶段 -->
      <section id="missionScreen" class="screen hidden">
        <div class="mission-header">
          <h2>第 <span id="missionNum">1</span> 个任务</h2>
          <div class="mission-track">
            <div class="track-item" data-team="1"></div>
            <div class="track-item" data-team="2"></div>
            <div class="track-item" data-team="3"></div>
            <div class="track-item" data-team="4"></div>
            <div class="track-item" data-team="5"></div>
          </div>
        </div>
        
        <div id="teamSelection" class="phase">
          <h3>队长选择队伍</h3>
          <p>队长: <strong id="leaderName">-</strong></p>
          <div id="playerCheckboxes" class="player-checkboxes"></div>
          <button id="confirmTeamBtn">确认队伍</button>
        </div>

        <div id="votingPhase" class="phase hidden">
          <h3>队伍投票</h3>
          <p>请选择赞成或反对</p>
          <div class="vote-buttons">
            <button class="vote-btn approve" data-vote="approve">赞成</button>
            <button class="vote-btn reject" data-vote="reject">反对</button>
          </div>
          <div id="voteResults" class="vote-results"></div>
        </div>

        <div id="missionExecution" class="phase hidden">
          <h3>任务执行</h3>
          <p id="missionInstruction"></p>
          <div class="vote-buttons">
            <button class="vote-btn success" data-mission="success">成功</button>
            <button class="vote-btn fail" data-mission="fail">失败</button>
          </div>
        </div>
      </section>

      <!-- 结果展示 -->
      <section id="resultScreen" class="screen hidden">
        <h2 id="resultTitle"></h2>
        <div id="resultDetails" class="result-details"></div>
        <button id="nextPhaseBtn">下一阶段</button>
      </section>

      <!-- 胜利画面 -->
      <section id="victoryScreen" class="screen hidden">
        <h2 id="victoryTitle"></h2>
        <p id="victoryMessage"></p>
        <button id="playAgainBtn">再来一局</button>
      </section>
    </main>
  </div>

  <script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
  <script src="peer.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

**Step 2: 提交**

```bash
git add game.html
git commit -m "feat: 创建游戏页面基础结构"
```

---

### Task 5: 完善游戏样式

**Files:**
- Modify: `style.css`

**Step 1: 添加游戏页面样式**

在 style.css 末尾添加：

```css
/* 游戏页面样式 */
.game-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.room-info {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.screen {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 1rem;
}

.player-list {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin: 1.5rem 0;
}

.player-card {
  background: #2d3748;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.player-card.host::before {
  content: '👑';
}

.ready {
  color: #68d391;
}

.not-ready {
  color: #fc8181;
}

.role-card {
  background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
  padding: 2rem;
  border-radius: 16px;
  font-size: 2rem;
  margin: 1rem 0;
  border: 3px solid #ffd700;
}

.role-desc {
  color: #a0aec0;
  margin-bottom: 1rem;
}

.mission-track {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin: 1rem 0;
}

.track-item {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #4a5568;
  border: 3px solid #718096;
}

.track-item.success {
  background: #68d391;
  border-color: #48bb78;
}

.track-item.fail {
  background: #fc8181;
  border-color: #f56565;
}

.phase {
  text-align: center;
  margin: 2rem 0;
}

.player-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  margin: 1rem 0;
}

.checkbox-player {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #2d3748;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  cursor: pointer;
}

.checkbox-player input {
  width: 20px;
  height: 20px;
}

.vote-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin: 1rem 0;
}

.vote-btn {
  padding: 1rem 3rem;
  font-size: 1.2rem;
}

.vote-btn.approve, .vote-btn.success {
  background: #48bb78;
}

.vote-btn.reject, .vote-btn.fail {
  background: #f56565;
}

.vote-btn:hover {
  transform: scale(1.05);
}

.vote-results {
  margin-top: 1rem;
}

.result-details {
  font-size: 1.2rem;
  margin: 1rem 0;
}

.victory-screen h2 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.good-win {
  color: #68d391;
}

.evil-win {
  color: #fc8181;
}
```

**Step 2: 提交**

```bash
git add style.css
git commit -m "feat: 添加游戏页面样式"
```

---

### Task 6: 实现游戏核心逻辑

**Files:**
- Create: `game.js`

**Step 1: 创建 game.js 基础框架**

```javascript
const p2p = new P2PManager();

// 游戏状态
const gameState = {
  isHost: false,
  roomId: '',
  playerName: '',
  players: [],
  myId: '',
  roles: [],
  currentLeader: 0,
  currentMission: 1,
  missionResults: [],
  teamVotes: [],
  missionVotes: [],
  gamePhase: 'waiting', // waiting, roleReveal, teamSelect, voting, mission, result, victory
};

// 角色定义
const ROLE_DATA = {
  'merlin': { name: '梅林', team: 'good', desc: '你知道谁是坏人（除了莫德雷德）' },
  'percival': { name: '派西维尔', team: 'good', desc: '你知道梅林和莫甘娜是谁' },
  'loyal': { name: '亚瑟的忠臣', team: 'good', desc: '你没有特殊能力，努力找出坏人' },
  'mordred': { name: '莫德雷德', team: 'evil', desc: '梅林不知道你是坏人' },
  'morgana': { name: '莫甘娜', team: 'evil', desc: '你看起来像梅林' },
  'oberon': { name: '奥伯伦', team: 'evil', desc: '其他坏人不知道你是谁' },
  'assassin': { name: '刺客', team: 'evil', desc: '如果好人胜利，你可以刺杀梅林' },
};

// DOM 元素
const elements = {
  roomIdDisplay: document.getElementById('roomIdDisplay'),
  copyLinkBtn: document.getElementById('copyLinkBtn'),
  waitingRoom: document.getElementById('waitingRoom'),
  playerList: document.getElementById('playerList'),
  startGameBtn: document.getElementById('startGameBtn'),
  roleReveal: document.getElementById('roleReveal'),
  myRole: document.getElementById('myRole'),
  roleDescription: document.getElementById('roleDescription'),
  confirmRoleBtn: document.getElementById('confirmRoleBtn'),
  missionScreen: document.getElementById('missionScreen'),
  missionNum: document.getElementById('missionNum'),
  leaderName: document.getElementById('leaderName'),
  playerCheckboxes: document.getElementById('playerCheckboxes'),
  confirmTeamBtn: document.getElementById('confirmTeamBtn'),
  votingPhase: document.getElementById('votingPhase'),
  missionExecution: document.getElementById('missionExecution'),
  resultScreen: document.getElementById('resultScreen'),
  victoryScreen: document.getElementById('victoryScreen'),
};

// 初始化
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  gameState.roomId = urlParams.get('room');
  gameState.playerName = decodeURIComponent(urlParams.get('name') || '玩家');
  gameState.isHost = urlParams.get('host') === 'true';

  elements.roomIdDisplay.textContent = gameState.roomId;

  try {
    if (gameState.isHost) {
      await p2p.init(true, gameState.roomId);
      gameState.myId = p2p.peer.id;
      gameState.players = [{ id: gameState.myId, name: gameState.playerName, ready: true }];
    } else {
      await p2p.init(false);
      gameState.myId = p2p.peer.id;
      await p2p.connectToHost(gameState.roomId);
      p2p.send({ type: 'join', playerId: gameState.myId, name: gameState.playerName });
    }

    setupP2PHandlers();
    updatePlayerList();
  } catch (err) {
    alert('连接失败: ' + err.message);
  }
}

function setupP2PHandlers() {
  p2p.onMessage = (data, conn) => {
    handleMessage(data, conn);
  };

  p2p.onPeerConnected = (conn) => {
    console.log('新玩家连接:', conn.peer);
  };
}

function handleMessage(data, conn) {
  switch (data.type) {
    case 'join':
      if (gameState.isHost) {
        gameState.players.push({ id: data.playerId, name: data.name, ready: false });
        broadcast({ type: 'playersUpdate', players: gameState.players });
        updatePlayerList();
      }
      break;
    case 'playersUpdate':
      gameState.players = data.players;
      updatePlayerList();
      break;
    case 'startGame':
      assignRoles();
      showScreen('roleReveal');
      break;
    case 'roleAssigned':
      displayRole(data.role);
      break;
    case 'teamProposed':
      showTeamVote(data.team);
      break;
    case 'vote':
      handleVote(data);
      break;
    case 'missionAction':
      handleMissionAction(data);
      break;
    case 'gameResult':
      showResult(data);
      break;
    case 'victory':
      showVictory(data.winner);
      break;
  }
}

// 更新玩家列表
function updatePlayerList() {
  elements.playerList.innerHTML = gameState.players.map(p => `
    <div class="player-card ${p.ready ? 'ready' : 'not-ready'}">
      ${p.name} ${p.ready ? '✓' : '等待中'}
    </div>
  `).join('');

  // 房主检查是否可以开始
  if (gameState.isHost) {
    const minPlayers = 5;
    const maxPlayers = 10;
    elements.startGameBtn.disabled = gameState.players.length < minPlayers;
    elements.startGameBtn.textContent = gameState.players.length < minPlayers 
      ? `需要至少 ${minPlayers} 人` 
      : '开始游戏';
  }
}

// 分配角色
function assignRoles() {
  const playerCount = gameState.players.length;
  const roleConfigs = getRolesForPlayerCount(playerCount);
  
  gameState.roles = roleConfigs;
  
  // 分配角色给玩家
  const shuffledPlayers = [...gameState.players].sort(() => Math.random() - 0.5);
  
  gameState.players.forEach((player, index) => {
    const role = roleConfigs[index];
    if (player.id === gameState.myId) {
      displayRole(role);
    }
    if (gameState.isHost) {
      p2p.connections.find(c => c.peer === player.id)?.send({ type: 'roleAssigned', role });
    }
  });

  if (gameState.isHost) {
    setTimeout(() => {
      broadcast({ type: 'startTeamSelection', leaderIndex: 0, mission: 1 });
      showScreen('missionScreen');
    }, 5000);
  }
}

function getRolesForPlayerCount(count) {
  const roleSets = {
    5: ['merlin', 'percival', 'loyal', 'mordred', 'assassin'],
    6: ['merlin', 'percival', 'loyal', 'loyal', 'mordred', 'assassin'],
    7: ['merlin', 'percival', 'loyal', 'loyal', 'mordred', 'morgana', 'assassin'],
    8: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'mordred', 'morgana', 'assassin'],
    9: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'mordred', 'morgana', 'oberon', 'assassin'],
    10: ['merlin', 'percival', 'loyal', 'loyal', 'loyal', 'loyal', 'mordred', 'morgana', 'oberon', 'assassin'],
  };
  return roleSets[count] || roleSets[5];
}

function displayRole(roleKey) {
  const role = ROLE_DATA[roleKey];
  elements.myRole.textContent = role.name;
  elements.roleDescription.textContent = role.desc;
  elements.myRole.dataset.team = role.team;
}

// 广播（房主用）
function broadcast(data) {
  p2p.broadcast(data);
}

// 界面切换
function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const screen = document.getElementById(screenName);
  if (screen) screen.classList.remove('hidden');
}

// 事件监听
elements.copyLinkBtn.addEventListener('click', () => {
  const link = `${window.location.origin}${window.location.pathname}?room=${gameState.roomId}`;
  navigator.clipboard.writeText(link);
  elements.copyLinkBtn.textContent = '已复制!';
  setTimeout(() => elements.copyLinkBtn.textContent = '复制邀请链接', 2000);
});

elements.startGameBtn.addEventListener('click', () => {
  if (gameState.isHost) {
    broadcast({ type: 'startGame' });
    assignRoles();
    showScreen('roleReveal');
  }
});

elements.confirmRoleBtn.addEventListener('click', () => {
  if (gameState.isHost) {
    broadcast({ type: 'roleConfirm' });
    startTeamSelection(0, 1);
  } else {
    p2p.send({ type: 'roleConfirm' });
  }
  showScreen('missionScreen');
});

// 开始队伍选择
function startTeamSelection(leaderIndex, mission) {
  gameState.currentLeader = leaderIndex;
  gameState.currentMission = mission;
  
  elements.missionNum.textContent = mission;
  elements.leaderName.textContent = gameState.players[leaderIndex].name;
  
  if (gameState.players[leaderIndex].id === gameState.myId) {
    showTeamSelection();
  } else {
    elements.confirmTeamBtn.classList.add('hidden');
    elements.playerCheckboxes.innerHTML = '<p>等待队长选择队伍...</p>';
  }
}

function showTeamSelection() {
  elements.teamSelection.classList.remove('hidden');
  elements.votingPhase.classList.add('hidden');
  elements.missionExecution.classList.add('hidden');
  
  elements.playerCheckboxes.innerHTML = gameState.players.map(p => `
    <label class="checkbox-player">
      <input type="checkbox" value="${p.id}">
      ${p.name}
    </label>
  `).join('');
  
  elements.confirmTeamBtn.classList.remove('hidden');
}

elements.confirmTeamBtn.addEventListener('click', () => {
  const selected = Array.from(document.querySelectorAll('#playerCheckboxes input:checked'))
    .map(cb => cb.value);
  
  if (gameState.isHost) {
    broadcast({ type: 'teamProposed', team: selected, leader: gameState.currentLeader });
    showTeamVote(selected);
  } else {
    p2p.send({ type: 'teamProposed', team: selected });
    elements.confirmTeamBtn.disabled = true;
  }
});

// 队伍投票
function showTeamVote(team) {
  elements.teamSelection.classList.add('hidden');
  elements.votingPhase.classList.remove('hidden');
  
  if (gameState.isHost) {
    gameState.teamVotes = [];
    broadcast({ type: 'voteRequest', team });
  }
}

document.querySelectorAll('.vote-btn[data-vote]').forEach(btn => {
  btn.addEventListener('click', () => {
    const vote = btn.dataset.vote;
    if (gameState.isHost) {
      gameState.teamVotes.push({ playerId: gameState.myId, vote });
      checkAllVotes();
    } else {
      p2p.send({ type: 'vote', vote });
      btn.disabled = true;
    }
  });
});

function checkAllVotes() {
  if (gameState.teamVotes.length < gameState.players.length) {
    broadcast({ type: 'voteProgress', count: gameState.teamVotes.length, total: gameState.players.length });
    return;
  }
  
  const approves = gameState.teamVotes.filter(v => v.vote === 'approve').length;
  const rejects = gameState.teamVotes.length - approves;
  
  if (approves > rejects) {
    startMission();
  } else {
    nextLeader();
  }
  
  broadcast({ type: 'voteResult', approves, rejects, approved: approves > rejects });
}

function nextLeader() {
  const nextIndex = (gameState.currentLeader + 1) % gameState.players.length;
  startTeamSelection(nextIndex, gameState.currentMission);
}

// 任务执行
function startMission() {
  elements.votingPhase.classList.add('hidden');
  elements.missionExecution.classList.remove('hidden');
  
  const requiredFails = gameState.currentMission === 4 ? 2 : 1;
  elements.missionInstruction.textContent = `请执行任务（${gameState.currentMission}号任务）`;
  
  if (gameState.isHost) {
    gameState.missionVotes = [];
    broadcast({ type: 'missionStart', requiredFails });
  }
}

document.querySelectorAll('.vote-btn[data-mission]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.mission;
    if (gameState.isHost) {
      gameState.missionVotes.push({ playerId: gameState.myId, action });
      checkMissionComplete();
    } else {
      p2p.send({ type: 'missionAction', action });
      btn.disabled = true;
    }
  });
});

function checkMissionComplete() {
  if (gameState.missionVotes.length < gameState.players.length) return;
  
  const fails = gameState.missionVotes.filter(v => v.action === 'fail').length;
  const success = fails === 0;
  
  gameState.missionResults.push(success);
  broadcast({ type: 'missionResult', success, fails });
  showMissionResult(success);
}

function showMissionResult(success) {
  elements.missionExecution.classList.add('hidden');
  showScreen('resultScreen');
  
  document.getElementById('resultTitle').textContent = success ? '任务成功!' : '任务失败!';
  document.getElementById('resultDetails').innerHTML = success 
    ? '<p>好人阵营获得1分</p>' 
    : '<p>坏人阵营获得1分</p>';
  
  if (gameState.isHost) {
    document.getElementById('nextPhaseBtn').classList.remove('hidden');
  }
}

// 胜利判定
function checkVictory() {
  const successCount = gameState.missionResults.filter(r => r).length;
  const failCount = gameState.missionResults.filter(r => !r).length;
  
  if (successCount >= 3) {
    showVictory('good');
  } else if (failCount >= 3) {
    showVictory('evil');
  } else {
    startTeamSelection((gameState.currentLeader + 1) % gameState.players.length, gameState.currentMission + 1);
  }
}

function showVictory(winner) {
  showScreen('victoryScreen');
  const title = document.getElementById('victoryTitle');
  const message = document.getElementById('victoryMessage');
  
  if (winner === 'good') {
    title.textContent = '好人胜利!';
    title.className = 'good-win';
    message.textContent = ' Merlin has been protected!';
  } else {
    title.textContent = '坏人胜利!';
    title.className = 'evil-win';
    message.textContent = 'Evil has conquered Avalon!';
  }
}

document.getElementById('nextPhaseBtn')?.addEventListener('click', () => {
  checkVictory();
});

document.getElementById('playAgainBtn')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// 启动
init();
```

**Step 2: 提交**

```bash
git add game.js
git commit -m "feat: 实现游戏核心逻辑"
```

---

### Task 7: 本地测试

**Step 1: 用浏览器打开 index.html 测试**

- 创建房间，检查是否生成房间ID
- 复制链接，模拟加入

**Step 2: 提交**

```bash
git status
git add -A
git commit -m "feat: 完成阿瓦隆游戏基本功能"
```

---

### Task 8: 部署到 GitHub Pages

**Step 1: 创建 GitHub 仓库并推送**

```bash
# 初始化git（如果没有）
git init

# 添加所有文件
git add -A

# 提交
git commit -m "feat: Avalon Online - 多人在线阿瓦隆游戏"

# 添加远程仓库（替换为你的用户名）
git remote add origin https://github.com/你的用户名/avalon-online.git

# 推送
git push -u origin main
```

**Step 2: 启用 GitHub Pages**

1. 打开 GitHub 仓库页面
2. 进入 Settings → Pages
3. Source 选择 "main branch"
4. 保存

**Step 3: 分享链接给朋友**

---

## 完成!

计划完成，文件保存到 `docs/plans/2026-02-28-avalon-implementation.md`

**两个执行选项：**

1. **Subagent-Driven (当前会话)** - 我调度子任务，逐步实现
2. **Parallel Session (新会话)** - 在新会话中执行

你选哪个？
