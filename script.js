/* =========================================================
   ZERO-CONFIG PEER-TO-PEER WEBRTC RPS CONTROLLER
   ========================================================= */

let peer = null;
let connection = null;
let myName = 'Player';
let opponentName = 'Opponent';

let myScore = 0;
let oppScore = 0;
let myMove = null;
let oppMove = null;
let isLocked = false;
let soundEnabled = true;

const weapons = {
  rock: { icon: 'fa-hand-back-fist', beats: 'scissors', label: 'Rock' },
  paper: { icon: 'fa-hand', beats: 'rock', label: 'Paper' },
  scissors: { icon: 'fa-hand-scissors', beats: 'paper', label: 'Scissors' }
};

// DOM References
const lobbyScreen = document.getElementById('lobbyScreen');
const playerNameInput = document.getElementById('playerNameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');
const lobbyError = document.getElementById('lobbyError');

const activeRoomCode = document.getElementById('activeRoomCode');
const player1Name = document.getElementById('player1Name');
const player2Name = document.getElementById('player2Name');
const player1Score = document.getElementById('player1Score');
const player2Score = document.getElementById('player2Score');
const player1Pips = document.getElementById('player1Pips');
const player2Pips = document.getElementById('player2Pips');
const roomStatusText = document.getElementById('roomStatusText');

const myHand = document.getElementById('myHand');
const opponentHand = document.getElementById('opponentHand');
const myStatusTag = document.getElementById('myStatusTag');
const opponentStatusTag = document.getElementById('opponentStatusTag');

const resultBanner = document.getElementById('resultBanner');
const resultTitle = document.getElementById('resultTitle');
const resultSubtitle = document.getElementById('resultSubtitle');
const choiceButtons = document.querySelectorAll('.choice-btn');
const soundToggle = document.getElementById('soundToggle');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

const matchModal = document.getElementById('matchModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalIcon = document.getElementById('modalIcon');
const modalPlayAgain = document.getElementById('modalPlayAgain');
const currentYear = document.getElementById('currentYear');

currentYear.textContent = new Date().getFullYear();

/* =========================================================
   SYNTHESIZED AUDIO FX (Web Audio API)
   ========================================================= */
const AudioEngine = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  },
  playTone(freq, type, duration, gainVal = 0.1) {
    if (!soundEnabled) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },
  click() { this.playTone(400, 'sine', 0.06, 0.05); },
  clash() { this.playTone(180, 'triangle', 0.12, 0.08); },
  win() {
    setTimeout(() => this.playTone(523.25, 'sine', 0.15), 0);
    setTimeout(() => this.playTone(659.25, 'sine', 0.15), 100);
    setTimeout(() => this.playTone(783.99, 'sine', 0.25), 200);
  },
  lose() {
    setTimeout(() => this.playTone(329.63, 'sawtooth', 0.15, 0.08), 0);
    setTimeout(() => this.playTone(261.63, 'sawtooth', 0.25, 0.08), 120);
  },
  tie() { this.playTone(320, 'square', 0.15, 0.04); }
};

/* =========================================================
   CANVAS PARTICLES (Confetti)
   ========================================================= */
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function triggerConfetti() {
  particles = [];
  const colors = ['#00f0ff', '#ff2a85', '#ffd60a', '#05ffa1', '#9d4edd'];
  for (let i = 0; i < 70; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 16,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: Math.random() * 0.02 + 0.015
    });
  }
}

function renderParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach((p, idx) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.35;
    p.alpha -= p.decay;

    if (p.alpha <= 0) {
      particles.splice(idx, 1);
    } else {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
  requestAnimationFrame(renderParticles);
}
renderParticles();

/* =========================================================
   WEBRTC PEER-TO-PEER ENGINE
   ========================================================= */

// Create Room (Host)
createBtn.addEventListener('click', () => {
  myName = playerNameInput.value.trim() || 'Host';
  player1Name.textContent = myName.toUpperCase();
  lobbyError.textContent = 'Generating room...';

  // 4-digit readable room code
  const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  const fullPeerId = `rps-duel-${roomCode}`;

  peer = new Peer(fullPeerId);

  peer.on('open', () => {
    lobbyScreen.classList.add('hidden');
    activeRoomCode.textContent = `ROOM: ${roomCode}`;
    roomStatusText.textContent = `Share code "${roomCode}" with friend`;
    opponentStatusTag.textContent = 'Waiting for friend...';
    enableInputs(false);
  });

  peer.on('connection', (conn) => {
    connection = conn;
    setupConnectionListeners();
  });

  peer.on('error', (err) => {
    console.error(err);
    if (err.type === 'unavailable-id') {
      lobbyError.textContent = 'Room busy, tap Create Room again.';
    } else {
      lobbyError.textContent = 'Connection error. Retrying...';
    }
  });
});

// Join Room (Guest)
joinBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  myName = playerNameInput.value.trim() || 'Challenger';

  if (!code) {
    lobbyError.textContent = 'Please enter a 4-digit room code!';
    return;
  }

  lobbyError.textContent = 'Connecting to room...';
  player1Name.textContent = myName.toUpperCase();

  peer = new Peer(); // Random ID for joiner

  peer.on('open', () => {
    const targetPeerId = `rps-duel-${code}`;
    connection = peer.connect(targetPeerId, { reliable: true });

    connection.on('open', () => {
      lobbyScreen.classList.add('hidden');
      activeRoomCode.textContent = `ROOM: ${code}`;
      setupConnectionListeners();
      // Introduce name to host
      connection.send({ type: 'handshake', name: myName });
    });

    connection.on('error', () => {
      lobbyError.textContent = 'Failed to find room. Check code!';
    });
  });

  peer.on('error', (err) => {
    lobbyError.textContent = 'Room not found or expired.';
  });
});

function setupConnectionListeners() {
  roomStatusText.textContent = 'Opponent Connected!';
  opponentStatusTag.textContent = 'Ready';
  enableInputs(true);

  // Send handshake if host
  connection.send({ type: 'handshake', name: myName });

  connection.on('data', (data) => {
    if (data.type === 'handshake') {
      opponentName = data.name || 'Opponent';
      player2Name.textContent = opponentName.toUpperCase();
    } else if (data.type === 'locked') {
      opponentStatusTag.textContent = 'Locked move!';
    } else if (data.type === 'move') {
      oppMove = data.choice;
      checkRoundCompletion();
    } else if (data.type === 'restart') {
      resetWholeMatch();
    }
  });

  connection.on('close', () => {
    roomStatusText.textContent = 'Opponent disconnected.';
    opponentStatusTag.textContent = 'Left room';
    enableInputs(false);
  });
}

function checkRoundCompletion() {
  if (myMove && oppMove) {
    executeClashAnimation(myMove, oppMove);
  }
}

function executeClashAnimation(p1Choice, p2Choice) {
  enableInputs(false);

  myHand.innerHTML = `<i class="fas fa-fist-raised"></i>`;
  opponentHand.innerHTML = `<i class="fas fa-fist-raised"></i>`;
  myHand.classList.add('shake-player');
  opponentHand.classList.add('shake-bot');

  resultBanner.className = 'result-banner';
  resultTitle.textContent = 'DUEL CLASH...';
  resultSubtitle.textContent = 'Revealing selections...';
  AudioEngine.clash();

  setTimeout(() => {
    myHand.classList.remove('shake-player');
    opponentHand.classList.remove('shake-bot');

    myHand.innerHTML = `<i class="fas ${weapons[p1Choice].icon}"></i>`;
    opponentHand.innerHTML = `<i class="fas ${weapons[p2Choice].icon}"></i>`;

    if (p1Choice === p2Choice) {
      resultBanner.className = 'result-banner tie';
      resultTitle.textContent = 'STANDOFF TIE!';
      resultSubtitle.textContent = `Both selected ${weapons[p1Choice].label}!`;
      AudioEngine.tie();
    } else if (weapons[p1Choice].beats === p2Choice) {
      myScore++;
      resultBanner.className = 'result-banner win';
      resultTitle.textContent = 'ROUND VICTORY!';
      resultSubtitle.textContent = `${weapons[p1Choice].label} defeats ${weapons[p2Choice].label}!`;
      AudioEngine.win();
      triggerConfetti();
    } else {
      oppScore++;
      resultBanner.className = 'result-banner lose';
      resultTitle.textContent = 'ROUND DEFEAT!';
      resultSubtitle.textContent = `${weapons[p2Choice].label} beats ${weapons[p1Choice].label}!`;
      AudioEngine.lose();
    }

    player1Score.textContent = myScore;
    player2Score.textContent = oppScore;
    updatePips();

    if (myScore >= 3 || oppScore >= 3) {
      setTimeout(() => {
        showMatchWinner(myScore >= 3);
      }, 1000);
    } else {
      setTimeout(() => {
        resetTurn();
        enableInputs(true);
      }, 2500);
    }
  }, 900);
}

