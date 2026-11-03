# Finalisation V1 — procédure et résultats vérifiables

Guide historique V1. Pour l’interface V2, les modes indépendants vent/marées
et les derniers résultats, consulter [le bilan V2](V2-TEST-REPORT.md).

Aucune publication ni modification de la configuration réseau n’est effectuée.

## Débloquer les données réelles sans exposer la clé

Dans un PowerShell Windows personnel :

```powershell
cd "$HOME\Documents\GitHub\wing-dashboard"
& 'C:\pinokio\bin\miniconda\python.exe' scripts/collect_real_data.py
```

La clé de marées est demandée via une saisie masquée. Le collecteur refuse les
entrées non interactives et toute saisie qui pourrait être affichée. La clé est
transmise en variable d’environnement uniquement au processus de récupération
des marées. Elle n’est transmise ni à Node, ni au navigateur, ni au build et ne
figure dans aucun argument de commande. Aucun fichier de clé n’est créé.

Le collecteur exécute ensuite trois vraies requêtes Open-Meteo sans clé,
génère `public/data/weather.json` et conserve les réponses complètes dans
`output/weather-diagnostic/report.json`, ignoré par Git. Il vérifie les 48
valeurs horaires, leur continuité, le vent, les rafales et la direction.
Seul le JSON public validé est utilisé par l’application ; rien n’est inventé.

## Diagnostic de connexion constaté dans Codex

- DNS Open-Meteo résolu.
- Requêtes Node aux trois spots : `EACCES`, appel système `connect`.
- Requête de contrôle vers la documentation : même refus.
- Dans Chrome : `net::ERR_NETWORK_ACCESS_DENIED`, sans réponse HTTP exploitable.

Ces éléments montrent un refus d’accès réseau dans cet environnement avant
de pouvoir évaluer une réponse API. Ils n’indiquent pas une erreur de paramètre
Open-Meteo ou une panne de son service, et ne se limitent pas au CORS navigateur.
La collecte utilisateur a depuis confirmé HTTP 200 pour les trois spots.
Une réponse reçue par Node peut ne pas inclure d’en-tête CORS : son absence ne
prouve pas un échec. L’application utilise maintenant les deux JSON du même
domaine ; elle ne dépend plus de l’accès CORS tiers dans son chemin normal.

## Contrôle strict après collecte

```powershell
& 'C:\pinokio\bin\miniconda\node.exe' scripts/verify-real-data.mjs
```

Le résultat n’est positif que si les trois stations contiennent réellement
sept jours de marées, dont 48 h futures couvertes sans interruption, et si les
trois jeux météo publics contiennent les 48 heures requises et les valeurs
de vent/rafales/direction. Le rapport est `output/final-validation/data.json`.
Un ancien jeu d’une journée ne peut pas produire un succès de cette vérification.

## Vérification simultanée de l’interface et du PNG

Après build et lancement de la preview sur le port 5174 :

```powershell
$env:WING_BROWSER_CHANNEL='chrome'
& 'C:\pinokio\bin\miniconda\node.exe' scripts/check-ui.mjs --require-complete
$env:WING_REQUIRE_COMPLETE='1'
$env:WING_EXPORT_HOURS='48'
& 'C:\pinokio\bin\miniconda\node.exe' scripts/export-kobo.mjs tharon http://127.0.0.1:5174/kobo/
```

Le contrôle exige simultanément le vent, les rafales, la direction et une courbe
de marée couvrant les 48 h pour les trois spots sur ordinateur, mobile et Kobo.
Le PNG strict est refusé si une source manque ou si le contenu déborde du cadre.
Son fichier JSON associé précise les sources et le mode de récupération utilisé.

Les tests utilisent maintenant les JSON du site, exactement comme l’application
publique, sans interception Playwright des réponses. Les rapports indiquent
`same_origin_json`. Aucun horodatage ni aucune valeur n’est remplacé. Le mode
strict fixe seulement l’horloge au démarrage du test pour rendre les 18
comparaisons cohérentes. Ce n’est pas une requête Open-Meteo directe de Chrome :
les véritables réponses de l’API ont été collectées en amont puis validées.
Le workflow utilise 72 heures météo pour conserver 48 h affichables entre deux
actualisations, plutôt que les 48 échantillons du diagnostic initial.

## Publication et secrets

Le workflow est prévu toutes les six heures, à la minute 17 UTC. La clé est
injectée dans la seule étape Python ; le job de build récupère ensuite la météo
sans clé et génère les deux JSON et les pages statiques. Le script refuse
l’export si la clé réapparaît dans le contenu. Le déploiement nécessite encore
`PAGES_PUBLISH_ENABLED=true`, plus l’option `publish` lors d’un lancement manuel.
Aucun dépôt, secret distant ou workflow distant n’a été créé ou exécuté ici.
La configuration peut être vérifiée localement ; son bon fonctionnement sur
GitHub devra être confirmé par une exécution manuelle sans publication avant
d’activer les publications automatiques.
