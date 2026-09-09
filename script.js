/* =========================================================
   CLEAN PEER-TO-PEER RPS & HAND CRICKET CONTROLLER
   ========================================================= */

let peer = null;
let conn = null;
let myName = '';
let oppName = 'Opponent';
let gameMode = 'rps'; // 'rps' or 'cricket'
let isHost = false;
let isLocked = false;
let soundOn = true;

// RPS Series State
let rpsScoreMe = 0;
let rpsScoreOpp = 0;

// Hand Cricket Match State
let cricketState = {
  innings: 1,           // 1: Setting target, 2: Chasing target
  battingPlayerId: null,// 'me' or 'opp'
  target: 0,
  runs: 0,
  wickets: 0
};

// Hand Cricket Toss State (Odd/Even via 1-6)
let tossState = {
  active: false,
  format: 'single',     // 'single' (Default) or 'bo3'
  hostCall: 'odd',      // 'odd' or 'even'
  hostWins: 0,
  joinerWins: 0,
  round: 1,
  winnerId: null        // 'me' or 'opp'
};

let myCurrentChoice = null;
let oppCurrentChoice = null;

// Element References
const toastContainer = document.getElementById('toastContainer');
const lobbyScreen = document.getElementById('lobbyScreen');
const modeButtons = document.querySelectorAll('.mode-btn');
const playerNameInput = document.getElementById('playerNameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const lobbyError = document.getElementById('lobbyError');

const roomBadge = document.getElementById('roomBadge');
const roomCodeLabel = document.getElementById('roomCodeLabel');
const roundStatusText = document.getElementById('roundStatusText');
const p1Card = document.getElementById('p1Card');
const p2Card = document.getElementById('p2Card');
const p1NameLabel = document.getElementById('p1NameLabel');
const p2NameLabel = document.getElementById('p2NameLabel');
const p1Score = document.getElementById('p1Score');
const p2Score = document.getElementById('p2Score');

const rpsBoard = document.getElementById('rpsBoard');
const cricketBoard = document.getElementById('cricketBoard');
const rpsDeck = document.getElementById('rpsDeck');
const cricketDeck = document.getElementById('cricketDeck');
const gameTypeBadge = document.getElementById('gameTypeBadge');

const myCricketRole = document.getElementById('myCricketRole');
const cricketRuns = document.getElementById('cricketRuns');
const cricketWickets = document.getElementById('cricketWickets');
const targetScoreDisplay = document.getElementById('targetScoreDisplay');
const cricketMetaMessage = document.getElementById('cricketMetaMessage');

const myDisplay = document.getElementById('myDisplay');
const oppDisplay = document.getElementById('oppDisplay');
const myActionState = document.getElementById('myActionState');
const oppActionState = document.getElementById('oppActionState');

const promptBar = document.getElementById('promptBar');
const promptTitle = document.getElementById('promptTitle');
const promptSub = document.getElementById('promptSub');

const soundBtn = document.getElementById('soundBtn');
const exitBtn = document.getElementById('exitBtn');

// Toss Modals & Controls
const tossSetupModal = document.getElementById('tossSetupModal');
const hostTossControls = document.getElementById('hostTossControls');
const joinerTossWait = document.getElementById('joinerTossWait');
const tossTypeDefaultBtn = document.getElementById('tossTypeDefaultBtn');
const tossTypeBo3Btn = document.getElementById('tossTypeBo3Btn');
const callOddBtn = document.getElementById('callOddBtn');
const callEvenBtn = document.getElementById('callEvenBtn');
const startTossBtn = document.getElementById('startTossBtn');

const tossDecisionModal = document.getElementById('tossDecisionModal');
const tossWinnerHeading = document.getElementById('tossWinnerHeading');
const tossWinnerDesc = document.getElementById('tossWinnerDesc');
const tossDecisionBtns = document.getElementById('tossDecisionBtns');
const tossDecisionWait = document.getElementById('tossDecisionWait');
const chooseBatBtn = document.getElementById('chooseBatBtn');
const chooseBowlBtn = document.getElementById('chooseBowlBtn');

// Match & Innings Modals
const inningsModal = document.getElementById('inningsModal');
const inningsTitle = document.getElementById('inningsTitle');
const inningsDesc = document.getElementById('inningsDesc');
const inningsOkBtn = document.getElementById('inningsOkBtn');

const endModal = document.getElementById('endModal');
const modalBadgeIcon = document.getElementById('modalBadgeIcon');
const modalWinnerHeading = document.getElementById('modalWinnerHeading');
const modalWinnerDesc = document.getElementById('modalWinnerDesc');
const modalResetBtn = document.getElementById('modalResetBtn');
const yearEl = document.getElementById('yearEl');

yearEl.textContent = new Date().getFullYear();

/* =========================================================
   FLOATING MINI TOAST ALERT SYSTEM (Auto-dismiss in 3s)
   ========================================================= */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;

  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'warning') iconClass = 'fa-triangle-exclamation';
  if (type === 'danger') iconClass = 'fa-circle-xmark';

  toast.innerHTML = `
    <i class="fas ${iconClass} toast-icon"></i>
    <span class="toast-msg">${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 2800);
}

/* =========================================================
   SYNTHESIZED AUDIO
   ========================================================= */
const AudioFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
  },
  play(freq, type = 'sine', dur = 0.1) {
    if (!soundOn) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  },
  tap() { this.play(400, 'sine', 0.05); },
  win() {
    setTimeout(() => this.play(523, 'sine', 0.12), 0);
    setTimeout(() => this.play(659, 'sine', 0.12), 100);
    setTimeout(() => this.play(783, 'sine', 0.2), 200);
  },
  out() {
    setTimeout(() => this.play(260, 'sawtooth', 0.2), 0);
    setTimeout(() => this.play(180, 'sawtooth', 0.3), 150);
  }
};

/* =========================================================
   CANVAS PARTICLES
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

function blastConfetti() {
  particles = [];
  const palette = ['#00f0ff', '#ff2a85', '#ffd60a', '#05ffa1'];
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.7) * 14,
      size: Math.random() * 5 + 3,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 1,
      decay: Math.random() * 0.02 + 0.02
    });
  }
}

function renderParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach((p, idx) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.3;
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
   LOBBY / MODE SWITCHING
   ========================================================= */
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameMode = btn.getAttribute('data-game');
  });
});

function setGameMode(targetMode) {
  gameMode = targetMode;
  modeButtons.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-game') === targetMode);
  });
}

function applyGameModeUI() {
  if (gameMode === 'cricket') {
    rpsBoard.style.display = 'none';
    rpsDeck.style.display = 'none';
    cricketBoard.style.display = 'flex';
    cricketDeck.style.display = 'grid';
    gameTypeBadge.textContent = 'CRICKET';
    myDisplay.innerHTML = `<i class="fas fa-baseball-bat-ball"></i>`;
    oppDisplay.innerHTML = `<i class="fas fa-baseball-bat-ball"></i>`;
  } else {
    rpsBoard.style.display = 'grid';
    rpsDeck.style.display = 'grid';
    cricketBoard.style.display = 'none';
    cricketDeck.style.display = 'none';
    gameTypeBadge.textContent = 'RPS';
    myDisplay.innerHTML = `<i class="fas fa-hand-back-fist"></i>`;
    oppDisplay.innerHTML = `<i class="fas fa-hand-back-fist"></i>`;
  }
}

roomCodeInput.addEventListener('input', () => {
  const val = roomCodeInput.value.trim().toUpperCase();
  if (val.startsWith('CRIC-')) {
    setGameMode('cricket');
  } else if (val.startsWith('RPS-')) {
    setGameMode('rps');
  }
});

/* =========================================================
   P2P PEER CONNECTIONS & VALIDATION
   ========================================================= */
function validateName() {
  const entered = playerNameInput.value.trim();
  if (!entered) {
    playerNameInput.classList.add('input-error');
    lobbyError.textContent = 'Please enter your name to proceed!';
    playerNameInput.focus();
    return null;
  }
  playerNameInput.classList.remove('input-error');
  lobbyError.textContent = '';
  return entered;
}

createBtn.addEventListener('click', () => {
  const validName = validateName();
  if (!validName) return;

  isHost = true;
  myName = validName;
  p1NameLabel.textContent = myName.toUpperCase();
  lobbyError.textContent = 'Creating room...';

  const prefix = gameMode === 'cricket' ? 'CRIC' : 'RPS';
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const roomKey = `${prefix}-${rand}`;

  peer = new Peer(`duel-${roomKey}`);

  peer.on('open', () => {
    roomCodeLabel.textContent = `ROOM: ${roomKey}`;
    lobbyScreen.classList.add('hidden');
    roundStatusText.textContent = 'Waiting for opponent...';
    applyGameModeUI();
    highlightTurn();
    disableButtons(true);
    showToast(`Room ${roomKey} created! Share code with friend.`, 'success');
  });

  peer.on('connection', c => {
    conn = c;
    setupConnEvents();
  });

  peer.on('error', () => {
    lobbyError.textContent = 'Room error. Tap create again.';
    showToast('Room creation failed. Please try again.', 'danger');
  });
});

joinBtn.addEventListener('click', () => {
  const validName = validateName();
  if (!validName) return;

  const rawCode = roomCodeInput.value.trim().toUpperCase();
  if (!rawCode) {
    lobbyError.textContent = 'Please enter room code!';
    return;
  }

  if (rawCode.startsWith('CRIC-')) {
    setGameMode('cricket');
  } else if (rawCode.startsWith('RPS-')) {
    setGameMode('rps');
  }

  isHost = false;
  myName = validName;
  p1NameLabel.textContent = myName.toUpperCase();
  lobbyError.textContent = 'Connecting...';

  peer = new Peer();

  peer.on('open', () => {
    conn = peer.connect(`duel-${rawCode}`);
    conn.on('open', () => {
      roomCodeLabel.textContent = `ROOM: ${rawCode}`;
      applyGameModeUI();
      lobbyScreen.classList.add('hidden');
      setupConnEvents();
      conn.send({ type: 'handshake', name: myName });
      showToast(`Connected to room ${rawCode}!`, 'success');
    });
    conn.on('error', () => {
      lobbyError.textContent = 'Room not found! Check code.';
      showToast('Could not find room. Check code.', 'danger');
    });
  });

  peer.on('error', () => {
    lobbyError.textContent = 'Unable to connect to room.';
    showToast('Connection failed.', 'danger');
  });
});

function setupConnEvents() {
  roundStatusText.textContent = 'Opponent connected!';
  oppActionState.textContent = 'Ready';
  disableButtons(false);
  showToast(`${oppName} connected!`, 'success');

  if (isHost) {
    conn.send({ type: 'init_sync', mode: gameMode, hostName: myName });
    if (gameMode === 'cricket') {
      openTossSetupModal();
    }
  }

  highlightTurn();

  conn.on('data', data => {
    if (data.type === 'handshake') {
      oppName = data.name || 'Opponent';
      p2NameLabel.textContent = oppName.toUpperCase();
      showToast(`${oppName} joined the match!`, 'info');
    } else if (data.type === 'init_sync') {
      gameMode = data.mode;
      oppName = data.hostName || 'Host';
      p2NameLabel.textContent = oppName.toUpperCase();
      applyGameModeUI();
      if (gameMode === 'cricket') {
        openTossSetupModal();
      }
      highlightTurn();
    } else if (data.type === 'toss_start') {
      tossState.active = true;
      tossState.format = data.format;
      tossState.hostCall = data.hostCall;
      tossState.hostWins = 0;
      tossState.joinerWins = 0;
      tossState.round = 1;
      tossSetupModal.classList.remove('open');
      showToast(`Toss started! Host called ${data.hostCall.toUpperCase()}`, 'warning');
      promptTossMove();
    } else if (data.type === 'toss_decision_open') {
      handleTossDecisionOpen(data.winnerIsHost);
    } else if (data.type === 'toss_role_decided') {
      applyTossDecision(data.hostRole);
    } else if (data.type === 'locked') {
      oppActionState.textContent = 'Locked!';
      showToast(`${oppName} locked their move!`, 'info');
    } else if (data.type === 'move') {
      oppCurrentChoice = data.choice;
      checkTurnCompletion();
    } else if (data.type === 'start_innings_2') {
      startSecondInnings();
    } else if (data.type === 'reset') {
      resetMatchStates();
    }
  });

  conn.on('close', () => {
    roundStatusText.textContent = 'Opponent left.';
    oppActionState.textContent = 'Disconnected';
    disableButtons(true);
    showToast('Opponent disconnected from arena.', 'danger');
  });
}

/* =========================================================
   TOSS SYSTEM (HAND CRICKET ODD/EVEN VIA 1-6)
   ========================================================= */
function openTossSetupModal() {
  tossSetupModal.classList.add('open');
  if (isHost) {
    hostTossControls.style.display = 'block';
    joinerTossWait.style.display = 'none';
  } else {
    hostTossControls.style.display = 'none';
    joinerTossWait.style.display = 'block';
  }
}

// Format selection buttons
tossTypeDefaultBtn.addEventListener('click', () => {
  tossTypeDefaultBtn.classList.add('active');
  tossTypeBo3Btn.classList.remove('active');
  tossState.format = 'single';
  showToast('Toss format: 1-Round Default', 'info');
});
tossTypeBo3Btn.addEventListener('click', () => {
  tossTypeBo3Btn.classList.add('active');
  tossTypeDefaultBtn.classList.remove('active');
  tossState.format = 'bo3';
  showToast('Toss format: Best of 3', 'info');
});

// Call selection buttons
callOddBtn.addEventListener('click', () => {
  callOddBtn.classList.add('active');
  callEvenBtn.classList.remove('active');
  tossState.hostCall = 'odd';
  showToast('Host call: ODD', 'info');
});
callEvenBtn.addEventListener('click', () => {
  callEvenBtn.classList.add('active');
  callOddBtn.classList.remove('active');
  tossState.hostCall = 'even';
  showToast('Host call: EVEN', 'info');
});

// Host triggers Toss Duel
startTossBtn.addEventListener('click', () => {
  tossState.active = true;
  tossState.hostWins = 0;
  tossState.joinerWins = 0;
  tossState.round = 1;

  conn.send({
    type: 'toss_start',
    format: tossState.format,
    hostCall: tossState.hostCall
  });

  tossSetupModal.classList.remove('open');
  showToast(`Toss live! Pick your hand number (1-6).`, 'warning');
  promptTossMove();
});

function promptTossMove() {
  promptBar.className = 'prompt-bar';
  const formatText = tossState.format === 'bo3' ? `(Best of 3 - Duel ${tossState.round})` : '(Default)';
  promptTitle.textContent = `TOSS: PICK 1-6 ${formatText}`;
  const hostCallText = tossState.hostCall.toUpperCase();
  const guestCallText = tossState.hostCall === 'odd' ? 'EVEN' : 'ODD';
  promptSub.textContent = isHost ? `Your Call: ${hostCallText}` : `Host Call: ${hostCallText} | Your Call: ${guestCallText}`;
  myCricketRole.textContent = 'TOSS';
  cricketMetaMessage.textContent = `Throw hand 1-6. Sum determines Odd/Even!`;
  resetTurnUI();
}

function evaluateTossDuel() {
  const p1 = parseInt(myCurrentChoice, 10);
  const p2 = parseInt(oppCurrentChoice, 10);
  const sum = p1 + p2;
  const isOdd = sum % 2 !== 0;
  const outcomeString = isOdd ? 'odd' : 'even';

  myDisplay.innerHTML = `<span style="font-family:var(--font-title);font-size:2rem;font-weight:900">${p1}</span>`;
  oppDisplay.innerHTML = `<span style="font-family:var(--font-title);font-size:2rem;font-weight:900">${p2}</span>`;

  // Check winner of this toss round
  const hostWonThis = outcomeString === tossState.hostCall;
  if (hostWonThis) {
    tossState.hostWins++;
  } else {
    tossState.joinerWins++;
  }

  AudioFX.tap();
  promptBar.className = 'prompt-bar win';
  promptTitle.textContent = `SUM = ${sum} (${outcomeString.toUpperCase()})`;
  const roundWinnerName = hostWonThis ? (isHost ? 'You' : oppName) : (isHost ? oppName : 'You');
  promptSub.textContent = `${roundWinnerName} won this toss round!`;
  showToast(`Toss sum is ${sum} (${outcomeString.toUpperCase()})!`, 'info');

  if (tossState.format === 'single') {
    concludeToss(hostWonThis);
  } else {
    // Best of 3
    if (tossState.hostWins >= 2 || tossState.joinerWins >= 2) {
      concludeToss(tossState.hostWins >= 2);
    } else {
      tossState.round++;
      showToast(`Next toss round loading...`, 'info');
      setTimeout(promptTossMove, 1800);
    }
  }
}

function concludeToss(winnerIsHost) {
  tossState.active = false;
  setTimeout(() => {
    if (isHost) {
      conn.send({ type: 'toss_decision_open', winnerIsHost });
    }
    handleTossDecisionOpen(winnerIsHost);
  }, 1200);
}

function handleTossDecisionOpen(winnerIsHost) {
  tossDecisionModal.classList.add('open');
  const iAmWinner = isHost ? winnerIsHost : !winnerIsHost;

  if (iAmWinner) {
    tossWinnerHeading.textContent = 'YOU WON THE TOSS!';
    tossWinnerDesc.textContent = 'Choose whether to Bat or Bowl first:';
    tossDecisionBtns.style.display = 'grid';
    tossDecisionWait.style.display = 'none';
    showToast('You won the toss! Pick Bat or Bowl.', 'success');
  } else {
    tossWinnerHeading.textContent = `${oppName.toUpperCase()} WON THE TOSS!`;
    tossWinnerDesc.textContent = 'Waiting for their choice to Bat or Bowl...';
    tossDecisionBtns.style.display = 'none';
    tossDecisionWait.style.display = 'block';
    showToast(`${oppName} won the toss. Awaiting decision...`, 'warning');
  }
}

chooseBatBtn.addEventListener('click', () => {
  const hostRole = isHost ? 'bat' : 'bowl';
  conn.send({ type: 'toss_role_decided', hostRole });
  applyTossDecision(hostRole);
  showToast('You elected to BAT first!', 'success');
});

chooseBowlBtn.addEventListener('click', () => {
  const hostRole = isHost ? 'bowl' : 'bat';
  conn.send({ type: 'toss_role_decided', hostRole });
  applyTossDecision(hostRole);
  showToast('You elected to BOWL first!', 'success');
});

function applyTossDecision(hostRole) {
  tossDecisionModal.classList.remove('open');
  const hostBats = hostRole === 'bat';
  cricketState.battingPlayerId = hostBats ? (isHost ? 'me' : 'opp') : (isHost ? 'opp' : 'me');

  blastConfetti();
  syncCricketRoles();
  resetTurnUI();
}

/* =========================================================
   TURN HIGHLIGHTING LOGIC
   ========================================================= */
function highlightTurn() {
  if (gameMode === 'cricket') {
    if (tossState.active) {
      p1Card.classList.toggle('turn-active', !isLocked);
      p2Card.classList.toggle('turn-active', oppActionState.textContent !== 'Locked!');
    } else {
      const amIBatting = cricketState.battingPlayerId === 'me';
      p1Card.classList.toggle('turn-active', amIBatting);
      p2Card.classList.toggle('turn-active', !amIBatting);
    }
  } else {
    p1Card.classList.toggle('turn-active', !isLocked);
    p2Card.classList.toggle('turn-active', oppActionState.textContent !== 'Locked!');
  }
}

/* =========================================================
   TURN EVALUATION ENGINE
   ========================================================= */
function checkTurnCompletion() {
  if (myCurrentChoice !== null && oppCurrentChoice !== null) {
    disableButtons(true);
    myDisplay.classList.add('shaking');
    oppDisplay.classList.add('shaking');

    setTimeout(() => {
      myDisplay.classList.remove('shaking');
      oppDisplay.classList.remove('shaking');

      if (gameMode === 'rps') {
        evaluateRPS();
      } else if (tossState.active) {
        evaluateTossDuel();
      } else {
        evaluateCricket();
      }
    }, 700);
  }
}

/* =========================================================
   ROCK PAPER SCISSORS LOGIC
   ========================================================= */
const rpsIcons = {
  rock: 'fa-hand-back-fist',
  paper: 'fa-hand',
  scissors: 'fa-hand-scissors'
};

function evaluateRPS() {
  myDisplay.innerHTML = `<i class="fas ${rpsIcons[myCurrentChoice]}"></i>`;
  oppDisplay.innerHTML = `<i class="fas ${rpsIcons[oppCurrentChoice]}"></i>`;

  const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

  if (myCurrentChoice === oppCurrentChoice) {
    promptBar.className = 'prompt-bar';
    promptTitle.textContent = 'STANDOFF!';
    promptSub.textContent = 'Both chose identical hands.';
    showToast('Standoff! Identical hands.', 'warning');
  } else if (beats[myCurrentChoice] === oppCurrentChoice) {
    rpsScoreMe++;
    promptBar.className = 'prompt-bar win';
    promptTitle.textContent = 'ROUND WON!';
    promptSub.textContent = `${myCurrentChoice.toUpperCase()} beats ${oppCurrentChoice.toUpperCase()}`;
    AudioFX.win();
    blastConfetti();
    showToast(`You won the round!`, 'success');
  } else {
    rpsScoreOpp++;
    promptBar.className = 'prompt-bar lose';
    promptTitle.textContent = 'ROUND LOST!';
    promptSub.textContent = `${oppCurrentChoice.toUpperCase()} counters ${myCurrentChoice.toUpperCase()}`;
    showToast(`${oppName} won the round!`, 'danger');
  }

  p1Score.textContent = rpsScoreMe;
  p2Score.textContent = rpsScoreOpp;

  if (rpsScoreMe >= 3 || rpsScoreOpp >= 3) {
    setTimeout(() => {
      showEndModal(rpsScoreMe >= 3, `Best of 5 Series ended ${rpsScoreMe} - ${rpsScoreOpp}!`);
    }, 800);
  } else {
    setTimeout(resetTurnUI, 1800);
  }
}

/* =========================================================
   HAND CRICKET (1-6) REAL-TIME ENGINE
   ========================================================= */
function syncCricketRoles() {
  const amIBatting = cricketState.battingPlayerId === 'me';
  myCricketRole.textContent = amIBatting ? 'BATSMAN' : 'BOWLER';
  myCricketRole.style.color = amIBatting ? 'var(--accent-green)' : 'var(--accent-cyan)';
  myCricketRole.style.borderColor = amIBatting ? 'var(--accent-green)' : 'var(--accent-cyan)';

  if (cricketState.innings === 1) {
    targetScoreDisplay.textContent = '--';
    cricketMetaMessage.textContent = amIBatting
      ? `1st Innings: ${myName}, score as many as you can!`
      : `1st Innings: ${oppName} is batting, take the wicket!`;
  } else {
    targetScoreDisplay.textContent = cricketState.target;
    const needed = cricketState.target - cricketState.runs;
    cricketMetaMessage.textContent = amIBatting
      ? `2nd Innings: Need ${needed} runs to win!`
      : `2nd Innings: Defend ${cricketState.target} runs!`;
  }
  highlightTurn();
}

function evaluateCricket() {
  const myPick = parseInt(myCurrentChoice, 10);
  const oppPick = parseInt(oppCurrentChoice, 10);

  myDisplay.innerHTML = `<span style="font-family:var(--font-title);font-size:2rem;font-weight:900">${myPick}</span>`;
  oppDisplay.innerHTML = `<span style="font-family:var(--font-title);font-size:2rem;font-weight:900">${oppPick}</span>`;

  const amIBatting = cricketState.battingPlayerId === 'me';
  const batsmansRun = amIBatting ? myPick : oppPick;

  // WICKET OCCURS
  if (myPick === oppPick) {
    AudioFX.out();
    promptBar.className = 'prompt-bar out';
    promptTitle.textContent = 'WICKET! OUT!';
    promptSub.textContent = `Both threw ${myPick}!`;
    cricketWickets.textContent = '/1';
    showToast(`WICKET! Both threw ${myPick}!`, 'danger');

    if (cricketState.innings === 1) {
      const targetScore = cricketState.runs + 1;
      setTimeout(() => {
        inningsTitle.textContent = "WICKET! 1ST INNINGS OVER";
        inningsDesc.innerHTML = `Batsman dismissed on <strong>${cricketState.runs}</strong>.<br/>Target to win is <strong>${targetScore}</strong> runs!`;
        inningsModal.classList.add('open');
      }, 1000);
    } else {
      const bowlerWon = !amIBatting;
      setTimeout(() => {
        showEndModal(bowlerWon, bowlerWon
          ? `Target defended! Opponent fell short by ${cricketState.target - cricketState.runs} runs.`
          : `Bowled out! Needed ${cricketState.target - cricketState.runs} more runs.`);
      }, 1000);
    }
  } else {
    cricketState.runs += batsmansRun;
    cricketRuns.textContent = cricketState.runs;
    AudioFX.tap();

    promptBar.className = 'prompt-bar win';
    promptTitle.textContent = `+${batsmansRun} RUNS!`;
    promptSub.textContent = amIBatting ? 'Great shot!' : 'Batsman scored.';
    showToast(`+${batsmansRun} runs scored!`, 'info');

    if (cricketState.innings === 2) {
      const needed = cricketState.target - cricketState.runs;
      if (cricketState.runs >= cricketState.target) {
        const chaserWon = amIBatting;
        setTimeout(() => {
          showEndModal(chaserWon, chaserWon
            ? `Target reached! Sensational run-chase victory!`
            : `Opponent chased down the target of ${cricketState.target}!`);
        }, 800);
        return;
      } else {
        cricketMetaMessage.textContent = amIBatting
          ? `Need ${needed} runs to win!`
          : `Defend ${needed} more runs!`;
      }
    }
    setTimeout(resetTurnUI, 1600);
  }
}

function startSecondInnings() {
  inningsModal.classList.remove('open');
  cricketState.innings = 2;
  cricketState.target = cricketState.runs + 1;
  cricketState.runs = 0;
  cricketState.wickets = 0;
  // Swap roles
  cricketState.battingPlayerId = (cricketState.battingPlayerId === 'me') ? 'opp' : 'me';

  cricketRuns.textContent = '0';
  cricketWickets.textContent = '/0';
  syncCricketRoles();
  resetTurnUI();
  showToast('2nd Innings begins! Chase is on.', 'warning');
}

/* =========================================================
   UI HELPERS & BUTTONS
   ========================================================= */
function disableButtons(status) {
  document.querySelectorAll('.choice-tile').forEach(b => {
    b.disabled = status;
    if (!status) b.classList.remove('active-pick');
  });
}

function resetTurnUI() {
  myCurrentChoice = null;
  oppCurrentChoice = null;
  isLocked = false;
  myActionState.textContent = 'Your Move';
  oppActionState.textContent = 'Ready';

  if (!tossState.active) {
    promptBar.className = 'prompt-bar';
    promptTitle.textContent = 'MAKE YOUR MOVE';
    promptSub.textContent = 'Tap an option below';
  }

  if (gameMode === 'rps') {
    myDisplay.innerHTML = `<i class="fas fa-hand-back-fist"></i>`;
    oppDisplay.innerHTML = `<i class="fas fa-hand-back-fist"></i>`;
  } else {
    myDisplay.innerHTML = `<i class="fas fa-baseball-bat-ball"></i>`;
    oppDisplay.innerHTML = `<i class="fas fa-baseball-bat-ball"></i>`;
  }
  disableButtons(false);
  highlightTurn();
}

function showEndModal(isMeWinner, desc) {
  modalWinnerHeading.textContent = isMeWinner ? 'VICTORY!' : 'DEFEAT!';
  modalWinnerHeading.style.color = isMeWinner ? 'var(--accent-green)' : 'var(--accent-red)';
  modalWinnerDesc.textContent = desc;
  modalBadgeIcon.innerHTML = isMeWinner ? '<i class="fas fa-trophy"></i>' : '<i class="fas fa-skull"></i>';
  if (isMeWinner) blastConfetti();
  endModal.classList.add('open');
}

/* =========================================================
   COMPLETE CLEAN STATE RESET (Eliminates Replay Glitches)
   ========================================================= */
function resetMatchStates() {
  // Wipe RPS series
  rpsScoreMe = 0;
  rpsScoreOpp = 0;
  p1Score.textContent = '0';
  p2Score.textContent = '0';

  // Wipe Hand Cricket completely
  cricketState = {
    innings: 1,
    battingPlayerId: null,
    target: 0,
    runs: 0,
    wickets: 0
  };
  cricketRuns.textContent = '0';
  cricketWickets.textContent = '/0';
  targetScoreDisplay.textContent = '--';
  myCricketRole.textContent = 'TOSS';
  cricketMetaMessage.textContent = 'Waiting for toss to initiate...';

  // Wipe Toss
  tossState = {
    active: false,
    format: 'single',
    hostCall: 'odd',
    hostWins: 0,
    joinerWins: 0,
    round: 1,
    winnerId: null
  };

  // Close any active modals
  endModal.classList.remove('open');
  inningsModal.classList.remove('open');
  tossDecisionModal.classList.remove('open');

  showToast('Match restarted! Fresh series initialized.', 'info');

  if (gameMode === 'cricket') {
    openTossSetupModal();
  } else {
    resetTurnUI();
  }
}

/* =========================================================
   EVENT LISTENERS
   ========================================================= */
document.querySelectorAll('.choice-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    if (isLocked || !conn) return;
    isLocked = true;
    myCurrentChoice = tile.getAttribute('data-choice');
    tile.classList.add('active-pick');
    myActionState.textContent = 'Locked!';
    disableButtons(true);
    highlightTurn();
    AudioFX.tap();

    conn.send({ type: 'locked' });
    conn.send({ type: 'move', choice: myCurrentChoice });

    showToast(`You selected ${myCurrentChoice}`, 'info');
    checkTurnCompletion();
  });
});

inningsOkBtn.addEventListener('click', () => {
  if (conn) {
    conn.send({ type: 'start_innings_2' });
  }
  startSecondInnings();
});

modalResetBtn.addEventListener('click', () => {
  if (conn) {
    conn.send({ type: 'reset' });
  }
  resetMatchStates();
});

// Click room badge to copy code
roomBadge.addEventListener('click', () => {
  const code = roomCodeLabel.textContent.replace('ROOM: ', '').trim();
  if (code && code !== '---') {
    navigator.clipboard.writeText(code).then(() => {
      showToast(`Copied room code "${code}" to clipboard!`, 'success');
    });
  }
});

exitBtn.addEventListener('click', () => window.location.reload());

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.innerHTML = soundOn ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-xmark"></i>';
  showToast(soundOn ? 'Sound enabled' : 'Sound muted', 'info');
});
