# Déploiement Render

## Préparer le dépôt

```bash
npm install
git init
git add .
git commit -m "Initial version"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/interprete-du-gite.git
git push -u origin main
```

Vérifiez que `.env` n’est pas versionné.

## Créer le Web Service

1. Dans Render, cliquez sur “New” puis “Web Service”.
2. Connectez le dépôt GitHub.
3. Sélectionnez l’environnement Node.
4. Build command : `npm install`
5. Start command : `npm start`

## Variables d’environnement

Ajoutez dans Render :

```bash
OPENAI_API_KEY=sk-proj-...
```

Render fournit généralement `PORT` automatiquement. L’application lit quand même `PORT` si Render le définit.

## Tester après déploiement

1. Ouvrez l’URL HTTPS Render.
2. Choisissez une langue.
3. Lancez une traduction.
4. Autorisez le micro si vous utilisez le mode Live.

Si le micro ne démarre pas, vérifiez les permissions du navigateur et que l’URL est bien en HTTPS.
