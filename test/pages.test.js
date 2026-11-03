import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

test('Pages emits a direct Kobo route with assets valid under any repository prefix', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'wing-pages-'));
  try {
    await mkdir(join(temp, 'dist/kobo'), {recursive:true});
    await writeFile(join(temp, 'dist/kobo/index.html'), '<script src="../assets/main.js"></script><link href="../assets/main.css">');
    await writeFile(join(temp, 'dist/index.html'), '<script src="./assets/main.js"></script><link href="./assets/main.css">');
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/pages.mjs', import.meta.url))], { cwd: temp });
    const child = await readFile(join(temp, 'dist/kobo/index.html'), 'utf8');
    assert.match(child, /src="\.\.\/assets\/main.js"/);
    assert.match(child, /href="\.\.\/assets\/main.css"/);
    assert.equal(new URL('../assets/main.js', 'https://example.github.io/any-repository/kobo/').pathname, '/any-repository/assets/main.js');
    assert.equal(await readFile(join(temp, 'dist/.nojekyll'), 'utf8'), '');
  } finally { await rm(temp, { recursive: true, force: true }); }
});

