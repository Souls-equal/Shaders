# Bloxd File Share

Bibliothèque statique de packs pour Bloxd.io, en HTML/CSS/JavaScript moderne, sans framework ni dépendance à l’exécution. Trois catégories, un catalogue configurable et une fenêtre de récupération commune à chaque pack.

> **Le téléchargement volontaire est désormais la méthode recommandée.** Un vrai `File` en mémoire n’est pas nécessairement transporté intact par le drag natif vers un autre onglet. Le glisser-déposer reste une expérience, pas une promesse d’import dans Bloxd.io.

## Langues : anglais par défaut, français au choix

- Le bouton **EN / FR** est disponible dans l’en-tête, dans la fenêtre d’un pack et sur le récepteur de diagnostic.
- **Anglais à la première visite**, indépendamment de la langue du navigateur. Seul un choix explicite mémorisé peut remplacer ce défaut.
- La préférence est enregistrée localement sous `bloxd-file-share-language` et partagée avec la page de diagnostic. Une valeur inconnue ou un stockage inaccessible n’empêche pas le fonctionnement : retour à l’anglais, puis changement possible en mémoire.
- Le changement traduit aussi les catégories, descriptions, textes alternatifs des images, métadonnées de page, libellés accessibles, unités, erreurs, progression et résultats du diagnostic.
- Changer de langue n’annule pas un chargement, ne supprime pas un fichier préparé et ne relance aucun Fetch ou téléchargement. La catégorie sélectionnée et les sections développées de la fenêtre sont conservées.
- Les noms des packs/auteurs, noms de fichiers, versions, types MIME, URL, empreintes SHA-256 et octets des ZIP ne sont pas traduits.

Les textes se trouvent dans `js/translations.js`, avec les mêmes clés et paramètres dans `en` et `fr`. `js/i18n.js` gère la préférence, les formats et le rafraîchissement des vues sans rechargement. Pour un nouveau pack, ajouter les clés `pack.<id>.description` et, si illustré, `pack.<id>.alt`, `.tagline`, `.theme` dans les deux langues. Les champs français d’origine restent dans `config.js`. Une entrée peut aussi fournir `translations.en` et `translations.fr` avec ces mêmes champs pour surcharger les textes du dictionnaire.

## Démarrer

```sh
python3 -m http.server 3000 --bind 0.0.0.0
# Ouvrir http://localhost:3000
```

Sous Windows, utiliser `python` si nécessaire. Ne pas ouvrir la page en `file://` : Fetch et les modules ES nécessitent un serveur. HTTPS en production, notamment pour Web Crypto/SHA-256. Node.js 22+ sert uniquement aux tests.

## Organisation des fichiers

```text
.
├── shaders/
│   ├── aurora-v12.zip           # Ancien « aurora - 12.zip »
│   ├── aurora-v9.zip            # Ancien « aurora - V9.zip »
│   ├── aurora-original.zip      # Ancien « aurora.zip »
│   ├── emberfall-v5.zip
│   ├── frostbound-v5.zip
│   └── sunrise-v5.zip           # Nom déclaré : Golden Hour
├── schems/                     # Schematics à publier
├── t-packs/                    # Texture packs à publier
├── index.html                  # Catalogue et fenêtre de récupération
├── diagnostics.html            # Récepteur de vrais glisser-déposer
├── css/style.css
├── js/
│   ├── config.js               # Catégories et catalogue PACKS
│   ├── app.js                  # Filtres, cartes, fenêtre, téléchargement et nettoyage
│   ├── i18n.js                 # EN/FR, préférence et formats localisés
│   ├── translations.js         # Tous les textes du site dans les deux langues
│   ├── shader-loader.js        # Chargeur ZIP partagé : flux borné, Blob, File
│   ├── drag-drop.js             # Drag natif, jamais simulé
│   └── diagnostics.js          # Métadonnées et hash à la réception
├── assets/                     # Illustrations WebP propres à chaque pack et police locale
├── tests/                      # Tests Node sans dépendance
├── tools/browser-check.mjs      # Contrôles UI et téléchargements Playwright
├── docs/                       # Rapport et observations
└── netlify.toml
```

Les trois archives Aurora ont été déplacées/renommées **sans modifier leurs octets**. Les anciens chemins à la racine ne sont plus utilisés. Les dossiers vides `schems/` et `t-packs/` sont conservés avec `.gitkeep`.

### Catalogue actuel

