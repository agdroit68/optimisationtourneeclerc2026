# Optimiseur de tournée — Significations d'actes

Application web pour préparer les tournées de signification : saisie des adresses, calcul de l'ordre de passage optimal, et lancement de la navigation dans Google Maps avec toutes les étapes pré-remplies.

## Mise en ligne sur GitHub Pages (10 minutes, gratuit)

1. **Créer un compte GitHub** sur [github.com](https://github.com) si tu n'en as pas (gratuit).

2. **Créer un dépôt** : bouton vert « New » (ou [github.com/new](https://github.com/new)).
   - Repository name : `tournee` (ou ce que tu veux)
   - Visibilité : **Public** (obligatoire pour GitHub Pages gratuit)
   - Clique « Create repository ».

3. **Envoyer les fichiers** : sur la page du dépôt, « uploading an existing file » (ou « Add file → Upload files »).
   - Glisse-dépose **tout le contenu de ce dossier** : `index.html`, `manifest.json`, `README.md`, `icon-192.png`, `icon-512.png`, et les dossiers `css/` et `js/`.
   - ⚠️ Si le glisser-déposer des dossiers ne marche pas, envoie d'abord les fichiers racine, puis crée `css/style.css` et `js/app.js` via « Add file → Create new file » en tapant `css/style.css` comme nom (le `/` crée le dossier) et en collant le contenu.
   - Clique « Commit changes ».

4. **Activer GitHub Pages** : onglet « Settings » du dépôt → menu « Pages » (colonne de gauche).
   - Source : « Deploy from a branch »
   - Branch : `main`, dossier `/ (root)` → « Save ».

5. **Attendre 1 à 2 minutes**, puis ton appli est en ligne à l'adresse :
   `https://TON-PSEUDO.github.io/tournee/`
   (l'adresse exacte s'affiche en haut de la page Settings → Pages).

6. **Sur ton téléphone** : ouvre cette adresse dans Chrome (Android) ou Safari (iPhone) → menu ⋮ ou bouton Partager → **« Ajouter à l'écran d'accueil »**. L'appli s'installe avec son icône et se lance en plein écran.

## Modes de fonctionnement

| | Sans clé (gratuit) | Avec clé Google Maps |
|---|---|---|
| Saisie des adresses | ✅ | ✅ |
| Localisation des adresses | OpenStreetMap | Google (précis) |
| Calcul de l'ordre optimal | ✅ (distances à vol d'oiseau) | ✅ par Google sur routes réelles |
| Carte intégrée + km/durées exacts | ❌ | ✅ |
| Lancement du GPS Google Maps | ✅ | ✅ |

La clé se saisit dans l'appli (menu **⚙ Réglages** en haut) et reste stockée **uniquement dans le navigateur du téléphone** — ne la mets jamais dans le code ni sur GitHub.

## Clé Google Maps (optionnelle)

Gratuite jusqu'à 10 000 requêtes/mois par API (une tournée ≈ 1 à 3 requêtes). Création sur [console.cloud.google.com](https://console.cloud.google.com) : créer un projet → activer la facturation (carte bancaire en garantie, 0 € sous le quota) → activer **Maps JavaScript API**, **Directions API** et **Geocoding API** → Identifiants → Créer une clé API.

**Important — sécuriser la clé** une fois le site en ligne : dans la console Google, « Modifier la clé API » →
- Restrictions relatives aux applications : « Sites web » → ajouter `https://TON-PSEUDO.github.io/*`
- Restrictions relatives aux API : cocher uniquement les 3 API ci-dessus.

Ainsi, même visible dans le trafic réseau, ta clé est inutilisable ailleurs que sur ton site.

## Notes techniques

- Mode gratuit : géocodage [Nominatim / OpenStreetMap](https://nominatim.org) (1 requête/seconde par politique d'usage — une tournée de 15 adresses prend ~20 s à localiser), puis optimisation locale (plus proche voisin + 2-opt).
- Mode Google : `DirectionsService` avec `optimizeWaypoints`, 25 étapes max par calcul.
- Navigation : liens `google.com/maps/dir/?api=1` — 11 points max par lien, découpage automatique en segments au-delà.
- Données (adresses mémorisées, clé) : `localStorage` du navigateur, rien n'est envoyé sur un serveur tiers hormis les requêtes de localisation/itinéraire.
