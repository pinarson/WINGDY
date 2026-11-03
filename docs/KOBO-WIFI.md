# Publication et premier téléchargement Wi-Fi — préparation locale

État au 29 octobre 2026 : rien envoyé sur GitHub, aucun workflow déclenché,
aucune publication et aucune modification de la liseuse. Design Kobo Lite inchangé.
Le dossier fourni n'a pas de `.git` : l'audit concerne les deux workflows locaux,
pas les exécutions ni les paramètres d'un éventuel dépôt distant.

## Pipeline préparé

`.github/workflows/pages.yml` contient déjà `17 */6 * * *` : 00:17, 06:17,
12:17 et 18:17 UTC (Paris : +1 h en hiver, +2 h en été). Cette cadence est
indicative : Actions peut retarder ou abandonner une exécution sous charge.
Le workflow doit être sur la branche par défaut ; les horaires ne sont pas une
garantie temps réel. Dans un dépôt public, le planning peut être désactivé après
60 jours sans activité.

1. Job `tides` : tests Python, collecte de sept jours pour les trois stations
   approuvées, puis artefact JSON validé. Six appels API par collecte, soit
   24 appels par jour à cette cadence, hors diagnostics et relances.
2. Job `build` : collecte Open-Meteo 96 h pour les trois spots, tests JS,
   compilation, installation Chromium Playwright, export des trois PNG Lite.
3. `prepare:kobo-pages` sert le build sur loopback dans le runner, utilise
   l'export existant, exige un état `ready`, des sources de moins de sept heures,
   aucun débordement, 600 × 800, gris 8 bits opaque, 16 niveaux et sans entrelacement.
   Il produit un manifeste avec dates des sources et SHA256, et une empreinte
   par image. Aucun changement dans `src/`, les styles ou la composition validée.
4. Un artefact `kobo-lite-<run_id>` permet la revue sans déploiement. L'artefact
   Pages contient le site, les JSON et les trois images uniquement après succès.
5. Le job `deploy` exige `PAGES_PUBLISH_ENABLED=true` ET une exécution planifiée
   ou la case manuelle `publish=true`. Valeur absente ou différente : job ignoré.
   Aucun déclencheur sur push. Ne pas activer cette variable avant autorisation :
   elle autorise aussi les publications planifiées suivantes.

Une erreur de collecte ou de rendu bloque tout le déploiement ; le dernier site
publié reste en place. Le diagnostic `tide-diagnostic.yml` reste manuel, sans
déploiement. Aucun workflow ne commite les données dans les sources.

Commandes locales après collecte de données fraîches et `npm.cmd run build` :

```powershell
# Chrome installé, comportement local par défaut
npm.cmd run prepare:kobo-pages
# Ou le Chromium Playwright, utilisé en CI
npx.cmd playwright install chromium
$env:WING_BROWSER_CHANNEL='chromium'
npm.cmd run prepare:kobo-pages
```

## URL fixes prévues

Remplacer `COMPTE` par le propriétaire réel du dépôt. Avec le nom de dépôt
`wing-dashboard` et sans domaine personnalisé :

| Spot | URL PNG |
| --- | --- |
| Tharon | `https://COMPTE.github.io/wing-dashboard/kobo/png/tharon.png` |
| La Baule | `https://COMPTE.github.io/wing-dashboard/kobo/png/la-baule.png` |
| Suscinio | `https://COMPTE.github.io/wing-dashboard/kobo/png/suscinio.png` |

Le manifeste est à `kobo/png/manifest.json`. Les empreintes sont à
`kobo/png/tharon.sha256`, `la-baule.sha256` et `suscinio.sha256`.
Ces chemins sont indépendants des noms hashés des assets Vite et des dates.
L'adresse définitive dépend du compte et du dépôt, encore inconnus ici.
Les JSON publiés restent `data/weather.json` et `data/tides.json`.
Les artefacts Actions ne sont pas des URL publiques fixes destinées à la Kobo.

## Secrets : résultat et limite de l'audit

Dans les deux workflows, `API_MAREE_KEY` vient exclusivement de
`${{ secrets.API_MAREE_KEY }}` et n'est injectée que dans l'étape Python
authentifiée. Le job Node, le build, le rendu et la Kobo n'en reçoivent pas.
Le client API utilise un en-tête Bearer, jamais un paramètre URL, refuse les
redirections et ne journalise pas les réponses d'erreur du serveur.
L'export JSON filtre les données, refuse la clé exacte dans le résultat et
les tests Python couvrent la non-divulgation et la conservation de l'ancien JSON.
`.env` et `.env.*` sont ignorés ; aucun fichier de ce type trouvé à la racine.

