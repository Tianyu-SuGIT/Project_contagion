document.addEventListener('DOMContentLoaded', () => {
    // Elementi del DOM
    const homeScreen = document.getElementById('home-screen');
    const gameScreen = document.getElementById('game-screen');
    const chatLog = document.getElementById('chat-log');
    const playerList = document.getElementById('player-list');
    const timerDisplay = document.getElementById('timer-display');
    const inputArea = document.getElementById('input-area');
    const userInput = document.getElementById('user-input');
    const submitButton = document.getElementById('submit-action');
    const usernameInput = document.getElementById('username-input');
    const joinButton = document.getElementById('join-game-button');

    let ws;

    const switchScreen = (screen) => {
        homeScreen.classList.remove('active');
        gameScreen.classList.remove('active');
        document.getElementById(screen).classList.add('active');
    };

    const addMessage = (text, type = 'system') => {
        const message = document.createElement('div');
        message.classList.add('chat-message', `${type}-message`);
        message.innerHTML = text; // Il server ora formatta i messaggi
        chatLog.appendChild(message);
        chatLog.scrollTop = chatLog.scrollHeight;
    };

    const updatePlayerList = (players) => {
        playerList.innerHTML = '';
        players.forEach(p => {
            const playerTag = document.createElement('div');
            playerTag.classList.add('player-tag');
            playerTag.textContent = `${p.name} (${p.score})`;
            playerList.appendChild(playerTag);
        });
    };

    const updateTimer = (time) => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    joinButton.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (!username) {
            alert('Per favore, inserisci un username.');
            return;
        }

        switchScreen('game-screen');
        
        // Connessione al server WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        ws = new WebSocket(`${protocol}//${host}`);

        ws.onopen = () => {
            console.log('Connesso al server');
            ws.send(JSON.stringify({ type: 'join', username }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'system_message':
                    addMessage(data.message, 'system');
                    break;
                case 'player_update':
                    updatePlayerList(data.players);
                    break;
                case 'game_start':
                    addMessage(`Sei un <strong>${data.role}</strong>.`, 'system');
                    if (data.secret_word) {
                        addMessage(`La parola segreta è: <strong>${data.secret_word}</strong>`, 'system');
                    } else if (data.mode === 'hidden_saboteur') {
                        addMessage('Non conosci la parola segreta. Cerca di non farti scoprire!', 'system');
                    }
                    break;
                case 'timer_update':
                    updateTimer(data.time);
                    break;
                case 'clues':
                    let clueText = Array.isArray(data.clues) ? `<ul>${data.clues.map(c => `<li>${c}</li>`).join('')}</ul>` : data.clues;
                    addMessage(`<strong>Indizi del round:</strong>
${clueText}`, 'system');
                    break;
            }
        };

        ws.onclose = () => {
            console.log('Disconnesso dal server');
            addMessage('Disconnesso dal server. Aggiorna per riprovare.', 'system');
        };

        ws.onerror = (error) => {
            console.error('Errore WebSocket:', error);
            addMessage('Errore di connessione al server.', 'system');
        };
    });
});