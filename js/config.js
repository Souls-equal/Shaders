// Change only this object to publish a different pack. All URLs are relative to
// the deployed site root, so GitHub Pages project subdirectories work too.
export const SHADER_CONFIG = Object.freeze({
  name: 'Aurora',
  author: 'K4miNoK4mi',
  description: 'A fresh perspective on your favorite world. Warm light, richer colors, and a little more atmosphere.',
  filename: 'aurora.zip',
  url: './aurora.zip',
  maxSizeMB: 50,
  expectedSizeBytes: 16789, // Actual ZIP size, not the uncompressed size; optional.
  sha256: 'f83f701ce164341fb41344ff0df502ff823ec1db92579101c22ed1ecdf1d91d4', // Optional integrity pin, NOT a malware guarantee.
  allowedOrigins: [], // Same origin is always allowed. Explicitly add any trusted HTTPS file host here.
  timeoutMs: 45000,
});
