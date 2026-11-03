/*
 * Interfaz del CAD web. Solo habla con el bot a través de `window.cad` (`web/web.ts`). TODO el
 * texto que llega del servidor se pinta con `textContent` (o en el canvas, que no interpreta HTML).
 *
 * El mapa es un <canvas>: la imagen oficial de ER:LC (la sirve el bot en `mapa.png`) con zoom y
 * desplazamiento y, encima, los rótulos del callejero de Ibiza, las unidades, los avisos y tu
 * propia posición. Solo se repinta cuando algo cambia (nunca en bucle).
 *
 * Coordenadas: las de la API de ER:LC son directamente los píxeles del mapa oficial (5355 × 5355,
 * origen arriba a la izquierda), así que no hay nada que calibrar.
 */

const COLOR: Record<string, string> = {
  policia: '#3b82f6',
  bomberos: '#f28c28',
  abierto: '#e5484d',
  atendido: '#f28c28',
  cerrado: '#687585',
  halo: '#0a0f15',
  texto: '#e7ecf2',
  yo: '#3fb67a',
  /** Persona consultada en el MDT («ver en el mapa»). */
  mdt: '#a855f7',
};
/** Puntos de interés que se ven también con el mapa entero (el resto, al acercarse). */
const ESENCIALES = new Set<TipoLugarCad>(['comisaria', 'hospital', 'bomberos', 'carcel', 'aerodromo', 'ayuntamiento']);
/** Icono y color de cada tipo de punto de interés. */
const LUGAR: Record<TipoLugarCad, { icono: string; color: string }> = {
  comisaria: { icono: '👮', color: '#3b82f6' },
  hospital: { icono: '🏥', color: '#e5484d' },
  bomberos: { icono: '🚒', color: '#f2622b' },
  ayuntamiento: { icono: '🏛️', color: '#e2a43b' },
  juzgado: { icono: '⚖️', color: '#c9a86a' },
  carcel: { icono: '🔒', color: '#9aa6b4' },
  aerodromo: { icono: '✈️', color: '#5cc8f2' },
  puerto: { icono: '⚓', color: '#2bb5a8' },
  banco: { icono: '🏦', color: '#3fb67a' },
  joyeria: { icono: '💎', color: '#7dd3fc' },
  gasolinera: { icono: '⛽', color: '#e8c547' },
  concesionario: { icono: '🚗', color: '#a78bfa' },
  armeria: { icono: '🔫', color: '#94a3b8' },
  lugar: { icono: '📍', color: '#f6a65a' },
};
const TEXTO_CONEXION: Record<EstadoConexionCad, string> = {
  conectado: 'En línea',
  conectando: 'Conectando…',
  reconectando: 'Reconectando…',
  desconectado: 'Desconectado',
};
const TEXTO_ERLC: Record<EstadoErlc, string> = {
  ok: 'ER:LC',
  apagado: 'ER:LC apagado',
  limitado: 'ER:LC limitado',
  'sin-api': 'ER:LC sin configurar',
  error: 'ER:LC sin respuesta',
};
const TEXTO_ESTADO: Record<EstadoAvisoCad, string> = { abierto: 'Abierto', atendido: 'Atendido', cerrado: 'Cerrado' };
const ORDEN_ESTADO: Record<EstadoAvisoCad, number> = { abierto: 0, atendido: 1, cerrado: 2 };
const ZOOM_MIN = 0.04;
const ZOOM_MAX = 4;
/** A partir de este zoom se escriben los indicativos junto a cada unidad. */
const ZOOM_ETIQUETAS = 0.28;

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el as T;
}

const ui = {
  conexion: $<HTMLSpanElement>('conexion'),
  conexionTexto: $<HTMLSpanElement>('conexion-texto'),
  erlc: $<HTMLSpanElement>('erlc'),
  erlcTexto: $<HTMLSpanElement>('erlc-texto'),
  contadores: $<HTMLDivElement>('contadores'),
  numPolicia: $<HTMLSpanElement>('num-policia'),
  numBomberos: $<HTMLSpanElement>('num-bomberos'),
  numAvisos: $<HTMLSpanElement>('num-avisos'),
  miNombre: $<HTMLSpanElement>('mi-nombre'),
  btnFlotante: $<HTMLButtonElement>('btn-flotante'),
  btnSalir: $<HTMLButtonElement>('btn-salir'),
  cad: $<HTMLElement>('pantalla-cad'),
  mapa: $<HTMLElement>('mapa'),
  lienzo: $<HTMLCanvasElement>('lienzo'),
  mapaEstado: $<HTMLDivElement>('mapa-estado'),
  info: $<HTMLDivElement>('info'),
  btnAcercar: $<HTMLButtonElement>('btn-acercar'),
  btnAlejar: $<HTMLButtonElement>('btn-alejar'),
  btnEncajar: $<HTMLButtonElement>('btn-encajar'),
  btnYo: $<HTMLButtonElement>('btn-yo'),
  yo: $<HTMLDivElement>('yo'),
  yoTexto: $<HTMLSpanElement>('yo-texto'),
  pestanaAvisos: $<HTMLSpanElement>('pestana-avisos'),
  pestanaUnidades: $<HTMLSpanElement>('pestana-unidades'),
  btnEmergencias: $<HTMLButtonElement>('btn-emergencias'),
  marcaMdt: $<HTMLDivElement>('marca-mdt'),
  marcaTexto: $<HTMLSpanElement>('marca-texto'),
  btnQuitarMarca: $<HTMLButtonElement>('btn-quitar-marca'),
  panelAvisos: $<HTMLDivElement>('panel-avisos'),
  panelUnidades: $<HTMLDivElement>('panel-unidades'),
  listaAvisos: $<HTMLUListElement>('lista-avisos'),
  listaUnidades: $<HTMLUListElement>('lista-unidades'),
  sinAvisos: $<HTMLParagraphElement>('sin-avisos'),
  sinUnidades: $<HTMLParagraphElement>('sin-unidades'),
  aviso: $<HTMLParagraphElement>('aviso'),
  login: $<HTMLElement>('pantalla-login'),
  codigo: $<HTMLInputElement>('codigo'),
  btnLogin: $<HTMLButtonElement>('btn-login'),
  loginAviso: $<HTMLParagraphElement>('login-aviso'),
  avisoFlotante: $<HTMLElement>('aviso-flotante'),
  btnTraer: $<HTMLButtonElement>('btn-traer'),
};

