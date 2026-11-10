# Web pública de Ibiza Roleplay (www.ibizaroleplayerlc.com)

HTML, CSS y dos scripts pequeños. Sin dependencias y sin compilar: esta carpeta ES la web.

## Verla en local

```bash
python -m http.server 8770
```

Abre `http://localhost:8770`. Hay que servirla así (no abrir `index.html` a mano) porque los enlaces son de carpeta.

## Qué se edita a mano

| Qué | Dónde |
|---|---|
| Enlace del Discord | todos los `index.html` (buscar `discord.gg/QFgEHgJyag`) |
| Cifra de seguidores | `index.html`: `data-valor` y el texto de `data-vivo="seguidores"` (hoy TikTok + YouTube + Instagram = 8.388, leído el 2026-11-07) |
| Staff y fechas de la historia | `conocenos/index.html` |
| Trabajos y Donaciones (quitadas hasta que estén listas) | `.pendientes/trabajos/` y `.pendientes/donaciones/`: para volver a publicarlas, mover cada carpeta junto a `conocenos/` y añadir sus enlaces al menú, al pie y a `sitemap.xml` |

Los huecos amarillos (`.pendiente`) son datos que faltan. Antes de publicar no debe quedar ninguno.

## Publicar

**Con el bot (lo normal):** el bot sirve esta carpeta en cuanto está encendido, a las peticiones cuyo dominio esté en `PUBLIC_WEB_ORIGINS`.

1. La carpeta `www/` del repo del bot es una copia de esta (sin `LEEME.md` ni `vista-previa.html`) y el compose la monta en el bot como `/ibiza-www`. `_headers` tiene que ir dentro: el bot saca de él las cabeceras de seguridad y, sin él, no sirve la web. Tras editar aquí, recópiala: `cp -r ibiza-www/. ibiza-bot/www/ && rm ibiza-bot/www/LEEME.md ibiza-bot/www/vista-previa.html`.
2. En el túnel de Cloudflare, el hostname `www.ibizaroleplayerlc.com` apunta al mismo servicio que `app` (`http://localhost:3001`).
3. Reinicia el bot: carga la web una vez al arrancar, así que un cambio en estos archivos no se ve hasta reiniciarlo. En la consola verás «🌐 Web pública disponible».

El bot nunca sirve `LEEME.md`, `_headers` ni `vista-previa.html`, aunque estén en la carpeta. Las páginas que no existen salen con `404.html`.

**Con otro servidor estático:** con Cloudflare Pages o Netlify, `_headers` aplica las cabeceras solo. Con nginx u otro, hay que copiarlas a mano. `robots.txt` y `sitemap.xml` ya apuntan a `https://www.ibizaroleplayerlc.com`.

## Seguridad: no la rompas sin querer

La política de `_headers` es estricta: solo scripts y estilos de la propia web, imágenes propias y conexiones únicamente a `https://app.ibizaroleplayerlc.com`.

- **No pongas `style="..."` ni `<script>...</script>` dentro del HTML**: el navegador los bloquea. Usa clases del CSS y archivos de `assets/`.
- Una imagen, fuente o script de otro dominio también se bloquea. Si hace falta uno, hay que añadirlo a la política a propósito.
- Los enlaces que abren otra pestaña llevan `rel="noopener noreferrer"`. Mantenlo.

## Conexión con el bot

La web habla con el bot en `https://app.ibizaroleplayerlc.com`:

- `POST /api/desbaneo`: el formulario de desbaneo. El bot lo publica en un canal privado del staff.
- `GET /api/estado`: miembros del Discord (portada).

Para que funcionen, en el `bot.env` del bot (y reiniciándolo):

```
CHANNEL_UNBAN_REQUESTS_ID=<id del canal privado del staff>
PUBLIC_WEB_ORIGINS=https://www.ibizaroleplayerlc.com
WS_TRUST_PROXY=true
```

Sin `PUBLIC_WEB_ORIGINS` el navegador bloquea las dos llamadas. Sin `WS_TRUST_PROXY=true`, detrás de Cloudflare Tunnel todos los visitantes comparten IP y los límites por IP los bloquean a la vez. Si el bot no responde, la portada muestra «Sin datos» y el formulario enseña el correo como alternativa: nunca inventa cifras.
