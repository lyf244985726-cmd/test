const p2p = new P2PManager();

const gameState = {
  isHost: false,
  roomId: '',
  playerName: '',
  players: [],
  myId: '',
  roles: [],
  myRole: '',
  currentLeader: 0,
  currentMission: 1,
  missionResults: [],
  teamVotes: [],
  missionVotes: [],
  gamePhase: 'waiting',
  currentTeam: [],
};

const ROLE_DATA = {
  'merlin': { name: '梅林', team: 'good', desc: '你知道谁是坏人（除了莫德雷德）' },
  'percival': { name: '派西维尔', team: 'good', desc: '你知道梅林和莫甘娜是谁' },
  'loyal': { name: '亚瑟的忠臣', team: 'good', desc: '你没有特殊能力，努力找出坏人' },
  'mordred': { name: '莫德雷德', team: 'evil', desc: '梅林不知道你是坏人' },
  'morgana': { name: '莫甘娜', team: 'evil', desc: '你看起来像梅林' },
  'oberon': { name: '奥伯伦', team: 'evil', desc: '其他坏人不知道你是谁' },
  'assassin': { name: '刺客', team: 'evil', desc: '如果好人胜利，你可以刺杀梅林' },
};

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
  teamSelection: document.getElementById('teamSelection'),
  votingPhase: document.getElementById('votingPhase'),
  missionExecution: document.getElementById('missionExecution'),
  resultScreen: document.getElementById('resultScreen'),
  victoryScreen: document.getElementById('victoryScreen'),
};

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
      updatePlayerList();
    } else {
      await p2p.init(false);
      gameState.myId = p2p.peer.id;
      await p2p.connectToHost(gameState.roomId);
      p2p.send({ type: 'join', playerId: gameState.myId, name: gameState.playerName });
    }

    setupP2PHandlers();
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
      gameState.myRole = data.role;
      displayRole(data.role);
      break;
    case 'roleConfirm':
      if (gameState.isHost) {
        startTeamSelection(0, 1);
      }
      break;
    case 'startTeamSelection':
      gameState.currentLeader = data.leaderIndex;
      gameState.currentMission = data.mission;
      showScreen('missionScreen');
      updateMissionInfo();
      showTeamVotingUI();
      break;
    case 'teamProposed':
      gameState.currentTeam = data.team;
      showScreen('missionScreen');
      updateMissionInfo();
      showTeamVote(data.team);
      break;
    case 'voteRequest':
      break;
    case 'vote':
      if (gameState.isHost) {
        gameState.teamVotes.push({ playerId: data.playerId, vote: data.vote });
        checkAllVotes();
      }
      break;
    case 'voteResult':
      showVoteResult(data);
      break;
    case 'missionStart':
      showMissionExecution();
      break;
    case 'missionAction':
      if (gameState.isHost) {
        gameState.missionVotes.push({ playerId: data.playerId, action: data.action });
        checkMissionComplete();
      }
      break;
    case 'missionResult':
      showMissionResult(data);
      break;
    case 'nextPhase':
      if (gameState.isHost) {
        checkVictory();
      }
      break;
  }
}

function updatePlayerList() {
  elements.playerList.innerHTML = gameState.players.map(p => `
    <div class="player-card ${p.ready ? 'ready' : 'not-ready'}">
      ${p.name} ${p.ready ? '✓' : '等待中'}
    </div>
  `).join('');

  if (gameState.isHost) {
    const minPlayers = 5;
    elements.startGameBtn.disabled = gameState.players.length < minPlayers;
    elements.startGameBtn.textContent = gameState.players.length < minPlayers 
      ? `需要至少 ${minPlayers} 人` 
      : '开始游戏';
  }
}