// Logo del servidor: se muestra solo si carga bien; si no, queda la insignia «IR».
for (const logo of document.querySelectorAll<HTMLImageElement>('.logo-servidor')) {
  const mostrar = () => {
    logo.hidden = false;
    document.body.classList.add('con-logo');
  };
  logo.addEventListener('load', mostrar);
  logo.addEventListener('error', () => logo.remove());
  if (logo.complete && logo.naturalWidth > 0) mostrar();
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const avisos = new Map<string, AvisoCad>();
let unidades: UnidadCad[] = [];
let estadoErlc: EstadoErlc | null = null;
let ultimaPosicion = 0;
let seleccion: { tipo: 'aviso' | 'unidad'; id: string } | null = null;
/** Quien tiene el CAD abierto: su cuenta de Roblox y dónde está ahora en ER:LC. */
let miRobloxId: string | null = null;
let yo: YoCad | null = null;
let hover: { tipo: 'aviso' | 'unidad'; id: string } | null = null;
/** Avisos con una acción en curso (botones desactivados hasta la respuesta). */
const pendientes = new Set<string>();
/** «Ver en el CAD» desde el MDT: dónde estaba la persona consultada. */
let marcaMdt: { x: number; z: number; nombre: string } | null = null;

function aviso(texto: string): void {
  ui.aviso.textContent = texto;
}

function elemento<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(etiqueta);
  el.className = clase;
  el.textContent = texto;
  return el;
}

function haceCuanto(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

const nombreUnidad = (u: { indicativo: string | null; nombre: string }) => (u.indicativo ? `${u.indicativo} · ${u.nombre}` : u.nombre);

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------

const ctx = ui.lienzo.getContext('2d')!;
let imagen: HTMLImageElement | null = null;
/** Tamaño de la imagen oficial (se corrige al cargarla). */
let tamMapa = 5355;
/** Rótulos del mapa (nombres del callejero de Ibiza). */
let lugares: LugaresCad = { distritos: [], lugares: [], postales: [], calles: [] };
/** Pantalla = píxel del mapa × zoom + (x, y), en píxeles CSS. */
const vista = { zoom: 0.15, x: 0, y: 0 };
let vistaLista = false;

const anchoLienzo = () => ui.lienzo.clientWidth;
const altoLienzo = () => ui.lienzo.clientHeight;

/** Coordenadas de ER:LC → píxel de la imagen del mapa: son lo mismo (1 stud = 1 píxel). */
function aMapa(x: number, z: number): { px: number; py: number } {
  return { px: x, py: z };
}

function aPantalla(x: number, z: number): { sx: number; sy: number } {
  const { px, py } = aMapa(x, z);
  return { sx: px * vista.zoom + vista.x, sy: py * vista.zoom + vista.y };
}

function encajar(): void {
  const w = anchoLienzo();
  const h = altoLienzo();
  if (w === 0 || h === 0) return;
  vista.zoom = (Math.min(w, h) / tamMapa) * 0.98;
  vista.x = (w - tamMapa * vista.zoom) / 2;
  vista.y = (h - tamMapa * vista.zoom) / 2;
  vistaLista = true;
  pedirDibujo();
}

/** `true` en cuanto la persona mueve o acerca el mapa: entonces no se recentra solo. */
let vistaMovida = false;

function centrarEn(x: number, z: number): void {
  vistaLista = true;
  vista.zoom = Math.min(ZOOM_MAX, Math.max(vista.zoom, 0.55));
  const { px, py } = aMapa(x, z);
  vista.x = anchoLienzo() / 2 - px * vista.zoom;
  vista.y = altoLienzo() / 2 - py * vista.zoom;
  pedirDibujo();
}

function zoomEn(factor: number, sx = anchoLienzo() / 2, sy = altoLienzo() / 2): void {
  vistaMovida = true;
  const nuevo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vista.zoom * factor));
  vista.x = sx - ((sx - vista.x) * nuevo) / vista.zoom;
  vista.y = sy - ((sy - vista.y) * nuevo) / vista.zoom;
  vista.zoom = nuevo;
  pedirDibujo();
}

let cargandoMapa = false;
/**
 * El mapa oficial, servido por el bot (unos 17 MB: el navegador lo guarda en caché). Si el bot aún
 * lo está descargando de ER:LC, se reintenta cada 15 s.
 */
function cargarMapa(): void {
  if (imagen || cargandoMapa) return;
  cargandoMapa = true;
  ui.mapaEstado.hidden = false;
  ui.mapaEstado.textContent = 'Cargando el mapa oficial de ER:LC…';
  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('load', () => {
    cargandoMapa = false;
    imagen = img;
    tamMapa = img.naturalWidth || tamMapa;
    ui.mapaEstado.hidden = true;
    pedirDibujo();
  });
  img.addEventListener('error', () => {
    cargandoMapa = false;
    ui.mapaEstado.textContent = 'El bot aún no tiene el mapa oficial de ER:LC. Se reintentará en unos segundos…';
    setTimeout(cargarMapa, 15_000);
  });
  img.src = 'mapa.png';
}

/**
 * Ventana en la que está ahora el mapa: la pestaña o la ventana flotante. Los fotogramas se piden a
 * esa: con la pestaña minimizada, los de la pestaña no llegan.
 */
const ventanaMapa = (): Window => ui.lienzo.ownerDocument.defaultView ?? window;

// ---------------------------------------------------------------------------
// Movimiento suave
// ---------------------------------------------------------------------------

/**
 * El bot lee las posiciones cada 2 s, pero ER:LC solo las actualiza cada ~5 s (medido conduciendo:
 * 5,6, 5,0 y 5,1 s entre cambios). Para que no vayan a saltos ni a tirones, cada unidad se desliza en
 * línea recta desde donde se ve ahora hasta su posición nueva, durante el tiempo que pasó entre sus
 * dos últimos cambios: así llega justo cuando suele llegar el siguiente. Un salto grande (reaparecer
 * en otro sitio, cambiar de vehículo) no se anima: se pone allí.
 */