Six archives sont publiées : quatre shaders actuels avec un visuel distinct, puis deux anciennes versions d’Aurora regroupées sous « Les versions précédentes ». Les métadonnées proviennent des manifestes : **K4miNoK4mi** pour Aurora, **Arena Agent** pour les trois nouveaux packs ; tous déclarent `apiVersion: 5`.

| Version | Chemin | Taille réelle | SHA-256 |
|---|---|---:|---|
| V12, mise en avant | `shaders/aurora-v12.zip` | 17 036 octets | `4592bfadf6d1662607afdcef290961796af0676f29a561e97873ec90217b2100` |
| Emberfall 1.0.1 | `shaders/emberfall-v5.zip` | 8 163 octets | `7e3648cd06ed4db6653a9153ac1ff159774c960c1b9b25e1aafcf59e61a41c4e` |
| Frostbound 1.0.1 | `shaders/frostbound-v5.zip` | 9 843 octets | `f01855eed024f702ad5bd7c009a235c93f70f1d406cc984b9a396c923fd2a809` |
| Golden Hour 1.0.1 | `shaders/sunrise-v5.zip` | 8 108 octets | `a03523df78ff8a97e585f87ce31c76c179c88eb75501dffc555735daa4172ad3` |
| V9, archive | `shaders/aurora-v9.zip` | 15 703 octets | `b809e83196b9d5197eea8bbf5346e05a30fd677bb90c66677cc37c4146954bab` |
| Original, version non confirmée | `shaders/aurora-original.zip` | 16 789 octets | `f83f701ce164341fb41344ff0df502ff823ec1db92579101c22ed1ecdf1d91d4` |

L’archive d’origine n’a pas de numéro confirmé : elle n’est pas rebaptisée arbitrairement V10 ou V11. Les catégories Schematics et Texture packs n’ont pas encore de contenu ; le site l’indique au lieu de présenter de faux packs. Les quatre visuels sont des illustrations IA, **pas des captures en jeu** ; les cartes et fenêtres le précisent. Les ambiances et descriptions des nouveaux packs suivent les intentions et réglages présents dans leurs fichiers WGSL, sans promettre un résultat testé dans Bloxd.io. `sunrise-v5.zip` conserve son nom de fichier, mais s’affiche sous **Golden Hour**, son nom dans `pack.json`. Le suffixe `v5` désigne ici l’API ; leur version de pack déclarée est **1.0.1**, affichée séparément.

## Récupérer un pack

1. Sélectionner **Shaders**, **Schematics** ou **Texture packs**.
2. Cliquer **Obtenir le pack** sur la version souhaitée. Cela ouvre une fenêtre accessible (focus, Escape, fermeture par la croix ou le fond), **sans télécharger ni même récupérer l’archive**.
3. Choisir une méthode :
   - **Télécharger le ZIP**, recommandé : récupère les octets, vérifie la source, la taille, la structure ZIP et le SHA-256, puis lance un téléchargement uniquement parce que l’utilisateur l’a demandé. Le fichier porte un nom distinct pour chaque version. Le sélectionner ensuite dans le véritable importeur du jeu.
   - **Essayer le glisser-déposer**, expérimental : déplier cette option, puis cliquer **Préparer en mémoire**. Aucun enregistrement sur disque. Un vrai geste de souris peut ensuite attacher ce `File` au drag, mais sa réception par le jeu reste non garantie.
4. **Annuler le chargement**, **Libérer le fichier** ou fermer la fenêtre pour abandonner la requête et libérer les références/URL temporaires. Un changement de pack ne réutilise jamais les octets d’une autre version.

Un fichier déjà préparé peut être téléchargé sans être récupéré une deuxième fois, toujours sur clic volontaire. L’ouverture de la fenêtre, le filtrage et la préparation en mémoire ne déclenchent aucun téléchargement. Le navigateur décide de l’emplacement d’enregistrement et peut demander confirmation. La page ne peut ni confirmer l’application du pack dans le jeu, ni annuler un téléchargement déjà confié au navigateur.

## Ajouter un futur pack

1. Déposer l’archive dans le dossier approprié : `shaders/`, `schems/` ou `t-packs/`.
2. Calculer sa taille et son hash :

```sh
python3 -c "import pathlib,hashlib; p=pathlib.Path('shaders/mon-pack.zip'); print(p.stat().st_size); print(hashlib.sha256(p.read_bytes()).hexdigest())"
```

