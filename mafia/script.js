// Web Audio API Context & Drone Nodes
let audioCtx = null;
let droneOsc1 = null;
let droneOsc2 = null;
let droneFilter = null;
let droneGain = null;
let lfo = null;
let lfoGain = null;
let whiteNoise = null;
let noiseGain = null;
let noiseFilter = null;

// Game State Variables
let players = [];
let gameLog = [];
let dayNumber = 1;
let currentPhase = 'setup'; // setup, reveal, night-transition, night-action, day-transition, day-discussion, day-vote, game-over
let revealIndex = 0;
let nightStepIndex = 0;
let nightSequence = []; // Roles sequence for the current night
let nightChoices = {
    mafiaTarget: null,
    doctorTarget: null,
    copTarget: null
};
let lastExecutedPlayer = null; // Tracked for Medium
let soldierShieldActive = true; // Soldier's one-time night-kill shield
let copInvestigatedPlayers = []; // Tracked for Soldier to know if Cop investigated him

// Settings
let isTtsEnabled = true;
// Disable background drone/music by default per user request. Short effects (tick, chime, alarm) are preserved.
let isDroneEnabled = false;
let discussionDuration = 120; // 2 minutes in seconds
let ttsSpeed = 1.0;
let ttsPitch = 1.0;

// Night action acknowledgement guards
let copAcked = false; // true when cop's modal has been acknowledged
let executionAutoAdvanceTimer = null; // (may already exist) safe to ensure declared

// Timer state
let timerInterval = null;
let timerTimeLeft = 0;
let isTimerPaused = false;

// Timeout handle for execution auto-advance (so Next button can cancel it)
// already declared above; reuse executionAutoAdvanceTimer variable


// Role Metadata Definitions
const ROLES_METADATA = {
    mafia: {
        name: '마피아',
        team: '악당 세력',
        enTeam: 'Evil Side',
        desc: '밤마다 눈을 떠 다른 마피아들과 합의하여 한 명의 플레이어를 지목해 살해합니다.',
        icon: 'skull',
        themeClass: 'theme-mafia'
    },
    cop: {
        name: '경찰',
        team: '시민 세력',
        enTeam: 'Citizens',
        desc: '밤마다 한 명을 지목하여 마피아인지 확인할 수 있습니다.',
        icon: 'search',
        themeClass: 'theme-cop'
    },
    doctor: {
        name: '의사',
        team: '시민 세력',
        enTeam: 'Citizens',
        desc: '밤마다 한 명을 지목하여 마피아의 공격으로부터 살릴 수 있습니다.',
        icon: 'stethoscope',
        themeClass: 'theme-doctor'
    },
    citizen: {
        name: '시민',
        team: '시민 세력',
        enTeam: 'Citizens',
        desc: '특별한 능력이 없습니다. 낮 단계의 토론과 투표를 통해 마피아를 제거해야 합니다.',
        icon: 'user',
        themeClass: 'theme-citizen'
    },
    medium: {
        name: '영매',
        team: '시민 세력',
        enTeam: 'Citizens',
        desc: '밤마다 직전 낮 단계에 처형당해 사망한 플레이어 한 명의 마피아 여부를 확인할 수 있습니다.',
        icon: 'sparkles',
        themeClass: 'theme-special'
    },
    politician: {
        name: '정치인',
        team: '시민 세력',
        enTeam: 'Citizens',
        desc: '투표 처형 면역을 가집니다. 투표 시 본인의 투표는 2표로 계산됩니다. (패시브)',
        icon: 'landmark',
        themeClass: 'theme-special'
    },
    loverA: {
        name: '연인 A',
        team: '시민 세력',
        enTeam: 'Citizens',
        desc: '다른 연인(연인 B)과 밤에 서로의 정체를 확인합니다. 확실한 시민 편입니다.',
        icon: 'heart',
        themeClass: 'theme-special'
    },
    loverB: {
        name: '연인 B',
        team: '시민 세력',
        enTeam: 'Citizens',
        desc: '다른 연인(연인 A)과 밤에 서로의 정체를 확인합니다. 확실한 시민 편입니다.',
        icon: 'heart',
        themeClass: 'theme-special'
    },
    soldier: {
        name: '군인',
        team: '시민 세력',
        enTeam: 'Citizens',
        desc: '마피아의 밤 습격을 첫 1회 방어합니다. 경찰이 자신을 조사하면 그 경찰이 누구인지 알려줍니다.',
        icon: 'shield',
        themeClass: 'theme-special'
    }
};

// Default Players to help user test quickly
const DEFAULT_PLAYERS = ['김철수', '이영희', '박민수', '최지원', '정우성', '한지민', '김민지', '이준호', '박서준', '송혜교', '유아인', '김하늘', '조승우'];

// Sound & Audio Setup
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    loadVoices();
}

// Low frequency ambient suspense drone synthesizer
function startSuspenseDrone() {
    if (!isDroneEnabled) return;
    initAudio();
    
    try {
        // Create nodes
        droneOsc1 = audioCtx.createOscillator();
        droneOsc2 = audioCtx.createOscillator();
        droneFilter = audioCtx.createBiquadFilter();
        droneGain = audioCtx.createGain();
        
        droneOsc1.type = 'sawtooth';
        droneOsc1.frequency.setValueAtTime(55, audioCtx.currentTime); // A1
        
        droneOsc2.type = 'sawtooth';
        droneOsc2.frequency.setValueAtTime(55.4, audioCtx.currentTime); // Detune
        
        droneFilter.type = 'lowpass';
        droneFilter.frequency.setValueAtTime(140, audioCtx.currentTime);
        droneFilter.Q.setValueAtTime(6, audioCtx.currentTime);
        
        // Slow sweeping filter modulation
        lfo = audioCtx.createOscillator();
        lfoGain = audioCtx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.15, audioCtx.currentTime); // 0.15 Hz sweep
        lfoGain.gain.setValueAtTime(45, audioCtx.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(droneFilter.frequency);
        
        // Synthesise procedural white wind noise
        const bufferSize = audioCtx.sampleRate * 2;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        whiteNoise = audioCtx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;
        
        noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(220, audioCtx.currentTime);
        noiseFilter.Q.setValueAtTime(1.5, audioCtx.currentTime);
        
        noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        
        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(droneGain);
        
        droneOsc1.connect(droneFilter);
        droneOsc2.connect(droneFilter);
        droneFilter.connect(droneGain);
        
        droneGain.connect(audioCtx.destination);
        
        droneOsc1.start();
        droneOsc2.start();
        lfo.start();
        whiteNoise.start();
        
        droneGain.gain.setValueAtTime(0, audioCtx.currentTime);
        droneGain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 3.0);
    } catch (e) {
        console.error("Drone failed to start:", e);
    }
}

function stopSuspenseDrone() {
    if (droneGain && audioCtx) {
        try {
            droneGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);
            setTimeout(() => {
                if (droneOsc1) { try { droneOsc1.stop(); } catch(err){} droneOsc1.disconnect(); droneOsc1 = null; }
                if (droneOsc2) { try { droneOsc2.stop(); } catch(err){} droneOsc2.disconnect(); droneOsc2 = null; }
                if (lfo) { try { lfo.stop(); } catch(err){} lfo.disconnect(); lfo = null; }
                if (whiteNoise) { try { whiteNoise.stop(); } catch(err){} whiteNoise.disconnect(); whiteNoise = null; }
                if (lfoGain) lfoGain.disconnect();
                if (noiseFilter) noiseFilter.disconnect();
                if (noiseGain) noiseGain.disconnect();
                if (droneFilter) droneFilter.disconnect();
                if (droneGain) { droneGain.disconnect(); droneGain = null; }
            }, 1600);
        } catch (e) {
            console.error("Error stopping drone:", e);
        }
    }
}

function playAudioLoop(elId) {
    const a = document.getElementById(elId);
    if (!a) return;
    try {
        a.volume = 0.55;
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) p.catch(e => console.warn('Audio autoplay prevented:', e));
    } catch(e) { console.warn('playAudioLoop error', e); }
}
function stopAudio(elId) {
    const a = document.getElementById(elId);
    if (!a) return;
    try {
        a.pause();
        a.currentTime = 0;
    } catch(e) { console.warn('stopAudio error', e); }
}

// Procedural high-pitched morning chime synthesizer
function playMorningChime() {
    initAudio();
    const now = audioCtx.currentTime;
    // E5, G#5, B5, E6 sparkling notes
    const freqs = [659.25, 830.61, 987.77, 1318.51];
    
    freqs.forEach((freq, index) => {
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.08, now + 0.08 * index + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5 + 0.2 * index);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(now + 0.08 * index);
            osc.stop(now + 2.2);
        } catch(e) {
            console.error("Chime note error:", e);
        }
    });
}

// Procedural countdown ticking and ending buzz sounds
function playTickSound() {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } catch(e){}
}

function playAlarmSound() {
    try {
        initAudio();
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(224, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.8);
        osc2.stop(audioCtx.currentTime + 0.8);
    } catch(e){}
}

// TTS Speech Utility
let koVoice = null;
function loadVoices() {
    if ('speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        koVoice = voices.find(v => v.lang.includes('ko') || v.lang.includes('KO'));
    }
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
}

function speak(text, callback) {
    console.log("TTS Reading:", text);
    
    // Subtitles display
    const subtitle = document.getElementById('tts-subtitle');
    if (subtitle) {
        subtitle.textContent = text;
        subtitle.style.opacity = 1;
    }
    
    if (!isTtsEnabled || !('speechSynthesis' in window)) {
        // Fallback waiting if TTS is off/unsupported
        const delay = Math.max(1500, text.length * 160);
        setTimeout(() => {
            if (callback) callback();
        }, delay);
        return;
    }
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = ttsSpeed;
    utterance.pitch = ttsPitch;
    
    if (koVoice) {
        utterance.voice = koVoice;
    }
    
    utterance.onend = () => {
        if (callback) callback();
    };
    
    utterance.onerror = (e) => {
        console.error("TTS play error:", e);
        if (callback) callback();
    };
    
    window.speechSynthesis.speak(utterance);
}

