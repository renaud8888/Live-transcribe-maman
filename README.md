# Interprète du gîte

Petite web app mobile/PWA pour aider à parler avec des guests qui ne parlent pas français.

Elle est volontairement simple : un code d’accès, une langue principale, deux gros boutons de traduction, des sous-titres, et des phrases rapides du gîte.

> Traduction automatique, à vérifier pour les informations importantes.

## Installation locale

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
cp .env.example .env
```

Ouvrez ensuite `.env` et remplacez les valeurs.

## Variables d’environnement

```bash
OPENAI_API_KEY=sk-proj-votre-cle-api-openai
ACCESS_CODE=1234
PORT=3000
```

- `OPENAI_API_KEY` : clé API OpenAI, uniquement côté serveur.
- `ACCESS_CODE` : code simple demandé dans l’app avant de créer une session. Si la variable est vide ou absente, aucun code n’est vérifié.
- `PORT` : port local ou port fourni par Render.

Ne mettez jamais votre vraie clé API dans le code, dans GitHub, ou dans `public/app.js`.

## Lancement local

```bash
npm start
```

Puis ouvrez :

[http://localhost:3000](http://localhost:3000)

## Langues V1

La V1 garde volontairement les langues les plus utiles pour l’accueil :

- Anglais : `en`
- Néerlandais : `nl`
- Allemand : `de`
- Espagnol : `es`

## Test sur téléphone

Le téléphone et l’ordinateur doivent être sur le même Wi-Fi.

1. Sur l’ordinateur, trouvez l’adresse IP locale.
2. Lancez l’app avec `npm start`.
3. Sur le téléphone, ouvrez `http://ADRESSE-IP:3000`.
4. Autorisez le micro quand le navigateur le demande.

Sur certains navigateurs, le micro exige HTTPS. En déploiement Render, l’app sera en HTTPS.

## Mise sur GitHub

```bash
git init
git add .
git commit -m "Initial version"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/interprete-du-gite.git
git push -u origin main
```

Le fichier `.env` est ignoré par Git grâce à `.gitignore`.

## Déploiement Render

1. Créez un nouveau Web Service sur Render.
2. Connectez le dépôt GitHub.
3. Choisissez Node.
4. Build command : `npm install`
5. Start command : `npm start`
6. Ajoutez les variables d’environnement :
   - `OPENAI_API_KEY`
   - `ACCESS_CODE`
   - `PORT` est généralement fourni par Render automatiquement.

Voir aussi [docs/deployment-render.md](docs/deployment-render.md).

## Ajout à l’écran d’accueil iPhone/iPad

1. Ouvrez l’app dans Safari.
2. Touchez le bouton de partage.
3. Touchez “Sur l’écran d’accueil”.
4. Validez le nom “Interprète du gîte”.

## Ajout à l’écran d’accueil Android

1. Ouvrez l’app dans Chrome.
2. Touchez le menu à trois points.
3. Touchez “Ajouter à l’écran d’accueil” ou “Installer l’application”.
4. Validez.

## Fonctionnement technique

- Le navigateur capture le micro avec WebRTC.
- Le serveur crée un client secret temporaire via `/session`.
- `/session` appelle `https://api.openai.com/v1/realtime/translations/client_secrets`.
- Le navigateur ouvre ensuite l’appel WebRTC vers `https://api.openai.com/v1/realtime/translations/calls`.
- La clé `OPENAI_API_KEY` reste toujours côté serveur.
- Chaque session est unidirectionnelle :
  - “Je parle au guest” : français vers langue du guest.
  - “Le guest me parle” : langue du guest vers français.
- Quand on change de direction, l’ancienne session WebRTC est fermée proprement.

## Roadmap V2

1. Mode conversation bidirectionnel plus fluide avec deux sessions simultanées.
2. Bouton “Lire cette phrase avec une voix OpenAI” via un endpoint serveur `/tts`.
3. Gestion personnalisée des infos du gîte : Wi-Fi, horaires petit-déjeuner, check-out, parking, règlement, numéro d’urgence.
4. Fichier `config/gite.json` pour modifier les infos sans toucher au code.
5. Historique local des conversations, désactivable.
6. Mode “texte uniquement” si le micro est indisponible.
7. Mode “urgence” avec phrases essentielles.
8. Statistiques simples d’usage, sans stocker de données personnelles.
9. Possibilité d’ajouter un logo et les couleurs du gîte.
10. Ajout d’une page `/admin` protégée par code pour modifier les phrases rapides.