3. Ajouter une entrée à `PACKS` dans `js/config.js` :

```js
Object.freeze({
  ...DEFAULTS,
  id: 'mon-pack-v1',             // Unique, stable.
  category: 'shaders',           // 'shaders', 'schems' ou 't-packs'.
  name: 'Mon pack',
  version: 'V1',
  author: 'Créateur',
  description: 'Description du pack.',
  filename: 'mon-pack.zip',
  url: './shaders/mon-pack.zip',
  expectedSizeBytes: 12345,       // Remplacer par la taille réelle.
  sha256: 'EMPREINTE_SHA256_REELLE_DE_64_CARACTERES',
  apiVersion: 5,                // Reprendre la valeur réelle du manifeste.
  // Facultatif : illustration propre au pack, sur carte ET dans la fenêtre.
  preview: preview('assets/mon-pack.webp', 'Illustration du paysage…', 'Votre accroche.', 'Votre thème'),
  // featured: true,             // Facultatif : mise en avant, indépendante du visuel.
}),
```

**Remplacer les valeurs d’exemple avant publication.** Le filtre, le compteur, la carte et les deux options de la fenêtre sont générés à partir du catalogue : aucune modification de HTML ou de gestionnaire de téléchargement n’est nécessaire. Un site statique ne peut pas énumérer arbitrairement les fichiers du serveur ; déposer un fichier seul ne suffit donc pas à le publier dans le catalogue.

Les visuels se configurent dans `preview` : `src`, `alt`, `tagline`, `theme`, `width`, `height` et `type`. Le helper `preview(...)` utilise `type: 'illustration'` ; une véritable capture vérifiée peut être déclarée avec un objet `preview` de `type: 'screenshot'`. Sans visuel, la carte reste compacte avec une icône. Les nouvelles images sont servies localement en WebP et chargées à la demande, hormis la carte mise en avant.

Le chargeur actuel est volontairement limité aux **archives ZIP**, quelle que soit leur catégorie. Ajouter des schematics bruts dans un autre format nécessitera un validateur approprié ; ne pas simplement renommer leur extension en `.zip`. Le format et la structure attendus par l’importeur Bloxd doivent être vérifiés séparément. La présence d’une catégorie ne prétend pas rendre n’importe quel fichier compatible avec le jeu.

Pour une source distante, configurer son URL HTTPS finale et son origine exacte dans `allowedOrigins`. Le serveur doit autoriser CORS. Les redirections sont refusées : ne pas utiliser une page GitHub `blob/`. Une URL relative garde la compatibilité avec les sous-répertoires GitHub Pages.

## Pourquoi le drag peut ne pas fonctionner

`new File([blob], ...)` crée bien un objet `File`, et `DataTransfer.items.add(file)` peut bien l’accepter pendant `dragstart`. Cela ne garantit pas que le mécanisme natif du navigateur le sérialise et le transmette comme fichier au récepteur.

Dans les essais Chromium headless 141 disponibles, un `File` réel était présent au départ, mais un récepteur du même document recevait zéro fichier. L’essai historique entre frames même origine montrait aussi zéro fichier ; une frame cross-origin ne recevait aucun drop. Le retour utilisateur signale également un échec dans Bloxd.io. La cause exacte de ce dernier ne peut pas être établie sans observer le récepteur du jeu ; ni ces essais ni un simple `dropEffect: copy` ne prouvent un import réussi.

`diagnostics.html` permet de déposer un fichier par une vraie interaction et de voir le nombre de fichiers reçus, leur nom, leur taille et leur SHA-256. Le hash est comparé à **toutes les versions publiées**, pas seulement à une valeur unique. Le récepteur ne téléverse, n’extrait et n’exécute rien. Il ignore les événements synthétiques.

Pour tester Edge : ouvrir le catalogue et le récepteur dans deux onglets réels, préparer un pack depuis sa fenêtre, puis le glisser dans le récepteur. Refaire sur une origine différente, puis dans le vrai Bloxd.io. Voir la [procédure et les limites](docs/TEST_REPORT.md).

**Alternative : télécharger volontairement puis utiliser le sélecteur natif du jeu.** Cela abandonne explicitement l’objectif initial sans disque. Sans prise en charge coopérative par le jeu, cette page ne peut pas forcer un fichier dans un autre onglet ni remplir son `<input type="file">`. Aucune API privée, extension, désactivation de sécurité ou simulation d’événement n’est utilisée.

