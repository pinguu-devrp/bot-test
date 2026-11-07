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
| Donaciones (nombre, precio, ventajas, enlace de compra) | `donaciones/index.html`: una tarjeta `<li>` por donación |
| Staff y fechas de la historia | `conocenos/index.html` |
| Sueldos | `trabajos/index.html` |

Los huecos amarillos (`.pendiente`) son datos que faltan. Antes de publicar no debe quedar ninguno.

## Publicar

- Sirve la carpeta con cualquier servidor estático. Con **Cloudflare Pages** o Netlify, el archivo `_headers` aplica las cabeceras de seguridad solo. Con nginx u otro, hay que copiarlas a mano.
- Usa `404.html` como página de error. `robots.txt` y `sitemap.xml` ya apuntan a `https://www.ibizaroleplayerlc.com`.
- No subas `vista-previa.html` (es solo para verla en remoto) ni este archivo.

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
