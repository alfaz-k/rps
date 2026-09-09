/* =========================================================
   CLEAN PEER-TO-PEER RPS & HAND CRICKET CONTROLLER
   ========================================================= */

let peer = null;
let conn = null;
let myName = 'Player';
let oppName = 'Opponent';
let gameMode = 'rps'; // 'rps' or 'cricket'
let isHost = false;
let isLocked = false;
let soundOn = true;

// RPS State
let rpsScoreMe = 0;
let rpsScoreOpp = 0;

// Hand Cricket State
let cricketState = {
  innings: 1,           // 1: Setting target, 2: Chasing target
  battingPlayerId: null,// 'me' or 'opp'
  target: 0,
  runs: 0,
  wickets: 0
};

let myCurrentChoice = null;
let oppCurrentChoice = null;

// Element References
const lobbyScreen = document.getElementById('lobbyScreen');
const modeButtons = document.querySelectorAll('.mode-btn');
const playerNameInput = document.getElementById('playerNameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const lobbyError = document.getElementById('lobbyError');

const roomCodeLabel = document.getElementById('roomCodeLabel');
const roundStatusText = document.getElementById('roundStatusText');
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

const endModal = document.getElementById('endModal');
const modalBadgeIcon = document.getElementById('modalBadgeIcon');
const modalWinnerHeading = document.getElementById('modalWinnerHeading');
const modalWinnerDesc = document.getElementById('modalWinnerDesc');
const modalResetBtn = document.getElementById('modalResetBtn');
const yearEl = document.getElementById('yearEl');

yearEl.textContent = new Date().getFullYear();

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
   GAME MODE TOGGLER (LOBBY)
   ========================================================= */
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameMode = btn.getAttribute('data-game');
  });
});

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

/* =========================================================
   P2P PEER CONNECTIONS
   ========================================================= */
createBtn.addEventListener('click', () => {
  isHost = true;
  myName = playerNameInput.value.trim() || 'Host';
  p1NameLabel.textContent = myName.toUpperCase();
  lobbyError.textContent = 'Creating room...';

  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  peer = new Peer(`duel-${code}`);

  peer.on('open', () => {
    roomCodeLabel.textContent = `ROOM: ${code}`;
    lobbyScreen.classList.add('hidden');
    roundStatusText.textContent = 'Waiting for opponent...';
    applyGameModeUI();
    disableButtons(true);
  });

  peer.on('connection', c => {
    conn = c;
    setupConnEvents();
  });

  peer.on('error', () => {
    lobbyError.textContent = 'Room error. Tap create again.';
  });
});

joinBtn.addEventListener('click', () => {
  isHost = false;
  const code = roomCodeInput.value.trim().toUpperCase();
  myName = playerNameInput.value.trim() || 'Challenger';

  if (!code) {
    lobbyError.textContent = 'Enter 4-digit code!';
    return;
  }

  lobbyError.textContent = 'Connecting...';
  p1NameLabel.textContent = myName.toUpperCase();
  peer = new Peer();

  peer.on('open', () => {
    conn = peer.connect(`duel-${code}`);
    conn.on('open', () => {
      roomCodeLabel.textContent = `ROOM: ${code}`;
      lobbyScreen.classList.add('hidden');
      setupConnEvents();
      conn.send({ type: 'handshake', name: myName });
    });
    conn.on('error', () => {
      lobbyError.textContent = 'Room not found!';
    });
  });

  peer.on('error', () => {
    lobbyError.textContent = 'Unable to connect to room.';
  });
});

