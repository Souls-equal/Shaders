# Rapport de validation — 7 novembre 2026

## Conclusion

**Le prototype prépare correctement un vrai `File`, mais le transfert sans disque vers Bloxd.io n’est pas démontré.** Les essais automatisés disponibles montrent même une perte de l’objet File entre le départ et l’arrivée dans Chromium headless. Aucun succès Edge/Bloxd.io n’est annoncé.

## Environnement réellement utilisé

- Linux Debian 12, Node.js 22.22.3, Python 3.11.2.
- Playwright 1.56.1, binaire Chromium headless 141.0.7390.0.
- Application servie sur `http://localhost:3000` ; origine alternative `http://127.0.0.1:3000`.
- Sécurité Web et isolation d’origine non désactivées. `--no-sandbox` est uniquement utilisé pour l’exécution du navigateur dans le conteneur de tests ; cela ne désactive pas la Same Origin Policy.
- Aucun Microsoft Edge installé. Pas d’accès fonctionnel à `https://bloxd.io` depuis l’environnement réseau de travail ; aucun essai interactif dans le jeu n’a pu être réalisé.
- Archive réelle : `aurora.zip`, 16 789 octets, SHA-256 `f83f701ce164341fb41344ff0df502ff823ec1db92579101c22ed1ecdf1d91d4`.

## Scénarios obligatoires

| Scénario | Résultat réellement acquis | Ce qui reste à vérifier |
|---|---|---|
| 1. ZIP normal | **PASS** : octets originaux, MIME ZIP, taille, structure et SHA-256 ; création d’un vrai `File` Node et navigateur | Compatibilité du contenu avec le jeu |
| 2. Fichier invalide | **PASS** : HTML/MIME incorrect, faux ZIP au bon MIME, données tronquées, répertoire invalide et chemin dangereux refusés | Validation malwares/CRC/WGSL hors périmètre |
| 3. ZIP trop volumineux | **PASS** : limite sur en-tête, flux sans taille et taille déclarée mensongère ; UI d’erreur | Pas de stress test destructif de RAM |
| 4. Annulation et nettoyage | **PASS** : AbortController, référence supprimée, URL Blob révoquée, nouvelle préparation après annulation ; ancienne requête incapable de réactiver le fichier | Le navigateur garde la maîtrise du GC et d’un drag déjà démarré |
| 5. Drag entre deux onglets Edge | **NON TESTÉ** | Test manuel Edge graphique sur machine réelle |
| 6. Importation réelle dans Bloxd.io | **NON TESTÉE** | Réponse réelle de son importeur et résultat en jeu |
| 7. Pas d’enregistrement automatique | **PASS dans le contexte Chromium testé** : zéro événement download et zéro URL Blob pendant préparation, nettoyage et drag ; un téléchargement uniquement après clic volontaire | Vérification visuelle du dossier Téléchargements dans Edge réel |

Les erreurs mémoire sont contrôlées par simulation de `RangeError`. Un navigateur tué par l’OS n’est pas une erreur JavaScript récupérable. Réseau/CORS sont testés avec des réponses simulées et des requêtes abandonnées : le message ne prétend pas distinguer ces causes.

## Résultats automatisés

- `npm test` : **24 tests réussis**, 0 échec.
- `npm run test:browser` : **15 contrôles réussis**, 0 erreur JavaScript d’exécution.
- Responsive contrôlé à 320, 390, 768, 1024 et 1440 px, sans débordement horizontal.
- Dialogues, fermeture Escape, nettoyage, annulation/reprise et téléchargement volontaire testés.
- Audit ponctuel supplémentaire avec axe-core Playwright 4.10.2 : zéro violation automatique des règles WCAG 2 A/AA sur les états initial, préparé, dialogue de compatibilité et diagnostic, à 390 et 1440 px. Cela ne remplace pas un audit humain complet d’accessibilité.
- Le téléchargement volontaire produit les **octets identiques** à l’archive originale ; le test le supprime après vérification.
- Les tests navigateur sont des contrôles de comportement et d’observation, **pas 15 preuves d’import réussi**.

### Observations du drag

Les interactions sont produites par les commandes souris de Playwright et créent de vrais événements navigateur (`isTrusted: true`). Ni `new DragEvent(...)`, ni `dispatchEvent`, ni un faux `DataTransfer` ne sont utilisés pour les essais de transfert.