L'outil historique `collect_real_data.py` permet encore une saisie locale masquée
en mémoire pour un usage manuel. Le pipeline préparé ne l'utilise pas : pour
garder la clé exclusivement dans GitHub Secrets, ne pas utiliser cet outil ni
définir la clé sur le PC. Ne jamais mettre la clé dans `config/`, une variable
`VITE_*`, un script Kobo, un journal, un artefact ou les fichiers Pages.

Sans accès au dépôt distant, sa présence dans les secrets, ses réglages et
l'absence de secret dans un historique Git ne sont pas vérifiables ici.
Il faudra contrôler le nom du secret (sans afficher sa valeur), et auditer
l'historique avant le premier envoi si un dépôt existe déjà. La revue locale
ne constitue pas un détecteur universel de toutes les formes de secrets.

## N905B : HTTPS et TLS

La Kobo ne charge pas React : elle récupère uniquement un PNG déjà rendu.
La capacité HTTPS dépend du firmware et surtout du binaire curl/wget et de sa
bibliothèque TLS, pas de la résolution ni du modèle N905B à lui seul.
Ne pas supposer que le navigateur Kobo et curl partagent les mêmes capacités.
GitHub a retiré TLS 1.0/1.1 ; prévoir TLS 1.2 au minimum, SNI, une horloge juste,
des suites compatibles et un magasin de certificats racines à jour.

Avant le test, relever sur la liseuse via un script lancé par NickelMenu
(résultats dans un fichier local, lisible ensuite par USB) :

```sh
date -u
uname -m
command -v curl
curl --version
command -v wget
command -v sha256sum
```

Le script `kobo/download-dashboard.sh` utilise HTTPS avec vérification du
certificat, TLS ≥ 1.2, délais et taille limitée, contrôle SHA256 et en-tête PNG.
Il refuse HTTP, ne suit pas les redirections, n'exécute rien téléchargé et ne
remplace le PNG existant qu'après tous les contrôles. Un déploiement entre la
lecture de l'empreinte et celle du PNG peut faire échouer la comparaison :
relancer, l'ancienne image est conservée. L'empreinte vérifie la cohérence ;
l'authentification du serveur repose sur HTTPS. Elle ne détecte pas à elle seule
une image ancienne mais valide : comparer les dates du manifeste au premier test.

Si la connexion échoue :

| Symptôme | Suite à donner |
| --- | --- |
| curl absent ou option inconnue | Fournir par USB un curl compilé pour cette Kobo et son architecture/ABI, puis vérifier `--version`. |
| erreur de certificat, par exemple curl 60 | Corriger la date et utiliser un bundle CA actuel via `WING_CA_BUNDLE`. |
| négociation TLS impossible, par exemple curl 35 | Fournir un curl et sa bibliothèque TLS compatibles TLS 1.2+, SNI et suites du serveur. Une mise à jour des CA seule ne suffit pas. |
| DNS ou délai | Vérifier l'association Wi-Fi et l'accès Internet depuis la Kobo. |
| HTTP 404 | Vérifier le compte, le dépôt, le déploiement et le chemin exact. |

**Solution privilégiée : client HTTPS moderne autonome, copié par USB**, testé
sur la N905B avant de retenir un binaire. Des outils Kobo existent dans
l'écosystème NiLuJe/KOReader ; cela ne prouve pas la compatibilité d'un paquet
donné avec cette liseuse. Ne pas installer un ensemble qui active aussi Dropbear,
SSH ou telnet. Ici aucun paquet ni firmware n'est installé. Les chemins optionnels
`WING_CURL` et `WING_CA_BUNDLE` évitent de remplacer les binaires système.

Si aucun client TLS utilisable ne fonctionne, un relais **hébergé à l'extérieur**
pourrait récupérer Pages en HTTPS et fournir les images à un client ancien.
Un relais HTTP perd l'authentification du transport et n'est pas retenu par le
script préparé ; il demanderait une décision séparée et, idéalement, une signature
vérifiable sur la Kobo. Aucun relais domestique, port redirigé ou serveur sur le PC
n'est nécessaire. Ne pas utiliser `curl -k` comme correction TLS.

## Premier test Wi-Fi, après autorisation de publication

1. Fournir/identifier le dépôt GitHub. Avant tout envoi, revoir les fichiers
   préparés ; aucun envoi n'a été effectué pendant cette préparation.