interface Desplazamiento {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  t0: number;
  ms: number;
}
const SALTO_SIN_ANIMAR = 600; // studs
/** Límites del deslizamiento: ni más rápido que 1 s ni más lento que 6 s (tras una parada larga). */
const DESLIZAMIENTO_MIN_MS = 1000;
const DESLIZAMIENTO_MAX_MS = 6000;
const desplazamientos = new Map<string, Desplazamiento>();

const ahoraMs = () => performance.now();

function enPunto(d: Desplazamiento, ahora: number): { x: number; z: number } {
  const k = Math.min(1, Math.max(0, (ahora - d.t0) / d.ms));
  return { x: d.x0 + (d.x1 - d.x0) * k, z: d.z0 + (d.z1 - d.z0) * k };
}

/** Dónde se dibuja ahora algo que está (o va) en `x`, `z`. */
function mostrada(id: string, x: number, z: number, ahora = ahoraMs()): { x: number; z: number } {
  const d = desplazamientos.get(id);
  return d && d.x1 === x && d.z1 === z ? enPunto(d, ahora) : { x, z };
}

/**
 * Nuevas lecturas: lo que no ha cambiado sigue su camino; lo que ha cambiado empieza a deslizarse
 * desde donde se ve ahora, durante lo que pasó desde su cambio anterior.
 */
function moverA(puntos: readonly { id: string; x: number; z: number }[], ahora: number, quitarResto: boolean): void {
  const vistos = new Set<string>();
  for (const p of puntos) {
    vistos.add(p.id);
    const antes = desplazamientos.get(p.id);
    if (antes && antes.x1 === p.x && antes.z1 === p.z) continue; // ER:LC aún no la ha actualizado
    const desde = antes ? enPunto(antes, ahora) : { x: p.x, z: p.z };
    const ms = antes ? Math.min(DESLIZAMIENTO_MAX_MS, Math.max(DESLIZAMIENTO_MIN_MS, ahora - antes.t0)) : DESLIZAMIENTO_MIN_MS;
    const salto = !antes || Math.hypot(p.x - desde.x, p.z - desde.z) > SALTO_SIN_ANIMAR;
    desplazamientos.set(p.id, salto ? { x0: p.x, z0: p.z, x1: p.x, z1: p.z, t0: ahora, ms } : { x0: desde.x, z0: desde.z, x1: p.x, z1: p.z, t0: ahora, ms });
  }
  if (quitarResto) for (const id of [...desplazamientos.keys()]) if (id !== 'yo' && !vistos.has(id)) desplazamientos.delete(id);
}

/** `true` mientras alguna unidad siga deslizándose (hay que seguir pintando). */
function animando(ahora: number): boolean {
  for (const d of desplazamientos.values()) if (ahora - d.t0 < d.ms && (d.x0 !== d.x1 || d.z0 !== d.z1)) return true;
  return false;
}

let dibujoPendiente = false;
function pedirDibujo(): void {
  if (dibujoPendiente) return;
  dibujoPendiente = true;
  ventanaMapa().requestAnimationFrame(() => {
    dibujoPendiente = false;
    dibujar();
  });
}