// Helper to shuffle roles
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// Fetch active roles configuration for count
function getRolesListForCount(count) {
    const roles = [];

    // Special small-game distributions requested:
    if (count === 3) {
        // 3명: 마피아 1, 시민 2
        return ['mafia', 'citizen', 'citizen'];
    }
    if (count === 4) {
        // 4명: 마피아 1, 시민 3
        return ['mafia', 'citizen', 'citizen', 'citizen'];
    }

    if (count >= 5) {
        roles.push('mafia');     // No.1
        roles.push('cop');       // No.2
        roles.push('doctor');    // No.3
        roles.push('citizen');   // No.4
        roles.push('citizen');   // No.5
    }
    if (count >= 6) {
        roles.push('citizen');   // No.6
    }
    if (count >= 7) {
        roles.push('mafia');     // No.7
    }
    if (count >= 8) {
        roles.push('medium');    // No.8
    }
    if (count >= 9) {
        roles.push('politician'); // No.9
    }
    if (count >= 10) {
        roles.push('mafia');     // No.10
    }
    if (count >= 11) {
        if (count >= 12) {
            roles.push('loverA'); // No.11
        } else {
            roles.push('citizen'); // No.11 (treated as citizen)
        }
    }
    if (count >= 12) {
        roles.push('loverB');    // No.12
    }
    if (count >= 13) {
        roles.push('soldier');   // No.13
    }

    // Ensure minimum mafia count is 3 for larger games when possible
    let mafiaCount = roles.filter(r => r === 'mafia').length;
    while (mafiaCount < 3 && roles.length < count) {
        roles.push('mafia');
        mafiaCount++;
    }

    while (roles.length < count) {
        roles.push('citizen');
    }
    return roles.slice(0, count);
}

// Update settings UI display values
function updateSettingsUI() {
    document.getElementById('discussion-time-display').textContent = `${Math.floor(discussionDuration / 60)}분 ${(discussionDuration % 60).toString().padStart(2, '0')}초`;
    document.getElementById('tts-speed-display').textContent = `${ttsSpeed.toFixed(1)}x`;
}

// Render Setup Screen
function renderSetupScreen() {
    // Fill default players if list empty
    if (players.length === 0) {
        DEFAULT_PLAYERS.forEach(name => {
            players.push({
                id: Date.now() + Math.floor(Math.random() * 100000),
                name: name,
                role: null,
                isAlive: true
            });
        });
    }
    
    const playersListEl = document.getElementById('players-list');
    playersListEl.innerHTML = '';
    
    players.forEach(p => {
        const badge = document.createElement('div');
        badge.className = 'player-badge';
        badge.innerHTML = `
            <span>${escapeHtml(p.name)}</span>
            <button class="btn-delete-player"><i data-lucide="x"></i></button>
        `;
        badge.querySelector('.btn-delete-player').addEventListener('click', () => {
            removePlayer(p.id);
        });
        playersListEl.appendChild(badge);
    });
    
    document.getElementById('player-count-badge').textContent = `${players.length}명`;
    
    // Render upcoming roles preview only if there are at least 3 players
    const rolesBox = document.querySelector('.roles-preview-box');
    const rolesGrid = document.getElementById('active-roles-list');
    rolesGrid.innerHTML = '';

    if (players.length < 3) {
        // Hide the roles preview entirely for clarity
        if (rolesBox) rolesBox.style.display = 'none';
    } else {
        if (rolesBox) rolesBox.style.display = '';

        const plannedRoles = getRolesListForCount(players.length);
        const roleCounts = {};
        plannedRoles.forEach(r => {
            roleCounts[r] = (roleCounts[r] || 0) + 1;
        });
        
        Object.keys(roleCounts).forEach(roleKey => {
            const meta = ROLES_METADATA[roleKey];
            const count = roleCounts[roleKey];
            
            const previewItem = document.createElement('div');
            previewItem.className = `role-preview-item ${meta.themeClass}`;
            previewItem.innerHTML = `
                <i data-lucide="${meta.icon}"></i>
                <span>${meta.name}</span>
                <span class="role-preview-count">${count}</span>
            `;
            rolesGrid.appendChild(previewItem);
        });
    }
    
    lucide.createIcons();
}

function removePlayer(id) {
    players = players.filter(p => p.id !== id);
    renderSetupScreen();
}

function addPlayer() {
    const input = document.getElementById('input-player-name');
    const name = input.value.trim();
    if (!name) return;
    
    if (players.length >= 13) {
        alert("최대 13명까지만 참여할 수 있습니다. (기존 규칙 최적화 인원: 5~13명)");
        return;
    }
    
    // Check duplicates
    if (players.some(p => p.name === name)) {
        alert("이미 등록된 이름입니다!");
        return;
    }
    
    players.push({
        id: Date.now() + Math.floor(Math.random() * 100000),
        name: name,
        role: null,
        isAlive: true
    });
    
    input.value = '';
    renderSetupScreen();
    input.focus();
}

// Switch Screens helper
function showScreen(screenId) {
    document.querySelectorAll('.game-screen').forEach(s => {
        s.classList.remove('active');
    });
    const activeScreen = document.getElementById(screenId);
    activeScreen.classList.add('active');
    
    // Update headers based on view (Only show on setup to save space during gameplay)
    const header = document.getElementById('app-header');
    if (screenId === 'screen-setup') {
        header.style.display = 'flex';
    } else {
        header.style.display = 'none';
    }
}

// Initialise Game & Role shuffles
function startGame() {
    console.debug('startGame: called', { playersCount: players.length, isTtsEnabled, isDroneEnabled, discussionDuration });
    if (players.length < 3) {
        alert("최소 3명 이상의 플레이어가 필요합니다!");
        return;
    }
    if (players.length > 13) {
        alert("최대 13명까지만 플레이할 수 있습니다!");
        return;
    }
    
    initAudio();
    
    // Assign roles randomly
    const assignedRoles = getRolesListForCount(players.length);
    shuffle(assignedRoles);
    
    players.forEach((p, idx) => {
        p.role = assignedRoles[idx];
        p.isAlive = true;
    });
    
    dayNumber = 1;
    gameLog = [];
    lastExecutedPlayer = null;
    soldierShieldActive = true;
    copInvestigatedPlayers = [];
    
    // Enter Reveal Mode
    revealIndex = 0;
    setupRevealPlayer();
    showScreen('screen-reveal');
    
    // Announce start, then announce the first player's turn (do not reveal role)
    speak("게임이 시작되었습니다. 차례대로 돌아가며 역할을 확인해 주세요.", () => {
        const firstPlayer = players[revealIndex];
        if (firstPlayer) {
            speak(`${firstPlayer.name} 님 차례입니다.`);
        }
    });
}

// Setup Reveal UI for revealIndex player
function setupRevealPlayer() {
    const p = players[revealIndex];
    document.getElementById('reveal-player-name').textContent = `${p.name} 님 차례`;
    
    // Reset Card state
    const card = document.getElementById('interactive-role-card');
    card.className = 'role-card';
    card.classList.remove('flipped');
    
    const meta = ROLES_METADATA[p.role];
    card.classList.add(meta.themeClass);
    
    // Bind Card Info
    document.getElementById('reveal-card-badge').textContent = meta.team;
    document.getElementById('reveal-card-no').textContent = `No. ${players.indexOf(p) + 1}`;
    
    const iconEl = document.getElementById('reveal-card-icon');
    iconEl.setAttribute('data-lucide', meta.icon);
    
    document.getElementById('reveal-card-title').textContent = meta.name;
    document.getElementById('reveal-card-desc').textContent = meta.desc;
    
    lucide.createIcons();
    
    // Disable confirm button until card is flipped
    const nextBtn = document.getElementById('btn-next-player');
    if (nextBtn) {
        nextBtn.disabled = true;
    }
}

function revealCard() {
    const card = document.getElementById('interactive-role-card');
    if (!card) return;
    // If already flipped, ignore further clicks to preserve secrecy
    if (card.classList.contains('flipped')) return;
    card.classList.add('flipped');
    
    // Enable bottom confirm button after reveal
    const nextBtn = document.getElementById('btn-next-player');
    if (nextBtn) {
        nextBtn.disabled = false;
    }
    
    // TTS reveal role - SECRET (Do not speak the role itself!)
    speak("역할을 확인하셨으면 하단의 확인 완료 버튼을 눌러주세요.");
}

function nextPlayerReveal() {
    const card = document.getElementById('interactive-role-card');
    const nextBtn = document.getElementById('btn-next-player');

    // Immediately reset visual state without playing flip-back animation
    if (card) {
        // Temporarily disable CSS transitions to prevent flip animation
        const prevTransition = card.style.transition;
        card.style.transition = 'none';
        card.classList.remove('flipped');
        // Force reflow so the class removal takes effect immediately
        void card.offsetWidth;
        // Restore transition shortly after DOM update
        setTimeout(() => { card.style.transition = prevTransition || ''; }, 50);
        // Prevent accidental rapid taps from interacting with previous state
        card.style.pointerEvents = 'none';
    }

    if (nextBtn) {
        nextBtn.disabled = true;
    }

    // Immediately advance to next player and set up their card (no animation)
    revealIndex++;
    if (revealIndex < players.length) {
        setupRevealPlayer();
        // Re-enable card interaction after new content is in place
        setTimeout(() => {
            if (card) card.style.pointerEvents = '';
        }, 200);

        // Announce next player's turn without revealing role
        const nextPlayer = players[revealIndex];
        if (nextPlayer) {
            speak(`${nextPlayer.name} 님 차례입니다.`);
        }
    } else {
        // All players revealed, proceed to Night 1
        // Ensure card pointer events reset
        if (card) card.style.pointerEvents = '';
        enterNightTransition();
    }
}

