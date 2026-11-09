# Rapport — catalogue et récupération des packs

Date : 7 novembre 2026. Aucun succès d’import réel dans Bloxd.io n’est revendiqué.

## Mise à jour bilingue EN / FR

- Anglais par défaut, même avec un navigateur configuré en français ; choix explicite EN/FR mémorisé, disponible sur les deux pages et dans la fenêtre d’un pack.
- Traduction des contenus statiques et dynamiques, descriptions/visuels, métadonnées, libellés accessibles, messages, unités et résultats du diagnostic.
- **42 tests Node réussis**, dont 7 tests de traduction : parité et paramètres des dictionnaires, couverture des textes HTML/JS, descriptions et images, préférence, formats, erreurs et stockage inaccessible.
- **24 contrôles navigateur de régression réussis**, maintenus explicitement en français.
- **12 contrôles navigateur EN/FR réussis** : défaut anglais avec navigateur français, traduction complète, persistance après rechargement, synchronisation avec le diagnostic via le véritable événement de stockage, fichier préparé conservé sans requête supplémentaire, téléchargement identique, changement pendant un chargement, erreurs et résultats de diagnostic retraduits, préférence invalide, stockage bloqué et pages statiques sans JavaScript en anglais.
- Responsive contrôlé dans les deux langues de 320 à 1440 px ; aucune erreur JavaScript dans les parcours testés.
- Axe-core 4.10.2 : aucune violation automatique WCAG 2 A/AA sur le catalogue, une fenêtre illustrée et le diagnostic, dans les deux langues à 390 et 1440 px. Cela ne remplace pas un audit humain.

Rapport courant : [language-evidence.json](language-evidence.json). Les rapports des intégrations précédentes ci-dessous restent des traces historiques. Les essais EN/FR n’établissent toujours pas une importation réussie dans Bloxd.io.

## Intégration d’Emberfall, Frostbound et Golden Hour

Le catalogue contient désormais **six archives**, avec quatre cartes illustrées et une rangée séparée pour les deux anciennes versions d’Aurora.

- Noms, auteur et version repris des manifestes : Emberfall, Frostbound et **Golden Hour** (`sunrise-v5.zip`), auteur **Arena Agent**, version de pack **1.0.1**, API shader **5**.
- ZIP récupérés tels qu’ajoutés au dépôt : octets inchangés, CRC des archives vérifiés à l’inspection, taille et SHA-256 publiés contrôlés par le chargeur et les tests.
- Trois illustrations IA distinctes, locales et optimisées WebP ; libellé explicite sur les cartes et dans les fenêtres. Aucune capture réelle ni validation du rendu en jeu n’est prétendue.
- **35 tests Node réussis** : 24 du chargeur et 11 du catalogue, dont couverture de tous les ZIP, métadonnées des nouveaux packs et ressources des visuels.
- **24 contrôles navigateur réussis** : régression de tous les anciens comportements, téléchargements identiques pour les six archives, chargement/décodage des quatre images, correspondance des images dans chaque fenêtre et absence d’image résiduelle sur les archives.
- Axe-core Playwright 4.10.2 : zéro violation automatique WCAG 2 A/AA pour le catalogue et les quatre fenêtres illustrées, à 390 et 1440 px. Cela ne remplace pas un audit humain.

Observations actuelles : [shader-integration-evidence.json](shader-integration-evidence.json). Les résultats 29/20 ci-dessous et [catalogue-browser-evidence.json](catalogue-browser-evidence.json) sont le rapport initial conservé pour historique.

Le retour utilisateur sous **Edge 156 sur Windows** indique un vrai drop (`isTrusted: true`), mais **0 fichier** et seulement `text/plain` au récepteur GitHub Pages. C’est une observation utilisateur, pas un test Edge exécuté par notre automatisation. Le téléchargement reste recommandé ; l’intégration de ces shaders ne prétend pas corriger ce transport ni démontrer un import réel dans le jeu.

