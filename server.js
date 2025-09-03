const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, '/')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- Game State ---
let players = []; // { ws, id, name, role, isAlive, position, isImmune }
let gameState = {
    phase: 'LOBBY', // LOBBY, NIGHT, DAY, END
    round: 0,
    cureProgress: 0,
    terroristShotUsed: false,
    nightActions: [], // { actorId, action, targetId }
    votes: {}, // { voterId: targetId }
    gameLog: [],
    winData: null,
    dayTimer: null
};

const ROLES = {
    RESEARCHER: 'Ricercatore',
    JOURNALIST: 'Giornalista',
    POLICEMAN: 'Poliziotto',
    CITIZEN: 'Cittadino Comune',
    TERRORIST: 'Terrorista',
    FANATIC: 'Fanatico'
};

// --- WebSocket Handling ---
wss.on('connection', (ws) => {
    const playerId = `player_${Date.now()}_${Math.random()}`;
    
    // Send initial game state to the newly connected client
    const minimalPlayers = players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        position: p.position
    }));
    ws.send(JSON.stringify({
        type: 'GAME_STATE_UPDATE',
        payload: {
            ...gameState,
            players: minimalPlayers,
            nightActions: undefined,
            you: null // No personal info yet
        }
    }));
    
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        handleClientMessage(ws, playerId, data);
    });

    ws.on('close', () => {
        const player = players.find(p => p.id === playerId);
        if (player) {
            console.log(`${player.name} disconnected.`);
            players = players.filter(p => p.id !== playerId);
            if (gameState.phase !== 'LOBBY') {
                // In-game disconnect handling can be complex, for now we just remove them
                // A better implementation might kill them or end the game
                player.isAlive = false;
                checkWinConditions();
            }
            broadcastGameState();
        }
    });
});

function handleClientMessage(ws, playerId, data) {
    const { type, payload } = data;

    switch (type) {
        case 'JOIN_GAME':
            if (gameState.phase === 'LOBBY') {
                const newPlayer = {
                    ws,
                    id: playerId,
                    name: payload.name,
                    role: null,
                    isAlive: true,
                    position: 0,
                    isImmune: false
                };
                players.push(newPlayer);
                console.log(`${newPlayer.name} joined the lobby.`);
                broadcastGameState();
            }
            break;
        
        case 'START_GAME':
            if (gameState.phase === 'LOBBY' && players.length >= 8) {
                startGame();
            }
            break;

        case 'NIGHT_ACTION':
            if (gameState.phase === 'NIGHT') {
                const player = players.find(p => p.id === playerId);
                if (player && player.isAlive) {
                    gameState.nightActions.push({ actorId: playerId, ...payload });
                    // Optional: send confirmation back to player
                    ws.send(JSON.stringify({ type: 'ACTION_CONFIRMED' }));
                    checkNightActionsComplete();
                }
            }
            break;
        
        case 'TERRORIST_CHAT':
             const sender = players.find(p => p.id === playerId);
             if (sender && sender.role === ROLES.TERRORIST) {
                const terroristMessage = {
                    type: 'TERRORIST_CHAT_MESSAGE',
                    payload: { sender: sender.name, message: payload.message }
                };
                players.forEach(p => {
                    if (p.role === ROLES.TERRORIST) {
                        p.ws.send(JSON.stringify(terroristMessage));
                    }
                });
             }
             break;

        case 'VOTE':
            if (gameState.phase === 'DAY') {
                const voter = players.find(p => p.id === playerId);
                if (voter && voter.isAlive) {
                    gameState.votes[playerId] = payload.targetId;
                    broadcastGameState(); // Broadcast to show votes in real-time

                    // Check if all alive players have voted
                    const alivePlayers = players.filter(p => p.isAlive);
                    if (Object.keys(gameState.votes).length === alivePlayers.length) {
                        resolveDay(); // End day early if everyone voted
                    }
                }
            }
            break;
    }
}

// --- Game Logic ---
function startGame() {
    console.log('Starting game...');
    gameState.phase = 'NIGHT';
    gameState.round = 1;
    assignRoles();
    positionPlayers();
    broadcastGameState();
    startNight();
}

function assignRoles() {
    const numPlayers = players.length;
    let rolesToAssign = [];

    // Define role counts based on player number (simplified logic)
    rolesToAssign.push(ROLES.POLICEMAN, ROLES.JOURNALIST, ROLES.FANATIC);
    rolesToAssign.push(ROLES.TERRORIST, ROLES.TERRORIST);
    rolesToAssign.push(ROLES.RESEARCHER, ROLES.RESEARCHER);

    const remainingPlayers = numPlayers - rolesToAssign.length;
    for (let i = 0; i < remainingPlayers; i++) {
        rolesToAssign.push(ROLES.CITIZEN);
    }

    // Shuffle roles and assign
    rolesToAssign.sort(() => Math.random() - 0.5);
    players.forEach((player, i) => {
        player.role = rolesToAssign[i];
    });

    // Assign Immune Citizen secretly from the Citizen faction
    const citizenFactionRoles = [ROLES.CITIZEN, ROLES.RESEARCHER, ROLES.JOURNALIST, ROLES.POLICEMAN];
    const potentialImmune = players.filter(p => citizenFactionRoles.includes(p.role));
    if (potentialImmune.length > 0) {
        const immunePlayer = potentialImmune[Math.floor(Math.random() * potentialImmune.length)];
        immunePlayer.isImmune = true;
        console.log(`Immune citizen is: ${immunePlayer.name}`);
    }
     console.log('Roles assigned:', players.map(p => `${p.name}: ${p.role}`).join(', '));
}