// Transition to Night Phase
function enterNightTransition() {
    showScreen('screen-night-transition');
    currentPhase = 'night-transition';

    // Cancel voices and (conditionally) start drone synth
    window.speechSynthesis.cancel();
    const synthIndicator = document.querySelector('.synth-indicator');
    if (synthIndicator) synthIndicator.style.display = isDroneEnabled ? 'flex' : 'none';
    startSuspenseDrone();

    // Audio: switch to night background
    stopAudio('audio-day');
    playAudioLoop('audio-night');

    // 3초 자동 카운트다운 표시 후 밤 진행 자동 시작
    let countdown = 3;
    const display = document.getElementById('night-countdown-display');
    if (display) display.textContent = String(countdown);

    const tick = () => {
        if (display) display.textContent = String(countdown);
        if (countdown > 0) {
            countdown--;
            setTimeout(tick, 1000);
        } else {
            speak("밤이 시작됩니다. 가운데에 핸드폰을 놓고 모두 손가락을 올려주세요.", () => {
                // Compile Night Sequence based on active roles in play
                compileNightSequence();
                nightStepIndex = 0;
                // Small delay for UX smoothness then proceed
                setTimeout(() => {
                    progressNightStep();
                }, 500);
            });
        }
    };

    // Announce and start countdown
    speak(`밤이 다가오고 있습니다. 3초 후에 밤이 자동으로 시작됩니다.`, () => {
        tick();
    });
}

function compileNightSequence() {
    nightSequence = [];

    const hasRole = (roleKey) => players.some(p => p.role === roleKey);
    const hasEither = (roleKeys) => players.some(p => roleKeys.includes(p.role));

    if (dayNumber === 1) {
        // First night: include lovers only if lovers exist, mafia meetup only if mafia exists,
        // and cop only if cop exists in the assignment.
        if (hasEither(['loverA', 'loverB'])) {
            nightSequence.push('lovers');
        }
        if (hasRole('mafia')) {
            nightSequence.push('mafia');
        }
        if (hasRole('cop')) {
            nightSequence.push('cop');
        }
    } else {
        // Regular nights: include roles only if they are present in player assignments
        if (hasRole('mafia')) nightSequence.push('mafia');
        if (hasRole('cop')) nightSequence.push('cop');
        if (hasRole('doctor')) nightSequence.push('doctor');
        if (hasRole('medium')) nightSequence.push('medium');
        if (hasRole('soldier')) nightSequence.push('soldier');
    }

    nightChoices = {
        mafiaTarget: null,
        doctorTarget: null,
        copTarget: null
    };
}

// Process single night-action roles sequentially
function progressNightStep() {
    if (nightStepIndex < nightSequence.length) {
        const stepRole = nightSequence[nightStepIndex];
        setupNightActionUI(stepRole);
    } else {
        // Night actions completed
        resolveNightEvents();
    }
}