function setupConnEvents() {
  roundStatusText.textContent = 'Opponent connected!';
  oppActionState.textContent = 'Ready';
  disableButtons(false);

  // Host syncs game mode & starts cricket role allocation
  if (isHost) {
    conn.send({ type: 'init_sync', mode: gameMode, hostName: myName });
    if (gameMode === 'cricket') {
      cricketState.battingPlayerId = 'me'; // Host bats first
      syncCricketRoles();
    }
  }

  conn.on('data', data => {
    if (data.type === 'handshake') {
      oppName = data.name || 'Opponent';
      p2NameLabel.textContent = oppName.toUpperCase();
    } else if (data.type === 'init_sync') {
      gameMode = data.mode;
      oppName = data.hostName || 'Host';
      p2NameLabel.textContent = oppName.toUpperCase();
      applyGameModeUI();
      if (gameMode === 'cricket') {
        cricketState.battingPlayerId = 'opp'; // Joiner bowls first
        syncCricketRoles();
      }
    } else if (data.type === 'locked') {
      oppActionState.textContent = 'Locked!';
    } else if (data.type === 'move') {
      oppCurrentChoice = data.choice;
      checkTurnCompletion();
    } else if (data.type === 'reset') {
      resetMatchStates();
    }
  });

  conn.on('close', () => {
    roundStatusText.textContent = 'Opponent left.';
    oppActionState.textContent = 'Disconnected';
    disableButtons(true);
  });
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
  } else if (beats[myCurrentChoice] === oppCurrentChoice) {
    rpsScoreMe++;
    promptBar.className = 'prompt-bar win';
    promptTitle.textContent = 'ROUND WON!';
    promptSub.textContent = `${myCurrentChoice.toUpperCase()} beats ${oppCurrentChoice.toUpperCase()}`;
    AudioFX.win();
    blastConfetti();
  } else {
    rpsScoreOpp++;
    promptBar.className = 'prompt-bar lose';
    promptTitle.textContent = 'ROUND LOST!';
    promptSub.textContent = `${oppCurrentChoice.toUpperCase()} counters ${myCurrentChoice.toUpperCase()}`;
  }

  p1Score.textContent = rpsScoreMe;
  p2Score.textContent = rpsScoreOpp;

  if (rpsScoreMe >= 3 || rpsScoreOpp >= 3) {
    setTimeout(() => {
      showEndModal(rpsScoreMe >= 3, `Best of 5 finished: ${rpsScoreMe}-${rpsScoreOpp}`);
    }, 800);
  } else {
    setTimeout(resetTurnUI, 2000);
  }
}

/* =========================================================
   HAND CRICKET (1-6) REAL-TIME CALCULATOR ENGINE
   ========================================================= */
function syncCricketRoles() {
  const amIBatting = cricketState.battingPlayerId === 'me';
  myCricketRole.textContent = amIBatting ? 'BATSMAN' : 'BOWLER';
  myCricketRole.style.color = amIBatting ? 'var(--accent-green)' : 'var(--accent-cyan)';
  myCricketRole.style.borderColor = amIBatting ? 'var(--accent-green)' : 'var(--accent-cyan)';

  if (cricketState.innings === 1) {
    targetScoreDisplay.textContent = '--';
    cricketMetaMessage.textContent = amIBatting
      ? '1st Innings: Score as many runs as you can!'
      : '1st Innings: Bowl to get the batsman out!';
  } else {
    targetScoreDisplay.textContent = cricketState.target;
    const needed = cricketState.target - cricketState.runs;
    cricketMetaMessage.textContent = amIBatting
      ? `2nd Innings: Need ${needed} runs to win!`
      : `2nd Innings: Defend ${cricketState.target} runs!`;
  }
}