## Changements vérifiés (catalogue initial)

- Trois dossiers racine : `shaders/`, `schems/`, `t-packs/`.
- Aurora V12, V9 et Original déplacées sans modification d’octets ; taille et SHA-256 vérifiés contre le catalogue.
- V12 mise en avant ; onglets avec compteurs et états vides honnêtes pour les deux catégories sans fichier.
- Chaque carte ouvre la même fenêtre, avec téléchargement recommandé et préparation en mémoire expérimentale.
- Aucun téléchargement ni requête ZIP lors du filtrage ou de la simple ouverture de la fenêtre.

## Environnement

- Linux, Node.js 22, serveur statique Python 3.
- Playwright 1.56.1, Chromium headless **141.0.7390.0**.
- Origine locale `http://localhost:3000`.
- Sécurité Web et restrictions d’origine non désactivées. `--no-sandbox` utilisé uniquement pour lancer le navigateur dans le conteneur de test.
- Microsoft Edge graphique et importeur réel de Bloxd.io non accessibles pour un essai interactif ici.

## Résultats

### Tests Node : 29 réussis

24 tests du chargeur et 5 du catalogue :

- Origine, extension, MIME, statut HTTP, réseau/CORS, flux, limite annoncée et réelle, timeout, annulation et erreurs d’allocation simulées.
- ZIP réel/invalide, répertoire, chemins dangereux, hash et taille publiée.
- Organisation des dossiers, IDs uniques, correspondance catégorie/chemin et priorité V12.
- Création d’un vrai `File` avec les octets exacts de chacune des trois archives déplacées.

### Tests navigateur : 20 contrôles réussis

1. Trois catégories, trois vraies versions et V12 mise en avant, sans Fetch ZIP anticipé ni téléchargement.
2. Filtrage et touches fléchées/Home/End ; catégories vides non trompeuses.
3. Ouverture de la fenêtre sans téléchargement, focus sur le choix recommandé et fermeture Escape avec retour du focus.
4–6. Téléchargements V12/V9/Original : nom et octets identiques à l’archive de la bonne version.
7. Préparation en mémoire uniquement après action explicite et sans téléchargement.
8. Drag à la souris avec `isTrusted: true`, vrai File au départ ; message d’import restant inconnu.
9. Téléchargement d’un fichier préparé sans deuxième Fetch ; nettoyage de la mémoire et de l’URL Blob.
10–14. HTTP 404, MIME HTML, faux ZIP, taille excessive et échec réseau : erreur visible, aucun téléchargement.
15. Fermeture pendant la requête, puis préparation d’une autre version : aucun téléchargement tardif ni mélange de fichiers.
16. Annulation du chargement puis nouveau clic explicite de téléchargement.
17. Entrées de test pour les catégories Schematics et Texture packs : même fenêtre et mêmes octets téléchargés, sans publication de faux packs.
18. Catalogue et fenêtre développée sans débordement horizontal à 320, 390, 768, 1024 et 1440 px.
19. Chargement du récepteur diagnostic avec le nouveau catalogue.
20. Aucune erreur JavaScript d’exécution.

Observations : [catalogue-browser-evidence.json](catalogue-browser-evidence.json). Les contrôles qui constatent un drag réel ne sont **pas** des preuves de livraison du fichier à Bloxd.io.

Audit supplémentaire ponctuel axe-core Playwright 4.10.2 : aucune violation automatique des règles WCAG 2 A/AA dans les vues catalogue, catégorie vide, fenêtre, options développées, fichier préparé et diagnostic, à 390 et 1440 px. Un audit humain d’accessibilité reste distinct.

## Drag : constat et limite

Dans le contrôle actuel, le fichier Aurora V12 est bien présent au départ du drag (1 File, `aurora-v12.zip`, 17 036 octets). Le récepteur local de test sous Chromium headless expose cependant **zéro fichier**. La perte est observée entre `dragstart` et la réception.