function setupNightActionUI(roleKey) {
    showScreen('screen-night-action');
    currentPhase = 'night-action';
    
    // Apply role-based theme to dashboard (guard if element missing to avoid JS errors)
    const dashboard = document.querySelector('.night-dashboard');
    if (dashboard) {
        dashboard.className = 'night-dashboard'; // Reset classes
    }
    
    let instructions = "";
    let privacyTitle = "";
    let privacyDesc = "";
    
    if (roleKey === 'lovers') {
        if (dashboard) dashboard.classList.add('theme-special');
        privacyTitle = "연인들 확인 대기";
        privacyDesc = "가운데에 핸드폰을 놓고 모두 손가락을 올려주세요. 연인인 분만 화면을 터치하여 파트너를 확인해주세요.";
        instructions = "연인 단계: 서로의 동맹 파트너를 확인하세요.";
    } else if (roleKey === 'mafia') {
        if (dashboard) dashboard.classList.add('theme-mafia');
        privacyTitle = "마피아 대기";
        privacyDesc = "가운데에 핸드폰을 놓고 모두 손가락을 올려주세요. 마피아인 분만 화면을 터치하여 제거할 대상을 선택해주세요.";
        instructions = "제거할 플레이어 한 명을 지목하세요.";
    } else if (roleKey === 'cop') {
        if (dashboard) dashboard.classList.add('theme-cop');
        privacyTitle = "경찰 대기";
        privacyDesc = "가운데에 핸드폰을 놓고 모두 손가락을 올려주세요. 경찰인 분만 화면을 터치하여 조사할 대상을 선택해주세요.";
        instructions = "마피아 여부를 조사할 플레이어 한 명을 선택하세요.";
    } else if (roleKey === 'doctor') {
        if (dashboard) dashboard.classList.add('theme-doctor');
        privacyTitle = "의사 대기";
        privacyDesc = "가운데에 핸드폰을 놓고 모두 손가락을 올려주세요. 의사인 분만 화면을 터치하여 치료할 대상을 선택해주세요.";
        instructions = "마피아 공격으로부터 살릴 플레이어 한 명을 선택하세요.";
    } else if (roleKey === 'medium') {
        if (dashboard) dashboard.classList.add('theme-special');
        privacyTitle = "영매 대기";
        privacyDesc = "가운데에 핸드폰을 놓고 모두 손가락을 올려주세요. 영매인 분만 화면을 터치하여 조사 결과를 확인해주세요.";
        instructions = "직전에 처형된 플레이어가 마피아였는지 확인합니다.";
    } else if (roleKey === 'soldier') {
        if (dashboard) dashboard.classList.add('theme-special');
        privacyTitle = "군인 정보 확인";
        privacyDesc = "가운데에 핸드폰을 놓고 모두 손가락을 올려주세요. 군인인 분만 화면을 터치하여 경찰 조사 여부를 확인해주세요.";
        instructions = "경찰의 조사 여부와 경찰의 정체를 확인하세요.";
    }
    
    document.getElementById('privacy-target-role').textContent = privacyTitle;
    document.getElementById('privacy-target-desc').textContent = privacyDesc;
    document.getElementById('night-role-tag').textContent = privacyTitle.split(' ')[0];
    document.getElementById('night-action-title').textContent = privacyTitle;
    document.getElementById('night-action-instruction').textContent = instructions;
    
    // Cover screen for privacy
    const nightOverlay = document.getElementById('night-privacy-overlay');
    if (nightOverlay) {
        nightOverlay.style.opacity = 1;
        nightOverlay.style.pointerEvents = 'auto';
    }

    // Ensure the privacy unlock button is visible for this step
    const privacyBtn = document.getElementById('btn-privacy-unlock');
    if (privacyBtn) {
        privacyBtn.style.display = 'block';
        privacyBtn.disabled = false;
    }
    // Remove any existing visual "locked" badge left from previous step
    const oldBadge = document.getElementById('privacy-locked-badge');
    if (oldBadge && oldBadge.parentNode) {
        oldBadge.parentNode.removeChild(oldBadge);
    }

    // Action panel setups
    const targetsList = document.getElementById('night-targets-list');
    targetsList.innerHTML = '';
    targetsList.style.pointerEvents = 'auto'; // Reset pointer events
    
    const resultBox = document.getElementById('night-action-result');
    resultBox.classList.add('hidden');
    
    const confirmBtn = document.getElementById('btn-confirm-night-action');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '선택 완료'; // Reset button text
    confirmBtn.classList.remove('hidden'); // Reset display
    
    // Check if the players holding this role are alive
    const aliveRoleHolders = players.filter(p => p.role === roleKey || (roleKey === 'lovers' && (p.role === 'loverA' || p.role === 'loverB')));
    const hasAliveHolders = aliveRoleHolders.some(p => p.isAlive);
    
    // If no alive holders for this role, skip immediately to avoid stalling the night sequence
    if (!hasAliveHolders) {
        console.info(`Night step '${roleKey}' skipped: no alive holders.`);
        const targetsList = document.getElementById('night-targets-list');
        if (targetsList) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'result-box';
            const roleName = (ROLES_METADATA[roleKey] && ROLES_METADATA[roleKey].name) ? ROLES_METADATA[roleKey].name : roleKey;
            infoDiv.innerHTML = `<p class="result-text">${escapeHtml(roleName)} 역할 보유자가 없거나 모두 사망했습니다. 다음 단계로 이동합니다.</p>`;
            targetsList.appendChild(infoDiv);
        }
        // Small delay so UI updates are visible, then continue
        setTimeout(() => { executeNightStepComplete(roleKey); }, 600);
        return;
    }
    
    // Build selection options
    if (roleKey === 'lovers') {
        // Show lovers information
        const lovers = players.filter(p => p.role === 'loverA' || p.role === 'loverB');
        const loverNames = lovers.map(l => l.name).join(', ');
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'result-box';
        infoDiv.innerHTML = `
            <p class="result-label">연인 정보</p>
            <p class="result-text" style="color: var(--color-special); font-size: 1.2rem;">
                ${hasAliveHolders ? `확인된 연인 한 쌍: ${escapeHtml(loverNames)}` : '당신은 연인이 아니거나 연인이 사망했습니다. 안전하게 조작하는 척하고 확인 완료를 누르세요.'}
            </p>
        `;
        targetsList.appendChild(infoDiv);
        confirmBtn.disabled = false;
        confirmBtn.onclick = () => {
            executeNightStepComplete(roleKey);
        };
        
    } else if (roleKey === 'medium') {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'result-box';
        
        let mediumMsg = "";
        if (hasAliveHolders && lastExecutedPlayer) {
            const isTargetMafia = lastExecutedPlayer.role === 'mafia';
            mediumMsg = `${lastExecutedPlayer.name} 님은 마피아가 ${isTargetMafia ? '<span style="color: var(--color-mafia)">맞습니다</span>' : '<span style="color: var(--color-cop)">아닙니다</span>'}.`;
        } else {
            mediumMsg = "정보가 없거나 당신은 영매가 아닙니다. 조작하는 척하며 넘어가주세요.";
        }
        
        infoDiv.innerHTML = `
            <p class="result-label">영혼의 목소리</p>
            <p class="result-text">${mediumMsg}</p>
        `;
        targetsList.appendChild(infoDiv);
        confirmBtn.disabled = false;
        confirmBtn.onclick = () => {
            executeNightStepComplete(roleKey);
        };
        
    } else if (roleKey === 'soldier') {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'result-box';
        
        let soldierMsg = "";
        const soldierPlayer = players.find(p => p.role === 'soldier');
        
        if (hasAliveHolders && soldierPlayer) {
        // Find who investigated soldier during THIS NIGHT only
        const copsWhoInvestigated = copInvestigatedPlayers.filter(inv => inv.target === soldierPlayer.name && inv.day === dayNumber);
            if (copsWhoInvestigated.length > 0) {
                const copNames = copsWhoInvestigated.map(inv => inv.cop).join(', ');
                soldierMsg = `경찰이 당신을 조사했습니다! 경찰은 [<span style="color: var(--color-cop)">${escapeHtml(copNames)}</span>] 입니다.`;
            } else {
                soldierMsg = "아직 아무도 당신을 조사하지 않았습니다.";
            }
        } else {
        soldierMsg = "정보가 없습니다. 조작하는 척하며 넘어가주세요.";
        }
        
        infoDiv.innerHTML = `
            <p class="result-label">경찰 조사 기록</p>
            <p class="result-text">${soldierMsg}</p>
        `;
        targetsList.appendChild(infoDiv);
        confirmBtn.disabled = false;
        confirmBtn.onclick = () => {
            executeNightStepComplete(roleKey);
        };
        
    } else {
        // Selection roles: mafia, cop, doctor
        let selectedPlayerId = null;

        // If it's the very first night, mafia should only meet and not choose a kill
        if (roleKey === 'mafia' && dayNumber === 1) {
            const mafiaMembers = players.filter(p => p.role === 'mafia').map(p => p.name).join(', ');
            const infoDiv = document.createElement('div');
            infoDiv.className = 'result-box';
            infoDiv.innerHTML = `
                <p class="result-label">마피아 모임</p>
                <p class="result-text" style="color: var(--color-mafia); font-size: 1.1rem;">
                    ${hasAliveHolders ? `마피아 멤버: ${escapeHtml(mafiaMembers)}` : '당신은 마피아가 아닙니다.'}
                </p>
            `;
            targetsList.appendChild(infoDiv);
            confirmBtn.disabled = false;
            confirmBtn.onclick = () => {
                // Do not set mafia target on night 1
                executeNightStepComplete(roleKey);
            };
        } else {
            // Show selection lists
            let selectableExists = false;
            players.forEach(targetPlayer => {
                // Can only target alive players
                if (!targetPlayer.isAlive) return;

                const item = document.createElement('div');
                item.className = 'target-item';

                // If current step is Mafia, display mafia members as labeled and non-selectable
                if (roleKey === 'mafia' && targetPlayer.role === 'mafia') {
                    item.innerHTML = `${escapeHtml(targetPlayer.name)} <span style="margin-left:8px; font-size:0.85rem; font-weight:700; color: var(--color-mafia);">마피아</span>`;
                    item.style.opacity = '0.65';
                    item.style.pointerEvents = 'none';
                } else if (roleKey === 'cop') {
                    // If this player has been investigated before, show remembered result and disable selecting
                    const prev = copInvestigatedPlayers.find(inv => inv.target === targetPlayer.name);
                    if (prev) {
                        const wasMafia = players.find(p => p.name === prev.target)?.role === 'mafia';
                        item.innerHTML = `${escapeHtml(targetPlayer.name)} <span style="margin-left:8px; font-size:0.85rem; font-weight:700; color: ${wasMafia ? 'var(--color-mafia)' : 'var(--color-cop)'};">${wasMafia ? '마피아' : '시민'}</span>`;
                        item.style.opacity = '0.7';
                        item.style.pointerEvents = 'none';
                        item.title = `이미 조사됨 (밤 ${prev.day})`;
                    } else {
                        // selectable
                        selectableExists = true;
                        item.textContent = targetPlayer.name;
                        item.onclick = () => {
                            if (targetsList.style.pointerEvents === 'none') return;
                            document.querySelectorAll('.target-item').forEach(el => el.classList.remove('selected'));
                            item.classList.add('selected');

                            selectedPlayerId = targetPlayer.id;
                            confirmBtn.disabled = false;
                        };
                    }
                } else {
                    // Default selectable behavior for doctor and other roles
                    item.textContent = targetPlayer.name;
                    item.onclick = () => {
                        if (targetsList.style.pointerEvents === 'none') return;
                        document.querySelectorAll('.target-item').forEach(el => el.classList.remove('selected'));
                        item.classList.add('selected');

                        selectedPlayerId = targetPlayer.id;
                        confirmBtn.disabled = false;
                    };
                }

                targetsList.appendChild(item);
            });

            // If cop has no new selectable targets (everyone alive was previously investigated), allow proceeding without selection
            if (roleKey === 'cop' && !selectableExists) {
                const note = document.createElement('div');
                note.className = 'result-box';
                note.innerHTML = `<p class="result-text">이미 생존자 중 조사 가능한 대상이 없습니다. 이전 조사 결과가 기억되어 표시됩니다.</p>`;
                targetsList.appendChild(note);
                confirmBtn.disabled = false;
                confirmBtn.onclick = () => { executeNightStepComplete(roleKey); };
            }

            confirmBtn.onclick = () => {
                if (roleKey === 'cop' && hasAliveHolders) {
                    // First click: confirm selection, reveal result, and lock grid
                    // Police investigation: show result in a dialog, then proceed when acknowledged
                    if (selectedPlayerId) {
                        const target = players.find(p => p.id === selectedPlayerId);
                        nightChoices.copTarget = target;

                        // Track this investigation in case target is a Soldier
                        const copPlayer = players.find(p => p.role === 'cop');
                        if (copPlayer) {
                            copInvestigatedPlayers.push({
                                cop: copPlayer.name,
                            target: target.name,
                            day: dayNumber
                            });
                        }

                        // Build result text
                        const isMafia = target.role === 'mafia';
                        const resultHtml = `${target.name} 님은 마피아가 ${isMafia ? '<span style="color: var(--color-mafia)">맞습니다</span>' : '<span style="color: var(--color-cop)">아닙니다</span>'}.`;

                        // Create modal dialog to display investigation result clearly
                        const invOverlay = document.createElement('div');
                        invOverlay.style.position = 'fixed';
                        invOverlay.style.left = 0;
                        invOverlay.style.top = 0;
                        invOverlay.style.right = 0;
                        invOverlay.style.bottom = 0;
                        invOverlay.style.background = 'rgba(0,0,0,0.6)';
                        invOverlay.style.display = 'flex';
                        invOverlay.style.alignItems = 'center';
                        invOverlay.style.justifyContent = 'center';
                        invOverlay.style.zIndex = 10001;

                        const box = document.createElement('div');
                        box.style.background = '#111';
                        box.style.color = '#fff';
                        box.style.padding = '18px';
                        box.style.borderRadius = '10px';
                        box.style.maxWidth = '90%';
                        box.style.textAlign = 'center';

                        const title = document.createElement('div');
                        title.style.fontWeight = '800';
                        title.style.marginBottom = '10px';
                        title.textContent = '조사 결과';

                        const body = document.createElement('div');
                        body.style.marginBottom = '14px';
                        body.innerHTML = resultHtml;

                        const okBtn = document.createElement('button');
                        okBtn.className = 'btn btn-primary';
                        okBtn.textContent = '확인';
                        okBtn.style.padding = '8px 12px';

                        okBtn.onclick = () => {
                            // mark acknowledged so executeNightStepComplete won't be blocked
                            copAcked = true;

                            // remove dialog
                            if (invOverlay && invOverlay.parentNode) invOverlay.parentNode.removeChild(invOverlay);

                            // show locked state and proceed
                            targetsList.style.pointerEvents = 'none';
                            const confirmBtnLocal = document.getElementById('btn-confirm-night-action');
                            if (confirmBtnLocal) confirmBtnLocal.disabled = true;

                            // proceed to next night step (only allowed because copAcked==true)
                            executeNightStepComplete(roleKey);

                            // reset ack flag after a tick so further nights require re-ack
                            setTimeout(() => { copAcked = false; }, 100);
                        };

                        box.appendChild(title);
                        box.appendChild(body);
                        box.appendChild(okBtn);
                        invOverlay.appendChild(box);
                        document.body.appendChild(invOverlay);

                    } else {
                        // No selection made; ignore
                    }
                } else {
                    // Mafia (not night1), Doctor, or dead Cop
                    if (hasAliveHolders && selectedPlayerId) {
                        const target = players.find(p => p.id === selectedPlayerId);
                        if (roleKey === 'mafia') nightChoices.mafiaTarget = target;
                        if (roleKey === 'doctor') nightChoices.doctorTarget = target;
                    }
                    executeNightStepComplete(roleKey);
                }
            };
        }
    }

    // Announce via TTS
    let ttsSpeechText = "";
    if (roleKey === 'lovers') {
        ttsSpeechText = "연인은 화면을 터치하여 서로의 파트너를 확인해주세요.";
    } else if (roleKey === 'mafia') {
        if (dayNumber === 1) ttsSpeechText = "마피아는 화면을 터치하여 멤버를 확인하세요. 킬은 실행되지 않습니다.";
        else ttsSpeechText = "마피아는 화면을 터치하여 제거할 대상을 선택해주세요.";
    } else if (roleKey === 'cop') {
        ttsSpeechText = "경찰은 화면을 터치하여 조사할 대상을 선택해주세요.";
    } else if (roleKey === 'doctor') {
        ttsSpeechText = "의사는 화면을 터치하여 치료할 대상을 선택해주세요.";
    } else if (roleKey === 'medium') {
        ttsSpeechText = "영매는 화면을 터치하여 직전 처형자의 마피아 여부를 확인해주세요.";
    } else if (roleKey === 'soldier') {
        ttsSpeechText = "군인은 화면을 터치하여 경찰 조사 여부를 확인해주세요.";
    }

    speak(ttsSpeechText);
}

