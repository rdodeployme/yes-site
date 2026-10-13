// Bundles the live data layer and the Firebase SDK into one classic script for the static site.
import { build } from 'esbuild';
await build({
  entryPoints: ['live/yarta-live.src.js'],
  bundle: true, minify: true, format: 'iife', target: ['es2020'],
  outfile: '../src/assets/yarta/yarta-live.js',
  legalComments: 'none',
  banner: { js: '/* Yarta live data layer + Firebase JS SDK (Apache-2.0). Source: backend/live/yarta-live.src.js. Built file: do not edit. */' },
});
console.log('built src/assets/yarta/yarta-live.js');