function rombo(sx: number, sy: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(sx, sy - r);
  ctx.lineTo(sx + r, sy);
  ctx.lineTo(sx, sy + r);
  ctx.lineTo(sx - r, sy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLOR.halo!;
  ctx.stroke();
}

function etiqueta(texto: string, sx: number, sy: number, color = COLOR.texto!): void {
  ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLOR.halo!;
  ctx.strokeText(texto, sx, sy);
  ctx.fillStyle = color;
  ctx.fillText(texto, sx, sy);
}

function dibujar(): void {
  const ahora = ahoraMs();
  const dpr = ventanaMapa().devicePixelRatio || 1;
  const w = anchoLienzo();
  const h = altoLienzo();
  if (ui.lienzo.width !== Math.round(w * dpr) || ui.lienzo.height !== Math.round(h * dpr)) {
    ui.lienzo.width = Math.round(w * dpr);
    ui.lienzo.height = Math.round(h * dpr);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0a0f15';
  ctx.fillRect(0, 0, ui.lienzo.width, ui.lienzo.height);

  // Fondo: la imagen oficial, o una cuadrícula mientras se descarga.
  ctx.setTransform(dpr * vista.zoom, 0, 0, dpr * vista.zoom, dpr * vista.x, dpr * vista.y);
  if (imagen) {
    ctx.imageSmoothingQuality = vista.zoom < 0.5 ? 'medium' : 'high';
    ctx.drawImage(imagen, 0, 0);
  } else {
    ctx.fillStyle = '#111821';
    ctx.fillRect(0, 0, tamMapa, tamMapa);
    ctx.strokeStyle = '#222d3a';
    ctx.lineWidth = 2 / vista.zoom;
    for (let p = 0; p <= tamMapa; p += 250) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, tamMapa);
      ctx.moveTo(0, p);
      ctx.lineTo(tamMapa, p);
      ctx.stroke();
    }
  }

  // Rótulos y marcadores en píxeles de pantalla: no cambian de tamaño con el zoom.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dibujarRotulos(w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const porId = new Map(unidades.map((u) => [u.id, u]));

  // Aviso seleccionado: líneas hasta sus unidades (donde estén ahora).
  const avisoSel = seleccion?.tipo === 'aviso' ? avisos.get(seleccion.id) : undefined;
  if (avisoSel && avisoSel.x !== null && avisoSel.z !== null) {
    const a = aPantalla(avisoSel.x, avisoSel.z);
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    for (const asignada of avisoSel.unidades) {
      const u = porId.get(asignada.id);
      if (!u) continue;
      const m = mostrada(u.id, u.x, u.z, ahora);
      const p = aPantalla(m.x, m.z);
      ctx.strokeStyle = COLOR[u.servicio]!;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(p.sx, p.sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Unidades.
  for (const u of unidades) {
    const m = mostrada(u.id, u.x, u.z, ahora);
    const { sx, sy } = aPantalla(m.x, m.z);
    if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue;
    const elegida = (seleccion?.tipo === 'unidad' && seleccion.id === u.id) || (hover?.tipo === 'unidad' && hover.id === u.id);
    if (u.aviso !== null) {
      ctx.beginPath();
      ctx.arc(sx, sy, 9.5, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(sx, sy, elegida ? 7.5 : 6, 0, Math.PI * 2);
    ctx.fillStyle = COLOR[u.servicio]!;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLOR.halo!;
    ctx.stroke();
    // Tu propia unidad lleva su rótulo junto al «Tú» (abajo).
    if ((vista.zoom >= ZOOM_ETIQUETAS || elegida) && !(yo && u.id === miRobloxId)) etiqueta(u.indicativo ?? u.nombre, sx, sy - 11);
  }

  // Tú: aro verde (si además eres una unidad, alrededor de tu punto).
  if (yo) {
    const m = mostrada('yo', yo.x, yo.z, ahora);
    const { sx, sy } = aPantalla(m.x, m.z);
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(63, 182, 122, 0.22)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLOR.yo!;
    ctx.stroke();
    const propia = unidades.find((u) => u.id === miRobloxId);
    if (!propia) {
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.yo!;
      ctx.fill();
    }
    etiqueta(propia ? `Tú · ${propia.indicativo ?? propia.nombre}` : 'Tú', sx, sy - 15, COLOR.yo);
  }

  // Avisos sin cerrar con posición, por encima de todo: las unidades que acuden se le juntan.
  for (const a of avisos.values()) {
    if (a.estado === 'cerrado' || a.x === null || a.z === null) continue;
    const { sx, sy } = aPantalla(a.x, a.z);
    const elegido = seleccion?.tipo === 'aviso' && seleccion.id === a.id;
    if (elegido) {
      ctx.beginPath();
      ctx.arc(sx, sy, 17, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(229, 72, 77, 0.18)';
      ctx.fill();
    }
    rombo(sx, sy, elegido ? 11 : 9, COLOR[a.estado]!);
    etiqueta(`#${a.numero}`, sx, sy - 12, COLOR[a.estado]);
  }

  // Persona consultada en el MDT: diana morada con su nombre.
  if (marcaMdt) {
    const { sx, sy } = aPantalla(marcaMdt.x, marcaMdt.z);
    ctx.beginPath();
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLOR.mdt!;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy);
    ctx.lineTo(sx + 6, sy);
    ctx.moveTo(sx, sy - 6);
    ctx.lineTo(sx, sy + 6);
    ctx.stroke();
    etiqueta(marcaMdt.nombre, sx, sy - 17, COLOR.mdt);
  }

  // Mientras alguna unidad se desliza, siguiente fotograma.
  if (animando(ahora)) pedirDibujo();
}

/**
 * Rótulos del callejero de Ibiza según el zoom: de lejos, los distritos; más cerca, puntos de
 * interés, calles (giradas como la carretera) y códigos postales. Un rótulo que se pisaría con
 * otro ya dibujado se salta (por orden de importancia).
 */
function dibujarRotulos(w: number, h: number): void {
  const ocupados: [number, number, number, number][] = [];
  const cabe = (sx: number, sy: number, mw: number, mh: number) => {
    const caja: [number, number, number, number] = [sx - mw, sy - mh, sx + mw, sy + mh];
    if (caja[2] < 0 || caja[3] < 0 || caja[0] > w || caja[1] > h) return false;
    if (ocupados.some((o) => caja[0] < o[2] && caja[2] > o[0] && caja[1] < o[3] && caja[3] > o[1])) return false;
    ocupados.push(caja);
    return true;
  };
  const rotulo = (texto: string, sx: number, sy: number, fuente: string, color: string, angulo = 0) => {
    ctx.font = fuente;
    const ancho = ctx.measureText(texto).width;
    const alto = 13;
    // Caja (sin girar) que ocupa el texto girado, para comprobar choques.
    const mw = (Math.abs(Math.cos(angulo)) * ancho + Math.abs(Math.sin(angulo)) * alto) / 2 + 3;
    const mh = (Math.abs(Math.sin(angulo)) * ancho + Math.abs(Math.cos(angulo)) * alto) / 2 + 2;
    if (!cabe(sx, sy, mw, mh)) return;
    ctx.save();
    ctx.translate(sx, sy);
    if (angulo) ctx.rotate(angulo);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10, 15, 21, 0.85)';
    ctx.strokeText(texto, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(texto, 0, 0);
    ctx.restore();
  };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (vista.zoom < 0.34) {
    for (const d of lugares.distritos) {
      const { sx, sy } = aPantalla(d.x, d.z);
      rotulo(d.nombre.toUpperCase(), sx, sy, '700 12px "Segoe UI", system-ui, sans-serif', 'rgba(231, 236, 242, 0.82)');
    }
  }
  // Puntos de interés: de lejos, solo los esenciales; al acercarse, todos y con su nombre.
  for (const l of lugares.lugares) {
    if (vista.zoom < 0.2 && !ESENCIALES.has(l.tipo)) continue;
    const { sx, sy } = aPantalla(l.x, l.z);
    const { icono, color } = LUGAR[l.tipo];
    const r = 10;
    if (!cabe(sx, sy, r + 1, r + 1)) continue;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 15, 21, 0.9)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.font = '11px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(icono, sx, sy + 1);
    if (vista.zoom >= 0.2) {
      const fuente = '600 11.5px "Segoe UI", system-ui, sans-serif';
      ctx.font = fuente;
      const ancho = ctx.measureText(l.nombre).width;
      rotulo(l.nombre, sx + r + 6 + ancho / 2, sy, fuente, color);
    }
  }
  if (vista.zoom >= 0.32) {
    for (const c of lugares.calles) {
      const { sx, sy } = aPantalla(c.x, c.z);
      rotulo(c.nombre, sx, sy, '600 10.5px "Segoe UI", system-ui, sans-serif', '#c9d3de', c.angulo);
    }
  }
  if (vista.zoom >= 0.5) {
    for (const p of lugares.postales) {
      const { sx, sy } = aPantalla(p.x, p.z);
      rotulo(p.cp, sx, sy, '700 10px "Cascadia Mono", Consolas, monospace', '#8b98a8');
    }
  }
}

/** Marcador bajo el ratón (los avisos tienen prioridad sobre las unidades). */
function marcadorEn(sx: number, sy: number): { tipo: 'aviso' | 'unidad'; id: string } | null {
  for (const a of avisos.values()) {
    if (a.estado === 'cerrado' || a.x === null || a.z === null) continue;
    const p = aPantalla(a.x, a.z);
    if (Math.hypot(p.sx - sx, p.sy - sy) <= 12) return { tipo: 'aviso', id: a.id };
  }
  let mejor: { id: string; d: number } | null = null;
  for (const u of unidades) {
    const m = mostrada(u.id, u.x, u.z);
    const p = aPantalla(m.x, m.z);
    const d = Math.hypot(p.sx - sx, p.sy - sy);
    if (d <= 10 && (!mejor || d < mejor.d)) mejor = { id: u.id, d };
  }
  return mejor ? { tipo: 'unidad', id: mejor.id } : null;
}

function mostrarInfo(m: { tipo: 'aviso' | 'unidad'; id: string } | null, sx: number, sy: number): void {
  const lineas: [string, string][] = [];
  let color = COLOR.policia!;
  if (m?.tipo === 'unidad') {
    const u = unidades.find((x) => x.id === m.id);
    if (u) {
      color = COLOR[u.servicio]!;
      lineas.push(['info-titulo', nombreUnidad(u)], ['info-linea', u.ubicacion ?? 'Sin dirección'], ['info-linea', u.aviso !== null ? `En el aviso #${u.aviso}` : 'Libre']);
    }
  } else if (m?.tipo === 'aviso') {
    const a = avisos.get(m.id);
    if (a) {
      color = COLOR[a.estado]!;
      lineas.push(['info-titulo', `#${a.numero} · ${a.emoji} ${a.tipo}`], ['info-linea', a.ubicacion ?? 'Sin dirección'], ['info-linea', `${TEXTO_ESTADO[a.estado]} · ${haceCuanto(a.creado)}`]);
    }
  }
  if (lineas.length === 0) {
    ui.info.hidden = true;
    return;
  }
  ui.info.replaceChildren(...lineas.map(([clase, texto]) => elemento('div', clase, texto)));
  // CSSOM (no un atributo style): lo permite la CSP sin abrir 'unsafe-inline'.
  ui.info.style.setProperty('--c', color);
  ui.info.style.left = `${Math.min(sx + 14, anchoLienzo() - 290)}px`;
  ui.info.style.top = `${sy + 14}px`;
  ui.info.hidden = false;
}

// Arrastrar para mover, rueda (o pellizco en el móvil) para el zoom, clic para seleccionar.
let arrastre: { x: number; y: number; movido: boolean } | null = null;
const punteros = new Map<number, { x: number; y: number }>();
let pellizco: number | null = null;
const distanciaPunteros = () => {
  const [a, b] = [...punteros.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};
ui.lienzo.addEventListener('pointerdown', (e) => {
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  ui.lienzo.setPointerCapture(e.pointerId);
  if (punteros.size === 2) {
    // Segundo dedo: deja de arrastrar y empieza a pellizcar.
    arrastre = null;
    pellizco = distanciaPunteros();
    return;
  }
  arrastre = { x: e.clientX, y: e.clientY, movido: false };
});
ui.lienzo.addEventListener('pointermove', (e) => {
  const r = ui.lienzo.getBoundingClientRect();
  const sx = e.clientX - r.left;
  const sy = e.clientY - r.top;
  if (punteros.has(e.pointerId)) punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pellizco !== null && punteros.size >= 2) {
    const d = distanciaPunteros();
    const [a, b] = [...punteros.values()];
    if (pellizco > 0 && d > 0 && a && b) zoomEn(d / pellizco, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    pellizco = d;
    return;
  }
  if (arrastre) {
    const dx = e.clientX - arrastre.x;
    const dy = e.clientY - arrastre.y;
    if (arrastre.movido || Math.hypot(dx, dy) > 3) {
      arrastre.movido = true;
      vistaMovida = true;
      vista.x += dx;
      vista.y += dy;
      arrastre.x = e.clientX;
      arrastre.y = e.clientY;
      ui.lienzo.classList.add('arrastrando');
      ui.info.hidden = true;
      pedirDibujo();
    }
    return;
  }
  const m = marcadorEn(sx, sy);
  if (m?.id !== hover?.id) {
    hover = m;
    pedirDibujo();
  }
  ui.lienzo.classList.toggle('sobre-marcador', !!m);
  mostrarInfo(m, sx, sy);
});
const soltarPuntero = (e: PointerEvent) => {
  punteros.delete(e.pointerId);
  if (punteros.size < 2) pellizco = null;
};
ui.lienzo.addEventListener('pointercancel', (e) => {
  soltarPuntero(e);
  arrastre = null;
});
ui.lienzo.addEventListener('pointerup', (e) => {
  soltarPuntero(e);
  const fueClic = arrastre && !arrastre.movido;
  arrastre = null;
  ui.lienzo.classList.remove('arrastrando');
  if (!fueClic) return;
  const r = ui.lienzo.getBoundingClientRect();
  const sx = e.clientX - r.left;
  const sy = e.clientY - r.top;
  seleccionar(marcadorEn(sx, sy), false);
});
ui.lienzo.addEventListener('pointerleave', () => {
  ui.info.hidden = true;
  if (hover) {
    hover = null;
    pedirDibujo();
  }
});
ui.lienzo.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const r = ui.lienzo.getBoundingClientRect();
    zoomEn(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  },
  { passive: false },
);
ui.lienzo.addEventListener('dblclick', (e) => {
  const r = ui.lienzo.getBoundingClientRect();
  zoomEn(2, e.clientX - r.left, e.clientY - r.top);
});
ui.btnAcercar.addEventListener('click', () => zoomEn(1.5));
ui.btnAlejar.addEventListener('click', () => zoomEn(1 / 1.5));
ui.btnEncajar.addEventListener('click', encajar);
new ResizeObserver(() => {
  if (!vistaLista) encajar();
  pedirDibujo();
}).observe(ui.mapa);

// ---------------------------------------------------------------------------
// Panel lateral
// ---------------------------------------------------------------------------

function seleccionar(m: { tipo: 'aviso' | 'unidad'; id: string } | null, centrar: boolean): void {
  seleccion = m;
  if (m && centrar) {
    const punto = m.tipo === 'aviso' ? avisos.get(m.id) : unidades.find((u) => u.id === m.id);
    if (punto && punto.x !== null && punto.z !== null) centrarEn(punto.x, punto.z);
  }
  if (m?.tipo === 'aviso') mostrarPestana('avisos');
  pintarAvisos();
  pedirDibujo();
}

function mostrarPestana(nombre: 'avisos' | 'unidades'): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.pestana')) b.classList.toggle('activa', b.dataset.pestana === nombre);
  ui.panelAvisos.hidden = nombre !== 'avisos';
  ui.panelUnidades.hidden = nombre !== 'unidades';
}
for (const b of document.querySelectorAll<HTMLButtonElement>('.pestana')) {
  b.addEventListener('click', () => mostrarPestana(b.dataset.pestana === 'unidades' ? 'unidades' : 'avisos'));
}

async function accion(a: AvisoCad, tipo: 'atender' | 'cerrar'): Promise<void> {
  pendientes.add(a.id);
  pintarAvisos();
  const res = await window.cad.accion(a.id, tipo);
  pendientes.delete(a.id);
  aviso(res.ok ? (tipo === 'atender' ? `Aviso #${a.numero} atendido.` : `Aviso #${a.numero} cerrado.`) : (res.error ?? 'No se pudo hacer.'));
  pintarAvisos();
}

function boton(texto: string, clase: string, alPulsar: () => void, desactivado: boolean): HTMLButtonElement {
  const b = elemento('button', clase, texto);
  b.type = 'button';
  b.disabled = desactivado;
  b.addEventListener('click', (e) => {
    e.stopPropagation(); // que no seleccione la tarjeta
    alPulsar();
  });
  return b;
}

function pintarAvisos(): void {
  const lista = [...avisos.values()].sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || b.creado - a.creado);
  const items = lista.map((a) => {
    const li = elemento('li', `tarjeta ${a.estado}${seleccion?.tipo === 'aviso' && seleccion.id === a.id ? ' seleccionada' : ''}`);
    const cabecera = elemento('div', 'tarjeta-cabecera');
    cabecera.append(
      elemento('span', 'tarjeta-num', `#${a.numero}`),
      elemento('span', 'tarjeta-tipo', `${a.emoji} ${a.tipo}`),
      elemento('span', 'estado', TEXTO_ESTADO[a.estado]),
      elemento('span', 'tarjeta-hora', haceCuanto(a.creado)),
    );
    li.append(
      cabecera,
      elemento('p', 'tarjeta-ubicacion', `📍 ${a.ubicacion ?? 'Sin dirección'}${a.x === null ? ' · sin posición en el mapa' : ''}`),
      elemento('p', 'tarjeta-texto', a.descripcion),
      elemento('p', 'tarjeta-llamante', `Llama: ${a.llamante} · ${a.origen === 'juego' ? 'llamada del juego' : 'consola de rol'}`),
    );
    if (a.unidades.length > 0) {
      const chips = elemento('div', 'chips');
      for (const u of a.unidades) chips.append(elemento('span', `chip ${u.servicio}`, `${nombreUnidad(u)}${u.distancia !== null ? ` · ${u.distancia} m` : ''}`));
      li.append(chips);
    }
    if (a.estado !== 'cerrado') {
      const acciones = elemento('div', 'tarjeta-acciones');
      const ocupado = pendientes.has(a.id);
      if (a.estado === 'abierto') acciones.append(boton('Atender', 'boton primario', () => void accion(a, 'atender'), ocupado));
      acciones.append(boton('Cerrar', 'boton', () => void accion(a, 'cerrar'), ocupado));
      li.append(acciones);
    }
    li.addEventListener('click', () => seleccionar({ tipo: 'aviso', id: a.id }, true));
    return li;
  });
  ui.listaAvisos.replaceChildren(...items);
  const abiertos = lista.filter((a) => a.estado !== 'cerrado').length;
  ui.sinAvisos.hidden = lista.length > 0;
  ui.pestanaAvisos.textContent = String(abiertos);
  ui.numAvisos.textContent = String(abiertos);
}

function pintarUnidades(): void {
  const items: HTMLElement[] = [];
  for (const [servicio, titulo] of [
    ['policia', 'Policía'],
    ['bomberos', 'Bomberos / sanitarios'],
  ] as const) {
    const grupo = unidades.filter((u) => u.servicio === servicio);
    if (grupo.length === 0) continue;
    items.push(elemento('li', 'grupo', `${titulo} · ${grupo.length}`));
    for (const u of grupo) {
      const li = elemento('li', `unidad ${u.servicio}`);
      const datos = elemento('div', 'unidad-datos');
      const nombre = elemento('div', 'unidad-nombre');
      if (u.indicativo) nombre.append(elemento('span', 'unidad-indicativo', u.indicativo));
      nombre.append(document.createTextNode(u.nombre));
      if (u.id === miRobloxId) nombre.append(elemento('span', 'unidad-tu', 'Tú'));
      datos.append(nombre, elemento('div', 'unidad-ubicacion', u.ubicacion ?? 'Sin dirección'));
      li.append(datos, elemento('span', `unidad-estado${u.aviso !== null ? ' ocupada' : ''}`, u.aviso !== null ? `Aviso #${u.aviso}` : 'Libre'));
      li.addEventListener('click', () => seleccionar({ tipo: 'unidad', id: u.id }, true));
      items.push(li);
    }
  }
  ui.listaUnidades.replaceChildren(...items);
  ui.sinUnidades.hidden = unidades.length > 0;
  ui.pestanaUnidades.textContent = String(unidades.length);
  ui.numPolicia.textContent = String(unidades.filter((u) => u.servicio === 'policia').length);
  ui.numBomberos.textContent = String(unidades.filter((u) => u.servicio === 'bomberos').length);
}

function pintarErlc(): void {
  if (!estadoErlc || pantallaAnterior !== 'cad') {
    ui.erlc.hidden = true;
    return;
  }
  ui.erlc.hidden = false;
  ui.erlc.className = `pastilla erlc ${estadoErlc === 'ok' ? 'ok' : estadoErlc === 'limitado' ? 'aviso-erlc' : 'mal'}`;
  const segundos = Math.round((Date.now() - ultimaPosicion) / 1000);
  ui.erlcTexto.textContent = estadoErlc === 'ok' ? `${TEXTO_ERLC.ok} · hace ${segundos} s` : TEXTO_ERLC[estadoErlc];
}
// Tiempos relativos: barato y sin repintar el mapa.
setInterval(pintarErlc, 5_000);
setInterval(pintarAvisos, 30_000);

// ---------------------------------------------------------------------------
// Marca del MDT («Ver en el CAD»)
// ---------------------------------------------------------------------------

/*
 * Los MDT son otra web del portal (`/emergencias/guardia-civil/`, `/samu/`). Su botón «Ver en el CAD» manda aquí la posición de la persona
 * consultada: por `BroadcastChannel` si este CAD está abierto en el mismo navegador, o en la
 * dirección (`#marca=x,z,nombre`) si abre uno nuevo. La posición ya viene consultada (y registrada)
 * por el MDT: el CAD solo la pinta.
 */
const COORD_MAX = 100_000;

function ponerMarca(x: number, z: number, nombre: string): void {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > COORD_MAX || Math.abs(z) > COORD_MAX) return;
  const limpio = nombre.replace(/[\u0000-\u001f]/g, '').slice(0, 80) || 'Persona';
  marcaMdt = { x, z, nombre: limpio };
  ui.marcaTexto.textContent = `${limpio} · posición consultada a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  ui.marcaMdt.hidden = false;
  vistaMovida = true;
  centrarEn(x, z);
  pedirDibujo();
}

ui.btnQuitarMarca.addEventListener('click', () => {
  marcaMdt = null;
  ui.marcaMdt.hidden = true;
  pedirDibujo();
});

if ('BroadcastChannel' in window) {
  const canal = new BroadcastChannel('ibiza-cad-mdt');
  canal.onmessage = (e: MessageEvent<MensajeMdtCad>) => {
    const m = e.data;
    if (m?.tipo !== 'marca' || typeof m.nombre !== 'string' || pantallaAnterior !== 'cad') return;
    ponerMarca(m.x, m.z, m.nombre);
    canal.postMessage({ tipo: 'marca-recibida' } satisfies MensajeMdtCad);
  };
}

/** `#marca=x,z,nombre` (CAD abierto desde el MDT): se pinta en cuanto el mapa está listo. */
function marcaDelEnlace(): void {
  const valor = new URLSearchParams(location.hash.slice(1)).get('marca');
  if (!valor) return;
  history.replaceState(null, '', location.pathname + location.search);
  const [x, z, ...resto] = valor.split(',');
  const nombre = resto.join(',');
  requestAnimationFrame(() => ponerMarca(Number(x), Number(z), nombre));
}

// El portal de emergencias (`/emergencias/`) se abre en su propia pestaña y el CAD sigue abierto:
// así el MDT puede marcar en él. Con nombre, para que el portal y los MDT lo reutilicen.
if (!window.name) window.name = 'ibiza-cad';
ui.btnEmergencias.addEventListener('click', () => window.open('../', 'ibiza-emergencias'));

// ---------------------------------------------------------------------------
// Tu posición
// ---------------------------------------------------------------------------

function pintarYo(): void {
  ui.yo.hidden = pantallaAnterior !== 'cad' || estadoErlc === null;
  ui.btnYo.disabled = !yo;
  if (!yo) {
    ui.yoTexto.textContent = miRobloxId ? 'No estás dentro del servidor de ER:LC.' : 'Vincula tu cuenta de Roblox con /verificar para verte en el mapa.';
    return;
  }
  ui.yoTexto.textContent = `Tú · ${yo.ubicacion ?? 'sin dirección'}${yo.equipo ? ` · ${yo.equipo}` : ''}`;
}

/** La primera vez que llega tu posición, el mapa se centra en ti. */
let yaCentradoEnMi = false;
ui.btnYo.addEventListener('click', () => {
  if (yo) centrarEn(yo.x, yo.z);
});

// ---------------------------------------------------------------------------
// Ventana flotante (siempre encima)
// ---------------------------------------------------------------------------

/*
 * Chrome y Edge de escritorio: saca el CAD a una ventana siempre encima, también por encima de
 * Roblox en pantalla completa sin bordes, con la API Document Picture-in-Picture. Se MUEVE el mismo
 * mapa con sus listeners, así que todo funciona igual; la conexión sigue viviendo en esta pestaña,
 * por eso no se puede cerrar. En el móvil la API no existe y el botón no aparece.
 */
let flotante: Window | null = null;

function actualizarBotonFlotante(): void {
  ui.btnFlotante.hidden = !window.documentPictureInPicture || pantallaAnterior !== 'cad';
  ui.btnFlotante.title = flotante ? 'Volver a la pestaña' : 'Ventana flotante (siempre encima)';
  ui.btnFlotante.classList.toggle('activo', !!flotante);
}

/**
 * Extensiones del navegador (p. ej. las de atajos tipo Vim y su aviso «Insert mode») meten sus
 * propios elementos en la ventana flotante, que es pequeña y está siempre encima: allí tapan el mapa.
 * En esa ventana solo se deja lo nuestro; en la pestaña normal no se toca nada.
 */
function soloLoNuestro(ventana: Window, propio: Element): void {
  const doc = ventana.document;
  const limpiar = () => {
    const sueltos = [...Array.from(doc.documentElement.children), ...Array.from(doc.body?.children ?? [])];
    for (const el of sueltos) if (el !== doc.head && el !== doc.body && el !== propio) el.remove();
  };
  limpiar();
  const vigia = new MutationObserver(limpiar);
  vigia.observe(doc.documentElement, { childList: true });
  if (doc.body) vigia.observe(doc.body, { childList: true });
  ventana.addEventListener('pagehide', () => vigia.disconnect(), { once: true });
}

async function abrirFlotante(): Promise<void> {
  const api = window.documentPictureInPicture;
  if (!api || flotante) return;
  let ventana: Window;
  try {
    // Sin ningún `await` antes: el navegador solo la abre como respuesta directa a un clic.
    ventana = await api.requestWindow({ width: 560, height: 680 });
  } catch {
    aviso('El navegador no ha dejado abrir la ventana flotante.');
    return;
  }
  flotante = ventana;
  ventana.addEventListener('pagehide', devolverCad, { once: true });
  // La misma hoja de estilos (con su `?v=` de versión), por URL: la CSP no admite estilos en línea.
  const estilos = ventana.document.createElement('link');
  estilos.rel = 'stylesheet';
  estilos.href = document.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')?.href ?? new URL('styles.css', location.href).href;
  const cargados = new Promise((listo) => {
    estilos.onload = listo;
    estilos.onerror = listo;
  });
  ventana.document.head.append(estilos);
  ventana.document.title = document.title;
  await cargados;
  if (flotante !== ventana) return; // la han cerrado mientras cargaba
  ventana.document.body.className = 'flotante';
  ventana.document.body.append(ui.cad);
  soloLoNuestro(ventana, ui.cad);
  ventana.addEventListener('resize', pedirDibujo);
  ui.avisoFlotante.hidden = false;
  actualizarBotonFlotante();
  pedirDibujo();
}

/** Al cerrarse la ventana flotante (con su botón o con el nuestro), el CAD vuelve a la pestaña. */
function devolverCad(): void {
  flotante = null;
  // El fotograma pedido a la ventana cerrada ya no llegará.
  dibujoPendiente = false;
  document.body.insertBefore(ui.cad, ui.login);
  ui.avisoFlotante.hidden = true;
  actualizarBotonFlotante();
  pedirDibujo();
}

ui.btnFlotante.addEventListener('click', () => {
  if (flotante) flotante.close();
  else void abrirFlotante();
});
ui.btnTraer.addEventListener('click', () => flotante?.close());

// ---------------------------------------------------------------------------
// Acceso y eventos
// ---------------------------------------------------------------------------

let pantallaAnterior: 'cad' | 'login' | null = null;

function aplicarEstado(estado: EstadoCad): void {
  ui.conexion.className = `pastilla conexion ${estado.conexion}`;
  ui.conexionTexto.textContent = TEXTO_CONEXION[estado.conexion];
  const dentro = estado.conSesion || estado.conexion !== 'desconectado';
  document.body.classList.toggle('sin-sesion', !dentro);
  ui.cad.hidden = !dentro;
  ui.login.hidden = dentro;
  ui.contadores.hidden = !dentro;
  ui.btnSalir.hidden = !dentro;
  ui.miNombre.textContent = dentro ? (estado.nombre ?? '') : '';
  if (estado.robloxId !== miRobloxId) {
    miRobloxId = estado.robloxId;
    pintarUnidades();
  }
  // El portal de emergencias es para todos los que entran al CAD.
  ui.btnEmergencias.hidden = !dentro;
  const pantalla = dentro ? 'cad' : 'login';
  if (pantalla !== pantallaAnterior) {
    if (pantalla === 'login') {
      flotante?.close();
      ui.codigo.focus();
    } else {
      cargarMapa();
      requestAnimationFrame(() => (vistaLista ? pedirDibujo() : encajar()));
    }
  }
  pantallaAnterior = pantalla;
  actualizarBotonFlotante();
  pintarErlc();
  pintarYo();
}

ui.btnLogin.addEventListener('click', async () => {
  ui.loginAviso.textContent = 'Conectando…';
  const res = await window.cad.login(ui.codigo.value);
  ui.loginAviso.textContent = res.ok ? '' : (res.error ?? 'No se pudo entrar.');
  if (res.ok) ui.codigo.value = '';
});
ui.codigo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ui.btnLogin.click();
});
ui.btnSalir.addEventListener('click', async () => {
  await window.cad.cerrarSesion();
  avisos.clear();
  unidades = [];
  seleccion = null;
  estadoErlc = null;
  yo = null;
  yaCentradoEnMi = false;
  vistaMovida = false;
  marcaMdt = null;
  ui.marcaMdt.hidden = true;
  pintarAvisos();
  pintarUnidades();
  pintarErlc();
  pintarYo();
  pedirDibujo();
});