function unlockNightPrivacy() {
    // Hide overlay
    const overlay = document.getElementById('night-privacy-overlay');
    overlay.style.opacity = 0;
    overlay.style.pointerEvents = 'none';
}

function confirmNightAction(roleKey) {
    // Overridden by individual setups, but fallback
    executeNightStepComplete(roleKey);
}

function executeNightStepComplete(roleKey) {
    // Guard: cop action must be explicitly acknowledged via modal
    if (roleKey === 'cop' && !copAcked) {
        console.warn('executeNightStepComplete blocked: cop not acknowledged yet.');
        return;
    }

    // Restore confirm button if hidden by Cop check
    const confirmBtn = document.getElementById('btn-confirm-night-action');
    if (confirmBtn) confirmBtn.classList.remove('hidden');
    
    // Transition back to privacy blackout with countdown
    const overlay = document.getElementById('night-privacy-overlay');
    if (overlay) {
        overlay.style.opacity = 1;
        overlay.style.pointerEvents = 'auto';
    }

    // Remove the "화면 보기" button to prevent reopening the privacy overlay and changing selections
    const privacyBtn = document.getElementById('btn-privacy-unlock');
    if (privacyBtn) {
        privacyBtn.style.display = 'none';
        privacyBtn.disabled = true;
    }

    // Lock target list so selections cannot be changed after confirming
    const targetsList = document.getElementById('night-targets-list');
    if (targetsList) {
        targetsList.style.pointerEvents = 'none';
    }

    // Disable confirm button to avoid duplicate interactions
    if (confirmBtn) {
        confirmBtn.disabled = true;
    }

    // (Removed visual locked badge per request)
    document.getElementById('privacy-target-role').textContent = "기록 완료";
    document.getElementById('privacy-target-desc').textContent = "화면이 곧 암전됩니다. 폰을 제자리에 두고 다시 눈을 감아주세요.";
    
    let countdown = 3;
    const descEl = document.getElementById('privacy-target-desc');
    const updateCountdown = () => {
        descEl.textContent = `폰을 제자리에 두고 눈을 감아주세요. (${countdown}초)`;
        if (countdown > 0) {
            countdown--;
            setTimeout(updateCountdown, 1000);
        } else {
            // Close step
            let endSpeechText = "";
            if (roleKey === 'lovers') endSpeechText = "연인은 눈을 감아주세요.";
            else if (roleKey === 'mafia') endSpeechText = "마피아는 눈을 감아주세요.";
            else if (roleKey === 'cop') endSpeechText = "경찰은 눈을 감아주세요.";
            else if (roleKey === 'doctor') endSpeechText = "의사는 눈을 감아주세요.";
            else if (roleKey === 'medium') endSpeechText = "영매는 눈을 감아주세요.";
            else if (roleKey === 'soldier') endSpeechText = "군인은 눈을 감아주세요.";
            
            speak(endSpeechText, () => {
                nightStepIndex++;
                setTimeout(() => {
                    progressNightStep();
                }, 1000);
            });
        }
    };
    updateCountdown();
}

// Night resolution details
function resolveNightEvents() {
    stopSuspenseDrone();
    // Transition audio: stop night loop and start day loop
    stopAudio('audio-night');
    playAudioLoop('audio-day');
    
    let victim = nightChoices.mafiaTarget;
    let saved = nightChoices.doctorTarget;
    let killedPlayerName = null;
    let reportText = "";
    
    if (victim) {
        if (saved && victim.id === saved.id) {
            // Saved by doctor
            reportText = `의사의 극적인 응급치료로 지난밤에는 <span style="color: var(--color-doctor)">아무도 사망하지 않았습니다</span>.`;
            gameLog.push(`[밤 ${dayNumber}] 마피아가 ${victim.name}을 공격했으나 의사가 살렸습니다.`);
        } else if (victim.role === 'soldier' && soldierShieldActive) {
            // Shielded by soldier passive
            soldierShieldActive = false;
            reportText = `마피아의 피습을 받은 <span style="color: var(--color-special)">군인이 첫 습격을 방패로 방어</span>하여 아무도 사망하지 않았습니다!`;
            gameLog.push(`[밤 ${dayNumber}] 마피아가 군인(${victim.name})을 공격했으나 군인 패시브 방어로 생존하였습니다.`);
        } else {
            // Victim dies
            victim.isAlive = false;
            killedPlayerName = victim.name;
            reportText = `<span style="color: var(--color-mafia); font-weight:900;">${escapeHtml(victim.name)} 님</span>이 지난 밤 마피아의 습격으로 사망하셨습니다. (최후 변론 없음)`;
            gameLog.push(`[밤 ${dayNumber}] 마피아의 공격으로 ${victim.name}가 사망하였습니다.`);
        }
    } else {
        reportText = `마피아가 지난 밤 아무도 공격하지 않았거나 살해에 실패하여 <span style="color: var(--color-doctor)">아무도 사망하지 않았습니다</span>.`;
        gameLog.push(`[밤 ${dayNumber}] 마피아가 타겟을 결정하지 못해 아무도 사망하지 않았습니다.`);
    }
    
    // Check game over
    const won = checkWinConditions();
    if (won) {
        // If game ended, checkWinConditions already transitioned to game-over screen.
        return;
    }

    // UI update
    document.getElementById('morning-report-text').innerHTML = reportText;
    showScreen('screen-day-transition');
    currentPhase = 'day-transition';
    
    playMorningChime();
    
    let morningTts = `아침이 밝았습니다. 모두 눈을 뜨고 핸드폰 결과를 확인하세요. `;
    if (killedPlayerName) {
        morningTts += `지난밤 마피아의 습격으로 ${killedPlayerName} 님이 사망하셨습니다.`;
    } else {
        morningTts += `의사의 치료 혹은 군인의 방어로 지난밤에는 아무도 사망하지 않았습니다.`;
    }
    
    speak(morningTts);
}

// Win condition checks
function checkWinConditions() {
    const alivePlayers = players.filter(p => p.isAlive);
    const mafiaCount = alivePlayers.filter(p => p.role === 'mafia').length;
    const citizenCount = alivePlayers.length - mafiaCount;
    
    if (mafiaCount === 0) {
        // Citizens win
        endGame('citizens');
        return true;
    } else if (mafiaCount >= citizenCount) {
        // Mafia win
        endGame('mafia');
        return true;
    }
    return false;
}

function endGame(winner) {
    console.debug('endGame: called', { winner, playersCount: players.length, gameLogLength: gameLog.length });

    showScreen('screen-game-over');
    currentPhase = 'game-over';
    
    const title = document.getElementById('game-over-winner-title');
    const desc = document.getElementById('game-over-winner-desc');
    const winnerBox = document.getElementById('game-over-winner-box');
    
    winnerBox.innerHTML = '';
    
    if (winner === 'citizens') {
        title.textContent = "시민 세력 승리!";
        desc.textContent = "모든 마피아 세력이 전원 처형되었습니다.";
        title.style.color = "var(--color-cop)";
        winnerBox.innerHTML = `<i data-lucide="trophy" class="trophy-icon" style="color: var(--color-cop); filter: var(--glow-cop)"></i>`;
        speak("축하합니다! 시민들이 모든 마피아를 소탕하고 승리했습니다.");
    } else {
        title.textContent = "마피아 세력 승리!";
        desc.textContent = "생존한 마피아의 수가 생존한 시민의 수와 같거나 많아졌습니다.";
        title.style.color = "var(--color-mafia)";
        winnerBox.innerHTML = `<i data-lucide="skull" class="trophy-icon" style="color: var(--color-mafia); filter: var(--glow-mafia)"></i>`;
        speak("경고! 마피아가 도시를 장악하였습니다. 마피아 세력이 승리했습니다.");
    }
    
    // Recap list
    const recapList = document.getElementById('game-over-roles-list');
    recapList.innerHTML = '';
    
    players.forEach(p => {
        const meta = ROLES_METADATA[p.role];
        const row = document.createElement('div');
        row.className = 'recap-player-row';
        row.innerHTML = `
            <div class="recap-player-name-group">
                <span class="recap-status-tag ${p.isAlive ? 'alive' : 'dead'}">${p.isAlive ? '생존' : '사망'}</span>
                <strong>${escapeHtml(p.name)}</strong>
            </div>
            <span class="recap-role-tag ${p.role === 'mafia' ? 'mafia' : p.role === 'cop' ? 'cop' : p.role === 'doctor' ? 'doctor' : p.role === 'citizen' ? 'citizen' : 'special'}">
                ${meta.name}
            </span>
        `;
        recapList.appendChild(row);
    });
    
    // Timeline list
    const timelineEl = document.getElementById('game-over-timeline-log');
    timelineEl.innerHTML = '';
    
    gameLog.forEach(log => {
        const row = document.createElement('div');
        row.className = 'timeline-event-row ' + (log.includes('투표') ? 'day' : 'night');
        row.textContent = log;
        timelineEl.appendChild(row);
    });
    
    lucide.createIcons();

    console.debug('endGame: completed, UI updated for game-over screen');
}

