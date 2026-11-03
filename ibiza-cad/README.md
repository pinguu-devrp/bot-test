# CAD · Ibiza Roleplay

Página web de la central de emergencias: el mapa oficial de ER:LC con las unidades de policía y de bomberos/sanitarios en directo, tu propia posición y los avisos del 911 (de la consola de rol o del juego), con *Atender* y *Cerrar* sincronizados con Discord.

La sirve el bot (`../ibiza-bot`) en `/cad/`, en el mismo servidor que la consola: arranca con él y no hay que instalar nada. El bot hace todo el trabajo (avisos, unidades más cercanas, posiciones); la página solo muestra y manda acciones.

## Compilar

```bash
npm install
npm run build
```

Deja la web en `web-dist/`. El bot la carga al arrancar desde `CAD_WEB_DIR` (por defecto `../ibiza-cad/web-dist`), así que tras compilar hay que reiniciar el bot.

`npm run typecheck` comprueba los tipos.

## Entrar

1. En Discord, `/consola codigo`. A policía, bomberos, sanitarios y staff les sale el botón **Abrir el CAD**, que entra directamente. También se puede abrir `https://tu-dominio/cad/` y pegar el código.
2. El código es el de la consola y solo sirve una vez: o consola o CAD. Para abrir la otra, pide otro código.
3. La sesión se guarda en el navegador (7 días). El bot vuelve a mirar los roles al conectar, en cada acción y cada 2 minutos: quien los pierde, fuera.

## El mapa

- **Imagen:** la oficial de ER:LC (otoño, sin rótulos). La API de ER:LC no deja que otra web la cargue, así que el bot la descarga al arrancar y la sirve en `/cad/mapa.png` (unos 17 MB; el navegador la guarda y no la vuelve a bajar).
- **Coordenadas:** las de la API de ER:LC son directamente los píxeles del mapa (5355 × 5355, origen arriba a la izquierda). No hay que calibrar nada.
- **Rótulos** con los nombres del callejero de Ibiza (los mismos del GPS de la consola), según el zoom:
  - de lejos, los distritos (Eivissa Centro, Sant Antoni…);
  - siempre, los iconos de comisaría, Guardia Civil, hospital, bomberos, ayuntamiento, cárcel y aeródromo; al acercarse, también juzgados, banco, joyería, concesionario, armerías, gasolineras, Tráfico, Correos, talleres y muelles, todos con su nombre. Cada edificio está en su sitio exacto (posiciones de erlc.one);
  - más cerca, las calles (giradas como la carretera) y los códigos postales.

  Salen del bot (`ibiza-bot/src/data/mapaCad.ts` y `zonas.ts`), leídos del mapa oficial.

## Qué se ve

- **Mapa:** zoom con la rueda, los botones o pellizcando en el móvil; arrastrar para moverse; doble clic para acercar.
  - **Tú**, con un aro verde (también si no eres una unidad, por ejemplo staff). Arriba a la izquierda, tu calle y código postal; el botón de la mira te centra. Al entrar, el mapa se centra en ti.
  - Policía en **azul** y bomberos/sanitarios en **naranja**, con su indicativo; con un aro blanco si están en un aviso.
  - Avisos como un **rombo rojo** (abierto) o **naranja** (atendido), con su número.
  - Al pasar el ratón por encima, una ficha con la calle y el estado.
- **Panel lateral** (debajo del mapa en el móvil):
  - **Avisos:** número, tipo, calle, lo que dijo quien llamó, unidades asignadas con su distancia y botones *Atender* y *Cerrar*. Al pulsar un aviso, el mapa se centra en él y traza líneas hasta sus unidades.
  - **Unidades:** policía y bomberos/sanitarios, con su calle y si están libres o en qué aviso.
- **Cabecera:** conexión con el bot, estado de ER:LC (y hace cuánto llegaron las posiciones), unidades conectadas, avisos abiertos y el botón de **ventana flotante**.

**Ventana flotante** (Chrome y Edge de escritorio): saca el CAD a una ventana pequeña siempre encima, también sobre Roblox en pantalla completa sin bordes. La pestaña tiene que seguir abierta (se puede minimizar).

Las posiciones se leen cada 2 segundos mientras el CAD está abierto, pero ER:LC solo las actualiza cada ~5 s (medido conduciendo). Para que no vayan a saltos, cada unidad se desliza de una posición a la siguiente durante el tiempo que pasó entre sus dos últimos cambios: se ve fluido, a cambio de ir unos segundos por detrás (la asignación de avisos usa siempre la posición real, no la animada). Un salto grande, como reaparecer en otro sitio, no se anima. Los avisos llegan al momento.

## Seguridad

- CSP estricta del bot: solo nuestros archivos, conexión solo al mismo origen, sin scripts en línea ni marcos.
- Todo lo que llega del bot se valida campo a campo (`src/validar.ts`) y el texto se pinta con `textContent`.
- El código del enlace va tras `#` (no llega al servidor) y se borra de la barra de direcciones al momento.
- Las posiciones de las unidades solo las recibe quien tiene rol de emergencias o staff, y cada uno recibe además solo la suya.

## Licencia

© 2026 Ibiza Roleplay. Todos los derechos reservados. No se concede ninguna licencia de uso: ver [LICENSE](LICENSE).
