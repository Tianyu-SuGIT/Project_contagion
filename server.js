const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware per parsare il body delle richieste JSON
app.use(express.json());

// Serve i file statici (html, css, js)
app.use(express.static('.'));

// Endpoint per aggiungere un nuovo mistero
app.post('/add-mystery', (req, res) => {
    try {
        const newMystery = req.body;

        // Validazione base
        if (!newMystery || !newMystery.word) {
            return res.status(400).json({ message: 'Dati invalidi.' });
        }

        // Leggi il file esistente, aggiungi il nuovo mistero e salva
        const filePath = 'words.json';
        const fileData = fs.readFileSync(filePath);
        const jsonData = JSON.parse(fileData);
        
        jsonData.words.push(newMystery);
        
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));

        // Aggiorna i dati in memoria nel server
        wordsData.push(newMystery);

        console.log(`Nuovo mistero aggiunto: ${newMystery.word}`);
        res.status(200).json({ message: 'Mistero aggiunto con successo!' });

    } catch (error) {
        console.error("Errore nell'aggiungere il mistero:", error);
        res.status(500).json({ message: 'Errore interno del server.' });
    }
});

let wordsData = [];
try {
    const rawData = fs.readFileSync('words.json');
    wordsData = JSON.parse(rawData).words;
} catch (error) {
    console.error('Errore nel caricamento di words.json:', error);
}

// --- Gestione Gioco ---
let game = {
    players: [],
    mode: null,
    secret_word: null,
    word_choice: null,
    saboteur: null,
    round: 0,
    timer: 60,
    timerInterval: null,
    isGameRunning: false
};

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

function updatePlayerList() {
    const players = game.players.map(p => ({ name: p.name, score: p.score }));
    broadcast({ type: 'player_update', players });
}

function startGame(mode) {
    if (game.players.length < 3) {
        broadcast({ type: 'system_message', message: 'Servono almeno 3 giocatori per iniziare.' });
        return;
    }
    game.isGameRunning = true;
    game.mode = mode;
    game.round = 1;
    
    // Scegli parola e sabotatore
    game.word_choice = wordsData[Math.floor(Math.random() * wordsData.length)];
    game.secret_word = game.word_choice.word;
    game.saboteur = game.players[Math.floor(Math.random() * game.players.length)];

    game.players.forEach(p => {
        p.role = (p.id === game.saboteur.id) ? 'Sabotatore' : 'Cittadino';
        const message = {
            type: 'game_start',
            role: p.role,
            mode: game.mode
        };
        // Invia la parola segreta a chi deve conoscerla
        if (game.mode === 'hidden_saboteur' && p.role !== 'Sabotatore') {
            message.secret_word = game.secret_word;
        }
        if (game.mode === 'informed_saboteur' && p.role === 'Sabotatore') {
            message.secret_word = game.secret_word;
        }
        p.ws.send(JSON.stringify(message));
    });

    console.log(`Partita iniziata. Sabotatore: ${game.saboteur.name}, Parola: ${game.secret_word}`);
    startRound();
}

function startRound() {
    broadcast({ type: 'system_message', message: `--- Inizia il Round ${game.round} ---` });
    
    // Invia indizi
    setTimeout(() => {
        let clues;
        if (game.mode === 'hidden_saboteur') {
            clues = game.word_choice.clues[`round${game.round}`];
        } else { // Sabotatore Informato
            if(game.round === 1) {
                const good = [...game.word_choice.clues.round1].sort(() => 0.5 - Math.random()).slice(0, 4);
                const bad = game.word_choice.bad_clues.round1[Math.floor(Math.random() * 5)];
                clues = [...good, bad].sort(() => 0.5 - Math.random());
            } else {
                // Per i round 2 e 3, il sabotatore sceglie se mandare l'indizio buono o cattivo
                // Semplifichiamo per ora e mandiamo quello buono
                clues = game.word_choice.clues[`round${game.round}`];
            }
        }
        broadcast({ type: 'clues', clues });
    }, 2000);

    // Gestione Timer
    game.timer = 60;
    clearInterval(game.timerInterval);
    game.timerInterval = setInterval(() => {
        broadcast({ type: 'timer_update', time: game.timer });
        game.timer--;
        if (game.timer < 0) {
            clearInterval(game.timerInterval);
            endRound();
        }
    }, 1000);
}

function endRound() {
    broadcast({ type: 'system_message', message: `--- Round ${game.round} Terminato ---` });
    // Logica di fine round (voto, etc.) - da implementare
    game.round++;
    if (game.round > 3) {
        endGame();
    } else {
        // Per ora, passiamo direttamente al prossimo round
        setTimeout(startRound, 3000);
    }
}

function endGame() {
    broadcast({ type: 'system_message', message: '--- Partita Finita ---' });
    // Logica fine partita - da implementare
    setTimeout(resetGame, 5000);
}

function resetGame() {
    console.log("Resetting game state.");
    clearInterval(game.timerInterval);
    game = {
        ...game, // Mantieni i giocatori connessi
        mode: null,
        secret_word: null,
        word_choice: null,
        saboteur: null,
        round: 0,
        timer: 60,
        isGameRunning: false
    };
    // Notifica i client che possono iniziare una nuova partita
    broadcast({ type: 'game_reset' });
    updatePlayerList();
}

let nextPlayerId = 1;

wss.on('connection', ws => {
    console.log('Nuovo client connesso');

    ws.on('message', message => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'join':
                if (game.isGameRunning) {
                    ws.send(JSON.stringify({ type: 'system_message', message: 'Partita in corso. Attendi la fine per unirti.' }));
                    return;
                }

                const newPlayer = {
                    id: nextPlayerId++,
                    name: data.username,
                    score: 0,
                    role: null,
                    ws: ws
                };
                game.players.push(newPlayer);
                console.log(`${data.username} si è unito.`);
                updatePlayerList();
                broadcast({ type: 'system_message', message: `${data.username} si è unito alla lobby.` });
                
                // Per test, avviamo la partita automaticamente con 4 giocatori
                if (game.players.length === 4 && !game.isGameRunning) {
                    setTimeout(() => startGame('informed_saboteur'), 2000); // Avvia una modalità di default
                }
                break;
        }
    });

    ws.on('close', () => {
        const leavingPlayer = game.players.find(p => p.ws === ws);
        if (leavingPlayer) {
            console.log(`${leavingPlayer.name} si è disconnesso.`);
            game.players = game.players.filter(p => p.ws !== ws);
            if (game.players.length === 0) {
                console.log("Tutti i giocatori si sono disconnessi. Resetting.");
                resetGame();
            } else {
                updatePlayerList();
                broadcast({ type: 'system_message', message: `${leavingPlayer.name} ha lasciato la lobby.` });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});
