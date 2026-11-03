# Premier test visuel de Wing Dashboard V2 par USB

Le PNG existe déjà : `output/meteo-wingfoil-tharon.png`.
Ce test n’effectue aucune collecte météo et ne demande aucune clé API.
Il n’utilise ni SSH, ni Wi-Fi, ni installation de logiciel ou de firmware.

## 1. Connecter la Kobo

1. Allumer la liseuse puis la brancher au PC avec son câble USB.
2. Sur la Kobo, choisir **Connecter** si la demande apparaît.
3. Dans l’Explorateur Windows, vérifier la lettre de son lecteur. Lors du
   contrôle effectué ici, la Kobo Touch N905B est accessible sur **D:**.

L’installation existante a été relue : FBInk et sa bibliothèque sont dans
`.adds/hello-fbink/`. L’entrée NickelMenu **Afficher météo** appelle déjà
`.adds/kobo-screen/afficher-meteo.sh`, lequel lit exactement
`/mnt/onboard/.adds/kobo-screen/meteo-wingfoil.png`.

## 2. Transférer une seule image

Méthode guidée : double-cliquer sur **Transferer dashboard Kobo.cmd** à la
racine du projet. Le lecteur par défaut est D:. Le script utilise le Node.js
déjà présent sur le PC ; il n’installe rien et n’appelle pas npm.

Pour vérifier sans copier, dans PowerShell depuis le dossier du projet :

```powershell
.\'Transferer dashboard Kobo.cmd' D: --check
```

Pour effectuer la copie :

```powershell
.\'Transferer dashboard Kobo.cmd' D:
```

Si la Kobo change de lettre, remplacer `D:` par sa lettre réelle. Le script
refuse un lecteur non identifié N905B ou une installation dont les chemins
diffèrent des chemins attendus.

Le script :

- vérifie que le PNG est bien 600 × 800, gris 8 bits et non entrelacé ;
- vérifie les fichiers déjà installés et l’entrée NickelMenu ;
- sauvegarde l’ancienne image **sur le PC**, sous `output/kobo-transfer-backups/` ;
- écrit uniquement `.adds/kobo-screen/meteo-wingfoil.png` sur la Kobo ;
- conserve les octets du PNG sans redimensionnement ni conversion ;
- vérifie le SHA256 de la copie et que menus, scripts et FBInk n’ont pas changé.

Ne pas lancer le script si une erreur de vérification apparaît. Il ne tente
pas de réinstaller ou de corriger automatiquement les composants manquants.

Alternative manuelle dans l’Explorateur : sauvegarder le fichier existant
`D:\.adds\kobo-screen\meteo-wingfoil.png` sur le PC, copier le nouveau PNG dans
ce même dossier et le renommer **meteo-wingfoil.png**. Aucun autre fichier ne
doit être remplacé. Pour comparer les empreintes dans PowerShell :

```powershell
Get-FileHash .\output\meteo-wingfoil-tharon.png -Algorithm SHA256
Get-FileHash D:\.adds\kobo-screen\meteo-wingfoil.png -Algorithm SHA256
```

Les deux empreintes doivent être identiques.

## 3. Éjecter proprement

1. Attendre le message **Copie terminée et SHA256 vérifié**.
2. Fermer les fenêtres de l’Explorateur qui affichent la Kobo.
3. Dans la zone de notification Windows, choisir **Retirer le périphérique en
   toute sécurité et éjecter le média**, puis le lecteur Kobo. Le clic droit
   sur le lecteur dans l’Explorateur → **Éjecter** convient également.
4. Attendre l’autorisation de retrait, puis débrancher le câble USB.
5. Laisser la Kobo revenir à son interface normale.

Si Windows indique que le lecteur est utilisé, fermer l’application qui
l’utilise et réessayer l’éjection. Le script ne force aucun démontage.

## 4. Afficher le dashboard

Sur la Kobo : **NickelMenu → Afficher météo**. Attendre environ deux secondes :
le menu se ferme, puis FBInk affiche le PNG en plein écran avec un flash.
L’entrée est déjà installée ; ne pas en ajouter une seconde.

Commande utilisée par le script Kobo existant (à titre de référence, ce n’est
pas une commande PowerShell à lancer sur le PC) :

```sh
LD_PRELOAD=/mnt/onboard/.adds/hello-fbink/libfbink.so.1 \
 /mnt/onboard/.adds/hello-fbink/fbink -V -c -f -w -W GC16 \
 -g 'file=/mnt/onboard/.adds/kobo-screen/meteo-wingfoil.png,x=0,y=0,dither'
```

Retour : appuyer sur le **bouton physique Accueil**. Nickel reste actif et peut
recouvrir l’image à la prochaine interaction ou au passage en veille. Ce test
affiche un PNG statique, dont les dates et les prévisions sont celles de sa
génération ; il ne met pas les données à jour sur la liseuse.
Les sélecteurs et boutons dessinés dans l’image ne sont pas interactifs.

L’entrée **Hello World** et les autres fonctionnalités restent en place.
Aucun fichier système, aucune configuration Kobo, aucun binaire et aucun
firmware n’est modifié. Aucune action GitHub n’est effectuée.