// Start Discussion Screen timer
function startDiscussion() {
    showScreen('screen-day-discussion');
    currentPhase = 'day-discussion';
    
    // Set timer
    timerTimeLeft = discussionDuration;
    isTimerPaused = false;
    
    updateTimerProgress();
    updateTimerText();
    
    // Populating alive status mini grid
    const miniGrid = document.getElementById('discussion-alive-players');
    miniGrid.innerHTML = '';
    
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'mini-player-item ' + (p.isAlive ? 'alive' : 'dead');
        item.textContent = p.name;
        miniGrid.appendChild(item);
    });
    
    // Start ticking loop
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!isTimerPaused) {
            timerTimeLeft--;
            updateTimerText();
            updateTimerProgress();
            
            // Audio beeps for last 5 seconds
            if (timerTimeLeft <= 5 && timerTimeLeft > 0) {
                playTickSound();
            }
            
            // TTS alerts
            if (timerTimeLeft === 60) {
                speak("토론 시간 1분 남았습니다.");
            } else if (timerTimeLeft === 10) {
                speak("토론 시간 10초 전입니다.");
            } else if (timerTimeLeft <= 0) {
                clearInterval(timerInterval);
                playAlarmSound();
                speak("토론 시간이 모두 종료되었습니다. 아래 버튼을 눌러 투표 단계로 이동해 주세요.");
                
                // Mark timer visual danger
                document.querySelector('.timer-container').classList.add('warning');
            }
        }
    }, 1000);
    
    // Reset timer container styles
    document.querySelector('.timer-container').classList.remove('warning');
    
    // Reset toggle icon
    document.getElementById('timer-toggle-icon').setAttribute('data-lucide', 'pause');
    lucide.createIcons();
    
    speak(`자유 토론 시간 ${Math.floor(discussionDuration / 60)}분이 주어집니다. 마피아로 의심되는 사람을 토론을 통해 색출하세요.`);
}

function updateTimerText() {
    const mins = Math.floor(timerTimeLeft / 60);
    const secs = timerTimeLeft % 60;
    document.getElementById('timer-time-display').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateTimerProgress() {
    const circle = document.getElementById('timer-prog-bar');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    const offset = circumference - (timerTimeLeft / discussionDuration) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // Add flashing warning on final 15s
    const container = document.querySelector('.timer-container');
    if (timerTimeLeft <= 15) {
        container.classList.add('warning');
    } else {
        container.classList.remove('warning');
    }
}

function toggleTimer() {
    isTimerPaused = !isTimerPaused;
    const icon = document.getElementById('timer-toggle-icon');
    if (isTimerPaused) {
        icon.setAttribute('data-lucide', 'play');
        speak("타이머가 일시정지 되었습니다.");
    } else {
        icon.setAttribute('data-lucide', 'pause');
        speak("타이머가 재개되었습니다.");
    }
    lucide.createIcons();
}

// Render Voting interface
function enterVoteScreen() {
    clearInterval(timerInterval);
    showScreen('screen-day-vote');
    currentPhase = 'day-vote';

    // Stop other ambient audio and start vote background
    stopAudio('audio-night');
    stopAudio('audio-day');
    stopAudio('audio-final');
    playAudioLoop('audio-vote');

    const list = document.getElementById('vote-targets-list');
    list.innerHTML = '';
    // Ensure list is visible (may have been hidden by final-defense or execution flow)
    list.style.display = '';

    let selectedPlayerId = null;
    const confirmBtn = document.getElementById('btn-confirm-execution');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '최후변론 시작';

    // Ensure any previous final UI is cleaned
    // Also ensure skip button is visible
    const skipBtn = document.getElementById('btn-skip-execution');
    if (skipBtn) skipBtn.style.display = '';
    const existingFinalCard = document.getElementById('final-defense-card');
    if (existingFinalCard && existingFinalCard.parentNode) existingFinalCard.parentNode.removeChild(existingFinalCard);
    const existingCancel = document.getElementById('btn-final-cancel');
    if (existingCancel && existingCancel.parentNode) existingCancel.parentNode.removeChild(existingCancel);

    // Build vote list (players)
    players.forEach(p => {
        if (!p.isAlive) return;

        const item = document.createElement('div');
        item.className = 'target-item';
        item.textContent = p.name;

        item.onclick = () => {
            // Select this candidate
            document.querySelectorAll('#vote-targets-list .target-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            selectedPlayerId = p.id;
            confirmBtn.disabled = false;
            confirmBtn.textContent = '최후변론 시작';
        };
        list.appendChild(item);
    });

    // confirmBtn triggers final-defense stage for selected player
    confirmBtn.onclick = () => {
        if (!selectedPlayerId) return;
        // Show final defense UI
        showFinalDefense(selectedPlayerId);
    };

    speak('투표를 진행하세요. 처형할 대상을 선택하거나, 아무도 처형하지 않으면 목록의 해당 항목을 선택하세요. 선택 후 최후변론 시작 버튼을 눌러주세요.');
}

// Show a focused final-defense UI where only the defendant is emphasized
function showFinalDefense(playerId) {
    // Double-check: announce start of final defense, then show focused UI
    // Stop vote ambience first so TTS is clear
    stopAudio('audio-vote');
    stopAudio('audio-night');
    stopAudio('audio-day');

    // Show final-defense UI immediately (do not wait for TTS)
    playAudioLoop('audio-final');

    const list = document.getElementById('vote-targets-list');
    // Hide or dim the list to make clear the UI changed
    if (list) list.style.display = 'none';
    // Hide the bottom "skip execution" button during final-defense to avoid confusion
    const skipBtn = document.getElementById('btn-skip-execution');
    if (skipBtn) skipBtn.style.display = 'none';

    const footer = document.querySelector('#screen-day-vote .screen-footer');
    // Create a prominent card showing the defendant
    let card = document.getElementById('final-defense-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'final-defense-card';
        card.style.padding = '20px';
        card.style.textAlign = 'center';
        card.style.background = 'var(--card-bg, rgba(0,0,0,0.03))';
        card.style.borderRadius = '8px';
        card.style.margin = '12px';
        card.style.fontSize = '1.6rem';
        card.style.fontWeight = '800';
        card.style.boxShadow = '0 6px 18px rgba(0,0,0,0.06)';
        const container = document.querySelector('#screen-day-vote .screen-body');
        if (container) container.insertBefore(card, container.firstChild);
    }

    const p = players.find(x => x.id === playerId);
    card.textContent = p ? `${p.name} 님의 최후변론` : '선택된 플레이어';

    // Ensure only two buttons exist: 처형 취소 and 처형 진행
    // Remove existing cancel if any
    const oldCancel = document.getElementById('btn-final-cancel');
    if (oldCancel && oldCancel.parentNode) oldCancel.parentNode.removeChild(oldCancel);

    // Configure confirm button as '처형 진행'
    const confirmBtn = document.getElementById('btn-confirm-execution');
    confirmBtn.textContent = '처형 진행';
    confirmBtn.disabled = false;

    // Create cancel button if not present
    let cancelBtn = document.getElementById('btn-final-cancel');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-final-cancel';
        cancelBtn.className = 'btn btn-secondary btn-block';
        cancelBtn.textContent = '처형 취소';
        // Insert cancel before confirm in footer
        if (footer) footer.insertBefore(cancelBtn, confirmBtn);
    }

    // Cancel returns to voting UI (restore list and remove final card)
    cancelBtn.onclick = () => {
        cancelFinalDefense();
    };

    // Confirm executes the player
    confirmBtn.onclick = () => {
        // Delegate execution flow to executePlayer which will show announcement and transition to night
        executePlayer(playerId);
    };

    // Announce the start of final-defense for accessibility (non-blocking)
    speak('최후변론을 시작해주세요.');
}

function cancelFinalDefense() {
    // Stop final audio and resume vote ambiance
    stopAudio('audio-final');
    playAudioLoop('audio-vote');

    // Restore voting UI
    const listEl = document.getElementById('vote-targets-list');
    if (listEl) listEl.style.display = '';
    const cardEl = document.getElementById('final-defense-card');
    if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);

    // Restore confirm button to '최후변론 시작' and disable until selection
    const confirmBtn = document.getElementById('btn-confirm-execution');
    confirmBtn.textContent = '최후변론 시작';
    confirmBtn.disabled = true;

    // Remove cancel button
    const cb = document.getElementById('btn-final-cancel');
    if (cb && cb.parentNode) cb.parentNode.removeChild(cb);

    // Restore bottom skip button visibility
    const skipBtn = document.getElementById('btn-skip-execution');
    if (skipBtn) skipBtn.style.display = '';

    speak('처형이 취소되었습니다. 투표 화면으로 돌아갑니다.');
}

function skipExecution() {
    clearInterval(timerInterval);

    // Stop vote/final ambience before moving to night
    stopAudio('audio-vote');
    stopAudio('audio-final');

    speak("부결 혹은 과반수 미달로 아무도 처형하지 않고 밤이 찾아옵니다.", () => {
        dayNumber++;
        enterNightTransition();
    });
    gameLog.push(`[낮 ${dayNumber}] 투표 결과 아무도 처형되지 않았습니다.`);
}

