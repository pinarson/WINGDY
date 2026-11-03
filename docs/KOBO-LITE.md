# Kobo Lite — aperçu USB

La route `/kobo/?spot=tharon` possède son propre document, composant React et CSS. Le site web conserve son interface. Les identifiants disponibles sont `tharon`, `la-baule` et `suscinio`.

- Image fixe 600 × 800, sans sélecteur ni boutons.
- Une journée de navigation, cinq heures Paris : 10, 12, 14, 16 et 18 h. À partir de 18 h, la journée suivante est sélectionnée.
- Les flèches indiquent la provenance météorologique : nord vers le haut, ouest vers la gauche.
- Marées sur les 24 heures suivant le début de l'heure courante, avec PM/BM et coefficients disponibles. Les mentions des fournisseurs sont conservées intégralement.
- Données météo et marées existantes, aucune valeur de remplacement. L'export refuse des données incomplètes ou expirées.

## Génération locale

Après `npm run build`, lancer `npm run preview -- --port 5174`, puis :

```powershell
node scripts/export-kobo.mjs tharon http://127.0.0.1:5174/kobo/
node scripts/export-kobo.mjs la-baule http://127.0.0.1:5174/kobo/
node scripts/export-kobo.mjs suscinio http://127.0.0.1:5174/kobo/
node scripts/check-kobo-lite.mjs
```

Les fichiers restent `output/meteo-wingfoil-{spot}.png`, avec les dates réelles de collecte dans les fichiers JSON voisins. PNG opaque en niveaux de gris, type 0, profondeur 8 bits, 16 niveaux, sans entrelacement. Le Chrome déjà présent est utilisé pour le rendu.

## Transfert

La procédure et les scripts USB existants sont conservés. Le lanceur `Transferer dashboard Kobo.cmd` transfère le PNG Tharon vers `.adds/kobo-screen/meteo-wingfoil.png`. Vérifier l'aperçu avant de lancer le transfert, puis éjecter la Kobo dans Windows et utiliser l'entrée NickelMenu existante. Aucun transfert automatique pendant la génération ; aucun changement du firmware ou des workflows.

Validation : `npm test`, `node scripts/check-kobo-lite.mjs` et `npm run test:ui` (interface web ordinateur/mobile). Les PNG sont vérifiés à leur taille native ; le contraste physique reste à confirmer sur la liseuse.