| Configuration | Au départ | À la réception | Conclusion limitée à cet environnement |
|---|---|---|---|
| Même document, récepteur de test local | 1 File, `aurora.zip`, 16 789 octets ; `types: [Files]` | Vrai `drop`, 0 File ; `types: [text/plain]` | Fichier non transmis |
| Deux iframes même origine, code source et diagnostic réels | 1 File, `types: [Files]` | Vrai `drop`, 0 File ; `types: [text/plain]` | Fichier non transmis |
| Deux iframes origines différentes | 1 File, `types: [Files]` | Aucun `drop` observé | Aucun transfert reçu ; cause exacte non établie |

Voir [les observations brutes](chromium-141-evidence.json). Le harnais est fourni par interception uniquement dans le test ; les pages de production ne sont pas réécrites. Les iframes ne sont **pas** des onglets.

Le point de rupture est identifié : un `File` existe et est attaché à `dragstart`, mais n’est pas exposé au récepteur dans ces essais. L’ajout local d’un item File ne garantit pas sa sérialisation/son transport dans le mécanisme natif de drag. **On ne généralise pas ce constat à Edge Windows, aux autres versions Chromium, au navigateur graphique, ni à Bloxd.io.** Le mode headless et le mécanisme d’entrée automatisé font partie des conditions de l’observation.

## Procédure manuelle à effectuer sur Microsoft Edge

1. Noter le système, la version exacte Edge (`edge://version`), la date, l’origine de cette application, l’origine cible et les éventuelles extensions actives.
2. Servir le projet en HTTPS ou sur localhost. Vérifier le dossier Téléchargements avant l’essai et n’utiliser aucun bouton de téléchargement de secours pendant le test strict sans disque.
3. Cliquer **Prepare Shader**. Vérifier `aurora.zip`, 16 789 octets. Vérifier qu’aucun téléchargement n’a été créé.
4. Ouvrir `diagnostics.html` dans un **deuxième onglet Edge**, puis depuis la page source faire un vrai drag vers cet onglet : le survoler, attendre l’activation, déposer dans le cadre. Tester aussi deux fenêtres côte à côte et noter séparément les résultats.
5. Relever `isTrusted`, nombre de fichiers, nom, taille, MIME et SHA-256. Avec 0 fichier, signaler une limite du transfert, pas un succès.
6. Refaire avec le même récepteur hébergé sur une **autre origine HTTPS de confiance**, sans modifier la sécurité du navigateur. Ne pas déduire la compatibilité cross-origin d’un succès same-origin.
7. Dans un autre onglet, ouvrir **le vrai Bloxd.io**. Vérifier l’existence de son importeur de Shader Packs, ses réglages/restrictions actuels et sa zone de drop. Ne pas inventer un bouton ou un comportement absent.
8. Glisser le fichier préparé jusqu’à cette véritable zone. Noter le retour exact du jeu : nom affiché, erreur, confirmation, nécessité éventuelle d’appliquer/recharger, résultat visuel. Un changement de curseur, `dragend`, un `dropEffect: copy` ou un simple survol ne prouvent pas un import.
9. Si le jeu refuse : relever son message exact. Si le diagnostic cross-origin reçoit le bon fichier mais le jeu le refuse, chercher côté format/importeur/API du pack. Si le diagnostic ne reçoit aucun fichier, le transport navigateur doit être étudié d’abord.
10. Vérifier à nouveau Téléchargements ; cliquer **Clear File** et confirmer la désactivation du drag. Tester annulation et préparation suivante.
11. Refaire les étapes dans Chrome graphique pour comparaison, sans remplacer le résultat Edge demandé.

### Fiche de résultat à compléter

```text
Date / testeur :
OS / version Edge :
Origine source :
Origine diagnostic :
Deux onglets ou deux fenêtres :
File count au diagnostic :
Nom / taille / SHA-256 :
Réponse exacte de Bloxd.io :
Le shader est-il réellement appliqué dans le jeu ?
Un fichier a-t-il été enregistré sans clic explicite ?
Conclusion / captures :
```

## Alternative si le transfert est bloqué

**Download instead**, après préparation et clic volontaire, puis sélection via le véritable importeur du jeu. Le ZIP reste inchangé. Cette solution conserve les garanties d’origine/taille/intégrité du prototype, mais **abandonne explicitement la contrainte sans disque**.

S’il faut absolument éviter le disque et que le navigateur bloque ce transport, une prise en charge officielle par le jeu d’un import URL/flux ou d’un protocole de coopération serait nécessaire. Aucun tel mécanisme n’est supposé disponible. Le site ne peut pas forcer le fichier dans un autre onglet ni contourner les restrictions d’accès aux fichiers.
