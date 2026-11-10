import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = { '/': ['public/index.html', 'text/html'], '/app.js': ['public/app.js', 'text/javascript'], '/styles.css': ['public/styles.css', 'text/css'], '/icon.svg': ['public/icon.svg', 'image/svg+xml'] };
const assets = Object.fromEntries(Object.entries(files).map(([path, [file, type]]) => [path, { body: readFileSync(file, 'utf8'), type: `${type}; charset=utf-8` }]));
mkdirSync('dist/server', { recursive: true }); mkdirSync('dist/.openai', { recursive: true });
await build({ entryPoints: ['worker/index.js'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true, plugins: [{ name: 'assets', setup(builder) {
  builder.onResolve({ filter: /^virtual:assets$/ }, () => ({ path: 'assets', namespace: 'embedded' }));
  builder.onLoad({ filter: /.*/, namespace: 'embedded' }, () => ({ contents: `export default ${JSON.stringify(assets)}`, loader: 'js' }));
} }] });
writeFileSync('dist/.openai/hosting.json', readFileSync('.openai/hosting.json'));
console.log('Built the hosted Worker with the same UI and context service.');