function showMatchWinner(didIWin) {
  modalTitle.textContent = didIWin ? 'SERIES VICTORY!' : 'SERIES DEFEAT!';
  modalDesc.textContent = didIWin 
    ? `Spectacular moves! You defeated ${opponentName} in Best of 5!`
    : `${opponentName} took the victory this series. Challenge them again!`;

  modalIcon.innerHTML = didIWin 
    ? '<i class="fas fa-trophy" style="color: #05ffa1"></i>' 
    : '<i class="fas fa-skull" style="color: #ff3366"></i>';

  if (didIWin) triggerConfetti();
  matchModal.classList.add('active');
}

function updatePips() {
  renderPips(player1Pips, myScore, 3);
  renderPips(player2Pips, oppScore, 3);
}

function renderPips(container, score, max) {
  container.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const pip = document.createElement('div');
    pip.className = `pip ${i < score ? 'filled' : ''}`;
    container.appendChild(pip);
  }
}

function enableInputs(enable) {
  choiceButtons.forEach(btn => {
    btn.disabled = !enable;
    if (enable) btn.classList.remove('selected');
  });
}

function resetTurn() {
  myMove = null;
  oppMove = null;
  isLocked = false;
  myHand.innerHTML = `<i class="fas fa-fist-raised"></i>`;
  opponentHand.innerHTML = `<i class="fas fa-fist-raised"></i>`;
  myStatusTag.textContent = 'Your Move';
  opponentStatusTag.textContent = connection ? 'Ready' : 'Waiting...';
  resultBanner.className = 'result-banner';
  resultTitle.textContent = 'LOCK YOUR CHOICE';
  resultSubtitle.textContent = 'Tap an action below to strike';
}

function resetWholeMatch() {
  myScore = 0;
  oppScore = 0;
  player1Score.textContent = '0';
  player2Score.textContent = '0';
  updatePips();
  resetTurn();
  matchModal.classList.remove('active');
  enableInputs(true);
}

/* =========================================================
   USER ACTIONS
   ========================================================= */

choiceButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (isLocked || !connection) return;
    isLocked = true;
    myMove = btn.getAttribute('data-choice');
    btn.classList.add('selected');
    myStatusTag.textContent = 'Locked!';
    choiceButtons.forEach(b => b.disabled = true);
    AudioEngine.click();

    // Send signals over P2P DataChannel
    connection.send({ type: 'locked' });
    connection.send({ type: 'move', choice: myMove });

    checkRoundCompletion();
  });
});

modalPlayAgain.addEventListener('click', () => {
  if (connection) {
    connection.send({ type: 'restart' });
  }
  resetWholeMatch();
});

leaveRoomBtn.addEventListener('click', () => {
  window.location.reload();
});

soundToggle.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.innerHTML = soundEnabled 
    ? '<i class="fas fa-volume-up"></i>' 
    : '<i class="fas fa-volume-xmark"></i>';
});