window.cad.alEvento((evento) => {
  switch (evento.tipo) {
    case 'estado':
      aplicarEstado(evento.estado);
      break;
    case 'avisos':
      avisos.clear();
      for (const a of evento.avisos) avisos.set(a.id, a);
      pintarAvisos();
      pedirDibujo();
      break;
    case 'aviso': {
      const nuevo = !avisos.has(evento.aviso.id);
      avisos.set(evento.aviso.id, evento.aviso);
      if (nuevo && evento.aviso.estado === 'abierto') aviso(`🚨 Nuevo aviso #${evento.aviso.numero}: ${evento.aviso.tipo}.`);
      pintarAvisos();
      pedirDibujo();
      break;
    }
    case 'unidades': {
      moverA(evento.unidades.unidades, ahoraMs(), true);
      unidades = evento.unidades.unidades;
      estadoErlc = evento.unidades.estado;
      ultimaPosicion = evento.unidades.at;
      // Sin posiciones (ER:LC apagado o sin API) tampoco hay la tuya.
      if (estadoErlc !== 'ok') yo = null;
      pintarUnidades();
      pintarErlc();
      pintarYo();
      pedirDibujo();
      break;
    }
    case 'yo':
      yo = evento.yo;
      if (yo) moverA([{ id: 'yo', x: yo.x, z: yo.z }], ahoraMs(), false);
      // La primera vez, el mapa se centra en ti (si aún no lo has movido tú).
      if (yo && !yaCentradoEnMi && !vistaMovida) {
        yaCentradoEnMi = true;
        centrarEn(yo.x, yo.z);
      }
      pintarYo();
      pedirDibujo();
      break;
    case 'lugares':
      lugares = evento.lugares;
      pedirDibujo();
      break;
    case 'error':
      ui.loginAviso.textContent = evento.mensaje;
      aviso(evento.mensaje);
      break;
    case 'expulsado':
      ui.loginAviso.textContent = 'Tu sesión se ha cerrado o ya no tienes acceso al CAD. Vuelve a Emergencias o pide un código nuevo con /consola codigo.';
      break;
  }
});

void window.cad.estado().then(aplicarEstado);
marcaDelEnlace();
// El MDT puede reabrir este mismo CAD solo cambiando el `#marca=`: entonces no se recarga.
window.addEventListener('hashchange', marcaDelEnlace);
pintarAvisos();
pintarUnidades();
