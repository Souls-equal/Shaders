// Static catalogue: add each published archive here after putting it in its
// category folder. Relative paths also work on GitHub Pages project sites.
export const CATEGORIES = Object.freeze([
  Object.freeze({ id: 'shaders', label: 'Shaders', folder: 'shaders', icon: 'spark', description: 'Une nouvelle lumière sur vos mondes.' }),
  Object.freeze({ id: 'schems', label: 'Schematics', folder: 'schems', icon: 'cube', description: 'De nouvelles idées à construire, bloc après bloc.' }),
  Object.freeze({ id: 't-packs', label: 'Texture packs', folder: 't-packs', icon: 'layers', description: 'Un autre regard sur chaque bloc.' }),
]);

const DEFAULTS = { maxSizeMB: 50, allowedOrigins: Object.freeze([]), timeoutMs: 45000 };
// Previews are illustrations, not captures or proof of the shader's game output.
// Use type: 'screenshot' only for a genuine, verified in-game capture.
const preview = (src, alt, tagline, theme, width = 1280, height = 720) => Object.freeze({ src, alt, tagline, theme, width, height, type: 'illustration' });
export const PACKS = Object.freeze([
  Object.freeze({
    ...DEFAULTS,
    id: 'aurora-v12', category: 'shaders', name: 'Aurora', version: 'V12', apiVersion: 5,
    author: 'K4miNoK4mi', featured: true,
    description: 'La dernière version d’Aurora disponible ici. Lumière chaleureuse, couleurs nuancées et une nouvelle atmosphère pour vos mondes.',
    preview: preview('assets/aurora-landscape.webp', 'Illustration d’une vallée en blocs, de pins et d’une rivière au coucher du soleil.', 'Une autre atmosphère. Le même monde.', 'Atmosphérique', 1586, 992),
    filename: 'aurora-v12.zip', url: './shaders/aurora-v12.zip',
    expectedSizeBytes: 17036,
    sha256: '4592bfadf6d1662607afdcef290961796af0676f29a561e97873ec90217b2100',
  }),
  Object.freeze({
    ...DEFAULTS,
    id: 'emberfall-v5', category: 'shaders', name: 'Emberfall', version: '1.0.1', apiVersion: 5,
    author: 'Arena Agent',
    description: 'Une ambiance volcanique pensée autour de roches rouge sombre, de lave lumineuse et d’une brume de cendres. Un univers de feu et de braises.',
    preview: preview('assets/emberfall-landscape.webp', 'Illustration d’un canyon volcanique en blocs, traversé par une rivière de lave sous une brume rouge.', 'La chaleur d’un autre monde.', 'Volcanique', 1280, 629),
    filename: 'emberfall-v5.zip', url: './shaders/emberfall-v5.zip',
    expectedSizeBytes: 8163,
    sha256: '7e3648cd06ed4db6653a9153ac1ff159774c960c1b9b25e1aafcf59e61a41c4e',
  }),
  Object.freeze({
    ...DEFAULTS,
    id: 'frostbound-v5', category: 'shaders', name: 'Frostbound', version: '1.0.1', apiVersion: 5,
    author: 'Arena Agent',
    description: 'Une palette froide et désaturée, des surfaces givrées et une atmosphère neigeuse. Une interprétation hivernale, entre glace et silence.',
    preview: preview('assets/frostbound-landscape.webp', 'Illustration d’une vallée en blocs enneigée, de sapins givrés et d’une rivière de glace bleutée.', 'Le monde, sous un autre hiver.', 'Hivernal', 1280, 692),
    filename: 'frostbound-v5.zip', url: './shaders/frostbound-v5.zip',
    expectedSizeBytes: 9843,
    sha256: 'f01855eed024f702ad5bd7c009a235c93f70f1d406cc984b9a396c923fd2a809',
  }),
  Object.freeze({
    ...DEFAULTS,
    // The filename says sunrise-v5; pack.json names it Golden Hour 1.0.1.
    id: 'sunrise-v5', category: 'shaders', name: 'Golden Hour', version: '1.0.1', apiVersion: 5,
    author: 'Arena Agent',
    description: 'Une lumière dorée, des ombres froides et des reflets chaleureux sur l’eau. Une ambiance douce inspirée des premières et dernières lueurs du jour.',
    preview: preview('assets/golden-hour-landscape.webp', 'Illustration d’une vallée verdoyante en blocs, baignée d’une lumière dorée avec des reflets sur la rivière.', 'Un peu d’or dans chaque instant.', 'Lumière dorée', 1280, 710),
    filename: 'sunrise-v5.zip', url: './shaders/sunrise-v5.zip',
    expectedSizeBytes: 8108,
    sha256: 'a03523df78ff8a97e585f87ce31c76c179c88eb75501dffc555735daa4172ad3',
  }),
  Object.freeze({
    ...DEFAULTS,
    id: 'aurora-v9', category: 'shaders', name: 'Aurora', version: 'V9', apiVersion: 5, archived: true,
    author: 'K4miNoK4mi',
    description: 'Une version précédente, conservée pour retrouver votre ambiance préférée.',
    filename: 'aurora-v9.zip', url: './shaders/aurora-v9.zip',
    expectedSizeBytes: 15703,
    sha256: 'b809e83196b9d5197eea8bbf5346e05a30fd677bb90c66677cc37c4146954bab',
  }),
  Object.freeze({
    ...DEFAULTS,
    id: 'aurora-original', category: 'shaders', name: 'Aurora', version: 'Original', apiVersion: 5, archived: true,
    author: 'K4miNoK4mi',
    description: 'L’archive initialement partagée dans ce dépôt, sans numéro de version confirmé.',
    filename: 'aurora-original.zip', url: './shaders/aurora-original.zip',
    expectedSizeBytes: 16789,
    sha256: 'f83f701ce164341fb41344ff0df502ff823ec1db92579101c22ed1ecdf1d91d4',
  }),
]);