Les [observations historiques du premier prototype](chromium-141-evidence.json) portent sur l’ancien `aurora.zip` de 16 789 octets : même document et frames même origine recevaient zéro fichier ; une frame cross-origin ne recevait aucun événement drop. Ce JSON est une trace historique, pas un rapport d’exécution du nouveau catalogue.

Le retour utilisateur signale aussi un échec dans Bloxd.io. Cela est cohérent avec un fichier non transmis, mais ne prouve pas à lui seul la cause précise côté navigateur ou importeur. Le mode headless et la chaîne d’entrée automatisée font partie des conditions d’essai. Ni une réussite de `items.add(file)`, ni un curseur copy, ni `dragend` ne prouvent l’import.

**Non vérifiés** : deux onglets Microsoft Edge graphiques, deux fenêtres Edge, transfert cross-origin réel dans cet environnement et application du shader dans Bloxd.io. Aucun contournement n’a été ajouté.

## Procédure manuelle Edge et Bloxd.io

1. Noter l’OS, la version exacte d’Edge (`edge://version`), la date et les origines source/destination.
2. Ouvrir ce site en HTTPS ou localhost. Constater le contenu du dossier Téléchargements avant l’essai.
3. Choisir un pack, ouvrir sa fenêtre et vérifier qu’aucun fichier n’a été enregistré à cette étape.
4. Pour tester sans disque : développer **Essayer le glisser-déposer**, cliquer **Préparer en mémoire**, ouvrir `diagnostics.html` dans un deuxième onglet Edge, puis faire un véritable drag vers sa zone. Tester également deux fenêtres côte à côte et noter les deux résultats séparément.
5. Relever nombre de Files, nom, taille, hash et correspondance à une version du catalogue. Zéro File signifie que le récepteur n’a pas reçu le fichier ; un événement manquant peut également indiquer que le geste n’a pas atteint sa zone.
6. Répéter avec le récepteur inchangé sur une autre origine HTTPS de confiance. Un succès same-origin ne prouve pas la livraison à Bloxd.io.
7. Refaire avec le véritable importeur actuel de Bloxd.io, si disponible. Ne pas inventer de bouton, de mécanisme d’import ou de réglage absent du jeu. Relever son message exact et vérifier si le pack est réellement appliqué.
8. En cas de refus, comparer avec le diagnostic : File correct reçu ailleurs mais refusé par le jeu → examiner le format/la compatibilité ; aucun File reçu → examiner le transport avant le contenu du pack.
9. Relever à nouveau Téléchargements avant d’essayer le choix recommandé, **Télécharger le ZIP**. Ce second test doit enregistrer le fichier choisi volontairement ; le sélectionner ensuite avec l’importeur natif du jeu, si pris en charge.
10. Vérifier que V12, V9 et Original restent distinctes. Annuler un chargement, fermer/réouvrir la fenêtre, puis essayer une autre version.

```text
Date / testeur :
OS / version Edge :
Pack / version :
Origine source / destination :
Deux onglets ou deux fenêtres :
Nombre de Files / nom / taille / SHA-256 reçus :
Message exact de Bloxd.io :
Shader réellement appliqué ?
Enregistrement sans demande explicite ?
Résultat du téléchargement volontaire et de la sélection dans le jeu :
Conclusion / captures :
```

## Garantie du téléchargement et périmètre

Les tests garantissent que le clic de téléchargement fournit les octets de l’archive choisie dans le navigateur testé. Ils ne garantissent pas que Bloxd.io accepte le contenu d’un ZIP donné. Le téléchargement nécessite un enregistrement sur disque, contrairement à l’objectif expérimental initial.

La page ne peut pas forcer un fichier dans un onglet tiers ni renseigner son sélecteur natif. Un éventuel futur import URL/flux nécessiterait une prise en charge explicite du jeu ; aucune API de ce type n’est supposée disponible.
