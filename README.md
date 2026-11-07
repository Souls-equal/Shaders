# Bloxd File Share

Prototype statique de partage de Shader Packs pour Bloxd.io, en HTML/CSS/JavaScript ES modules, sans framework ni dépendance à l’exécution.

> **État réel : préparation en mémoire opérationnelle ; importation dans Bloxd.io NON démontrée.** Un véritable `File` est attaché à un `dragstart` utilisateur. Dans les essais automatisés sous Chromium 141 headless, ce fichier n’était toutefois plus présent à la réception. Les tests entre **deux onglets Microsoft Edge** et dans **Bloxd.io** restent à effectuer. Ce projet ne prétend pas contourner cette limitation.

## Démarrage

```sh
# Depuis la racine du dépôt, Python 3 suffit :
python3 -m http.server 3000 --bind 0.0.0.0
# Puis ouvrir http://localhost:3000
```

Sur Windows, utiliser `python` à la place de `python3` si nécessaire. Ne pas ouvrir `index.html` en `file://` : les modules et Fetch nécessitent un serveur HTTP. Utiliser HTTPS en production (notamment pour SHA-256 via Web Crypto). Node.js n’est nécessaire que pour les tests.

## Utilisation

1. **Prepare Shader** récupère `aurora.zip`, contrôle la réponse et crée un vrai `File` en mémoire. La progression est déterminée si la taille HTTP est disponible, sinon indéterminée avec les octets reçus.
2. Une fois prêt, la zone propose un glisser-déposer **réellement initié par l’utilisateur**. Placer Bloxd.io à côté ou survoler son onglet pendant le drag, puis viser sa véritable zone d’import si elle existe. Aucune fonction interne du jeu n’est supposée ou injectée.
3. Vérifier la réponse **dans le jeu**. Notre page n’a pas accès à l’état interne de Bloxd.io et ne transforme jamais `dragend`/`dropEffect` en « importation réussie ».
4. **Clear File** annule aussi un chargement en cours, supprime la référence au `File` et révoque les éventuelles URL Blob. Le ramasse-miettes décide du moment exact de restitution de mémoire. Un transfert déjà confié au navigateur ne peut pas être révoqué rétroactivement.
5. En cas de blocage, **Download instead** est le seul chemin de téléchargement : clic explicite, puis choix du fichier via le sélecteur natif du jeu, si disponible. Cette alternative écrit sur disque et ne respecte donc pas l’objectif strict « sans enregistrement » ; aucun substitut universel sans disque n’est annoncé.

Un appui clavier sur la zone prête ouvre les explications ; il ne simule pas un drag. Le bouton de téléchargement explicite constitue l’alternative clavier/tactile.

## Le pack inclus

- **Aurora**, auteur **K4miNoK4mi**, tel qu’indiqué dans `aurora/pack.json`.
- `aurora.zip` : **16 789 octets**, 8 entrées, manifeste `apiVersion: 5`.
- SHA-256 : `f83f701ce164341fb41344ff0df502ff823ec1db92579101c22ed1ecdf1d91d4`.
- Les deux ZIP préexistants restent **inchangés** ; `aurora - V9.zip` n’est pas utilisé par défaut.
- L’image de paysage est une **illustration générée**, pas une capture vérifiée de ce shader dans Bloxd.io. Aucun résultat graphique en jeu n’est promis.

## Configuration : un seul fichier

Modifier uniquement l’objet de `js/config.js` pour changer le pack distribué :

```js
export const SHADER_CONFIG = Object.freeze({
  name: 'My Custom Shader',
  author: 'Creator',
  description: 'Custom shader pack for Bloxd.io',
  filename: 'my-shader.zip',
  url: 'https://files.example.org/my-shader.zip',
  maxSizeMB: 50,
  expectedSizeBytes: undefined, // Facultatif ; sinon publier la taille exacte.
  sha256: undefined,            // Facultatif ; recommandé pour une source distante.
  allowedOrigins: ['https://files.example.org'],
  timeoutMs: 45000,
});
```

Le fichier n’est jamais encodé dans JavaScript. Le pack fourni est hébergé sur la même origine statique ; une source distante HTTPS est également prise en charge. Son origine exacte doit figurer dans `allowedOrigins` (sans slash final ni chemin) et son serveur doit autoriser CORS (`Access-Control-Allow-Origin`). Le mode `no-cors` est volontairement exclu, tout comme un proxy de contournement.

**Remplacer également la taille et le SHA-256** lors d’un changement de fichier, ou enlever ces deux champs facultatifs. Une ancienne empreinte doit bloquer un nouveau ZIP. Calculer les valeurs sans extraction :

