# Roadmap V2

## Conversation plus fluide

La V1 utilise une session unidirectionnelle par sens de traduction. La V2 pourra utiliser deux sessions simultanées pour éviter de changer de bouton pendant une conversation naturelle.

## Voix OpenAI pour les phrases rapides

Ajouter un endpoint serveur `/tts` qui appelle OpenAI côté serveur. La clé API resterait protégée, et le navigateur recevrait uniquement un fichier audio temporaire.

## Configuration du gîte

Créer `config/gite.json` pour modifier sans toucher au code :

- Wi-Fi
- horaires petit-déjeuner
- check-out
- parking
- règlement
- numéro d’urgence

## Modes utiles

- Historique local des conversations, désactivable.
- Mode “texte uniquement” si le micro est indisponible.
- Mode “urgence” avec phrases essentielles.

## Personnalisation

- Logo du gîte.
- Couleurs du gîte.
- Page `/admin` protégée par code pour modifier les phrases rapides.

## Mesure d’usage

Ajouter des statistiques simples, sans données personnelles et sans contenu de conversation.