function executePlayer(playerId) {
    // Stop vote/final ambience when executing
    stopAudio('audio-vote');
    stopAudio('audio-final');

    const p = players.find(x => x.id === playerId);
    if (!p) return;
    
    // Check Politician ability
    if (p.role === 'politician') {
        speak(`${p.name} 님은 정치인입니다! 본인의 면역 권한으로 인해 투표 처형당하지 않고 살아남습니다.`, () => {
            gameLog.push(`[낮 ${dayNumber}] 투표로 정치인 ${p.name}이 지목되었으나 패시브로 생존했습니다.`);
            dayNumber++;
            enterNightTransition();
        });
        return;
    }
    
    // Standard Execution
    p.isAlive = false;
    lastExecutedPlayer = p; // Stored for Medium check next night

    // Clean up final defense UI if present
    const finalCancel = document.getElementById('btn-final-cancel');
    if (finalCancel && finalCancel.parentNode) finalCancel.parentNode.removeChild(finalCancel);
    const finalCard = document.getElementById('final-defense-card');
    if (finalCard && finalCard.parentNode) finalCard.parentNode.removeChild(finalCard);

    // Ensure bottom skip button is restored state (if it was hidden earlier)
    const skipBtn = document.getElementById('btn-skip-execution');
    if (skipBtn) skipBtn.style.display = '';

    // Hide vote list to avoid confusion
    const listEl = document.getElementById('vote-targets-list');
    if (listEl) listEl.style.display = 'none';

    // Show execution announcement overlay/card with a Next button to advance
    let ann = document.getElementById('execution-announcement');
    if (!ann) {
        ann = document.createElement('div');
        ann.id = 'execution-announcement';
        ann.style.position = 'absolute';
        ann.style.left = 0;
        ann.style.top = 0;
        ann.style.right = 0;
        ann.style.bottom = 0;
        ann.style.display = 'flex';
        ann.style.alignItems = 'center';
        ann.style.justifyContent = 'center';
        ann.style.background = 'rgba(0,0,0,0.6)';
        ann.style.zIndex = 9999;

        const inner = document.createElement('div');
        inner.style.background = 'white';
        inner.style.padding = '24px 28px';
        inner.style.borderRadius = '10px';
        inner.style.textAlign = 'center';
        inner.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
        inner.style.maxWidth = '90%';

        const title = document.createElement('div');
        title.style.fontSize = '1.6rem';
        title.style.fontWeight = '800';
        title.style.color = 'var(--color-mafia)';
        title.textContent = `${p.name} 님이 처형당했습니다.`;

        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-primary';
        nextBtn.textContent = '다음';
        nextBtn.style.marginTop = '14px';
        nextBtn.style.padding = '10px 16px';

        nextBtn.onclick = () => {
            // Cancel any scheduled auto-advance
            if (executionAutoAdvanceTimer) {
                clearTimeout(executionAutoAdvanceTimer);
                executionAutoAdvanceTimer = null;
            }

            const annEl = document.getElementById('execution-announcement');
            if (annEl && annEl.parentNode) annEl.parentNode.removeChild(annEl);
            dayNumber++;
            enterNightTransition();
        };

        inner.appendChild(title);
        inner.appendChild(nextBtn);
        ann.appendChild(inner);

        const container = document.getElementById('screen-container') || document.body;
        container.appendChild(ann);
    } else {
        const innerDiv = ann.querySelector('div');
        if (innerDiv) innerDiv.firstChild.textContent = `${p.name} 님이 처형당했습니다.`;
        ann.style.display = 'flex';
    }

    // Record event immediately and check win conditions
    gameLog.push(`[낮 ${dayNumber}] 투표 결과 ${p.name}가 처형되어 사망하였습니다.`);

    const isEnded = checkWinConditions();
    if (isEnded) {
        // If game ended, remove announcement and return (endGame already called)
        const annEl = document.getElementById('execution-announcement');
        if (annEl && annEl.parentNode) annEl.parentNode.removeChild(annEl);
        return;
    }

    // Fallback: if nobody presses Next within 10s, auto-advance
    if (executionAutoAdvanceTimer) {
        clearTimeout(executionAutoAdvanceTimer);
        executionAutoAdvanceTimer = null;
    }
    executionAutoAdvanceTimer = setTimeout(() => {
        executionAutoAdvanceTimer = null;
        const annEl = document.getElementById('execution-announcement');
        if (annEl && annEl.parentNode) annEl.parentNode.removeChild(annEl);
        dayNumber++;
        enterNightTransition();
    }, 10000);

    // Announce (non-blocking)
    speak(`${p.name} 님이 처형당하셨습니다.`);

}

// Reset Game / Wipe State
function resetGame() {
    console.debug('resetGame: called', { playersCount: players.length, currentPhase, isTtsEnabled, isDroneEnabled, discussionDuration });

    // stop timers and audio
    clearInterval(timerInterval);
    stopSuspenseDrone();
    stopAudio('audio-night');
    stopAudio('audio-day');
    stopAudio('audio-vote');
    stopAudio('audio-final');

    // Keep existing players but reset roles and alive status so a new game can be started with same member list
    players.forEach(p => {
        p.role = null;
        p.isAlive = true;
    });

    // Reset core game state
    dayNumber = 1;
    gameLog = [];
    lastExecutedPlayer = null;
    soldierShieldActive = true;
    copInvestigatedPlayers = [];
    currentPhase = 'setup';

    // Ensure setup UI is editable: enable add input/button and make player list interactive
    const input = document.getElementById('input-player-name');
    if (input) input.disabled = false;
    const addBtn = document.getElementById('btn-add-player');
    if (addBtn) addBtn.disabled = false;
    const playersListEl = document.getElementById('players-list');
    if (playersListEl) playersListEl.style.pointerEvents = '';

    // Remove any DOM-level flags that might have marked members as immutable
    document.querySelectorAll('[data-immutable="true"]').forEach(el => el.removeAttribute('data-immutable'));
    document.querySelectorAll('.player-badge.immutable').forEach(el => el.classList.remove('immutable'));

    // Ensure known overlays/modals are removed or disabled
    try {
        const nightOverlay = document.getElementById('night-privacy-overlay');
        if (nightOverlay) { nightOverlay.style.opacity = 0; nightOverlay.style.pointerEvents = 'none'; }
        const execAnn = document.getElementById('execution-announcement');
        if (execAnn && execAnn.parentNode) execAnn.parentNode.removeChild(execAnn);
        const settingsDialog = document.getElementById('settings-dialog-overlay');
        if (settingsDialog && settingsDialog.parentNode) settingsDialog.parentNode.removeChild(settingsDialog);
        const finalCard = document.getElementById('final-defense-card');
        if (finalCard && finalCard.parentNode) finalCard.parentNode.removeChild(finalCard);
        // Remove any floating modals created dynamically (investigation modal): look for elements with text '조사 결과' or role-related overlays
        document.querySelectorAll('div').forEach(d => {
            try {
                if (d.innerText && (d.innerText.includes('조사 결과') || d.innerText.includes('초기화 오류가 발생했습니다') || d.id === 'invOverlay')) {
                    if (d.parentNode) d.parentNode.removeChild(d);
                }
            } catch (e) {}
        });
    } catch (e) { console.warn('resetGame: overlay cleanup error', e); }

    // Clear inline pointer-events that may block interaction and re-enable buttons/inputs
    try {
        document.querySelectorAll('[style]').forEach(el => {
            if (el.style && el.style.pointerEvents) el.style.pointerEvents = '';
        });
        document.querySelectorAll('button').forEach(b => b.disabled = false);
        const inputName = document.getElementById('input-player-name'); if (inputName) inputName.disabled = false;
    } catch (e) { console.warn('resetGame: enable UI error', e); }

    // Render setup
    showScreen('screen-setup');
    renderSetupScreen();

    console.debug('resetGame: completed', { playersCount: players.length });
    // Keep TTS short and non-identifying
    speak("새 게임 설정이 완료되었습니다.");
}