function assignRoles() {
  const playerCount = gameState.players.length;
  const roleConfigs = getRolesForPlayerCount(playerCount);
  
  gameState.roles = roleConfigs;
  
  const shuffledPlayers = [...gameState.players].sort(() => Math.random() - 0.5);
  
  gameState.players.forEach((player, index) => {
    const role = roleConfigs[index];
    if (player.id === gameState.myId) {
      gameState.myRole = role;
    }
    if (gameState.isHost) {
      const targetConn = p2p.connections.find(c => c.peer === player.id);
      if (targetConn) {
        targetConn.send({ type: 'roleAssigned', role });
      }
    }
  });

  displayRole(gameState.myRole);
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

function broadcast(data) {
  p2p.broadcast(data);
}

function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const screen = document.getElementById(screenName);
  if (screen) screen.classList.remove('hidden');
}

function updateMissionInfo() {
  elements.missionNum.textContent = gameState.currentMission;
  elements.leaderName.textContent = gameState.players[gameState.currentLeader]?.name || '-';
  
  const trackItems = document.querySelectorAll('.track-item');
  trackItems.forEach((item, i) => {
    item.classList.remove('success', 'fail');
    if (i < gameState.missionResults.length) {
      item.classList.add(gameState.missionResults[i] ? 'success' : 'fail');
    }
  });
}

function showTeamVotingUI() {
  elements.teamSelection.classList.remove('hidden');
  elements.votingPhase.classList.add('hidden');
  elements.missionExecution.classList.add('hidden');
  
  const isLeader = gameState.players[gameState.currentLeader]?.id === gameState.myId;
  
  if (isLeader) {
    elements.playerCheckboxes.innerHTML = gameState.players.map(p => `
      <label class="checkbox-player">
        <input type="checkbox" value="${p.id}">
        ${p.name}
      </label>
    `).join('');
    elements.confirmTeamBtn.classList.remove('hidden');
  } else {
    elements.playerCheckboxes.innerHTML = '<p>等待队长选择队伍...</p>';
    elements.confirmTeamBtn.classList.add('hidden');
  }
}

function showTeamVote(team) {
  elements.teamSelection.classList.add('hidden');
  elements.votingPhase.classList.remove('hidden');
  elements.missionExecution.classList.add('hidden');
  
  if (gameState.isHost) {
    gameState.teamVotes = [];
    broadcast({ type: 'voteRequest' });
  }
}

function showVoteResult(data) {
  elements.votingPhase.classList.add('hidden');
  showScreen('resultScreen');
  
  const resultTitle = document.getElementById('resultTitle');
  const resultDetails = document.getElementById('resultDetails');
  
  if (data.approved) {
    resultTitle.textContent = '队伍已确定!';
    resultDetails.innerHTML = `<p>赞成: ${data.approves} | 反对: ${data.rejects}</p>`;
    setTimeout(() => {
      if (gameState.isHost) {
        startMission();
      }
    }, 2000);
  } else {
    resultTitle.textContent = '队伍被拒绝!';
    resultDetails.innerHTML = `<p>赞成: ${data.approves} | 反对: ${data.rejects}</p><p>更换队长...</p>`;
    setTimeout(() => {
      if (gameState.isHost) {
        nextLeader();
      }
    }, 2000);
  }
}

function showMissionExecution() {
  elements.votingPhase.classList.add('hidden');
  elements.missionExecution.classList.remove('hidden');
  
  const isOnTeam = gameState.currentTeam.includes(gameState.myId);
  
  if (isOnTeam) {
    elements.missionInstruction.textContent = '你是队伍成员，请执行任务';
  } else {
    elements.missionInstruction.textContent = '等待队伍成员执行任务...';
    document.querySelectorAll('.vote-btn[data-mission]').forEach(btn => btn.disabled = true);
  }
  
  if (gameState.isHost) {
    gameState.missionVotes = [];
  }
}

