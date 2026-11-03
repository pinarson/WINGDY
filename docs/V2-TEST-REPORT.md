# Wing Dashboard V2 — intégration et vérification locale

Référence : `Tableau de bord météo et marées wingfoil.png`, fournie par
l’utilisateur. Ses chiffres d’illustration n’ont pas été saisis dans le code.
L’interface utilise les fichiers réels Open-Meteo et api-maree.fr déjà collectés.
Aucune publication, aucun envoi GitHub, aucune copie sur la Kobo.

## Interface intégrée

- Logo conservé, sélecteur borné à la largeur de l’écran et grands indicateurs
  arrondis à l’entier. Boussole de provenance du vent conservée.
- Tableau à cinq rangées : Date, Heure, Vent (nd), Rafales (nd), Direction.
- Créneaux 08/10/12/14/16/18/20 h en Europe/Paris ; seules les heures réellement
  disponibles dans le JSON sont rendues, sans colonnes de prévisions inventées.
- Modes 24/48/72 h : une, deux, trois journées civiles ; dès 20 h, début le
  lendemain. Tableau regroupé par dates sur ordinateur ; tableaux quotidiens
  sur mobile et Kobo, avec sept colonnes maximum par journée.
- Flèches du tableau : direction vers laquelle souffle le vent ; degrés et
  boussole : provenance météorologique. Convention explicitée sous le tableau.
- Marées : modes indépendants 24/48 h, grande courbe SVG, horaires PM/BM sur
  les points, hauteurs à une décimale et coefficients courts « Coef. 82 ».
- Stations approuvées conservées. Mentions légales et dates de récupération
  regroupées en pied de page, sans blocs Infos spot, Soleil ou Données et sources.

## Collecte et sécurité

Les deux workflows ont exactement les mêmes empreintes qu’avant l’intégration.
Schémas JSON, champs météo, stations, authentification et secrets inchangés.
Seule la fenêtre du collecteur météo est portée de 72 à **96 h** : trois
journées complètes après 20 h, plus le délai d’actualisation et les transitions
d’heure, peuvent dépasser 72 h. Aucun autre changement de collecte.
L’audit des fichiers `public/` et `dist/` n’a trouvé aucune clé API exposée.

## Résultats des tests

- **20 tests JavaScript + 14 tests Python : 34 réussites.**
- Compilation Vite de production réussie.
- **54 configurations UI** : trois spots × ordinateur/mobile/Kobo × trois
  modes de vent × deux modes de marée.
- Les cinq rangées, les valeurs, les heures réellement présentes, les dates,
  les flèches et les indicateurs sont comparés aux données réelles.
- Les horaires et les hauteurs à une décimale sont vérifiés sur chaque extremum.
- Régressions horaires : minuit, fin d’année, passage heure d’été et heure
  d’hiver, conservation des horaires locaux de navigation.
- Aucun débordement horizontal, sélecteur compris. Aucun contenu coupé sur les
  vues Kobo testées. Trois tableaux quotidiens réels tiennent aussi dans le
  cadre : contrôle historique à l’heure de collecte, hauteur d’environ 787 px.
- Les marées 24/48 h sont complètement couvertes pour les trois références.
- Le jeu météo local contient encore 48 échantillons horaires, pas 96 :
  18 configurations disposent de toutes les heures de leur journée de vent ;
  36 configurations affichent correctement une couverture partielle pour les
  modes 48/72 h. Les heures absentes ne sont ni remplies ni extrapolées.

Rapport machine : `output/v2/ui-results.json`. Le contrôle de trois tableaux
utilise les données authentiques et l’horloge fixée à leur heure de récupération,
sans inventer de valeur météo : `output/v2/three-day-layout.json`.

## Captures

- [Ordinateur · Tharon · 24 h](../output/v2/desktop-tharon-24h.png)
- [Ordinateur · Tharon · 72 h, couverture partielle](../output/v2/desktop-tharon-72h.png)
- [Mobile · Tharon · 24 h](../output/v2/mobile-tharon-24h.png)
- [Kobo · Tharon · 24 h](../output/v2/kobo-tharon-24h.png)
- [Kobo · trois tableaux quotidiens réels](../output/v2/kobo-three-days-real.png)

Les autres spots et modes ont également leurs captures dans `output/v2/`.

## Trois PNG Kobo

`output/meteo-wingfoil-tharon.png`, `output/meteo-wingfoil-la-baule.png`,
`output/meteo-wingfoil-suscinio.png` : vent sur une journée de navigation,
marées sur 48 heures, données réelles et complètes pour ces modes.

Format FBInk : 600 × 800, PNG type 0 (gris), profondeur 8 bits, 16 nuances,
opaque, sans entrelacement. Aucune copie sur la liseuse.

Pour d’autres durées, en PowerShell avant `npm run export:kobo -- tharon` :

```powershell
$env:WING_EXPORT_WIND_HOURS='72'
$env:WING_EXPORT_TIDE_HOURS='48'
```

Le mode strict `WING_REQUIRE_COMPLETE=1` refuse les exports avec des journées
incomplètes. Le mode normal conserve explicitement le signalement de couverture
partielle ; il ne produit aucune donnée de remplacement.

## Point restant lié aux données

Une récupération réelle de 96 h est nécessaire pour valider trois journées
complètes avec le jeu local. La collecte est déjà prête, sans clé pour le vent :

```powershell
& 'C:\pinokio\bin\miniconda\node.exe' scripts/update-weather.mjs
```

Après actualisation : reconstruire puis lancer `npm run test:ui -- --require-complete`.
L’accès réseau sortant de Codex reste refusé ; aucune série fictive n’a été
créée pour remplacer cette collecte. Les workflows restent prêts et désactivés
pour la publication tant que l’utilisateur ne l’autorise pas.
