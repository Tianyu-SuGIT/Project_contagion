# Project Contagion

`Project Contagion` è un gioco di deduzione sociale online, simile a classici come *Mafia* o *Lupus in Tabula*.

## Scopo del Gioco

Ci sono due fazioni principali che si scontrano: i **Cittadini** e i **Terroristi**.

*   L'obiettivo dei **Cittadini** è sviluppare una cura per il virus o eliminare tutti i Terroristi.
*   L'obiettivo dei **Terroristi** è raggiungere la superiorità numerica rispetto ai Cittadini.
*   Esiste anche un ruolo neutrale, il **Fanatico**, che vince solo se viene eliminato.

Il gioco richiede un minimo di **8 giocatori** per iniziare.

## I Ruoli

All'inizio della partita, a ogni giocatore viene assegnato segretamente un ruolo.

### Fazione dei Cittadini
*   **Ricercatore (Researcher)**: Ogni notte, può `ANALIZZARE` un giocatore. Se analizza il giocatore `Immune`, fa progredire la ricerca della cura.
*   **Giornalista (Journalist)**: Ogni notte, può `INVESTIGARE` un giocatore per scoprirne il vero ruolo.
*   **Poliziotto (Policeman)**: Ogni notte, può scegliere un giocatore da `ELIMINARE` con un colpo di pistola.
*   **Cittadino Comune (Citizen)**: Non ha abilità speciali. Deve usare la discussione e l'osservazione per capire di chi fidarsi.
*   **Cittadino Immune**: Un giocatore della fazione dei Cittadini (scelto a caso) è segretamente immune al virus dei Terroristi.

### Fazione dei Terroristi
*   **Terrorista (Terrorist)**: Ogni notte, può scegliere un giocatore da `INFETTARE` con un virus. Il virus si propaga anche ai giocatori seduti accanto alla vittima (a meno che non siano immuni). I terroristi possono comunicare tra loro in una chat segreta. Hanno anche a disposizione un singolo colpo di pistola da usare una volta per partita.

### Fazione Neutrale
*   **Fanatico (Fanatic)**: Il suo unico scopo è farsi eliminare. Se ci riesce, vince la partita da solo.

## Svolgimento della Partita

La partita si divide in cicli di Giorno e Notte.

1.  **Lobby (Sala d'attesa)**
    *   I giocatori si uniscono inserendo il proprio nome.
    *   Quando ci sono almeno 8 giocatori, il gioco può iniziare.

2.  **Fase Notturna**
    *   È il momento delle azioni segrete.
    *   I giocatori con abilità speciali (Ricercatore, Giornalista, Poliziotto, Terrorista) scelgono chi colpire.
    *   I Terroristi possono usare la loro chat privata per coordinarsi.

3.  **Risoluzione della Notte**
    *   Il server calcola il risultato di tutte le azioni. Vengono determinate le eliminazioni (per colpi di pistola o per il virus) e i risultati delle indagini.
    *   Il Giornalista e il Ricercatore ricevono un feedback privato sulle loro azioni.

4.  **Fase Diurna**
    *   Il gioco rivela a tutti chi è stato eliminato durante la notte.
    *   Questa è la fase della discussione. I giocatori parlano, si accusano a vicenda e cercano di capire chi sono i nemici.
    *   I giocatori votano per eliminare un sospetto.

5.  **Ciclo**
    *   Il gioco continua alternando le fasi di Notte e Giorno.

## Condizioni di Vittoria

La partita termina quando una delle seguenti condizioni viene soddisfatta:

*   **Vittoria dei Cittadini**:
    1.  La cura viene sviluppata (il Ricercatore ha trovato l'immune per 3 volte).
    2.  Tutti i Terroristi sono stati eliminati.
*   **Vittoria dei Terroristi**:
    *   Il numero di Terroristi vivi è uguale o superiore al numero di Cittadini vivi.
*   **Vittoria del Fanatico**:
    *   Il Fanatico viene eliminato in qualsiasi modo (di notte o di giorno).

## Sviluppo Locale

Se vuoi eseguire il progetto localmente:

1.  **Prerequisiti**: Assicurati di avere [Node.js](https://nodejs.org/) installato.
2.  **Installazione**: Clona il repository ed esegui `npm install` per installare le dipendenze (`express` e `ws`).
3.  **Avvio**: Esegui `npm start` per avviare il server.
4.  **Accesso**: Apri il browser e vai su `http://localhost:3000`.