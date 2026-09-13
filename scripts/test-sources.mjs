/**
 * Package sources: the CDN chain and URL -> package parsing.
 *
 *   node scripts/test-sources.mjs
 */
import { fetchPackage, getSources, packageFromUrl, sourceNames } from '../src/sources.js';

console.log('named sources:', sourceNames.join(', '));
console.log('default chain:', getSources().map((s) => s.id).join(' -> '));
console.log('cdn=github:', getSources('github').map((s) => s.id).join(' -> '));
console.log('cdn template:', getSources('https://my.cdn/{name}@{version}/{path}').map((s) => s.id).join(' -> '));

console.log('\nURL -> package:');
for (const url of [
  'https://cdn.jsdelivr.net/gh/elm-community/maybe-extra@5.3.0/src/Maybe/Extra.elm',
  'https://raw.githubusercontent.com/mdgriffith/elm-ui/1.1.8/src/Element.elm',
  'https://cdn.statically.io/gh/elm/parser/1.1.0/src/Parser.elm',
  'data:text/plain,hello',
]) {
  console.log(' ', url.slice(0, 70), '->', JSON.stringify(packageFromUrl(url)));
}

console.log('\nfetchPackage via default chain (jsDelivr):');
const pkg = await fetchPackage('elm-community/maybe-extra', '5.3.0');
console.log('  source =', pkg.source);
console.log('  elm.json version =', pkg.elmJson.version);
console.log('  files =', Object.keys(pkg.files).join(', '));

console.log('\nfetchPackage with a broken first source (fallback to jsDelivr):');
const broken = {
  id: 'broken',
  fileUrl: (name, version, path) => `https://example.invalid/${name}/${version}/${path}`,
};
const viaFallback = await fetchPackage('elm/parser', '1.1.0', {
  sources: [broken, ...getSources()],
  log: (m) => console.log('  ' + m),
});
console.log('  source =', viaFallback.source, '| files =', Object.keys(viaFallback.files).length);
