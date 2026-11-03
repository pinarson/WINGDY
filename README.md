# Wing Dashboard · V2

Préparation de l'actualisation Wi-Fi Kobo Lite (sans publication) :
[pipeline, URL PNG fixes, HTTPS/TLS et premier test](docs/KOBO-WIFI.md).
Ce guide complète et actualise les anciennes instructions de publication ci-dessous.

La V2 reprend la maquette validée « Tableau de bord météo et marées wingfoil ».
Le vent est affiché dans un tableau à cinq rangées, toutes les deux heures de
08 h à 20 h à Paris. Les modes 24/48/72 h correspondent à une, deux et trois
journées civiles de navigation ; à partir de 20 h, la première est le lendemain.
Les journées incomplètes n’affichent que les créneaux réellement présents.
Sur mobile et Kobo, les tableaux sont séparés par journée.

La courbe de marée garde ses propres modes 24/48 h. Horaires PM/BM, hauteurs à
une décimale et coefficients courts sont placés sur les extrema. Les crédits
obligatoires sont regroupés dans le pied de page. Aucun bloc secondaire Infos
spot, Soleil ou Données et sources n’est affiché.

Les workflows restent inchangés. Le seul ajustement de collecte est l’horizon
Open-Meteo porté à **96 heures**, afin de couvrir trois journées entières après
20 h, le changement d’heure et la marge entre deux actualisations. Les champs,
le schéma JSON, les stations et la gestion des secrets restent les mêmes.

[Bilan V2 et captures](docs/V2-TEST-REPORT.md).

Pour un premier affichage physique sans réseau : [procédure USB Kobo](docs/KOBO-USB.md).
Le lanceur `Transferer dashboard Kobo.cmd` réutilise FBInk et NickelMenu déjà
installés et copie uniquement le PNG, après sauvegarde et contrôle SHA256.

Tableau de bord personnel de prévisions de vent, inspiré de l’e-ink. React 19,
Vite 7, CSS responsive et graphiques SVG. Aucun backend permanent, compte
utilisateur, cookie, stockage personnel ni outil de suivi. La clé de marées
reste dans le terminal ou GitHub Actions ; aucun secret côté navigateur.
Aucun dépôt créé ou publié.

## Installation locale

Prérequis : Node.js **22.12 minimum** (Node 22 LTS conseillé) et npm.

```sh
npm install
npm run dev
```

Ouvrir l’adresse indiquée, généralement http://127.0.0.1:5173/.
Le premier `npm install` crée `package-lock.json` : le conserver dans Git,
puis utiliser `npm ci` pour les installations reproductibles suivantes.
Les versions directes sont fixées dans package.json. Aucun Node global ou
réglage système n’a été installé par ce projet.

```sh
npm test
npm run build
npm run preview
```

Le serveur de développement et le serveur de prévisualisation ne sont utilisés
que sur le PC. GitHub Pages sert ensuite uniquement les fichiers statiques,
y compris `data/weather.json` et `data/tides.json`.

## Interface

- Trois spots sélectionnables, avec coordonnées et lien de vérification.
- Vent moyen, rafales en nœuds et direction à 10 m, issus du modèle Open-Meteo.
- Flèche pointant **vers l’origine du vent** : 0° = nord, 90° = est, 225° = SO.
- Tableau de vent de 08 h à 20 h, au pas de deux heures, sur une à trois journées.
- Flèches du tableau orientées dans le sens du vent ; degrés de provenance.
- Courbe SVG de marée 24/48 h avec horaires et coefficients sur les extrema.
- Date de validité des conditions et date de récupération, en Europe/Paris.
- États de chargement, erreur, expiration et données partielles. Aucun faux chiffre.
- Mode monochrome fixe de 600 × 800 et export PNG sur le PC.

La mention « vent moyen » correspond au champ `wind_speed_10m` du modèle,
pas à une moyenne calculée sur les 24 heures ni à une station mesurée.
La date de récupération ne constitue pas l’heure de production du modèle,
qui n’est pas fournie par cet endpoint. Les valeurs affichées sont arrondies ;
le graphique utilise les valeurs numériques reçues sans lissage inventé.