## Sécurité et mémoire

- Origine autorisée, HTTPS distant, `credentials: 'omit'`, aucune redirection ni réponse opaque.
- Contrôle HTTP/MIME, extension ZIP et octets réels ; une extension n’est jamais une preuve suffisante.
- Limite de taille sur l’en-tête si exploitable, puis sur **chaque chunk reçu**, même si `Content-Length` est absent ou mensonger ; progression indéterminée si nécessaire.
- Contrôle de la signature, des bornes du répertoire ZIP et des en-têtes locaux, méthodes stockées/Deflate, refus des chemins dangereux, archives chiffrées/multiparties/ZIP64 ; 1 024 entrées maximum.
- Taille publiée et SHA-256 vérifiés avant de fournir un fichier. Les contrôles sont structurels : **ni analyse antivirus, ni vérification CRC par décompression, ni validation WGSL/Bloxd**.
- Pas d’extraction, d’exécution de scripts du ZIP, d’upload, d’analytics, de cache persistant du fichier ou d’accès aux fichiers personnels sur la page catalogue.
- La limite par défaut est de 50 MiB de ZIP ; la RAM totale peut être supérieure pendant la validation. Les erreurs d’allocation récupérables sont signalées ; un onglet tué par le système ne peut pas afficher d’erreur fiable.
- Fermeture/annulation : requête abandonnée, réponses tardives ignorées par génération, référence supprimée, URL Blob révoquée. Le garbage collector contrôle le moment exact de restitution de RAM. Un drag déjà confié au navigateur ne peut pas être retiré rétroactivement.
- Les erreurs réseau/CORS/redirection peuvent être indiscernables avec Fetch ; le site ne prétend pas identifier une cause que le navigateur ne révèle pas.

## Tests

```sh
npm test                        # Node 22+, sans dépendance : 42 tests.

# Contrôles navigateur facultatifs ; serveur local déjà lancé :
npm ci
npx playwright install --with-deps chromium
npm run test:browser            # 24 contrôles UI, téléchargements et erreurs.
npm run test:languages          # 12 contrôles EN/FR, stockage, diagnostics et état conservé.
```

Le script navigateur vérifie entre autres les octets téléchargés des six archives et les visuels propres à chaque shader, l’absence de téléchargement à l’ouverture/préparation, l’annulation/fermeture pendant le chargement, la non-réutilisation d’un autre pack, la navigation clavier et l’affichage mobile. Des entrées ZIP de schematics/texture packs **uniquement injectées dans les tests** vérifient la réutilisation de la même fenêtre ; aucun faux pack n’est publié sur le site.

Les sorties sont dans `test-results/` (ignoré par Git). Les observations EN/FR sont dans `docs/language-evidence.json`. Les observations de l’intégration des shaders sont dans `docs/shader-integration-evidence.json` ; `docs/catalogue-browser-evidence.json` conserve le rapport antérieur à l’ajout des trois shaders. Variables optionnelles : `BROWSER_EXECUTABLE`, `BROWSER_CHANNEL` (par exemple `msedge` si installé), `TEST_BASE_URL` et `PLAYWRIGHT_MODULE_PATH` pour une installation externe de Playwright. Même avec Edge, le script ne remplace pas un test manuel entre deux onglets graphiques et dans le jeu réel.

## Hébergement

**GitHub Pages** : publier la racine de la branche de déploiement choisie par le mainteneur. Aucun build ; `.nojekyll` est fourni. Les chemins relatifs fonctionnent sous `https://utilisateur.github.io/Shaders/`.

**Netlify** : répertoire de publication `.`, aucune commande de build. `netlify.toml` fournit les types ZIP et les en-têtes de sécurité. Ne pas imposer un téléchargement automatique par navigation ou ajouter un script de redirection vers l’archive.

Déployer `index.html`, `diagnostics.html`, `css/`, `js/`, `assets/` et les dossiers de packs. Les tests, Python et Node ne sont pas des dépendances de production. Aucun déploiement sur un compte externe n’est réalisé automatiquement.

## Crédits

[Apache-2.0](LICENSE) pour le dépôt. Police DM Sans auto-hébergée sous [SIL Open Font License](assets/FONT-LICENSE.txt). Illustrations créées pour le site, non captures d’écran du jeu. Noms, versions et auteurs des packs repris des manifestes. Projet indépendant, sans affiliation officielle avec Bloxd.io.
