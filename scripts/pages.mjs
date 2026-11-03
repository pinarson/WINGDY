import { readFile, mkdir, writeFile } from 'node:fs/promises';
// Vite builds two independent documents; never replace Kobo Lite with the web UI.
await readFile('dist/index.html','utf8');
await readFile('dist/kobo/index.html','utf8');
await writeFile('dist/.nojekyll', '');
console.log('Pages statiques prêtes : web / et Kobo Lite /kobo/ (entrées indépendantes).');
