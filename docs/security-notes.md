# Notes de sécurité

## Clé API

La clé `OPENAI_API_KEY` doit rester côté serveur. Elle ne doit jamais apparaître dans `public/app.js`, dans `index.html`, dans GitHub, ou dans une capture d’écran partagée.

## Client secret temporaire

Le navigateur appelle `/session`. Le serveur crée un client secret temporaire auprès d’OpenAI avec :

```text
https://api.openai.com/v1/realtime/translations/client_secrets
```

Le navigateur utilise ensuite ce client secret temporaire pour ouvrir l’appel WebRTC. Ce secret est court et ne remplace pas la vraie clé API.

## Accès

L’app ne demande plus de code d’accès. Pour une sécurité plus forte, il faudrait ajouter une authentification complète, une limitation de débit, et une supervision côté serveur.

## Conversations et consentement

Ne pas enregistrer les conversations sans consentement clair des personnes concernées.

Si un historique local est ajouté plus tard, il devra être visible, désactivable, et supprimable facilement.

## Avertissement à afficher

L’app affiche :

> Traduction automatique, à vérifier pour les informations importantes.

Il faut garder cet avertissement visible, surtout pour les sujets médicaux, légaux, financiers, ou de sécurité.