// Escape html tags helper
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Settings dialog helper
function showSettingsDialog() {
    // Remove existing dialog if any
    const existing = document.getElementById('settings-dialog-overlay');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    const overlay = document.createElement('div');
    overlay.id = 'settings-dialog-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = 0;
    overlay.style.top = 0;
    overlay.style.right = 0;
    overlay.style.bottom = 0;
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 10000;

    const panel = document.createElement('div');
    panel.style.background = '#0b0b0b';
    panel.style.color = '#ffffff';
    panel.style.border = '2px solid #ffffff';
    panel.style.padding = '18px';
    panel.style.borderRadius = '12px';
    panel.style.width = '92%';
    panel.style.maxWidth = '520px';
    panel.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';
    panel.style.fontFamily = '"Noto Sans KR", sans-serif';

    const title = document.createElement('h3');
    title.textContent = '설정';
    title.style.margin = '0 0 8px 0';
    title.style.fontSize = '1.3rem';
    title.style.fontWeight = '800';
    panel.appendChild(title);

    // Helper to create section blocks
    function createSection() {
        const sec = document.createElement('div');
        sec.style.background = '#0f0f0f';
        sec.style.border = '1px solid rgba(255,255,255,0.06)';
        sec.style.padding = '10px';
        sec.style.borderRadius = '8px';
        sec.style.margin = '10px 0';
        return sec;
    }

    // TTS toggle section
    const secTts = createSection();
    const ttsRow = document.createElement('div');
    ttsRow.style.display = 'flex';
    ttsRow.style.justifyContent = 'space-between';
    ttsRow.style.alignItems = 'center';

    const ttsLabel = document.createElement('div');
    ttsLabel.textContent = '음성 사회자 (TTS)';
    ttsLabel.style.fontWeight = '700';
    ttsLabel.style.fontSize = '1rem';

    const ttsInput = document.createElement('input');
    ttsInput.type = 'checkbox';
    ttsInput.checked = isTtsEnabled;
    ttsInput.style.width = '22px';
    ttsInput.style.height = '22px';
    ttsInput.style.accentColor = '#0a84ff';
    ttsInput.onchange = (e) => { isTtsEnabled = e.target.checked; document.getElementById('setting-tts-toggle').checked = isTtsEnabled; };

    ttsRow.appendChild(ttsLabel);
    ttsRow.appendChild(ttsInput);
    secTts.appendChild(ttsRow);
    panel.appendChild(secTts);

    // Discussion time section
    const secTime = createSection();
    const timeLabel = document.createElement('div');
    timeLabel.textContent = '낮 토론 시간';
    timeLabel.style.fontWeight = '700';
    timeLabel.style.marginBottom = '8px';
    secTime.appendChild(timeLabel);

    const timeInput = document.createElement('input');
    timeInput.type = 'range';
    timeInput.min = 30; timeInput.max = 300; timeInput.step = 30;
    timeInput.value = discussionDuration;
    timeInput.style.width = '100%';
    timeInput.style.appearance = 'none';
    timeInput.style.height = '10px';
    timeInput.style.background = '#222';
    timeInput.style.borderRadius = '6px';
    timeInput.oninput = (e) => {
        discussionDuration = parseInt(e.target.value);
        document.getElementById('setting-discussion-time').value = discussionDuration;
        updateSettingsUI();
        timeVal.textContent = `${Math.floor(discussionDuration/60)}분 ${(discussionDuration%60).toString().padStart(2,'0')}초`;
    };

    const timeVal = document.createElement('div');
    timeVal.style.fontSize = '0.95rem';
    timeVal.style.color = 'rgba(255,255,255,0.9)';
    timeVal.style.marginTop = '8px';
    timeVal.textContent = `${Math.floor(discussionDuration/60)}분 ${(discussionDuration%60).toString().padStart(2,'0')}초`;

    secTime.appendChild(timeInput);
    secTime.appendChild(timeVal);
    panel.appendChild(secTime);

    // TTS speed section
    const secSpeed = createSection();
    const speedLabel = document.createElement('div');
    speedLabel.textContent = 'TTS 목소리 속도';
    speedLabel.style.fontWeight = '700';
    speedLabel.style.marginBottom = '8px';
    secSpeed.appendChild(speedLabel);

    const speedInput = document.createElement('input');
    speedInput.type = 'range';
    speedInput.min = 0.7; speedInput.max = 1.5; speedInput.step = 0.1;
    speedInput.value = ttsSpeed;
    speedInput.style.width = '100%';
    speedInput.style.appearance = 'none';
    speedInput.style.height = '10px';
    speedInput.style.background = '#222';
    speedInput.style.borderRadius = '6px';
    speedInput.oninput = (e) => {
        ttsSpeed = parseFloat(e.target.value);
        document.getElementById('setting-tts-speed').value = ttsSpeed;
        updateSettingsUI();
        speedVal.textContent = `${ttsSpeed.toFixed(1)}x`;
    };

    const speedVal = document.createElement('div');
    speedVal.style.fontSize = '0.95rem';
    speedVal.style.color = 'rgba(255,255,255,0.9)';
    speedVal.style.marginTop = '8px';
    speedVal.textContent = `${ttsSpeed.toFixed(1)}x`;

    secSpeed.appendChild(speedInput);
    secSpeed.appendChild(speedVal);
    panel.appendChild(secSpeed);

    // Footer actions (Test TTS + Close)
    const footerRow = document.createElement('div');
    footerRow.style.display = 'flex';
    footerRow.style.gap = '10px';
    footerRow.style.marginTop = '12px';

    const testBtn = document.createElement('button');
    testBtn.className = 'btn';
    testBtn.textContent = '목소리 테스트';
    testBtn.style.flex = '1';
    testBtn.style.background = '#111';
    testBtn.style.color = '#fff';
    testBtn.style.border = '1px solid rgba(255,255,255,0.06)';
    testBtn.style.padding = '10px 12px';
    testBtn.onclick = () => { initAudio(); speak('마피아 게임 사회자 테스트 음성입니다.'); };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn';
    closeBtn.textContent = '닫기';
    closeBtn.style.flex = '0 0 110px';
    closeBtn.style.background = '#ff4b4b';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = 'none';
    closeBtn.style.padding = '10px 14px';
    closeBtn.style.borderRadius = '8px';
    closeBtn.onclick = () => {
        // propagate current settings to main controls
        document.getElementById('setting-tts-toggle').checked = isTtsEnabled;
        document.getElementById('setting-discussion-time').value = discussionDuration;
        document.getElementById('setting-tts-speed').value = ttsSpeed;
        updateSettingsUI();
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    footerRow.appendChild(testBtn);
    footerRow.appendChild(closeBtn);
    panel.appendChild(footerRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
}

// Listeners Bindings
document.addEventListener('DOMContentLoaded', () => {
    try {
        // 1. Setup Screen buttons
        const btnAdd = document.getElementById('btn-add-player');
        if (btnAdd) btnAdd.addEventListener('click', addPlayer);
        const inputPlayer = document.getElementById('input-player-name');
        if (inputPlayer) inputPlayer.addEventListener('keydown', (e) => { if (e.key === 'Enter') addPlayer(); });
        
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) btnStart.addEventListener('click', startGame);
        
        // Toggle Settings panel drawer (setup-screen inline button removed; guard in case it exists)
        const btnToggleSettings = document.getElementById('btn-toggle-settings');
        if (btnToggleSettings) {
            btnToggleSettings.addEventListener('click', () => {
                const panel = document.getElementById('settings-panel');
                if (panel) panel.classList.toggle('collapsed');
            });
        }
        
        // Settings adjustments listeners
        const ttsToggleEl = document.getElementById('setting-tts-toggle');
        if (ttsToggleEl) ttsToggleEl.addEventListener('change', (e) => { isTtsEnabled = e.target.checked; });
        
        const discTimeRange = document.getElementById('setting-discussion-time');
        if (discTimeRange) discTimeRange.addEventListener('input', (e) => { discussionDuration = parseInt(e.target.value); updateSettingsUI(); });
        
        const ttsSpeedRange = document.getElementById('setting-setting-tts-speed') || document.getElementById('setting-tts-speed');
        if (ttsSpeedRange) ttsSpeedRange.addEventListener('input', (e) => { ttsSpeed = parseFloat(e.target.value); updateSettingsUI(); });
        
        const btnTestTts = document.getElementById('btn-test-tts');
        if (btnTestTts) btnTestTts.addEventListener('click', () => { initAudio(); speak("마피아 게임 사회자 테스트 음성입니다. 목소리가 정상적으로 들리시나요?"); });
        
        // Reset Header Button
        // Header settings button opens a modal dialog showing current settings
        const btnReset = document.getElementById('btn-reset-game');
        if (btnReset) btnReset.addEventListener('click', () => { showSettingsDialog(); });
    
        // 2. Reveal Screen buttons
        // Support both a dedicated reveal button (btn-reveal-card) and clicking the card itself (interactive-role-card)
        const revealCardEl = document.getElementById('interactive-role-card') || document.getElementById('btn-reveal-card');
        if (revealCardEl) revealCardEl.addEventListener('click', revealCard);
        const btnNextPlayer = document.getElementById('btn-next-player');
        if (btnNextPlayer) btnNextPlayer.addEventListener('click', nextPlayerReveal);
        
        // 3. Night Transition: automatic countdown (button removed) — no click listener required
        
        // 4. Night Action privacy unlocker button
        const privacyUnlock = document.getElementById('btn-privacy-unlock');
        if (privacyUnlock) privacyUnlock.addEventListener('click', unlockNightPrivacy);
        
        // 5. Day Transition buttons
        const btnStartDiscussion = document.getElementById('btn-start-discussion');
        if (btnStartDiscussion) btnStartDiscussion.addEventListener('click', startDiscussion);
        
        // 6. Day Discussion Timer controls
        const btnTimerToggle = document.getElementById('btn-timer-toggle');
        if (btnTimerToggle) btnTimerToggle.addEventListener('click', toggleTimer);
        const btnGoVote = document.getElementById('btn-go-to-vote');
        if (btnGoVote) btnGoVote.addEventListener('click', enterVoteScreen);
        
        // 7. Day Vote buttons
        const btnSkipExec = document.getElementById('btn-skip-execution');
        if (btnSkipExec) btnSkipExec.addEventListener('click', skipExecution);
        
        // 8. Game Over buttons
        const btnRestart = document.getElementById('btn-restart-game');
        if (btnRestart) btnRestart.addEventListener('click', () => { console.debug('btn-restart-game clicked', { playersCount: players.length }); resetGame(); });
        
        // Load setting defaults
        updateSettingsUI();
        
        // Render initial setup
        renderSetupScreen();
    } catch (err) {
        console.error('Initialization error:', err);
        // Show user-visible error overlay to aid debugging
        const errOverlay = document.createElement('div');
        errOverlay.style.position = 'fixed';
        errOverlay.style.left = 0;
        errOverlay.style.top = 0;
        errOverlay.style.right = 0;
        errOverlay.style.bottom = 0;
        errOverlay.style.background = 'rgba(0,0,0,0.85)';
        errOverlay.style.color = '#fff';
        errOverlay.style.display = 'flex';
        errOverlay.style.alignItems = 'center';
        errOverlay.style.justifyContent = 'center';
        errOverlay.style.zIndex = 20000;
        errOverlay.style.padding = '20px';

        const msg = document.createElement('div');
        msg.style.maxWidth = '92%';
        msg.style.textAlign = 'left';
        msg.innerHTML = `<h3 style="margin-bottom:8px;">초기화 오류가 발생했습니다</h3><pre style="white-space:pre-wrap;color:#ffdddd;">${(err && err.stack) ? err.stack : String(err)}</pre><p>개발 콘솔을 확인하세요.</p>`;
        errOverlay.appendChild(msg);
        document.body.appendChild(errOverlay);
    }
});