## Coordonnées vérifiées

Coordonnées WGS84 de points de référence au bord des plages, pas de centres
administratifs. Une plage étant étendue, le point n’est pas une zone de
navigation officielle. Sources consultées le 23 octobre 2026 :

| Spot | Latitude | Longitude | Référence |
| --- | --- | --- | --- |
| Tharon-Plage | 47.16957 | -2.16599 | [Office de tourisme de Pornic : La Paillote, plage de Tharon](https://www.pornic.com/la-paillote-de-tharon-1.html) |
| La Baule | 47.28191 | -2.39399 | [Office de tourisme de Batz-sur-Mer : plage de La Baule](https://en.ot-batzsurmer.fr/la-baule-beach.html) |
| Suscinio | 47.50468 | -2.72878 | [OpenStreetMap, plage way 23038014](https://www.openstreetmap.org/way/23038014), [coordonnées recoupées sur Mapcarta](https://mapcarta.com/W23038014) |

Le modèle utilise sa maille géographique, qui peut différer du point demandé.
La vérification géographique ne garantit pas les conditions locales de navigation.

## Données et conditions Open-Meteo

Récupération HTTPS par `scripts/update-weather.mjs` depuis `api.open-meteo.com/v1/forecast` :
`current` et `hourly` = `wind_speed_10m,wind_gusts_10m,wind_direction_10m`,
`wind_speed_unit=kn`, `timeformat=unixtime`, `timezone=Europe/Paris`,
`forecast_hours=96` dans l’automatisation V2, pour conserver une marge au-delà
des trois journées de navigation affichées. L’import du diagnostic initial conserve ses
48 échantillons originaux. Les timestamps Unix sont formatés avec `Intl` et le fuseau
Europe/Paris pour gérer le passage heure d’été / heure d’hiver.

Le navigateur charge le JSON du même domaine. Aucun CORS tiers n’est requis.
Un cache **en mémoire uniquement** limite les lectures répétées. Changer la
durée 24/48 h n’effectue pas d’appel API. Les dates de récupération originales
sont conservées et les jeux vieux de plus de sept heures signalés. Le bouton
Actualiser recharge le JSON disponible ; il ne déclenche pas GitHub Actions.
Une requête locale échoue après 20 secondes ; changer de spot annule la précédente.
Si le fichier météo est absent (HTTP 404), le client peut encore tenter l’API
publique directement. Aucun secret n’est nécessaire pour Open-Meteo.

Si une valeur est absente : « — » et interruption de la courbe. En cas d’erreur
réseau, aucune donnée de démonstration ne remplace la réponse. Le changement
de spot efface les anciennes valeurs pour éviter toute confusion.

Usage personnel non commercial conforme à l’offre gratuite, sans publicité :
limites documentées de 600 appels/minute, 5 000/heure, 10 000/jour et
300 000/mois. Les limites peuvent évoluer ; vérifier les conditions avant
un changement d’usage. Attribution visible à Open-Meteo et licence CC BY 4.0,
avec mention de l’arrondi et conversion en nœuds demandée à l’API.

- [Documentation API](https://open-meteo.com/en/docs)
- [Conditions et confidentialité](https://open-meteo.com/en/terms)
- [Licence des données CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

L’application ne collecte aucune donnée personnelle. Le navigateur contacte
l’hébergeur des JSON (et Open-Meteo uniquement dans le repli HTTP 404), qui
reçoit les métadonnées réseau habituelles. Aucun tiers publicitaire ni police distante.

## Marées

Les stations sont définitivement fixées dans `config/tide-stations.json` :

| Spot | Station de référence | Distance |
| --- | --- | --- |
| Tharon-Plage | Pointe de Saint-Gildas | 6,856 km |
| La Baule | Le Pouliguen | 4,017 km |
| Suscinio | Le Logeo | 7,205 km |

L’application lit `public/data/tides.json`, jamais l’API authentifiée.
Les courbes affichent les hauteurs reçues au pas de 10 minutes ; les repères,
horaires PM/BM et coefficients proviennent des extrema de l’API. Les coefficients
sont estimés et non officiels. La station et sa distance restent visibles.
Les marées couvrent 24/48 heures écoulées à partir de l’heure courante.
Le vent utilise indépendamment une à trois journées civiles de navigation.
Les heures UTC sont converties en Europe/Paris avec gestion de l’heure d’hiver.

Le jeu réel local couvre du 23 au 30 octobre 2026, avec 1 008 points par station.
Les prévisions météo réelles des trois spots contiennent 48 échantillons horaires.
Une période absente n’est jamais extrapolée. Un jeu expiré n’est plus tracé.
Actualiser la page ne peut pas créer des dates absentes du JSON ; il faut
relancer la récupération. Pour actualiser les deux sources localement :

```sh
python scripts/collect_real_data.py
```

La récupération automatisée préparée demande sept jours, soit 1 008 ou 1 009
points par station selon l’inclusion de la borne de fin, avec six appels API.
Pour actualiser localement avec `API_MAREE_KEY` définie temporairement :

```sh
python scripts/update_tides.py
```

Le [guide marées](docs/TIDES.md) décrit la saisie masquée, les validations,
les crédits, les erreurs et le workflow. Aucun secret n’est enregistré.

## Route Kobo et PNG FBInk

Local : http://127.0.0.1:5173/kobo/?spot=tharon

Les identifiants sont `tharon`, `la-baule`, `suscinio`. Le sélecteur reste
disponible dans la vue Kobo. La surface est toujours **600 × 800 pixels**,
sans adaptation à la largeur du téléphone. La vue web reste responsive.

La liseuse N905B n’a pas besoin d’exécuter React : le rendu et l’export se font
dans un Chromium moderne sur le PC, puis le PNG est transféré par USB.
Le navigateur ancien de la Kobo n’est pas une cible de cette application Vite.

En laissant `npm run dev` ouvert dans un terminal :

```sh
npx playwright install chromium
npm run export:kobo -- tharon
npm run export:kobo -- la-baule
npm run export:kobo -- suscinio
```

Avec une URL publiée ou le serveur de preview :

```sh
npm run export:kobo -- suscinio http://127.0.0.1:4173/kobo/
npm run export:kobo -- tharon https://UTILISATEUR.github.io/wing-dashboard/kobo/
```

Sortie : `output/meteo-wingfoil-SPOT.png`, type couleur PNG 0 (gris), 8 bits,
600 × 800, opaque, sans entrelacement, valeurs quantifiées sur 16 niveaux.
L’export attend la fin du chargement météo et marées. Si une seule source
fonctionne, l’autre reste explicitement indisponible dans l’image. Il refuse
un fichier si les deux sources sont indisponibles ou si le contenu dépasse
le cadre 600 × 800. Un ancien fichier exporté reste inchangé en cas d’échec :
contrôler sa date avant transfert. La durée exportée est 24 h par défaut.
Avec Chrome déjà installé, définir `$env:WING_BROWSER_CHANNEL='chrome'` dans
PowerShell pour l’utiliser à la place de Chromium Playwright.

Pour la Kobo déjà équipée du test Hello World et du script météo : copier
manuellement le PNG choisi sous `.adds/kobo-screen/meteo-wingfoil.png`, puis
éjecter et lancer **Afficher météo**. Le projet n’écrit jamais sur la Kobo et
ne remplace aucun binaire ni firmware. Le script existant emploie :

```sh
LD_PRELOAD=/mnt/onboard/.adds/hello-fbink/libfbink.so.1 \
 /mnt/onboard/.adds/hello-fbink/fbink -V -c -f -w -W GC16 \
 -g 'file=/mnt/onboard/.adds/kobo-screen/meteo-wingfoil.png,x=0,y=0,dither'
```

[Options FBInk 1.25.0](https://github.com/NiLuJe/FBInk/blob/v1.25.0/CLI.md).
Retour : bouton physique Accueil. Le PNG est statique ; aucune mise à jour
automatique de la liseuse, aucun SSH ni TouchDesigner.

## GitHub Pages — préparé, sans publication

`base: './'` utilise des assets relatifs. `scripts/pages.mjs` crée une vraie
page `dist/kobo/index.html` référençant `../assets/`. Cela permet l’accès direct
et le rechargement de `/NOM-DU-DEPOT/kobo/` sans réécriture serveur, 404 de SPA,
ou routeur côté serveur. L’état du spot est transmis par `?spot=...`.
Le mode `#/kobo` est aussi compris, mais `/kobo/` est l’URL recommandée.

Après compilation et vérification de l’interface, et **seulement après accord
de publication** :

1. Créer un dépôt GitHub (public pour Pages gratuit avec GitHub Free), sans
   secret ni fichier personnel. Un site Pages publié est accessible publiquement,
   même si l’usage de l’application reste strictement personnel.
2. Conserver `package-lock.json` : le workflow utilise `npm ci` et le cache npm.
3. Envoyer les sources. Ne pas versionner node_modules, dist ou output.
4. Dans Settings → Pages → Build and deployment, choisir **GitHub Actions**.
5. Ajouter le secret Actions `API_MAREE_KEY`. Lancer **Publish GitHub Pages**
   sans cocher `publish` pour tester la récupération, les tests et le build.
6. Après accord explicite de publication, ajouter la variable Actions
   `PAGES_PUBLISH_ENABLED=true`, puis lancer le workflow avec `publish` coché.
7. Vérifier l’URL fournie, puis `/kobo/?spot=suscinio` et un rechargement direct.

Le workflow est manuel et planifié **toutes les six heures, à la minute 17 UTC**.
Il récupère les marées et les prévisions météo, puis construit le site. La récupération
et le build sont automatiques ; le déploiement reste bloqué tant que
`PAGES_PUBLISH_ENABLED` n’est pas `true`. Après autorisation et activation,
la planification publiera également les nouveaux JSON. Aucun lancement sur push.
En cas d’échec d’une station, le nouveau jeu complet n’est pas déployé ; le
dernier site publié reste en place. Les tâches planifiées GitHub peuvent être
retardées ou désactivées après 60 jours sans activité d’un dépôt public.
Le nom du dépôt peut changer sans modifier la base Vite.
Sources : [Vite / GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages),
[workflows Pages officiels](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Historique de validation V1

- 15 tests JavaScript et 14 tests Python : réussis. Conversion UTC/Paris,
  changement d’année et deux occurrences de 02:30 au passage à l’heure d’hiver.
- Compilation de production réussie. Chargement natif de la configuration Vite
  pour éviter les restrictions de lecture des dossiers parents sous Windows.
- Rendu Chrome testé sur les trois spots à 1280 px, 375 px et en Kobo 600 × 800,
  pour 24 et 48 h : 18 combinaisons avec vent, rafales, direction et marées réels.
- Courbes réelles, extrema, coefficients, crédits, sélecteur 24/48 h, expiration,
  absence de débordement horizontal et cadrage Kobo vérifiés.
- Route Kobo et JSON testés sous `/wing-dashboard/` comme sur GitHub Pages.
- Trois PNG 600 × 800 exportés avec vent et marées réels, sur 48 h.
- L’accès réseau externe reste refusé dans Codex, mais les JSON réellement
  collectés depuis le terminal utilisateur sont chargés par le chemin normal
  de l’application : aucune interception ou donnée de remplacement en QA.
- Sept jours de marées et HTTP 200 météo sur les trois spots confirmés.
- Le workflow est vérifié localement ; aucune exécution GitHub distante effectuée.
- Aucun dépôt publié et aucune copie sur la Kobo.

Pour reproduire les vérifications : `npm test`,
`python -m unittest discover -s tests_python -v`, `npm run build`, puis
`npm run preview -- --port 5174`. Dans un autre terminal, définir
`WING_BROWSER_CHANNEL=chrome` si nécessaire et lancer `npm run test:ui -- --require-complete`.
Les rapports et captures sont dans `output/qa/`, ignorés par Git.
