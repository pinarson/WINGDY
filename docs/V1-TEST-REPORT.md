# Wing Dashboard V1 — bilan local du 23 octobre 2026

Statut : validation locale réussie. Aucune publication et aucune copie sur la Kobo.

## Sources réelles vérifiées

Les fichiers ont été récupérés dans le terminal utilisateur, puis validés et
chargés par l’application via `data/weather.json` et `data/tides.json`.
Aucune interception réseau en QA, aucune météo fictive, aucun horaire inventé.

| Spot | Station de marée | Hauteurs | Vent actuel du modèle | Rafales | Direction |
| --- | --- | ---: | ---: | ---: | ---: |
| Tharon-Plage | Pointe de Saint-Gildas | 1 008 | 27,7 nd | 43,0 nd | 283° |
| La Baule | Le Pouliguen | 1 008 | 22,6 nd | 32,7 nd | 289° |
| Suscinio | Le Logeo | 1 008 | 18,7 nd | 27,8 nd | 294° |

Marées : sept jours, du 23 au 30 octobre UTC, au pas de dix minutes sans trou.
Météo : HTTP 200 confirmé par le diagnostic utilisateur, 48 valeurs horaires
continues par spot. Conditions actuelles du modèle valides le 23/10 à 17:30 UTC,
soit 19:30 à Paris. Les dates de récupération originales sont conservées.

## Tests et rendu

- 15 tests JavaScript et 14 tests Python réussis : **29 tests unitaires**.
- Compilation Vite de production réussie.
- **18 combinaisons UI** : trois spots × trois formats × deux durées.
- Formats : ordinateur 1280 px, mobile 375 px et Kobo 600 × 800.
- Vent, rafales, direction et marées présents simultanément dans chaque cas.
- Tracés de vent/rafales contrôlés : 24 ou 48 valeurs, un seul segment continu.
- Courbe de marée contrôlée : 145 ou 289 points, au pas de dix minutes.
- Horaires PM/BM, hauteurs et coefficients présents comparés au JSON réel.
- Conversion Europe/Paris vérifiée dans les cartes ; tests spécifiques des deux
  occurrences de 02:30 au passage à l’heure d’hiver et du changement d’année.
- Absence de défilement horizontal et de contenu coupé sur la Kobo.
- En 48 h, le contenu Kobo se termine à environ 760 px sur les 800 disponibles.
- État de données expirées vérifié ; aucune extrapolation du jeu absent.
- Les crédits de marées, de météo et les mentions de statut restent visibles.

Les rapports machine sont dans `output/qa/results-complete.json` et
`output/final-validation/`. Les captures sont dans `output/qa/` et ne sont pas
versionnées ni publiées. L’horloge du test est fixée à l’heure réelle au début
de l’exécution, uniquement pour comparer les mêmes fenêtres temporelles.

## PNG vérifiés

Trois exports 48 h : `output/meteo-wingfoil-tharon.png`,
`output/meteo-wingfoil-la-baule.png`, `output/meteo-wingfoil-suscinio.png`.
Vent et marées réellement disponibles dans les trois images.

Dimensions 600 × 800, profondeur 8 bits, type PNG 0 (niveaux de gris),
16 nuances, opaque, sans entrelacement. Contrôle du cadrage et inspection
visuelle effectués. Compatibilité de format avec FBInk 1.25.0 vérifiée ;
aucune image n’a été transférée ou affichée sur la liseuse pendant ces tests.

## Automatisation et confidentialité

Le workflow préparé lance la collecte toutes les six heures, à la minute 17 UTC :

1. Python récupère sept jours de marées avec le secret `API_MAREE_KEY`.
2. Le job de build récupère 72 heures Open-Meteo sans clé, pour conserver
   une marge au-delà des 48 heures affichées.
3. Tests, compilation et génération de `dist`, avec les deux JSON statiques
   et la page Kobo accessible directement sous un sous-répertoire GitHub Pages.
4. Le déploiement reste bloqué tant que `PAGES_PUBLISH_ENABLED` n’est pas `true`.

La clé est limitée à l’étape Python. Elle n’est pas transmise au build Vite,
à Open-Meteo ou au navigateur. L’audit des fichiers de `public` et `dist`
n’a détecté aucun champ, identifiant ou motif de clé API. Le générateur de
marées refuse en outre toute réapparition de la clé dans le JSON exporté.

L’architecture statique demandée évite le besoin d’un accès API depuis Chrome
dans Codex, sans modifier les règles réseau : l’affichage lit les JSON locaux
du site. Aucun CORS externe n’est requis pour
le chemin normal. L’absence de CORS sur une réponse Node n’était pas une erreur
de données ; le contrôle qui l’exigeait a été corrigé.

## Vérifications restantes avant publication

Aucun blocage détecté dans l’application ou les tests locaux.
Le workflow n’a pas été exécuté sur GitHub : il faut encore configurer le secret
dans le futur dépôt et effectuer une première exécution manuelle **sans publier**.
Cela confirmera l’accès réseau depuis les runners et la génération de 72 h météo.
Les appels locaux réussis couvraient 48 h ; le paramètre 72 h du workflow est
préparé et validé côté code, mais pas encore testé par un appel réel dans Codex.
L’activation de Pages et des publications automatiques attend l’accord utilisateur.