```sh
python3 -c "import pathlib,hashlib; p=pathlib.Path('aurora.zip'); print(p.stat().st_size); print(hashlib.sha256(p.read_bytes()).hexdigest())"
```

Le chemin d’URL doit se terminer par `.zip`. Les redirections sont refusées : configurer l’URL finale directe, pas un lien vers une page GitHub `blob/`. Une URL relative conserve la compatibilité avec les sous-répertoires GitHub Pages.

## Contrôles et limites de sécurité

- URL HTTPS distante, origine explicitement autorisée, absence d’identifiants dans l’URL ; HTTP même origine autorisé pour le développement.
- `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `redirect: 'error'`, contrôle du statut HTTP et de la provenance de la réponse.
- Extension `.zip`, MIME ZIP ou binaire générique, puis vérification des **octets**. Un MIME manquant n’est pas une preuve et déclenche les mêmes contrôles structurels.
- Limite de taille vérifiée sur l’en-tête si pertinent, puis **sur chaque chunk reçu**, même si `Content-Length` ment ou manque. Le flux est annulé en cas de dépassement. La taille HTTP compressée n’est pas confondue avec la taille du ZIP décodé.
- Signature, fin de répertoire, bornes du répertoire central, en-têtes locaux, méthodes stockées/Deflate, chemins sans traversée ; maximum 1 024 entrées. Refus des archives vides, multiparties, chiffrées et ZIP64.
- Taille publiée et SHA-256 facultatifs, contrôlés avant la création du `File`.
- **Pas d’extraction**, pas d’exécution de contenu provenant du ZIP, pas de saisie de fichiers personnels sur la page principale, pas d’upload, pas d’analytics, pas de cache persistant de fichier ou de service worker.
- La page de diagnostic lit uniquement le fichier que l’utilisateur lui dépose volontairement, pour afficher ses métadonnées et son hash, sans l’envoyer à un serveur.
- La validation est **structurelle**, non une validation complète du format ZIP : elle ne décompresse pas les entrées, ne vérifie pas leur CRC, ne scanne pas les malwares et ne valide pas le contrat WGSL/Bloxd. Une empreinte correspondante prouve l’identité des octets attendus, **pas leur innocuité**.
- La limite s’applique aux octets transférés, pas à la consommation totale de RAM. Blob, buffer de contrôle et hash peuvent temporairement multiplier la mémoire nécessaire. Certaines erreurs d’allocation sont signalables ; un onglet tué par le système pour manque de RAM ne peut pas afficher de message fiable.

Les erreurs réseau/CORS/redirection sont regroupées honnêtement : Fetch ne permet généralement pas de les distinguer. Les erreurs 404, HTTP, MIME, ZIP, taille, intégrité, délai dépassé, annulation et allocation ont des messages adaptés. Un refus par le jeu doit être constaté dans le jeu, pas déduit du navigateur source.

## Diagnostic de transfert

Ouvrir **About compatibility → Open test receiver**, ou `diagnostics.html` dans un autre onglet. Déposer le fichier dans sa zone et relever :

- l’authenticité de l’événement (`isTrusted`) ;
- le nombre de fichiers, les types exposés, le nom, la taille et le SHA-256 ;
- le navigateur et l’origine réceptrice.

Le récepteur rejette les événements synthétiques. Tester ensuite le récepteur inchangé sur une **autre origine** : un succès sur la même origine ne démontre pas une possibilité de transfert vers Bloxd.io.

### Limitation effectivement observée

Le 7 novembre 2026, Chromium headless **141.0.7390.0** sous Linux, avec sécurité Web et isolation d’origine conservées :

- `dragstart` réel : **1 File**, `aurora.zip`, 16 789 octets, type de transfert `Files` ;
- réception dans le même document et dans une iframe de même origine : événement réel, **0 File**, type `text/plain` ;
- iframe d’une autre origine : aucun événement `drop` observé.

La réussite de `DataTransfer.items.add(file)` n’assure donc pas le transport du fichier dans cet environnement. La rupture observée se situe **après `dragstart`, avant l’exposition du fichier à `drop`**. On ne peut pas en déduire seul si le même comportement existe dans Edge graphique sur Windows, ni attribuer le cas cross-origin uniquement à une règle de sécurité : le mode headless et la chaîne d’entrée automatisée font partie des conditions d’essai. Voir [le rapport](docs/TEST_REPORT.md) et [les observations JSON](docs/chromium-141-evidence.json).

Si Edge/Bloxd bloquent aussi la méthode, une page Web ne peut pas forcer la remise d’un fichier virtuel au jeu ni renseigner son `<input type="file">` à distance. Les options honnêtes sont un téléchargement **volontaire**, ou une future prise en charge explicite par Bloxd d’un import URL/flux. Aucun protocole interne, extension ou API d’import non documentée n’est inventé ici.

## Tests

### Tests du chargeur — sans dépendance

```sh
npm test
```

Node.js 22+, 24 tests : ZIP réel et invalide, MIME, taille annoncée/réelle, annulation, timeout, intégrité, origine, format et erreurs. Les allocations défaillantes et CORS sont simulés ; ce ne sont pas des essais destructifs de RAM ou d’un serveur CORS tiers.

### Tests navigateur facultatifs

```sh
npm ci
npx playwright install --with-deps chromium
# Lancer le serveur local dans un autre terminal, puis :
npm run test:browser
```

15 contrôles couvrent les états UI, les erreurs, le nettoyage, l’absence de téléchargement lors de la préparation, le téléchargement de secours explicite, les dialogues, le responsive (320–1440 px) et les événements de drag utilisateur. Le script **consigne** les résultats de transfert, sans assimiler un test terminé à un transfert réussi. Il ne crée aucun événement DragEvent synthétique. Les sorties sont ignorées dans `test-results/`.

Variables facultatives : `BROWSER_EXECUTABLE`, `BROWSER_CHANNEL` (`msedge` pour un Edge installé), `TEST_BASE_URL`, `TEST_RECEIVER_ORIGIN`. `PLAYWRIGHT_MODULE_PATH` peut pointer vers le `package.json` d’une installation externe de Playwright. Même exécuté avec Edge, le harnais de frames ne remplace pas le test manuel entre deux onglets.

La liste complète des tests manuels obligatoires, y compris Edge et Bloxd.io, est dans [docs/TEST_REPORT.md](docs/TEST_REPORT.md).

## Déploiement statique

### GitHub Pages

Dans les réglages Pages du dépôt, publier la racine (`/`) de la branche de déploiement choisie par le mainteneur. Aucun build n’est nécessaire. `.nojekyll` est fourni. Les ressources utilisent des chemins relatifs compatibles avec `https://utilisateur.github.io/Shaders/`.

