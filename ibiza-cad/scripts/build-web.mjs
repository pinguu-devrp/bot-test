// Construye el CAD web en web-dist/ (lo sirve el bot en /emergencias/cad/) y el portal de emergencias
// con sus MDT en web-dist-mdt/ (en /emergencias/ y en /emergencias/guardia-civil/, /samu/ y /bombers/).
// Uso: npm run build
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// Aviso de derechos al principio de cada archivo que se descarga el navegador (ver LICENSE).
const AVISO = '© 2026 Ibiza Roleplay. Todos los derechos reservados.';

// Navegadores de los últimos años, incluido Safari de iOS 14+.
const comun = {
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari14'],
  legalComments: 'none',
  logLevel: 'warning',
  banner: { js: `/*! ${AVISO} */` },
};

/**
 * Una web: adaptador (`web.js`, con validación y socket.io-client), interfaz (`renderer.js`),
 * estilos y logo. Los nombres de archivo son los que el bot acepta servir.
 */
async function web({ nombre, salida, adaptador, interfaz, estaticos }) {
  const dir = join(raiz, salida);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  await build({ ...comun, entryPoints: [join(raiz, adaptador)], outfile: join(dir, 'web.js') });
  await build({ ...comun, entryPoints: [join(raiz, interfaz)], outfile: join(dir, 'renderer.js') });
  writeFileSync(join(dir, 'styles.css'), `/*! ${AVISO} */\n${readFileSync(join(raiz, estaticos, 'styles.css'), 'utf8')}`);
  copyFileSync(join(raiz, 'static/logo.png'), join(dir, 'logo.png'));

  let html = readFileSync(join(raiz, estaticos, 'index.html'), 'utf8');
  // Huella del contenido en la URL (`renderer.js?v=…`): el bot sirve CSS y JS con 5 minutos de
  // caché, y sin esto, tras publicar una versión nueva, el navegador podía mezclar el HTML nuevo
  // con el JavaScript viejo. El bot ignora la parte `?v=`.
  const huella = (archivo) => createHash('sha256').update(readFileSync(join(dir, archivo))).digest('hex').slice(0, 10);
  for (const archivo of ['styles.css', 'web.js', 'renderer.js']) {
    html = html.replace(new RegExp(`(src|href)="${archivo.replace('.', '\\.')}"`), `$1="${archivo}?v=${huella(archivo)}"`);
  }
  if (!/src="web\.js\?v=\w+"/.test(html) || !/src="renderer\.js\?v=\w+"/.test(html) || !/href="styles\.css\?v=\w+"/.test(html)) {
    throw new Error(`${estaticos}/index.html debe cargar styles.css, web.js y renderer.js por su nombre: revisa scripts/build-web.mjs.`);
  }
  writeFileSync(join(dir, 'index.html'), html.replace(/^<!doctype html>/i, `$&\n<!-- ${AVISO} -->`));
  console.log(`${nombre} listo en ${salida}/`);
}

await web({ nombre: 'CAD web', salida: 'web-dist', adaptador: 'src/web/web.ts', interfaz: 'src/renderer.ts', estaticos: 'static' });
await web({ nombre: 'Portal de emergencias y MDT', salida: 'web-dist-mdt', adaptador: 'src/mdt/web.ts', interfaz: 'src/mdt/app.ts', estaticos: 'static-mdt' });
