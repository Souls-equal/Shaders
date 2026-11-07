// Static catalogue: add each published archive here after putting it in its
// category folder. Relative paths also work on GitHub Pages project sites.
export const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'shaders', label: 'Shaders', folder: 'shaders', icon: 'spark', description: 'Une nouvelle lumière sur vos mondes.' }),
  Object.freeze({ id: 'schems', label: 'Schematics', folder: 'schems', icon: 'cube', description: 'De nouvelles idées à construire, bloc après bloc.' }),
  Object.freeze({ id: 't-packs', label: 'Texture packs', folder: 't-packs', icon: 'layers', description: 'Un autre regard sur chaque bloc.' }),
]);

const DEFAULTS = { maxSizeMB: 50, allowedOrigins: Object.freeze([]), timeoutMs: 45000 };
export const PACKS = Object.freeze([
  Object.freeze({
    ...DEFAULTS,
    id: 'aurora-v12', category: 'shaders', name: 'Aurora', version: 'V12',
    author: 'K4miNoK4mi', featured: true,
    description: 'La dernière version d’Aurora disponible ici. Lumière chaleureuse, couleurs nuancées et une nouvelle atmosphère pour vos mondes.',
    filename: 'aurora-v12.zip', url: './shaders/aurora-v12.zip',
    expectedSizeBytes: 17036,
    sha256: '4592bfadf6d1662607afdcef290961796af0676f29a561e97873ec90217b2100',
  }),
  Object.freeze({
    ...DEFAULTS,
    id: 'aurora-v9', category: 'shaders', name: 'Aurora', version: 'V9', archived: true,
    author: 'K4miNoK4mi',
    description: 'Une version précédente, conservée pour retrouver votre ambiance préférée.',
    filename: 'aurora-v9.zip', url: './shaders/aurora-v9.zip',
    expectedSizeBytes: 15703,
    sha256: 'b809e83196b9d5197eea8bbf5346e05a30fd677bb90c66677cc37c4146954bab',
  }),
  Object.freeze({
    ...DEFAULTS,
    id: 'aurora-original', category: 'shaders', name: 'Aurora', version: 'Original', archived: true,
    author: 'K4miNoK4mi',
    description: 'L’archive initialement partagée dans ce dépôt, sans numéro de version confirmé.',
    filename: 'aurora-original.zip', url: './shaders/aurora-original.zip',
    expectedSizeBytes: 16789,
    sha256: 'f83f701ce164341fb41344ff0df502ff823ec1db92579101c22ed1ecdf1d91d4',
  }),
]);
