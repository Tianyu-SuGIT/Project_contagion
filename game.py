import json
import random
import time

class Game:
    def __init__(self):
        self.players = []
        self.word_data = self.load_words()
        self.game_state = {
            "mode": None,
            "secret_word": "",
            "saboteur": None,
            "round": 0,
            "game_over": False
        }

    def load_words(self):
        with open('words.json', 'r') as f:
            return json.load(f)['words']

    def setup_game(self):
        print("--- Benvenuto a Guess the Bro! ---")
        print("Simulazione: 4 giocatori - Alice, Bob, Charlie, David")
        num_players = 4
        player_names = ["Alice", "Bob", "Charlie", "David"]
        for name in player_names:
            self.players.append({"name": name, "score": 0, "role": "Cittadino"})
        
        print("\nGiocatori nella lobby:", ', '.join([p['name'] for p in self.players]))

    def choose_mode(self):
        print("\nScegli la modalità di gioco:")
        print("1. Sabotatore Nascosto (I Cittadini devono trovare il Sabotatore)")
        print("2. Sabotatore Informato (I Cittadini devono indovinare la parola)")
        mode = '1'
        while mode not in ['1', '2']:
            mode = input("Selezione non valida. Scegli 1 o 2: ")
        self.game_state['mode'] = 'hidden_saboteur' if mode == '1' else 'informed_saboteur'

    def assign_roles(self):
        saboteur_player = random.choice(self.players)
        self.game_state['saboteur'] = saboteur_player
        for p in self.players:
            if p == saboteur_player:
                p['role'] = "Sabotatore"

        print("\n--- I ruoli sono stati assegnati! ---")
        # Mostra a ogni giocatore il proprio ruolo privatamente
        for p in self.players:
            if p['role'] == 'Sabotatore':
                print(f"Pss, {p['name']}... tu sei il Sabotatore! Mantieni il segreto.")
            else:
                print(f"Pss, {p['name']}... tu sei un Cittadino.")
        time.sleep(2)

    def play(self):
        self.setup_game()
        self.choose_mode()
        self.assign_roles()

        word_choice = random.choice(self.word_data)
        self.game_state['secret_word'] = word_choice['word']

        if self.game_state['mode'] == 'hidden_saboteur':
            self.play_hidden_saboteur(word_choice)
        else:
            self.play_informed_saboteur(word_choice)

    def play_hidden_saboteur(self, word_choice):
        print("\n--- MODALITÀ: SABOTATORE NASCOSTO ---")
        secret_word = self.game_state['secret_word']
        saboteur_name = self.game_state['saboteur']['name']

        # Mostra la parola a tutti tranne al sabotatore
        print(f"La parola segreta è: {secret_word}")
        print("(Tutti la conoscono tranne il Sabotatore!) \n")
        time.sleep(2)

        # Turno di gioco
        clues = random.sample(word_choice['good_clues'], 3)
        print("Il sistema rivela 3 indizi anonimi:")
        for clue in clues:
            print(f"- {clue}")
        
        print("\nOra discutete! Il Sabotatore cercherà di bluffare.")
        self.run_challenge_phase(secret_word)
        self.run_voting_phase(saboteur_name)

    def play_informed_saboteur(self, word_choice):
        print("\n--- MODALITÀ: SABOTATORE INFORMATO ---")
        secret_word = self.game_state['secret_word']
        saboteur_name = self.game_state['saboteur']['name']

        print(f"Il Sabotatore conosce la parola segreta. I cittadini no.")
        print(f"({saboteur_name}, la parola è '{secret_word}'. Guida gli altri fuori strada!)\n")
        time.sleep(2)

        # Il sistema genera indizi, uno è del sabotatore
        good_clues = random.sample(word_choice['good_clues'], 2)
        bad_clue = random.choice(word_choice['bad_clues'])
        all_clues = good_clues + [bad_clue]
        random.shuffle(all_clues)

        print("Il sistema rivela 3 indizi anonimi (uno è fuorviante):")
        for clue in all_clues:
            print(f"- {clue}")

        print("\nCittadini, discutete e provate a indovinare la parola.")
        self.run_challenge_phase(secret_word)
        self.run_word_guess_phase(secret_word)

    def run_challenge_phase(self, secret_word):
        print("\nSimulazione di una Challenge...")
        time.sleep(1)
        challenger = random.choice(self.players)['name']
        possible_targets = [p['name'] for p in self.players if p['name'] != challenger]
        challenged = random.choice(possible_targets)
        print(f"{challenger} sfida {challenged}!")
        print(f"{challenged} deve spiegare un indizio...")
        time.sleep(2)

    def run_voting_phase(self, saboteur_name):
        print("\n--- VOTAZIONE FINALE SIMULATA ---")
        votes = {}
        # Aggiunge una probabilità maggiore di votare il sabotatore
        vote_pool = [p['name'] for p in self.players] + [saboteur_name, saboteur_name]
        for p in self.players:
            # Un giocatore non vota per se stesso
            player_vote_pool = [player for player in vote_pool if player != p['name']]
            vote = random.choice(player_vote_pool)
            print(f"{p['name']} vota per... {vote}")
            votes[vote] = votes.get(vote, 0) + 1
            time.sleep(1)
        
        most_voted = max(votes, key=votes.get)
        print(f"\nIl giocatore più votato è... {most_voted}!")

        if most_voted == saboteur_name:
            print(f"Corretto! {saboteur_name} era il Sabotatore! I CITTADINI VINCONO!")
        else:
            print(f"Sbagliato! Il vero Sabotatore era {saboteur_name}! IL SABOTATORE VINCE!")

    def run_word_guess_phase(self, secret_word):
        print("\n--- INDOVINA LA PAROLA ---")
        guess = input("Cittadini, qual è la vostra ipotesi finale per la parola segreta? ")
        if guess.upper() == secret_word.upper():
            print(f"Corretto! La parola era {secret_word}! I CITTADINI VINCONO!")
        else:
            print(f"Sbagliato! La parola era {secret_word}! IL SABOTATORE VINCE!")

if __name__ == '__main__':
    game = Game()
    game.play()