2. Mettre uniquement `API_MAREE_KEY` dans Settings → Secrets and variables →
   Actions → Secrets. Laisser `PAGES_PUBLISH_ENABLED` absent ou `false`.
3. Après autorisation d'envoyer les sources, lancer manuellement **Publish GitHub
   Pages**, case `publish` décochée. Contrôler les deux collectes, les tests,
   les trois PNG et les dates dans l'artefact de revue. Le job deploy doit être ignoré.
4. Après autorisation explicite de publier, choisir **GitHub Actions** comme source
   dans Settings → Pages, configurer l'environnement `github-pages` (approbateur
   requis si disponible), puis seulement activer `PAGES_PUBLISH_ENABLED=true`
   et lancer avec `publish` coché. Cette variable active aussi les futures publications
   planifiées ; la remettre à `false` après le test pour suspendre la publication.
5. Sur le PC, vérifier HTTP 200 et télécharger les trois URL PNG, contrôler leur
   taille, leurs empreintes et les dates du manifeste. Pages est public : publier
   uniquement ces données de prévision et les assets nécessaires.
6. Par USB, sauvegarder le PNG Kobo existant puis copier **uniquement**
   `download-dashboard.sh` dans `.adds/kobo-screen/`, en texte UTF-8 sans BOM
   et fins de ligne LF. Préparer le client HTTPS/CA seulement si le diagnostic
   l'exige. Ne pas écraser `afficher-meteo.sh` ni l'entrée existante Afficher météo.
7. Ajouter une entrée NickelMenu dédiée, avec le vrai compte et le vrai dépôt :

   ```text
   menu_item : main : Télécharger météo Wi-Fi : cmd_spawn : sh /mnt/onboard/.adds/kobo-screen/download-dashboard.sh https://COMPTE.github.io/wing-dashboard tharon > /mnt/onboard/.adds/kobo-screen/download.log 2>&1
   ```

   Pour un client séparé, préfixer `sh` dans cette commande par
   `WING_CURL=/chemin/vers/curl WING_CA_BUNDLE=/chemin/vers/cacert.pem`.
   Aucun identifiant GitHub ni clé météo n'est requis dans la Kobo.
8. Éjecter l'USB, connecter le Wi-Fi **sur la Kobo**, puis lancer Télécharger
   météo Wi-Fi. Lancer ensuite l'entrée existante **Afficher météo**. Contrôler
   visuellement le spot et les dates, puis relire `download.log` par USB.
9. Tester aussi une URL inexistante ou le Wi-Fi coupé : l'ancienne image doit
   rester intacte. Aucun téléchargement réussi ne doit être annoncé dans le log.

Le script effectue une seule récupération et se termine. Il n'ouvre aucun port,
n'utilise ni SSH ni connexion entrante, et ne nécessite aucune configuration du
routeur. Seule la Kobo initie les requêtes sortantes HTTPS (et la résolution DNS).
Le réveil périodique, la remise en veille et l'affichage autonome constituent
l'étape suivante, après ce premier test matériel ; ils ne sont pas activés ici.

## Vérifications locales

Le 29 octobre : 22 tests JS et 14 tests Python réussis ; compilation réussie.
La préparation PNG refuse correctement les JSON locaux anciens (collectés le
23 octobre). Aucun secret ni nouvelle collecte réelle n'a été demandé localement.
La chaîne de rendu complète a aussi produit les trois PNG et leurs empreintes
dans `output/wifi-offline-check/dist/kobo/png/`, avec une horloge de test fixée
au 23 octobre et les données historiques non modifiées. Ces images de QA ne
sont pas des prévisions actuelles et ne sont pas placées dans le build publiable.
Le script Kobo a un test hors réseau (client simulé) couvrant succès, échec HTTP,
empreinte incorrecte et en-tête invalide, avec conservation de l'ancien PNG.
La génération avec des sources fraîches et le téléchargement physique N905B
restent à valider lors du test Actions sans déploiement, puis sur la liseuse.

## Références

- [Workflows GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Planification Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [HTTPS Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Retrait des anciens protocoles TLS par GitHub](https://github.blog/news-insights/product-news/crypto-removal-notice/)
- [Vérification des certificats curl](https://curl.se/docs/sslcerts.html)
- [Toolchains Kobo/KOReader](https://github.com/NiLuJe/koxtoolchain)
- [Exemple de client Kobo et dépendances](https://github.com/usetrmnl/trmnl-kobo)
