# Marées réelles : récupération et publication différée

L’utilisateur a validé les trois références de `config/tide-stations.json`.
La récupération de production ne cherche plus de station et ne choisit jamais
automatiquement une autre référence. Le diagnostic historique reste disponible.

## Actualisation locale sans conserver la clé

Dans PowerShell, depuis la racine du projet :

```powershell
$tideSecret = Read-Host 'Clé API marées' -AsSecureString
$tideCredential = [System.Net.NetworkCredential]::new('', $tideSecret)
try {
    $env:API_MAREE_KEY = $tideCredential.Password
    & 'C:\pinokio\bin\miniconda\python.exe' scripts/update_tides.py
} finally {
    Remove-Item Env:\API_MAREE_KEY -ErrorAction SilentlyContinue
    $tideCredential = $null
    $tideSecret.Dispose()
}
```

Sur un autre PC, remplacer le chemin Python par `python` (3.10+).
Ne pas saisir la clé dans le code, une URL, une commande en clair ou un fichier
`.env`. La clé est transmise à l’API par en-tête Bearer ; les redirections sont
refusées. Aucune réponse brute ou exception réseau détaillée n’est imprimée.
Le JSON exporté ne contient qu’une liste blanche de données et de mentions ;
le script refuse l’écriture s’il y détecte une réapparition de la clé.

Le script demande sept jours UTC à partir du début de la journée courante,
six appels au total : hauteurs et extrema pour les trois stations fixes.
Il valide les unités, le site, le fuseau, les dates, l’ordre, le pas de 10 minutes,
la couverture et les coefficients éventuels. La mise à jour du fichier unique
`public/data/tides.json` est atomique : un échec ne remplace pas le jeu précédent.
En cas d’échec, vérifier l’erreur, puis relancer ; les détails HTTP sensibles
sont volontairement masqués. Aucun envoi Git ni déploiement n’est effectué.

Pour réimporter le diagnostic existant sans clé et sans modifier les chiffres :

```sh
python scripts/update_tides.py --from-report output/tide-diagnostic/report.json
```

La date de récupération initiale est conservée, sans rajeunir le jeu.
Ce diagnostic ne couvre qu’une journée : il ne remplace pas une récupération
complète de sept jours pour le fonctionnement 48 h continu.

## Affichage et validité

Le navigateur lit uniquement le JSON du même site. Il vérifie le schéma,
les stations approuvées, les intervalles, les dates et les mentions.
Un jeu invalide ou expiré ne produit aucune courbe. Une période partiellement
couverte est explicitement signalée et la partie absente reste vide.
Les PM/BM viennent de `/tide-extrema`, pas des maxima approximés de l’échantillonnage.
Le coefficient n’est affiché que s’il est effectivement fourni sur une PM.

Toutes les dates sont stockées en UTC avec un suffixe explicite. `Intl` utilise
Europe/Paris pour les afficher, y compris les jours qui durent 23 ou 25 heures.
Les 24/48 h sont des durées écoulées, pas un décompte de jours civils locaux.
Sur le web, chaque événement affiche aussi son décalage UTC. Sur la Kobo,
les horaires et les dates restent locaux sous le libellé « Heure de Paris ».

Les mentions retournées par le fournisseur sont conservées et affichées en
texte React échappé. Les réponses du diagnostic ne contenaient pas les champs
`attribution` et `status_notice`. Dans ce cas seulement, le générateur emploie
l’attribution publiée sur https://api-maree.fr/cgu et une mention de statut
tirée de la documentation : prédictions calculées et coefficients estimés non
officiels, impropres à la navigation. Le JSON précise l’origine documentaire
de ces mentions. Les liens api-maree.fr, Ifremer/PREVIMER et CC BY 4.0 restent
visibles, y compris sur le PNG Kobo, avec la mention des arrondis/conversions.

Les hauteurs sont en mètres au-dessus du zéro local du fournisseur. Le calage
peut être modélisé pour certains sites : l’application ne promet pas un zéro
officiel ou une précision qui n’a pas été démontrée pour la station choisie.

## Automatisation GitHub Actions

Le workflow `pages.yml` est préparé toutes les six heures, à la minute 17 UTC, sur la branche
par défaut, et pour un lancement manuel. Il n’a pas été exécuté à distance.

1. Job `tides` : tests Python, puis récupération avec le secret de dépôt
   `API_MAREE_KEY`, limité à l’étape Python. Artefact JSON, conservé huit jours.
2. Job `build` : télécharge le JSON de marées, installe avec `npm ci`, récupère
   96 heures de météo réelle pour les trois spots sans clé, teste et compile.
   L’artefact Pages contient `data/weather.json` et `data/tides.json`.
   Ce job ne reçoit jamais le secret de marées.
3. Job `deploy` : bloqué tant que la variable de dépôt
   `PAGES_PUBLISH_ENABLED` n’est pas exactement `true`.

En manuel, la case `publish` est également obligatoire pour déployer ; elle est
décochée par défaut. Après un accord explicite de publication, la variable
pourra être activée et les exécutions planifiées publieront les nouveaux jeux.
Avant cela, récupération et build ne rendent pas le site accessible sur Pages.
Les JSON ne sont pas commités automatiquement dans Git ; les déploiements
futurs utiliseront les artefacts. Un échec API bloque le nouveau déploiement.

Les deux JSON sont lus sur le même domaine par le navigateur ; l’affichage
simultané ne dépend pas d’une requête CORS externe. Le client conserve l’heure
réelle de récupération. Quand les conditions actuelles enregistrées sont
trop anciennes, il lit le point de prévision correspondant à l’heure courante,
sans interpolation ni valeur inventée. Les prévisions de plus de sept heures
sont signalées. Un horizon météo incomplet est affiché comme partiel et un
jeu expiré est refusé. Les 96 heures collectées en V2 laissent une marge pour
trois journées civiles de navigation après 20 h et les changements d’heure,
avec des exécutions toutes les six heures. Les marées conservent leurs modes
indépendants de 24/48 heures écoulées.

Le secret est à créer ultérieurement dans Settings → Secrets and variables →
Actions → Secrets. La variable d’autorisation de publication est distincte,
dans l’onglet Variables. Ne pas activer cette variable avant l’accord.
GitHub peut retarder les tâches planifiées ou les désactiver après 60 jours
sans activité d’un dépôt public : le site doit donc gérer l’expiration du jeu.

## Vérifications locales

`npm test` teste le schéma, les trois correspondances, les valeurs manquantes,
l’expiration et la conversion UTC/Paris. Les tests Python vérifient aussi que
l’export contenant un secret est refusé sans écraser le JSON précédent.
`npm run test:ui` teste les trois spots en web, mobile et Kobo, puis l’expiration.
Il utilise uniquement le vrai jeu local ; son horloge est figée au début du jeu
pour inspecter les horaires historiques. Il n’invente aucune hauteur de marée.
Le drapeau `WING_OFFLINE_WEATHER_TEST=1` provoque explicitement une erreur réseau
météo pendant les tests ; il ne fournit aucun faux vent.

L’export PNG refuse un dépassement du cadre 600 × 800 et attend les deux
chargements. Si le vent ou les marées échouent, leur indisponibilité reste dans
l’image ; si les deux échouent, aucun nouveau PNG n’est écrit.

Sources : https://api-maree.fr/documentation, https://api-maree.fr/cgu,
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule.
