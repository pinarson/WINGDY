# Diagnostic API marées — avant validation des données

Le script `scripts/probe_tides.py` utilise Python 3.10+ et uniquement la
bibliothèque standard. Aucune dépendance à installer. Il n’écrit ni dans `src`,
ni dans `public`, ni dans `dist`, et ne publie rien.

## Fournir la clé sans l’enregistrer

La clé est lue uniquement dans la variable de processus `API_MAREE_KEY`.
Ne pas créer de `.env`, ne pas utiliser `setx`, ne pas coller la clé dans une
commande, une URL, ce document ou la conversation. Le script ne charge aucun
fichier de secrets. Il utilise `Authorization: Bearer`, refuse les redirections
HTTP et ne journalise ni réponse brute, ni en-têtes, ni exception réseau brute.

Dans un terminal PowerShell personnel ouvert dans le dossier du projet :

```powershell
$tideSecret = Read-Host 'Clé API marées (saisie masquée)' -AsSecureString
$tideCredential = [System.Net.NetworkCredential]::new('', $tideSecret)
$env:API_MAREE_KEY = $tideCredential.Password
try {
    python scripts/probe_tides.py
} finally {
    Remove-Item Env:\API_MAREE_KEY -ErrorAction SilentlyContinue
    $tideCredential = $null
    $tideSecret.Dispose()
}
```

La saisie n’apparaît pas dans l’historique. La valeur existe nécessairement en
mémoire pendant l’appel, puis la variable est retirée. Si `python` n’est pas sur
le PATH de ce PC, utiliser `& 'C:\pinokio\bin\miniconda\python.exe'` à sa place.
Une variable définie dans un autre terminal n’est pas héritée par une session
Codex déjà ouverte ; lancer le script dans ce terminal ou relancer Codex depuis
l’environnement qui contient la variable.

## Ce qui est testé

1. Appel authentifié à `/sites`, validation des coordonnées.
2. Calcul de la distance orthodromique à chaque plage (WGS84, rayon terrestre
   moyen), puis affichage des cinq stations les plus proches.
3. Proposition de la station la plus proche et interrogation indépendante de
   `/water-levels` et `/tide-extrema` pour chaque spot.
4. Vérification du site retourné, des unités en mètres, du fuseau UTC, de la
   couverture et du pas de dix minutes, ainsi que des horaires PM/BM.
5. Affichage des coefficients présents sur les PM ; les coefficients absents
   restent absents, sans calcul ni remplacement.
6. Contrôle de présence des mentions `attribution` et `status_notice`.

Par défaut, le test porte sur **aujourd’hui de 00:00 à 24:00 UTC**. Une journée
UTC n’est pas une journée civile française ; UTC est volontairement utilisé pour
éviter toute ambiguïté de changement d’heure. L’interface convertira les dates
en Europe/Paris lors d’une intégration ultérieure validée.

Pour une date ou une station différente (clé toujours dans l’environnement) :

```sh
python scripts/probe_tides.py --date 2026-10-23
python scripts/probe_tides.py --days 7
python scripts/probe_tides.py --station tharon=IDENTIFIANT_RETOURNE_PAR_SITES
```

La proximité ne prouve pas l’équivalence hydrodynamique d’une station voisine.
Chaque sélection reste une **référence proposée**, avec nom, coordonnées et
distance explicites. Aucun identifiant de port n’est inventé ou déduit du nom
de la plage. La sélection doit être revue selon le bassin et le littoral avant
de l’afficher comme référence de Tharon, La Baule ou Suscinio. Une station trop
éloignée ou située dans un autre bassin ne devra pas être utilisée par défaut.

## Rapports locaux

Sortie ignorée par Git : `output/tide-diagnostic/report.json` et un JSON par
spot. Ces fichiers contiennent les données validées, les candidates, les
résultats indépendants des endpoints et les mentions légales retournées.
Les champs serveur non nécessaires ne sont pas conservés. Toutes les chaînes
exportées sont filtrées pour masquer une éventuelle réapparition de la clé.

Les fichiers portent `status: diagnostic_only` et `mapping_approved: false`.
Ne pas les copier dans le site avant validation. Les mentions légales manquantes
sont signalées et doivent être résolues avant publication, même si les données
techniques sont récupérées correctement. En cas d’échec avant écriture, les
anciens rapports peuvent rester sur le disque : vérifier `fetched_at`.

Codes de retour : 0 = hauteurs et PM/BM reçus et validés pour les trois
propositions ; 1 = erreur ou récupération partielle ; 2 = clé absente/invalide.
Un code 0 ne vaut pas validation de la pertinence géographique ou de la licence.

## Workflow GitHub Actions préparé

`.github/workflows/tide-diagnostic.yml` est manuel (`workflow_dispatch`). Il
exécute les tests sans clé, puis fournit `secrets.API_MAREE_KEY` uniquement à
l’étape d’appel API. Aucun secret n’est transmis à Vite ou au JavaScript web.

Il produit un artefact de diagnostic conservé sept jours, sans commit, sans
modification de Pages et sans déploiement. Rien n’a été envoyé sur GitHub.
Après autorisation de création du dépôt et d’exécution distante, ajouter la clé
dans Settings → Secrets and variables → Actions → New repository secret, nom
`API_MAREE_KEY`, puis lancer **Diagnose tide API (no deployment)**.

Une fois les stations et données approuvées, un workflow de production pourra
générer les JSON publics avec leurs attributions, contrôler leur validité, puis
alimenter le build Pages. Cette publication n’est pas activée ici.

## Références

- https://api-maree.fr/documentation
- https://api-maree.fr/cgu
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- https://docs.github.com/en/actions/tutorials/store-and-share-data

Les données sont des prédictions calculées ; les coefficients estimés ne sont
pas officiels. Les hauteurs sont annoncées au-dessus du zéro hydrographique
local, avec un zéro modélisé possible pour certains sites non recalés sur un
marégraphe. Conserver les précisions du fournisseur plutôt que d’affirmer une
précision ou un calage officiel non vérifié.
