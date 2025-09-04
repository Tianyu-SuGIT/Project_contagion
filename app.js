document.addEventListener('DOMContentLoaded', () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    // Views
    const lobbyView = document.getElementById('lobby-view');
    const gameView = document.getElementById('game-view');
    const endView = document.getElementById('end-view');

    // Lobby elements
    const nameInput = document.getElementById('name-input');
    const joinButton = document.getElementById('join-button');
    const playerList = document.getElementById('player-list');
    const startButton = document.getElementById('start-button');

    // Game elements
    const roleName = document.getElementById('role-name');
    const roleDescription = document.getElementById('role-description');
    const terroristPartner = document.getElementById('terrorist-partner');
    const cureProgressBar = document.getElementById('progress-bar');
    const cureStatus = document.getElementById('cure-status');
    const phaseDisplay = document.getElementById('phase-display');
    const playerCircleContainer = document.getElementById('player-circle-container');
    const logList = document.getElementById('log-list');
    const feedbackMessage = document.getElementById('feedback-message');
    const actionOverlay = document.getElementById('action-overlay');
    const actionTitle = document.getElementById('action-title');
    const actionPrompt = document.getElementById('action-prompt');
    const confirmActionButton = document.getElementById('confirm-action-button');

    // Terrorist Chat
    const terroristChatContainer = document.getElementById('terrorist-chat-container');
    const terroristMessages = document.getElementById('terrorist-messages');
    const terroristChatInput = document.getElementById('terrorist-chat-input');
    const terroristChatSend = document.getElementById('terrorist-chat-send');

    // End view elements
    const winTitle = document.getElementById('win-title');
    const winReason = document.getElementById('win-reason');
    const finalRolesList = document.getElementById('final-roles-list');
    const playAgainButton = document.getElementById('play-again-button');

    let localPlayer = { id: null, name: null, role: null };
    let selectedTargetId = null;

    // --- WebSocket Handlers ---
    ws.onopen = () => {
        console.log('Connected to server');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Received:', message);
        switch (message.type) {
            case 'GAME_STATE_UPDATE':
                updateUI(message.payload);
                break;
            case 'PRIVATE_FEEDBACK':
                feedbackMessage.textContent = message.payload;
                break;
            case 'ACTION_CONFIRMED':
                actionOverlay.style.display = 'none';
                break;
            case 'TERRORIST_CHAT_MESSAGE':
                const msg = document.createElement('div');
                msg.textContent = `${message.payload.sender}: ${message.payload.message}`;
                terroristMessages.appendChild(msg);
                terroristMessages.scrollTop = terroristMessages.scrollHeight;
                break;
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        // Maybe show a reconnect button
    };

    // --- Event Listeners ---
    joinButton.addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (name) {
            localPlayer.name = name;
            sendMessage('JOIN_GAME', { name });
            joinButton.disabled = true;
            nameInput.disabled = true;
        }
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            joinButton.click();
        }
    });

    startButton.addEventListener('click', () => {
        sendMessage('START_GAME', {});
    });

    confirmActionButton.addEventListener('click', () => {
        if (selectedTargetId) {
            const action = getPlayerAction(localPlayer.role);
            sendMessage('NIGHT_ACTION', { action, targetId: selectedTargetId });
            confirmActionButton.disabled = true;
        }
    });

    terroristChatSend.addEventListener('click', () => {
        const message = terroristChatInput.value;
        if (message.trim() !== '') {
            sendMessage('TERRORIST_CHAT', { message });
            terroristChatInput.value = '';
        }
    });

    terroristChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            terroristChatSend.click();
        }
    });

    playAgainButton.addEventListener('click', () => {
        // Simple refresh to go back to lobby
        window.location.reload();
    });

    // --- UI Update Logic ---
    function updateUI(state) {
        // Update view visibility
        lobbyView.style.display = state.phase === 'LOBBY' ? 'flex' : 'none';
        gameView.style.display = (state.phase === 'NIGHT' || state.phase === 'DAY') ? 'grid' : 'none';
        endView.style.display = state.phase === 'END' ? 'block' : 'none';

        if (state.phase === 'LOBBY') {
            updateLobby(state);
        } else if (state.phase === 'NIGHT' || state.phase === 'DAY') {
            localPlayer = { ...localPlayer, ...state.you };
            updateGameView(state);
        } else if (state.phase === 'END') {
            updateEndView(state);
        }
    }

    function updateLobby(state) {
        const { players } = state;
        playerList.innerHTML = '';
        players.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name;
            playerList.appendChild(li);
        });
        startButton.disabled = players.length < 8;
    }

    function updateGameView(state) {
        phaseDisplay.textContent = `Phase: ${state.phase} - Round: ${state.round}`;
        document.body.className = state.phase === 'NIGHT' ? 'night-phase' : '';

        // Role Info
        roleName.textContent = state.you.role;
        roleDescription.textContent = getRoleDescription(state.you.role);
        if (state.you.partner) {
            terroristPartner.textContent = `Your partner is ${state.you.partner}.`;
            terroristPartner.style.display = 'block';
        }
        terroristChatContainer.style.display = state.you.role === 'Terrorista' ? 'block' : 'none';

        // Cure Progress
        const curePercentage = (state.cureProgress / 3) * 100;
        cureProgressBar.style.width = `${curePercentage}%`;
        cureStatus.textContent = `${state.cureProgress} / 3`;

        // Event Log
        logList.innerHTML = '';
        state.gameLog.forEach(entry => {
            const li = document.createElement('li');
            li.textContent = entry;
            logList.appendChild(li);
        });

        // Player Circle
        renderPlayerCircle(state); // Pass the whole state

        // Action Overlay
        handleActionOverlay(state.you, state.phase);
    }

    function renderPlayerCircle(state) { // Changed parameter
        const { players, you, phase, votes } = state; // Destructure state
        playerCircleContainer.innerHTML = '';
        const numPlayers = players.length;
        const radius = 180;

        // Create a map of targetId -> [voter names]
        const voteMap = {};
        for (const voterId in votes) {
            const targetId = votes[voterId];
            if (!voteMap[targetId]) {
                voteMap[targetId] = [];
            }
            const voter = players.find(p => p.id === voterId);
            if (voter) {
                voteMap[targetId].push(voter.name);
            }
        }

        players.forEach((p, i) => {
            const angle = (i / numPlayers) * 2 * Math.PI - (Math.PI / 2);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            const avatar = document.createElement('div');
            avatar.className = 'player-avatar';
            avatar.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            avatar.dataset.id = p.id;

            if (!p.isAlive) avatar.classList.add('is-dead');
            if (p.id === you.id) avatar.style.borderColor = '#00ff00';

            let voteDisplay = '';
            if (phase === 'DAY' && voteMap[p.id]) {
                voteDisplay = `<div class="vote-count">Voted by: ${voteMap[p.id].join(', ')}</div>`;
            }

            avatar.innerHTML = `<div class="player-name">${p.name}</div><div class="player-pos">${p.position}</div>${voteDisplay}`;
            
            // Add click listener for targeting (NIGHT)
            if (phase === 'NIGHT' && p.isAlive && p.id !== you.id) {
                avatar.addEventListener('click', () => handleTargetSelection(p.id));
            }

            // Add vote button (DAY)
            if (phase === 'DAY' && p.isAlive && you.isAlive) {
                const voteButton = document.createElement('button');
                voteButton.className = 'vote-button';
                voteButton.textContent = 'Vote';
                if (votes[you.id]) { // If player has already voted
                    voteButton.disabled = true;
                }
                voteButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent avatar click event
                    sendMessage('VOTE', { targetId: p.id });
                });
                avatar.appendChild(voteButton);
            }

            playerCircleContainer.appendChild(avatar);
        });
    }

    function handleTargetSelection(targetId) {
        selectedTargetId = targetId;
        // Remove previous selections
        document.querySelectorAll('.player-avatar.selected').forEach(el => el.classList.remove('selected'));
        // Highlight new selection
        const avatar = document.querySelector(`.player-avatar[data-id='${targetId}']`);
        if (avatar) avatar.classList.add('selected');
        confirmActionButton.disabled = false;
    }

    function handleActionOverlay(you, phase) {
        const action = getPlayerAction(you.role);
        if (phase === 'NIGHT' && action && you.isAlive) {
            actionOverlay.style.display = 'block';
            actionTitle.textContent = `Your Action: ${action.replace('_', ' ')}`;
            actionPrompt.textContent = getActionPrompt(action);
            confirmActionButton.disabled = true;
            selectedTargetId = null;
            document.querySelectorAll('.player-avatar.selected').forEach(el => el.classList.remove('selected'));
        } else {
            actionOverlay.style.display = 'none';
        }
    }

    function updateEndView(state) {
        winTitle.textContent = `${state.winData.winner} Win!`;
        winReason.textContent = state.winData.reason;

        finalRolesList.innerHTML = '';
        state.players.forEach(p => {
            const li = document.createElement('li');
            const playerWithRole = state.winData.fullRoles.find(fr => fr.id === p.id);
            li.textContent = `${p.name}: ${playerWithRole.role}`;
            finalRolesList.appendChild(li);
        });
    }

    // --- Helpers ---
    function sendMessage(type, payload) {
        ws.send(JSON.stringify({ type, payload }));
    }

    function getRoleDescription(role) {
        const descriptions = {
            'Ricercatore': 'Each night, analyze a player. If you find the Immune Citizen, the cure progresses.',
            'Giornalista': 'Each night, investigate a player to discover their exact role.',
            'Poliziotto': 'Each night, you can choose to shoot a player you suspect.',
            'Cittadino Comune': 'Use your deduction skills during the day to find the terrorists.',
            'Terrorista': 'Each night, choose a player to infect. You have a private chat with your partner and a one-time shot.',
            'Fanatico': 'You win if you get eliminated from the game. Deceive others into killing you.'
        };
        return descriptions[role] || 'No special abilities.';
    }

    function getPlayerAction(role) {
        const actions = {
            'Ricercatore': 'ANALYZE',
            'Giornalista': 'INVESTIGATE',
            'Poliziotto': 'SHOOT_POLICE',
            'Terrorista': 'INFECT' // Or SHOOT_TERRORIST, needs more complex UI
        };
        return actions[role];
    }

    function getActionPrompt(action) {
        const prompts = {
            'ANALYZE': 'Select a player to analyze for immunity research.',
            'INVESTIGATE': 'Select a player to investigate their role.',
            'SHOOT_POLICE': 'Select a player to shoot.',
            'INFECT': 'Select a player to infect with the virus.'
        };
        return prompts[action] || '';
    }

});