### Netlify

Importer le dépôt ou déployer son contenu statique. Répertoire de publication : `.` ; **aucune commande de build**. Le fichier `netlify.toml` fournit les types ZIP, des en-têtes de sécurité et la revalidation des scripts/archives. Aucun en-tête `Content-Disposition: attachment` n’est nécessaire pour Fetch.

Seuls `index.html`, `diagnostics.html`, `.nojekyll`, `css/`, `js/`, `assets/` et le ZIP configuré sont nécessaires au déploiement. Les tests, Node.js et le serveur Python ne sont pas des dépendances de production. Aucune publication sur un compte externe n’a été réalisée par ce prototype.

## Architecture

```text
.
├── index.html                  # Galerie et préparation
├── diagnostics.html            # Récepteur de vrais drops
├── css/style.css               # Thème sombre, responsive, reduced-motion
├── js/
│   ├── config.js               # Seul point de configuration du pack
│   ├── shader-loader.js        # Fetch, flux borné, validation, Blob et File
│   ├── drag-drop.js            # Capacités locales et drag natif
│   ├── app.js                  # États UI, annulation et libération
│   └── diagnostics.js          # Métadonnées côté réception uniquement
├── assets/                     # Illustration, police locale, icône
├── aurora.zip                  # Archive originale distribuée
├── aurora - V9.zip             # Autre archive originale, non utilisée
├── tests/shader-loader.test.js
├── tools/browser-check.mjs
├── docs/                       # Rapport et observations de tests
├── netlify.toml
├── package.json                # Outils de test uniquement
└── README.md
```

Pour ajouter textures/schematics : conserver le chargement et le transport de `File` séparés de l’UI, puis introduire une configuration de type de ressource et un validateur spécifique. Les badges « Soon » ne sont pas des fonctionnalités actives.

## Crédits et affiliation

Licence du dépôt : [Apache-2.0](LICENSE). Police DM Sans auto-hébergée, sous [SIL Open Font License](assets/FONT-LICENSE.txt). Illustration créée pour ce prototype. Attribution du pack reprise de son manifeste, sans promesse de compatibilité ou de résultat visuel. Projet indépendant, sans affiliation officielle avec Bloxd.io.