function showMissionResult(data) {
  elements.missionExecution.classList.add('hidden');
  showScreen('resultScreen');
  
  const resultTitle = document.getElementById('resultTitle');
  const resultDetails = document.getElementById('resultDetails');
  
  if (data.success) {
    resultTitle.textContent = '任务成功!';
    resultTitle.style.color = '#68d391';
  } else {
    resultTitle.textContent = '任务失败!';
    resultTitle.style.color = '#fc8181';
  }
  resultDetails.innerHTML = `<p>失败票数: ${data.fails}</p>`;
  
  gameState.missionResults.push(data.success);
  
  document.getElementById('nextPhaseBtn').classList.remove('hidden');
}

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

function startTeamSelection(leaderIndex, mission) {
  gameState.currentLeader = leaderIndex;
  gameState.currentMission = mission;
  gameState.currentTeam = [];
  
  broadcast({ type: 'startTeamSelection', leaderIndex, mission });
  showScreen('missionScreen');
  updateMissionInfo();
  showTeamVotingUI();
}

function startMission() {
  broadcast({ type: 'missionStart' });
  showMissionExecution();
}

function nextLeader() {
  const nextIndex = (gameState.currentLeader + 1) % gameState.players.length;
  startTeamSelection(nextIndex, gameState.currentMission);
}

function checkAllVotes() {
  if (gameState.teamVotes.length < gameState.players.length) return;
  
  const approves = gameState.teamVotes.filter(v => v.vote === 'approve').length;
  const rejects = gameState.teamVotes.length - approves;
  const approved = approves > rejects;
  
  broadcast({ type: 'voteResult', approves, rejects, approved });
  
  if (approved) {
    setTimeout(() => startMission(), 1000);
  } else {
    setTimeout(() => nextLeader(), 2000);
  }
}

function checkMissionComplete() {
  if (gameState.missionVotes.length < gameState.currentTeam.length) return;
  
  const fails = gameState.missionVotes.filter(v => v.action === 'fail').length;
  const success = fails === 0;
  
  broadcast({ type: 'missionResult', success, fails });
  showMissionResult({ success, fails });
}

function showVictory(winner) {
  showScreen('victoryScreen');
  const title = document.getElementById('victoryTitle');
  const message = document.getElementById('victoryMessage');
  
  if (winner === 'good') {
    title.textContent = '好人胜利!';
    title.className = 'good-win';
    message.textContent = '梅林被保护了!';
  } else {
    title.textContent = '坏人胜利!';
    title.className = 'evil-win';
    message.textContent = '邪恶征服了阿瓦隆!';
  }
  
  broadcast({ type: 'victory', winner });
}

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
    showScreen('missionScreen');
  }
});

elements.confirmTeamBtn.addEventListener('click', () => {
  const selected = Array.from(document.querySelectorAll('#playerCheckboxes input:checked'))
    .map(cb => cb.value);
  
  gameState.currentTeam = selected;
  
  if (gameState.isHost) {
    broadcast({ type: 'teamProposed', team: selected });
    showTeamVote(selected);
  } else {
    p2p.send({ type: 'teamProposed', team: selected });
    elements.confirmTeamBtn.disabled = true;
  }
});

document.querySelectorAll('.vote-btn[data-vote]').forEach(btn => {
  btn.addEventListener('click', () => {
    const vote = btn.dataset.vote;
    if (gameState.isHost) {
      gameState.teamVotes.push({ playerId: gameState.myId, vote });
      checkAllVotes();
    } else {
      p2p.send({ type: 'vote', vote });
    }
    btn.disabled = true;
  });
});

document.querySelectorAll('.vote-btn[data-mission]').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.mission;
    if (gameState.isHost) {
      gameState.missionVotes.push({ playerId: gameState.myId, action });
      checkMissionComplete();
    } else {
      p2p.send({ type: 'missionAction', action });
    }
    btn.disabled = true;
  });
});

document.getElementById('nextPhaseBtn')?.addEventListener('click', () => {
  if (gameState.isHost) {
    checkVictory();
  }
  broadcast({ type: 'nextPhase' });
});

document.getElementById('playAgainBtn')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});

init();