function positionPlayers() {
    players.forEach((player, i) => {
        player.position = i + 1;
    });
}

function startNight() {
    console.log(`--- Round ${gameState.round}: Night Phase ---`);
    gameState.phase = 'NIGHT';
    gameState.nightActions = [];
    broadcastGameState();
    // Set a timer for the night phase
    setTimeout(resolveNight, 120000); // 120 second night
}

function checkNightActionsComplete() {
    const alivePlayersWithActions = players.filter(p => 
        p.isAlive && p.role !== ROLES.CITIZEN && p.role !== ROLES.FANATIC
    ).length;
    
    if (gameState.nightActions.length >= alivePlayersWithActions) {
        // Everyone has acted, resolve night early
        // Clear the existing timeout and resolve immediately
        // Note: This requires managing the timeout object, simplified for now.
    }
}

function resolveNight() {
    if (gameState.phase !== 'NIGHT') return; // Avoid double resolution
    console.log('Resolving night actions...');
    
    const log = [];
    const eliminations = new Map(); // key: playerId, value: reason ('SHOT', 'VIRUS')

    const getAction = (actionType) => gameState.nightActions.find(a => a.action === actionType);

    // 1. Police Shot
    const policeShot = getAction('SHOOT_POLICE');
    if (policeShot) {
        const target = players.find(p => p.id === policeShot.targetId);
        if (target && target.isAlive) {
            eliminations.set(target.id, 'SHOT');
            log.push(`${target.name} was found dead.`);
        }
    }

    // 2. Terrorist Shot (one-time)
    const terroristShot = getAction('SHOOT_TERRORIST');
    if (terroristShot && !gameState.terroristShotUsed) {
        const target = players.find(p => p.id === terroristShot.targetId);
        if (target && target.isAlive && !eliminations.has(target.id)) {
            eliminations.set(target.id, 'SHOT');
            log.push(`${target.name} was found dead.`);
            gameState.terroristShotUsed = true;
        }
    }

    // 3. Infection
    const infection = getAction('INFECT');
    if (infection) {
        const target = players.find(p => p.id === infection.targetId);
        if (target && target.isAlive && !eliminations.has(target.id)) {
            if (target.isImmune) {
                log.push(`${target.name} was targeted by the virus but survived (Immune).`);
            } else {
                eliminations.set(target.id, 'VIRUS');
                log.push(`${target.name} has disappeared (Patient Zero).`);
                
                // Virus Propagation
                const numPlayers = players.length;
                const pos = target.position;
                const leftPos = (pos === 1) ? numPlayers : pos - 1;
                const rightPos = (pos === numPlayers) ? 1 : pos + 1;

                const leftPlayer = players.find(p => p.position === leftPos);
                const rightPlayer = players.find(p => p.position === rightPos);

                if (leftPlayer && leftPlayer.isAlive && !eliminations.has(leftPlayer.id)) {
                    if (leftPlayer.isImmune) {
                        log.push(`The virus spread to ${leftPlayer.name}, but they survived (Immune).`);
                    } else {
                        eliminations.set(leftPlayer.id, 'VIRUS');
                        log.push(`The virus spread to ${leftPlayer.name}.`);
                    }
                }
                if (rightPlayer && rightPlayer.isAlive && !eliminations.has(rightPlayer.id)) {
                     if (rightPlayer.isImmune) {
                        log.push(`The virus spread to ${rightPlayer.name}, but they survived (Immune).`);
                    } else {
                        eliminations.set(rightPlayer.id, 'VIRUS');
                        log.push(`The virus spread to ${rightPlayer.name}.`);
                    }
                }
            }
        }
    }
    
    // Apply eliminations
    eliminations.forEach((reason, playerId) => {
        const player = players.find(p => p.id === playerId);
        if (player) player.isAlive = false;
    });

    // Check for Fanatic win before proceeding
    if (checkWinConditions()) return;

    // 4. Investigations & Analysis (feedback sent privately)
    const journalistAction = getAction('INVESTIGATE');
    if (journalistAction) {
        const actor = players.find(p => p.id === journalistAction.actorId);
        const target = players.find(p => p.id === journalistAction.targetId);
        if (actor && target) {
            actor.ws.send(JSON.stringify({ type: 'PRIVATE_FEEDBACK', payload: `Your investigation reveals ${target.name} is a ${target.role}.` }));
        }
    }

    const researcherActions = gameState.nightActions.filter(a => a.action === 'ANALYZE');
    researcherActions.forEach(action => {
        const actor = players.find(p => p.id === action.actorId);
        const target = players.find(p => p.id === action.targetId);
        if (actor && target) {
            if (target.isImmune) {
                gameState.cureProgress++;
                actor.ws.send(JSON.stringify({ type: 'PRIVATE_FEEDBACK', payload: `Your analysis of ${target.name} was a success! Cure progress has advanced.` }));
            } else {
                actor.ws.send(JSON.stringify({ type: 'PRIVATE_FEEDBACK', payload: `Your analysis of ${target.name} yielded no results.` }));
            }
        }
    });

    gameState.gameLog.push(...log);
    
    if (checkWinConditions()) return;

    startDay();
}