function evaluateCricket() {
  const myPick = parseInt(myCurrentChoice, 10);
  const oppPick = parseInt(oppCurrentChoice, 10);

  myDisplay.innerHTML = `<span style="font-family:var(--font-title);font-size:2rem;font-weight:900">${myPick}</span>`;
  oppDisplay.innerHTML = `<span style="font-family:var(--font-title);font-size:2rem;font-weight:900">${oppPick}</span>`;

  const amIBatting = cricketState.battingPlayerId === 'me';
  const batsmansRun = amIBatting ? myPick : oppPick;

  // Check OUT condition (both throw identical number 1-6)
  if (myPick === oppPick) {
    AudioFX.out();
    promptBar.className = 'prompt-bar out';
    promptTitle.textContent = 'WICKET! OUT!';
    promptSub.textContent = `Both chose ${myPick}!`;

    cricketWickets.textContent = '/1';

    if (cricketState.innings === 1) {
      // Transition to Innings 2
      setTimeout(() => {
        cricketState.innings = 2;
        cricketState.target = cricketState.runs + 1;
        cricketState.runs = 0;
        cricketState.wickets = 0;
        // Swap roles
        cricketState.battingPlayerId = amIBatting ? 'opp' : 'me';

        cricketRuns.textContent = '0';
        cricketWickets.textContent = '/0';
        syncCricketRoles();
        resetTurnUI();
      }, 2000);
    } else {
      // Innings 2 completed with wicket -> Bowler wins
      const bowlerWon = !amIBatting;
      setTimeout(() => {
        showEndModal(bowlerWon, bowlerWon
          ? `Target defended! Opponent fell short by ${cricketState.target - cricketState.runs} runs.`
          : `You were bowled out! Needed ${cricketState.target - cricketState.runs} more runs.`);
      }, 1000);
    }
  } else {
    // Add runs
    cricketState.runs += batsmansRun;
    cricketRuns.textContent = cricketState.runs;
    AudioFX.tap();

    promptBar.className = 'prompt-bar win';
    promptTitle.textContent = `+${batsmansRun} RUNS!`;
    promptSub.textContent = amIBatting ? 'Good shot!' : 'Batsman scored.';

    // Check if 2nd Innings Target achieved
    if (cricketState.innings === 2) {
      const needed = cricketState.target - cricketState.runs;
      if (cricketState.runs >= cricketState.target) {
        // Chased successfully
        const chaserWon = amIBatting;
        setTimeout(() => {
          showEndModal(chaserWon, chaserWon
            ? `Target reached! Sensational chase!`
            : `Opponent chased down target of ${cricketState.target}!`);
        }, 1000);
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

  promptBar.className = 'prompt-bar';
  promptTitle.textContent = 'MAKE YOUR MOVE';
  promptSub.textContent = 'Tap an option below';

  if (gameMode === 'rps') {
    myDisplay.innerHTML = `<i class="fas fa-hand-back-fist"></i>`;
    oppDisplay.innerHTML = `<i class="fas fa-hand-back-fist"></i>`;
  } else {
    myDisplay.innerHTML = `<i class="fas fa-baseball-bat-ball"></i>`;
    oppDisplay.innerHTML = `<i class="fas fa-baseball-bat-ball"></i>`;
  }
  disableButtons(false);
}

function showEndModal(isMeWinner, desc) {
  modalWinnerHeading.textContent = isMeWinner ? 'VICTORY!' : 'DEFEAT!';
  modalWinnerHeading.style.color = isMeWinner ? 'var(--accent-green)' : 'var(--accent-red)';
  modalWinnerDesc.textContent = desc;
  modalBadgeIcon.innerHTML = isMeWinner ? '<i class="fas fa-trophy"></i>' : '<i class="fas fa-skull"></i>';
  if (isMeWinner) blastConfetti();
  endModal.classList.add('open');
}

function resetMatchStates() {
  rpsScoreMe = 0;
  rpsScoreOpp = 0;
  p1Score.textContent = '0';
  p2Score.textContent = '0';

  cricketState = {
    innings: 1,
    battingPlayerId: isHost ? 'me' : 'opp',
    target: 0,
    runs: 0,
    wickets: 0
  };
  cricketRuns.textContent = '0';
  cricketWickets.textContent = '/0';
  targetScoreDisplay.textContent = '--';

  endModal.classList.remove('open');
  if (gameMode === 'cricket') syncCricketRoles();
  resetTurnUI();
}

// User Move Click
document.querySelectorAll('.choice-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    if (isLocked || !conn) return;
    isLocked = true;
    myCurrentChoice = tile.getAttribute('data-choice');
    tile.classList.add('active-pick');
    myActionState.textContent = 'Locked!';
    disableButtons(true);
    AudioFX.tap();

    conn.send({ type: 'locked' });
    conn.send({ type: 'move', choice: myCurrentChoice });

    checkTurnCompletion();
  });
});

modalResetBtn.addEventListener('click', () => {
  if (conn) conn.send({ type: 'reset' });
  resetMatchStates();
});

exitBtn.addEventListener('click', () => window.location.reload());

soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  soundBtn.innerHTML = soundOn ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-xmark"></i>';
});
