import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const isWatch = process.argv.includes('--watch');

const outDir = join(root, 'docs', 'assets', 'js');
const uppyRoot = join(root, 'uppy--uppy-companion-6.2.2', 'packages', '@uppy');

const alias = {
  '@uppy/core': join(uppyRoot, 'core', 'src', 'index.ts'),
  '@uppy/utils': join(uppyRoot, 'utils', 'src', 'index.ts'),
  '@uppy/store-default': join(uppyRoot, 'store-default', 'src', 'index.ts'),
  '@uppy/drop-target': join(uppyRoot, 'drop-target', 'src', 'index.ts'),
};

const entryPoints = [
  { in: join(root, 'src', 'firebase.js'), out: 'firebase.js' },
  { in: join(root, 'src', 'admin', 'index.js'), out: 'admin-portal.js' },
  { in: join(root, 'src', 'store', 'catalogue.js'), out: 'store-catalogue.js' }
];

await mkdir(outDir, { recursive: true });

async function buildAll() {
  const builds = entryPoints.map(({ in: entry, out }) =>
    esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      target: ['es2019'],
      sourcemap: true,
      outfile: join(outDir, out),
      logLevel: 'info',
      alias,
    })
  );
  await Promise.all(builds);
}

if (isWatch) {
  const contexts = await Promise.all(
    entryPoints.map(({ in: entry, out }) =>
      esbuild.context({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        target: ['es2019'],
        sourcemap: true,
        outfile: join(outDir, out),
        logLevel: 'info',
        alias,
      })
    )
  );

  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('Watching for changes...');
} else {
  await buildAll();
  console.log('Build completed');
}