function startDay() {
    console.log('--- Day Phase ---');
    gameState.phase = 'DAY';
    gameState.votes = {}; // Reset votes for the new day
    broadcastGameState();
    
    // Clear any previous timer and set a new one
    if (gameState.dayTimer) {
        clearTimeout(gameState.dayTimer);
    }
    gameState.dayTimer = setTimeout(resolveDay, 120000); // 120 second day
}

function resolveDay() {
    if (gameState.phase !== 'DAY') return;

    console.log('Resolving day vote...');
    if (gameState.dayTimer) {
        clearTimeout(gameState.dayTimer);
        gameState.dayTimer = null;
    }

    const voteCounts = {};
    const alivePlayerIds = players.filter(p => p.isAlive).map(p => p.id);

    // Initialize vote counts for all alive players to 0
    alivePlayerIds.forEach(id => voteCounts[id] = 0);

    // Tally votes from the gameState
    for (const voterId in gameState.votes) {
        const targetId = gameState.votes[voterId];
        if (voteCounts.hasOwnProperty(targetId)) {
            voteCounts[targetId]++;
        }
    }

    let maxVotes = 0;
    let playerToEliminateId = null;
    let tie = false;

    for (const playerId in voteCounts) {
        const votes = voteCounts[playerId];
        if (votes > maxVotes) {
            maxVotes = votes;
            playerToEliminateId = playerId;
            tie = false;
        } else if (votes === maxVotes && maxVotes > 0) {
            tie = true;
        }
    }

    const log = [];
    if (tie || maxVotes === 0) {
        log.push('The vote resulted in a tie. No one was eliminated.');
    } else if (playerToEliminateId) {
        const eliminatedPlayer = players.find(p => p.id === playerToEliminateId);
        if (eliminatedPlayer) {
            eliminatedPlayer.isAlive = false;
            log.push(`${eliminatedPlayer.name} was eliminated by popular vote.`);
        }
    }

    gameState.gameLog.push(...log);

    if (checkWinConditions()) return;

    gameState.round++;
    startNight();
}

function checkWinConditions() {
    const alivePlayers = players.filter(p => p.isAlive);
    const aliveCitizens = alivePlayers.filter(p => [ROLES.CITIZEN, ROLES.RESEARCHER, ROLES.JOURNALIST, ROLES.POLICEMAN].includes(p.role));
    const aliveTerrorists = alivePlayers.filter(p => p.role === ROLES.TERRORIST);

    let winner = null;
    let reason = '';

    // Fanatic Win
    const fanatic = players.find(p => p.role === ROLES.FANATIC);
    if (fanatic && !fanatic.isAlive) {
        winner = 'Fanatico';
        reason = 'The Fanatic has achieved their goal of being eliminated.';
    }
    // Citizen Win
    else if (gameState.cureProgress >= 3) {
        winner = 'Cittadini';
        reason = 'The cure has been developed!';
    } else if (aliveTerrorists.length === 0) {
        winner = 'Cittadini';
        reason = 'All Terrorists have been eliminated.';
    }
    // Terrorist Win
    else if (aliveTerrorists.length >= aliveCitizens.length) {
        winner = 'Terroristi';
        reason = 'The Terrorists have achieved numerical superiority.';
    }

    if (winner) {
        console.log(`Game Over. Winner: ${winner}`);
        gameState.phase = 'END';
        const fullRoles = players.map(p => ({ id: p.id, name: p.name, role: p.role }));
        gameState.winData = { winner, reason, fullRoles };
        broadcastGameState();
        return true;
    }
    return false;
}


// --- Broadcasting ---
function broadcastGameState() {
    const minimalPlayers = players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        position: p.position
    }));

    players.forEach(player => {
        const personalState = {
            type: 'GAME_STATE_UPDATE',
            payload: {
                ...gameState,
                players: minimalPlayers,
                // Don't send night actions or full player objects
                nightActions: undefined, 
                // Personal info
                you: {
                    id: player.id,
                    role: player.role,
                    isAlive: player.isAlive,
                    isImmune: player.isImmune,
                    position: player.position,
                    // Reveal terrorist partner
                    partner: player.role === ROLES.TERRORIST 
                        ? players.find(p => p.role === ROLES.TERRORIST && p.id !== player.id)?.name 
                        : null
                }
            }
        };
        player.ws.send(JSON.stringify(personalState));
    });
}