document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('save-button');
    const statusMessage = document.getElementById('status-message');

    saveButton.addEventListener('click', async () => {
        // Raccogli i dati dal form
        const title = document.getElementById('title').value;
        const good_r1 = document.getElementById('good-clues-r1').value.split(',').map(s => s.trim());
        const good_r2 = document.getElementById('good-clues-r2').value;
        const good_r3 = document.getElementById('good-clues-r3').value;
        const bad_r1 = document.getElementById('bad-clues-r1').value.split(',').map(s => s.trim());
        const bad_r2 = document.getElementById('bad-clues-r2').value;
        const bad_r3 = document.getElementById('bad-clues-r3').value;

        if (!title || good_r1.length < 5) {
            statusMessage.textContent = 'Errore: Titolo e almeno 5 indizi per il Round 1 sono obbligatori.';
            statusMessage.style.color = 'red';
            return;
        }

        // Costruisci l'oggetto del mistero
        const newMystery = {
            word: title.toUpperCase(), // Usiamo 'word' per compatibilità
            clues: {
                round1: good_r1,
                round2: good_r2,
                round3: good_r3
            },
            bad_clues: {
                round1: bad_r1,
                round2: bad_r2,
                round3: bad_r3
            }
        };

        // Invia i dati al server
        try {
            const response = await fetch('/add-mystery', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newMystery)
            });

            const result = await response.json();

            if (response.ok) {
                statusMessage.textContent = result.message;
                statusMessage.style.color = 'lightgreen';
                // Pulisci il form
                document.querySelectorAll('input').forEach(input => input.value = '');
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            statusMessage.textContent = `Errore nel salvataggio: ${error.message}`;
            statusMessage.style.color = 'red';
        }
    });
});
