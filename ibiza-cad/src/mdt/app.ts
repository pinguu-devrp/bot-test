/**
 * Interfaz del portal de emergencias (Ibiza Roleplay) y de sus MDT. La misma página sirve el portal
 * (`/emergencias/`) y el MDT de cada servicio (`/emergencias/guardia-civil/`, `/samu/` y
 * `/bombers/`): sabe cuál es por la dirección. Dentro de cada MDT, páginas con su ruta (`#/`,
 * `#/personas`, `#/persona/<id>`, `#/informes`, `#/informe/<id>`, `#/nuevo/<plantilla>`…) y barra
 * de navegación abajo, en un marco de tablet.
 *
 * Qué aplicaciones se ven lo decide el bot por los roles (y lo vuelve a mirar en cada consulta): la
 * dirección no da permisos. Todo se pinta con `textContent`: nada de lo que llega del bot se
 * interpreta como HTML.
 */

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el as T;
}

function h<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase = '', texto = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;
  return el;
}

const ui = {
  hora: $<HTMLSpanElement>('hora'),
  franja: $<HTMLSpanElement>('franja'),
  barraTitulo: $<HTMLSpanElement>('barra-titulo'),
  conexion: $<HTMLSpanElement>('conexion'),
  conexionTexto: $<HTMLSpanElement>('conexion-texto'),
  marcaTitulo: $<HTMLSpanElement>('marca-titulo'),
  agente: $<HTMLSpanElement>('agente'),
  btnApps: $<HTMLAnchorElement>('btn-apps'),
  btnSalir: $<HTMLButtonElement>('btn-salir'),
  contenido: $<HTMLElement>('contenido'),
  navegacion: $<HTMLElement>('navegacion'),
  navCad: $<HTMLButtonElement>('nav-cad'),
  login: $<HTMLElement>('login'),
  loginEtiqueta: $<HTMLSpanElement>('login-etiqueta'),
  loginTitulo: $<HTMLHeadingElement>('login-titulo'),
  codigo: $<HTMLInputElement>('codigo'),
  btnLogin: $<HTMLButtonElement>('btn-login'),
  loginAviso: $<HTMLParagraphElement>('login-aviso'),
};

// Logo del servidor: si no carga, queda la insignia «IR».
for (const logo of document.querySelectorAll<HTMLImageElement>('.logo, .login-logo')) {
  logo.addEventListener('error', () => {
    logo.remove();
    document.body.classList.add('sin-logo');
  });
}

const TEXTO_CONEXION: Record<EstadoConexionCad, string> = {
  desconectado: 'Desconectado',
  conectando: 'Conectando…',
  conectado: 'En línea',
  reconectando: 'Reconectando…',
};

const euros = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
const fecha = (ts: number) => new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Cuándo se vio algo: «hace 5 min», «hoy a las 18:40», «ayer a las 23:09» o «el 25/10 a las 18:00». */
function cuando(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const d = new Date(ts);
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hoy = new Date();
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return `hoy a las ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `ayer a las ${hora}`;
  return `el ${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} a las ${hora}`;
}

/** Un momento futuro: «hoy a las 18:40», «mañana a las 09:15» o «el 30/10 a las 18:00». */
function hasta(ts: number): string {
  const d = new Date(ts);
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const hoy = new Date();
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  if (d.toDateString() === hoy.toDateString()) return `hoy a las ${hora}`;
  if (d.toDateString() === manana.toDateString()) return `mañana a las ${hora}`;
  return `el ${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} a las ${hora}`;
}

/** Iconos de trazo (SVG en línea, sin archivos externos). */
const ICONOS: Record<string, string> = {
  casa: 'M4 11 12 4l8 7v9h-5v-6H9v6H4v-9Z',
  persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  coche: 'M5 16h14M6 16l1.5-5a2 2 0 0 1 1.9-1.4h5.2a2 2 0 0 1 1.9 1.4L18 16M5 16v3h3v-3M16 16v3h3v-3',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4',
  libro: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h10',
  informe: 'M7 3h8l4 4v14H7V3Zm8 0v4h4M10 12h6M10 16h6',
  orden: 'M12 3 4 7v5c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V7l-8-4Zm0 6v4m0 3h.01',
  escudo: 'M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6l-8-3Z',
  cruz: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  llama: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2-4.6.3 1.6 1.2 2.6 2.2 2.6C11 8.6 11 5.6 12 3Z',
  sirena: 'M7 18v-5a5 5 0 0 1 10 0v5M5 21h14M5 18h14M12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4',
  edificio: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M4 21h16',
  revision: 'M9 4h6v3H9V4ZM7 5H5v16h14V5h-2M9 13l2 2 4-4',
  pregunta: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.6-11.6a2.6 2.6 0 1 1 3.7 2.4c-.7.3-1.1.9-1.1 1.6v.6m0 3.2h.01',
  chevron: 'm9 6 6 6-6 6',
  mas: 'M12 5v14M5 12h14',
  atras: 'm15 6-6 6 6 6',
  mapa: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  ubicacion: 'M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
};

function icono(nombre: string, clase = 'icono'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', clase);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONOS[nombre] ?? '');
  svg.append(path);
  return svg;
}

// ---------------------------------------------------------------------------
// Aplicación (por la dirección)
// ---------------------------------------------------------------------------

type App = 'portal' | 'guardia-civil' | 'samu' | 'bombers';
type Pagina = 'inicio' | 'personas' | 'persona' | 'vehiculos' | 'requisitorias' | 'pacientes' | 'paciente' | 'locales' | 'informes' | 'informe' | 'nuevo';
type Servicio = 'sanitarios' | 'bomberos';

interface ConfigApp {
  /** Barra de estado y título de la pestaña. */
  titulo: string;
  /** Etiqueta de las portadas y del acceso. */
  etiqueta: string;
  /** Franja de color de la barra de estado. */
  franja: string;
  /** Complemento del MDT en frases, con su preposición («No tienes acceso al MDT del SAMU»). */
  servicio: string;
  /** Secciones de la barra de navegación (la primera es el inicio). */
  secciones: { pagina: Pagina; texto: string; icono: string }[];
  /** Informes que ve este MDT (y plantillas que se firman en él). */
  ambito: AmbitoInformeMdt | null;
  tipos: TipoInformeMdt[];
  puede(apps: AppsEmergencias): boolean;
}

const INICIO = { pagina: 'inicio', texto: 'Inicio', icono: 'casa' } as const;
const INFORMES = { pagina: 'informes', texto: 'Informes', icono: 'informe' } as const;

const APPS: Record<App, ConfigApp> = {
  portal: { titulo: 'Emergencias', etiqueta: 'Emergencias · Ibiza Roleplay', franja: 'franja-emergencias', servicio: '', secciones: [], ambito: null, tipos: [], puede: () => true },
  'guardia-civil': {
    titulo: 'Guardia Civil · MDT',
    etiqueta: 'Guardia Civil · Terminal de datos',
    franja: 'franja-gc',
    servicio: 'de la Guardia Civil',
    secciones: [
      INICIO,
      { pagina: 'personas', texto: 'Personas', icono: 'persona' },
      { pagina: 'vehiculos', texto: 'Vehículos', icono: 'coche' },
      { pagina: 'requisitorias', texto: 'Requisitorias', icono: 'orden' },
      INFORMES,
    ],
    ambito: 'guardiaCivil',
    tipos: ['denuncia', 'atestado'],
    puede: (a) => a.guardiaCivil,
  },
  samu: {
    titulo: 'SAMU · MDT',
    etiqueta: 'SAMU · Terminal sanitaria',
    franja: 'franja-samu',
    servicio: 'del SAMU',
    secciones: [INICIO, { pagina: 'pacientes', texto: 'Pacientes', icono: 'cruz' }, INFORMES],
    ambito: 'samu',
    tipos: ['asistencia'],
    puede: (a) => a.samu,
  },
  bombers: {
    titulo: 'Bombers · MDT',
    etiqueta: 'Bombers · Terminal de intervención',
    franja: 'franja-bombers',
    servicio: 'de Bombers',
    secciones: [INICIO, { pagina: 'locales', texto: 'Locales', icono: 'edificio' }, INFORMES],
    ambito: 'bombers',
    tipos: ['intervencion'],
    puede: (a) => a.bombers,
  },
};

const APP: App = (() => {
  const m = /\/(guardia-civil|samu|bombers)\/?$/.exec(location.pathname);
  return m ? (m[1] as App) : 'portal';
})();
const CONFIG = APPS[APP];
/** Raíz del portal (`/emergencias/`): los enlaces entre aplicaciones salen de aquí. */
const RAIZ = APP === 'portal' ? location.pathname.replace(/\/?$/, '/') : location.pathname.replace(/[^/]+\/?$/, '');

// El CAD abre el portal en esta pestaña («Emergencias» de su cabecera), y los MDT, el CAD en la suya.
if (!window.name) window.name = 'ibiza-emergencias';

document.title = `${CONFIG.titulo} · Ibiza Roleplay`;
ui.franja.className = `franja ${CONFIG.franja}`;
ui.barraTitulo.textContent = CONFIG.titulo;
ui.marcaTitulo.textContent = APP === 'portal' ? 'Emergencias' : 'MDT';
ui.loginEtiqueta.textContent = CONFIG.etiqueta;
ui.loginTitulo.textContent = APP === 'portal' ? 'Emergencias' : 'MDT';
ui.btnApps.href = RAIZ;
for (const s of CONFIG.secciones) {
  const a = h('a');
  a.href = s.pagina === 'inicio' ? '#/' : `#/${s.pagina}`;
  a.dataset.ruta = s.pagina;
  a.append(icono(s.icono), h('span', '', s.texto));
  ui.navegacion.insertBefore(a, ui.navCad);
}

const abrirCad = (hash = '') => window.open(`${RAIZ}cad/${hash}`, 'ibiza-cad');

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

let estadoActual: EstadoMdt = {
  conexion: 'desconectado',
  conSesion: false,
  nombre: null,
  apps: { cad: false, cadProximamente: false, guardiaCivil: false, samu: false, bombers: false },
  redactar: { guardiaCivil: false, samu: false, bombers: false },
  requisitorias: { emitir: false, ejecutar: false },
  inspeccionar: false,
  staff: false,
};
/** Últimas búsquedas: al volver de una ficha se ve lo mismo sin repetir la consulta. */
const cachePersonas = { q: '', lista: null as PersonaMdt[] | null, error: '' };
const cacheVehiculos = { q: '', lista: null as MatriculaMdt[] | null, error: '' };
/** Páginas del registro del concesionario vistas hace poco (1 min), por filtro y página. */
const cacheRegistro = new Map<string, { datos: RegistroVehiculosMdt; at: number }>();
const cacheLocales = { q: '', lista: null as LocalMdt[] | null, error: '', at: 0 };
/** Fichas abiertas hace poco (1 min): ir y volver no vuelve a consultar ni a registrar. */
const cacheFichas = new Map<string, { ficha: FichaMdt; at: number }>();
const cachePacientes = new Map<string, { ficha: PacienteSamuMdt; at: number }>();

/** Tarjeta de avisos del inicio del SAMU o de Bombers, que se refresca sola. */
let avisosVivos: { caja: HTMLElement; servicio: Servicio } | null = null;

const conocidas = (a: AppsEmergencias) => a.cad || a.guardiaCivil || a.samu || a.bombers;

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

type Ruta =
  | { pagina: 'inicio' | 'informes' }
  | { pagina: 'personas' | 'pacientes'; q: string }
  /** `revisar`: solo los locales ocupados cuya inspección no está al día. */
  | { pagina: 'locales'; q: string; revisar: boolean }
  /** `q`: búsqueda de matrícula; `r` y `p`: filtro y página del registro del concesionario. */
  | { pagina: 'vehiculos'; q: string; r: string; p: number }
  /** `todas`: también las ejecutadas y anuladas. */
  | { pagina: 'requisitorias'; todas: boolean }
  | { pagina: 'persona' | 'paciente' | 'informe'; id: string }
  | { pagina: 'nuevo'; tipo: TipoInformeMdt; persona: string | null; aviso: number | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** ¿Tiene esta aplicación esa página? (las fichas van con su búsqueda). */
function tienePagina(p: Pagina): boolean {
  if (p === 'persona') return APP === 'guardia-civil';
  if (p === 'paciente') return APP === 'samu';
  return CONFIG.secciones.some((s) => s.pagina === p);
}

function rutaActual(): Ruta {
  const [camino = '', consulta = ''] = location.hash.replace(/^#/, '').split('?');
  const q = (new URLSearchParams(consulta).get('q') ?? '').slice(0, 40);
  const [p0, p1] = camino.split('/').filter(Boolean);
  if (p0 === 'vehiculos' && tienePagina(p0)) {
    const params = new URLSearchParams(consulta);
    const p = Number(params.get('p') ?? '0');
    return { pagina: p0, q, r: (params.get('r') ?? '').slice(0, 40), p: Number.isInteger(p) && p >= 0 && p <= 500 ? p : 0 };
  }
  if ((p0 === 'personas' || p0 === 'pacientes') && tienePagina(p0)) return { pagina: p0, q };
  if (p0 === 'locales' && tienePagina(p0)) return { pagina: p0, q, revisar: new URLSearchParams(consulta).get('f') === 'revisar' };
  if (p0 === 'requisitorias' && tienePagina(p0)) return { pagina: p0, todas: new URLSearchParams(consulta).get('todas') === '1' };
  if ((p0 === 'persona' || p0 === 'paciente') && tienePagina(p0) && p1 && UUID.test(p1)) return { pagina: p0, id: p1 };
  if (p0 === 'informes' && tienePagina('informes')) return { pagina: 'informes' };
  if (p0 === 'informe' && CONFIG.ambito && p1 && UUID.test(p1)) return { pagina: 'informe', id: p1 };
  const tipo = CONFIG.tipos.find((t) => t === p1);
  if (p0 === 'nuevo' && tipo) {
    const params = new URLSearchParams(consulta);
    const persona = params.get('persona');
    const aviso = Number(params.get('aviso') ?? '');
    return { pagina: 'nuevo', tipo, persona: persona && UUID.test(persona) ? persona : null, aviso: Number.isInteger(aviso) && aviso > 0 && aviso <= 1e9 ? aviso : null };
  }
  return { pagina: 'inicio' };
}

const ir = (hash: string) => {
  if (location.hash === hash) void pintar();
  else location.hash = hash;
};

window.addEventListener('hashchange', () => void pintar());

// ---------------------------------------------------------------------------
// Piezas comunes de las páginas
// ---------------------------------------------------------------------------

function encabezado(etiqueta: string, titulo: string, subtitulo?: string): HTMLElement {
  const cab = h('header', 'pagina-cabecera');
  const eti = h('p', 'etiqueta');
  eti.append(h('span', 'etiqueta-punto'), document.createTextNode(etiqueta));
  cab.append(eti, h('h1', 'pagina-titulo', titulo));
  if (subtitulo) cab.append(h('p', 'pagina-sub', subtitulo));
  return cab;
}

function tarjeta(clase = ''): HTMLElement {
  return h('section', `tarjeta ${clase}`.trim());
}

function tituloTarjeta(texto: string, iconoNombre?: string, extra?: string): HTMLElement {
  const t = h('div', 'tarjeta-titulo');
  if (iconoNombre) t.append(icono(iconoNombre, 'icono icono-titulo'));
  t.append(h('h2', '', texto));
  if (extra) t.append(h('span', 'tarjeta-extra', extra));
  return t;
}

function insignia(conectado: boolean): HTMLSpanElement {
  return h('span', `insignia${conectado ? ' en-linea' : ''}`, conectado ? 'En el servidor' : 'Desconectado');
}

/** Insignias de un resultado de búsqueda: conexión y, para la Guardia Civil, si está en busca y captura. */
function insignias(p: PersonaMdt, conBuscado: boolean): HTMLElement {
  const caja = h('span', 'insignias');
  if (conBuscado && p.buscado) caja.append(h('span', 'insignia buscado', 'Buscado'));
  caja.append(insignia(p.conectado));
  return caja;
}

function botonAccion(texto: string, clase: string, alPulsar: () => void): HTMLButtonElement {
  const b = h('button', `boton ${clase}`.trim(), texto);
  b.type = 'button';
  b.addEventListener('click', alPulsar);
  return b;
}

/** Línea de documentación de un coche: en regla (con su matrícula registrada) o sin documentación. */
function lineaDocumentacion(v: Pick<VehiculoMdt, 'documentacion' | 'matriculaRegistrada' | 'matricula'>): HTMLParagraphElement {
  if (v.documentacion === 'en-regla') {
    const registrada = v.matriculaRegistrada ?? '';
    const distinta = registrada && v.matricula && v.matricula.toUpperCase().replace(/[^A-Z0-9]/g, '') !== registrada.replace(' ', '');
    return h('p', 'vehiculo-doc en-regla', `✅ Documentación en regla · matrícula registrada ${registrada}${distinta ? ' (en el juego lleva otra)' : ''}`);
  }
  if (v.documentacion === 'sin-documentacion') return h('p', 'vehiculo-doc sin-documentacion', '⚠️ Sin documentación: su dueño no ha comprado este modelo');
  return h('p', 'vehiculo-doc', 'Documentación: sin datos');
}

function muestraColor(hex: string | null): HTMLSpanElement {
  const muestra = h('span', 'color');
  // CSSOM, no un atributo `style`: lo permite la CSP estricta.
  if (hex) muestra.style.backgroundColor = hex;
  else muestra.classList.add('sin-color');
  return muestra;
}

/**
 * Buscador: campo + botón. Al enviar navega a la ruta con `?q=` (así «atrás» funciona). Con
 * `vacioVale`, enviarlo vacío también busca (los locales: sin texto salen todos).
 */
function buscador(seccion: string, valor: string, placeholder: string, vacioVale = false): HTMLElement {
  const form = h('form', 'buscador');
  form.autocomplete = 'off';
  const campo = h('input', 'campo');
  campo.type = 'search';
  campo.maxLength = 40;
  campo.spellcheck = false;
  campo.value = valor;
  campo.placeholder = placeholder;
  const boton = h('button', 'boton primario');
  boton.type = 'submit';
  boton.append(icono('buscar'), document.createTextNode('Buscar'));
  form.append(campo, boton);
  form.addEventListener('submit', (e) => {
    e.preventDefault(); // la CSP no deja enviar formularios: todo va por el socket
    const q = campo.value.trim();
    if (q) ir(`#/${seccion}?q=${encodeURIComponent(q)}`);
    else if (vacioVale) ir(`#/${seccion}`);
  });
  queueMicrotask(() => campo.focus({ preventScroll: true }));
  return form;
}

function fila(numero: number, titulo: string, detalle: string, derecha: HTMLElement | null, alPulsar: (() => void) | null): HTMLLIElement {
  const li = h('li', `fila${alPulsar ? ' pulsable' : ''}`);
  li.append(h('span', 'fila-num', String(numero)));
  const textos = h('div', 'fila-textos');
  textos.append(h('p', 'fila-titulo', titulo), h('p', 'fila-detalle', detalle));
  li.append(textos);
  if (derecha) li.append(derecha);
  if (alPulsar) {
    li.append(icono('chevron', 'icono fila-chevron'));
    li.tabIndex = 0;
    li.addEventListener('click', alPulsar);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') alPulsar();
    });
  }
  return li;
}

function mensaje(texto: string, clase = 'mensaje'): HTMLParagraphElement {
  return h('p', clase, texto);
}

/** Accesos de una portada: enlace a una sección, o «Próximamente» si aún no existe. */
function accesos(lista: { titulo: string; texto: string; icono: string; hash: string | null }[]): HTMLElement {
  const caja = h('div', 'accesos');
  for (const { titulo, texto, icono: ico, hash } of lista) {
    const a = h(hash ? 'a' : 'div', `acceso${hash ? '' : ' proximamente'}`);
    if (hash && a instanceof HTMLAnchorElement) a.href = hash;
    const cab = h('div', 'acceso-icono');
    cab.append(icono(ico));
    a.append(cab, h('p', 'acceso-titulo', titulo), h('p', 'acceso-texto', hash ? texto : 'Próximamente'));
    caja.append(a);
  }
  return caja;
}

function notaRegistro(): HTMLElement {
  const aviso = tarjeta('tarjeta-aviso');
  aviso.append(mensaje('Cada búsqueda, ficha e informe que abres queda registrado con tu nombre. Consulta solo lo que necesites para el servicio.', 'mensaje tenue'));
  return aviso;
}

// ---------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------

function paginaPortal(): HTMLElement[] {
  const a = estadoActual.apps;
  const saludo = estadoActual.nombre ? `Hola, ${estadoActual.nombre}` : 'Hola';
  const cabecera = encabezado(CONFIG.etiqueta, saludo, 'Elige una aplicación. Solo ves las de tu servicio.');
  if (!conocidas(a)) {
    const t = tarjeta();
    t.append(mensaje(estadoActual.conexion === 'conectado' ? 'No tienes ninguna aplicación de emergencias.' : 'Comprobando tus permisos…', 'mensaje tenue'));
    return [cabecera, t];
  }
  const rejilla = h('div', 'apps');
  const app = (clase: string, ico: string, titulo: string, texto: string, href: string, otraPestana = false) => {
    const el = h('a', `app ${clase}`);
    el.href = href;
    // El CAD en su propia pestaña: así sigue abierto mientras usas un MDT, y «Ver en el CAD» marca en él.
    if (otraPestana) el.target = 'ibiza-cad';
    const cab = h('div', 'app-icono');
    cab.append(icono(ico));
    el.append(cab, h('p', 'app-titulo', titulo), h('p', 'app-texto', texto));
    if (otraPestana) el.append(h('span', 'app-nota', 'Se abre en otra pestaña'));
    return el;
  };
  if (a.cad) rejilla.append(app('app-cad', 'mapa', 'CAD', 'Mapa en directo con las unidades y los avisos.', `${RAIZ}cad/`, true));
  else if (a.cadProximamente) rejilla.append(cadProximamente());
  if (a.guardiaCivil) rejilla.append(app('app-gc', 'escudo', 'Guardia Civil', 'Fichas de personas y matrículas.', `${RAIZ}guardia-civil/`));
  if (a.samu) rejilla.append(app('app-samu', 'cruz', 'SAMU', 'Avisos sanitarios y fichas de pacientes.', `${RAIZ}samu/`));
  if (a.bombers) rejilla.append(app('app-bombers', 'llama', 'Bombers', 'Incendios, rescates y locales.', `${RAIZ}bombers/`));
  return [cabecera, rejilla, notaRegistro()];
}

/**
 * El CAD mientras es solo del staff: sin enlace y sin nombrarlo (ni el nombre ni el icono del
 * mapa), solo «Próximamente» con pistas de lo que viene.
 */
function cadProximamente(): HTMLElement {
  const el = h('div', 'app app-pronto proximamente');
  el.setAttribute('aria-disabled', 'true');
  const ico = h('div', 'app-icono');
  ico.append(icono('pregunta'));
  el.append(
    ico,
    h('p', 'app-titulo', 'Próximamente'),
    h('p', 'app-pistas', '🗺️ 📡 🚓 🚒 🚑 ⏱️'),
    h('p', 'app-texto', 'Algo se está cocinando en la central… 👀'),
    h('span', 'app-nota', '🔒 En pruebas con el staff'),
  );
  return el;
}

function paginaSinAcceso(): HTMLElement[] {
  const t = tarjeta();
  const volver = h('a', 'boton primario', 'Volver a Emergencias');
  volver.href = RAIZ;
  const acciones = h('div', 'acciones');
  acciones.append(volver);
  t.append(mensaje(`No tienes acceso al MDT ${CONFIG.servicio}: solo lo ven su servicio y el staff.`), acciones);
  return [encabezado(CONFIG.etiqueta, 'Sin acceso'), t];
}

// ---------------------------------------------------------------------------
// Guardia Civil
// ---------------------------------------------------------------------------

function paginaInicio(): HTMLElement[] {
  const nombre = estadoActual.nombre ?? 'agente';
  const rapida = tarjeta();
  rapida.append(tituloTarjeta('Búsqueda rápida', 'buscar'), buscador('personas', '', 'Nombre y apellidos o DNI/NIE'));
  return [
    encabezado(CONFIG.etiqueta, `Hola, ${nombre}`, 'Consulta fichas de personas y vehículos del servidor.'),
    rapida,
    accesos([
      { titulo: 'Personas', texto: 'Fichas por nombre y apellidos o DNI/NIE', icono: 'persona', hash: '#/personas' },
      { titulo: 'Vehículos', texto: 'Matrículas en directo y vistas', icono: 'coche', hash: '#/vehiculos' },
      { titulo: 'Informes', texto: 'Denuncias y atestados de detención', icono: 'informe', hash: '#/informes' },
      { titulo: 'Código penal', texto: '', icono: 'libro', hash: null },
      { titulo: 'Requisitorias', texto: 'Órdenes de busca y captura de jueces y fiscales', icono: 'orden', hash: '#/requisitorias' },
    ]),
    notaRegistro(),
  ];
}

/** Búsqueda de personas (Guardia Civil) o de pacientes (SAMU): misma lista, cada uno con su ficha. */
async function paginaPersonas(q: string): Promise<HTMLElement[]> {
  const samu = APP === 'samu';
  const caja = tarjeta();
  caja.append(tituloTarjeta(samu ? 'Buscar paciente' : 'Buscar persona', samu ? 'cruz' : 'persona'), buscador(samu ? 'pacientes' : 'personas', q, 'Nombre y apellidos o DNI/NIE'));
  const resultados = tarjeta();
  if (!q) {
    resultados.append(mensaje('Escribe un nombre y apellidos o un DNI/NIE.', 'mensaje tenue'));
  } else {
    if (cachePersonas.q !== q || (!cachePersonas.lista && !cachePersonas.error)) {
      cachePersonas.q = q;
      cachePersonas.lista = null;
      cachePersonas.error = '';
      resultados.append(mensaje('Buscando…', 'mensaje tenue'));
      const res = samu ? await window.mdt.pacientes(q) : await window.mdt.personas(q);
      if (res.ok) cachePersonas.lista = res.datos;
      else cachePersonas.error = res.error;
      resultados.replaceChildren();
    }
    if (cachePersonas.error) {
      resultados.append(mensaje(cachePersonas.error, 'mensaje error'));
    } else {
      const lista = cachePersonas.lista ?? [];
      resultados.append(tituloTarjeta(`${lista.length} resultado${lista.length === 1 ? '' : 's'}`, undefined, `«${q}»`));
      if (lista.length === 0) resultados.append(mensaje('Nadie coincide con esa búsqueda.', 'mensaje tenue'));
      const ul = h('ul', 'filas');
      lista.forEach((p, i) =>
        ul.append(
          fila(i + 1, p.nombre, `${p.documento} · ${p.edad} años${p.roblox ? ` · Roblox: ${p.roblox}` : ''}`, insignias(p, !samu), () =>
            ir(`#/${samu ? 'paciente' : 'persona'}/${p.id}`),
          ),
        ),
      );
      resultados.append(ul);
    }
  }
  return [samu ? encabezado(CONFIG.etiqueta, 'Pacientes') : encabezado('Registro de personas', 'Personas'), caja, resultados];
}

/** Dirección de la página de vehículos con su búsqueda de matrícula y el filtro y la página del registro. */
function hashVehiculos(q: string, r: string, p: number): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (r) params.set('r', r);
  if (p > 0) params.set('p', String(p));
  const s = params.toString();
  return s ? `#/vehiculos?${s}` : '#/vehiculos';
}

/** Registro del concesionario: todos los coches comprados, con filtro y por páginas. */
function tarjetaRegistro(q: string, r: string, p: number): HTMLElement {
  const caja = tarjeta();
  const form = h('form', 'buscador');
  form.autocomplete = 'off';
  const campo = h('input', 'campo');
  campo.type = 'search';
  campo.maxLength = 40;
  campo.spellcheck = false;
  campo.value = r;
  campo.placeholder = 'Modelo, matrícula o titular';
  const boton = h('button', 'boton');
  boton.type = 'submit';
  boton.append(icono('buscar'), document.createTextNode('Filtrar'));
  form.append(campo, boton);
  form.addEventListener('submit', (e) => {
    e.preventDefault(); // la CSP no deja enviar formularios: todo va por el socket
    ir(hashVehiculos(q, campo.value.trim().slice(0, 40), 0));
  });
  const cuerpo = h('div', 'registro-cuerpo');
  cuerpo.append(mensaje('Cargando el registro…', 'mensaje tenue'));
  caja.append(
    tituloTarjeta('Registro del concesionario', 'libro'),
    mensaje('Todos los coches comprados con /comprar-coche, del más nuevo al más antiguo. Pulsa uno para abrir la ficha de su titular.', 'mensaje nota'),
    form,
    cuerpo,
  );
  void cargarRegistro(cuerpo, q, r, p);
  return caja;
}

function enlacePagina(texto: string, destino: string | null): HTMLElement {
  if (!destino) return h('span', 'boton desactivado', texto);
  const a = h('a', 'boton', texto);
  a.href = destino;
  return a;
}

async function cargarRegistro(cuerpo: HTMLElement, q: string, r: string, p: number): Promise<void> {
  const clave = `${r}|${p}`;
  const guardado = cacheRegistro.get(clave);
  let datos: RegistroVehiculosMdt;
  if (guardado && Date.now() - guardado.at < 60_000) {
    datos = guardado.datos;
  } else {
    const res = await window.mdt.registroVehiculos(r, p);
    if (!cuerpo.isConnected) return; // ya se ha cambiado de página
    if (!res.ok) {
      cuerpo.replaceChildren(mensaje(res.error, 'mensaje error'));
      return;
    }
    datos = res.datos;
    cacheRegistro.set(clave, { datos, at: Date.now() });
  }
  // Sin `isConnected` aquí: desde la caché esto corre antes de que la tarjeta esté en la página, y
  // comprobarlo la dejaba en «Cargando…» para siempre. Pintar en una tarjeta ya quitada no hace nada.
  const paginas = Math.max(1, Math.ceil(datos.total / datos.porPagina));
  const piezas: HTMLElement[] = [h('p', 'fila-detalle', `${datos.total} coche${datos.total === 1 ? '' : 's'} registrado${datos.total === 1 ? '' : 's'}${r ? ` con «${r}»` : ''}`)];
  if (datos.vehiculos.length === 0) {
    piezas.push(mensaje(datos.pagina > 0 && datos.total > 0 ? 'Esa página no existe.' : r ? 'Ningún coche registrado coincide con ese filtro.' : 'Aún no se ha comprado ningún coche.', 'mensaje tenue'));
  } else {
    const ul = h('ul', 'filas');
    for (const v of datos.vehiculos) {
      const li = h('li', 'vehiculo pulsable');
      const cab = h('div', 'vehiculo-cabecera');
      cab.append(h('span', 'matricula', v.matricula), h('span', 'vehiculo-modelo', v.modelo));
      if (v.enDirecto) cab.append(h('span', 'insignia en-linea', 'En el servidor'));
      li.append(cab, h('p', 'vehiculo-titular', `Titular: ${v.dueno.nombre}`), h('p', 'fila-detalle', `Comprado el ${fecha(v.comprado)}`));
      const abrir = () => ir(`#/persona/${v.dueno.id}`);
      li.tabIndex = 0;
      li.addEventListener('click', abrir);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') abrir();
      });
      ul.append(li);
    }
    piezas.push(ul);
  }
  if (paginas > 1 || datos.pagina > 0) {
    const nav = h('div', 'acciones paginacion');
    nav.append(
      enlacePagina('Anterior', datos.pagina > 0 ? hashVehiculos(q, r, Math.min(datos.pagina - 1, paginas - 1)) : null),
      h('span', 'paginacion-texto', `Página ${datos.pagina + 1} de ${paginas}`),
      enlacePagina('Siguiente', datos.pagina + 1 < paginas ? hashVehiculos(q, r, datos.pagina + 1) : null),
    );
    piezas.push(nav);
  }
  cuerpo.replaceChildren(...piezas);
}

async function paginaVehiculos(q: string, r: string, p: number): Promise<HTMLElement[]> {
  const caja = tarjeta();
  caja.append(tituloTarjeta('Buscar matrícula', 'coche'), buscador('vehiculos', q, 'Matrícula o parte de ella'));
  const resultados = tarjeta();
  if (!q) {
    resultados.append(mensaje('Escribe la matrícula que ves en el juego, entera o un trozo. Primero salen los vehículos que están ahora en el servidor.', 'mensaje tenue'));
  } else {
    if (cacheVehiculos.q !== q || (!cacheVehiculos.lista && !cacheVehiculos.error)) {
      cacheVehiculos.q = q;
      cacheVehiculos.lista = null;
      cacheVehiculos.error = '';
      resultados.append(mensaje('Buscando…', 'mensaje tenue'));
      const res = await window.mdt.matriculas(q);
      if (res.ok) cacheVehiculos.lista = res.datos;
      else cacheVehiculos.error = res.error;
      resultados.replaceChildren();
    }
    if (cacheVehiculos.error) {
      resultados.append(mensaje(cacheVehiculos.error, 'mensaje error'));
    } else {
      const lista = cacheVehiculos.lista ?? [];
      resultados.append(tituloTarjeta(`${lista.length} vehículo${lista.length === 1 ? '' : 's'}`, undefined, `«${q}»`));
      if (lista.length === 0) resultados.append(mensaje('Ningún vehículo visto con esa matrícula.', 'mensaje tenue'));
      const ul = h('ul', 'filas');
      for (const m of lista) {
        const li = h('li', `vehiculo${m.dueno.id ? ' pulsable' : ''}`);
        const cab = h('div', 'vehiculo-cabecera');
        cab.append(h('span', 'matricula', m.matricula), h('span', 'vehiculo-modelo', m.modelo));
        if (m.enDirecto) cab.append(h('span', 'insignia en-linea', 'En el servidor'));
        const detalle = h('p', 'fila-detalle');
        detalle.append(muestraColor(m.colorHex), document.createTextNode(`${m.color ?? 'Color desconocido'} · ${m.enDirecto ? 'visto ahora' : `visto ${cuando(m.visto)}`}`));
        const titular = h('p', 'vehiculo-titular', m.dueno.nombre ? `Titular: ${m.dueno.nombre}` : `Roblox: ${m.dueno.roblox} · sin DNI`);
        li.append(cab, detalle, titular, lineaDocumentacion(m));
        if (m.dueno.id) {
          const id = m.dueno.id;
          li.tabIndex = 0;
          li.addEventListener('click', () => ir(`#/persona/${id}`));
        }
        ul.append(li);
      }
      resultados.append(ul);
    }
  }
  return [encabezado('Registro de vehículos', 'Vehículos'), caja, resultados, tarjetaRegistro(q, r, p)];
}

function dato(etiqueta: string, valor: string): HTMLElement {
  const d = h('div', 'dato');
  d.append(h('span', 'dato-etiqueta', etiqueta), h('span', 'dato-valor', valor));
  return d;
}

function filaMulta(m: MultaMdt): HTMLLIElement {
  const li = h('li', `multa ${m.estado}`);
  const cab = h('div', 'multa-cabecera');
  const reclusion = m.reclusion === 'ninguna' ? '' : ` · ${m.reclusion === 'prision' ? 'Prisión' : 'Calabozo'} ${m.minutos} min`;
  cab.append(h('span', 'multa-importe', `${euros(m.importe)}${reclusion}`), h('span', `estado ${m.estado}`, m.estado === 'pagada' ? 'Pagada' : 'Pendiente'));
  li.append(cab, h('p', 'multa-motivo', m.motivo), h('p', 'fila-detalle', `${fecha(m.fecha)} · ${m.agente ? `Agente: ${m.agente}` : 'Agente sin DNI'}`));
  // Pronto pago: lo que pagó si fue con descuento, o hasta cuándo puede pagarla así.
  if (m.estado === 'pagada' && m.pagado !== null && m.pagado < m.importe) li.append(h('p', 'fila-detalle', `Pagó ${euros(m.pagado)} con pronto pago`));
  if (m.estado === 'pendiente' && m.descuentoHasta !== null) li.append(h('p', 'fila-detalle', `Puede pagarla con descuento hasta ${hasta(m.descuentoHasta)}`));
  return li;
}

function enlaceVolver(seccion: 'personas' | 'pacientes', texto: string): HTMLAnchorElement {
  const volver = h('a', 'volver');
  volver.href = cachePersonas.q ? `#/${seccion}?q=${encodeURIComponent(cachePersonas.q)}` : `#/${seccion}`;
  volver.append(icono('atras'), document.createTextNode(cachePersonas.q ? 'Resultados' : texto));
  return volver;
}

/** Cabecera de una ficha: foto del avatar de Roblox, documento, nombre y si está en el servidor. */
function tarjetaPerfil(p: PacienteMdt): HTMLElement {
  const perfil = tarjeta('perfil');
  if (p.foto) {
    const foto = h('img', 'foto');
    foto.alt = '';
    foto.referrerPolicy = 'no-referrer';
    foto.src = p.foto;
    foto.addEventListener('error', () => foto.replaceWith(h('div', 'foto sin-foto', p.nombre.charAt(0))));
    perfil.append(foto);
  } else {
    perfil.append(h('div', 'foto sin-foto', p.nombre.charAt(0)));
  }
  const identidad = h('div', 'identidad');
  identidad.append(h('p', 'identidad-doc', `${p.tipoDocumento} ${p.documento}`), h('h1', 'identidad-nombre', `${p.nombre} ${p.apellidos}`), insignia(p.conectado));
  perfil.append(identidad);
  return perfil;
}

function tarjetaDatos(p: PacienteMdt): HTMLElement {
  const datos = tarjeta();
  const rejilla = h('div', 'datos');
  rejilla.append(
    dato('Edad', `${p.edad} años`),
    dato('Nacimiento', p.nacimiento !== null ? fecha(p.nacimiento) : '—'),
    dato('Nacionalidad', p.nacionalidad),
    dato('Roblox', p.roblox ?? '—'),
  );
  datos.append(tituloTarjeta('Datos personales', 'persona'), rejilla);
  return datos;
}

async function paginaPersona(id: string): Promise<HTMLElement[]> {
  const volver = enlaceVolver('personas', 'Personas');
  const guardada = cacheFichas.get(id);
  let ficha: FichaMdt;
  if (guardada && Date.now() - guardada.at < 60_000) {
    ficha = guardada.ficha;
  } else {
    const res = await window.mdt.ficha(id);
    if (!res.ok) {
      const t = tarjeta();
      t.append(mensaje(res.error, 'mensaje error'));
      return [volver, encabezado('Ficha', 'No disponible'), t];
    }
    ficha = res.datos;
    cacheFichas.set(id, { ficha, at: Date.now() });
  }
  const licencias = tarjeta();
  const chips = h('div', 'chips');
  for (const l of ficha.licencias) chips.append(h('span', 'chip', l));
  licencias.append(tituloTarjeta('Licencias', 'libro'), ficha.licencias.length > 0 ? chips : mensaje('Sin licencias.', 'mensaje tenue'));

  const multas = ficha.multas.filter((m) => m.reclusion === 'ninguna');
  const antecedentes = ficha.multas.filter((m) => m.reclusion !== 'ninguna');
  const tMultas = tarjeta();
  const ulMultas = h('ul', 'filas');
  ulMultas.append(...multas.map(filaMulta));
  const sinPagar = ficha.multasPendientes > 0 ? `${ficha.multasPendientes} sin pagar · ${euros(ficha.pendiente)}` : 'Al día';
  tMultas.append(tituloTarjeta('Multas', 'informe', sinPagar), multas.length > 0 ? ulMultas : mensaje('Sin multas.', 'mensaje tenue'));
  const tAntecedentes = tarjeta();
  const ulAnt = h('ul', 'filas');
  ulAnt.append(...antecedentes.map(filaMulta));
  tAntecedentes.append(tituloTarjeta('Antecedentes', 'orden', 'Calabozo y prisión'), antecedentes.length > 0 ? ulAnt : mensaje('Sin antecedentes.', 'mensaje tenue'));

  const tVehiculos = tarjeta();
  const ulVeh = h('ul', 'filas');
  for (const v of ficha.vehiculos) {
    const li = h('li', 'vehiculo');
    const cab = h('div', 'vehiculo-cabecera');
    cab.append(h('span', 'matricula', v.matricula ?? '—'), h('span', 'vehiculo-modelo', v.modelo));
    if (v.enDirecto) cab.append(h('span', 'insignia en-linea', 'En el servidor'));
    const detalle = h('p', 'fila-detalle');
    detalle.append(muestraColor(v.colorHex), document.createTextNode(`${v.color ?? 'Color desconocido'} · ${v.enDirecto ? 'visto ahora' : `visto ${cuando(v.visto)}`}`));
    li.append(cab, detalle, lineaDocumentacion(v));
    ulVeh.append(li);
  }
  tVehiculos.append(tituloTarjeta('Vehículos vistos', 'coche'), ficha.vehiculos.length > 0 ? ulVeh : mensaje('No se le ha visto ningún vehículo.', 'mensaje tenue'));

  // Coches comprados en el concesionario (a su nombre, con matrícula registrada).
  const tCoches = tarjeta();
  const ulCoches = h('ul', 'filas');
  for (const c of ficha.coches) {
    const li = h('li', 'vehiculo');
    const cab = h('div', 'vehiculo-cabecera');
    cab.append(h('span', 'matricula', c.matricula), h('span', 'vehiculo-modelo', c.modelo));
    li.append(cab, h('p', 'fila-detalle', `Comprado el ${fecha(c.comprado)}`));
    ulCoches.append(li);
  }
  tCoches.append(tituloTarjeta('Coches a su nombre', 'coche', `${ficha.coches.length}`), ficha.coches.length > 0 ? ulCoches : mensaje('No tiene ningún coche comprado.', 'mensaje tenue'));

  const columnas = h('div', 'columnas');
  const izquierda = h('div', 'columna');
  izquierda.append(tarjetaDatos(ficha), licencias, tCoches, tVehiculos);
  const derecha = h('div', 'columna');
  derecha.append(tarjetaInformesDe(ficha), tMultas, tAntecedentes);
  columnas.append(izquierda, derecha);
  const avisos: HTMLElement[] = [];
  if (ficha.deudor) {
    const t = tarjeta('tarjeta-alerta');
    t.append(mensaje(`⚠️ Deudor: tiene ${ficha.multasPendientes} multas sin pagar (${euros(ficha.pendiente)}). No puede comprar coches hasta pagarlas.`));
    avisos.push(t);
  }
  return [volver, tarjetaPerfil(ficha), ...tarjetasRequisitoriasDe(ficha), ...avisos, columnas];
}

// ---------------------------------------------------------------------------
// Guardia Civil: requisitorias
// ---------------------------------------------------------------------------

const ESTADO_REQUISITORIA = { activa: 'En vigor', ejecutada: 'Ejecutada', anulada: 'Anulada' } as const;

/** Formulario para cerrar una requisitoria: nota opcional y confirmar. */
function formCierre(r: RequisitoriaMdt, accion: 'ejecutar' | 'anular', alCerrar: () => void, cancelar: () => void): HTMLElement {
  const caja = h('div', 'formulario-corto');
  const { el, area } = areaTexto(300, accion === 'ejecutar' ? 'Dónde y cuándo se le detuvo, nº de atestado… (opcional)' : 'Por qué se anula (opcional)');
  const aviso = mensaje('', 'mensaje error');
  const confirmar = botonAccion(accion === 'ejecutar' ? 'Confirmar: está detenido' : 'Confirmar anulación', 'primario', async () => {
    confirmar.disabled = true;
    aviso.textContent = '';
    const res = await window.mdt.cerrarRequisitoria(r.id, accion, area.value.trim());
    if (!res.ok) {
      aviso.textContent = res.error;
      confirmar.disabled = false;
      return;
    }
    cacheFichas.delete(r.persona.id);
    alCerrar();
  });
  const acciones = h('div', 'acciones');
  acciones.append(confirmar, botonAccion('Cancelar', '', cancelar));
  caja.append(grupo(accion === 'ejecutar' ? 'Nota de la detención' : 'Motivo de la anulación', el), aviso, acciones);
  return caja;
}

/** Una requisitoria con sus botones (ejecutar o anular, según quién la mire). */
function tarjetaRequisitoria(r: RequisitoriaMdt, conPersona: boolean, alCambiar: () => void): HTMLElement {
  const t = tarjeta(`requisitoria ${r.estado}`);
  const cab = h('div', 'requisitoria-cabecera');
  cab.append(h('span', 'requisitoria-num', `${r.estado === 'activa' ? '🚨 ' : ''}Requisitoria nº ${r.numero}/${r.anio}`), h('span', `estado ${r.estado}`, ESTADO_REQUISITORIA[r.estado]));
  t.append(cab);
  if (conPersona) {
    const texto = `${r.persona.nombre} · ${r.persona.documento}${r.persona.existe ? '' : ' (ya no existe)'}`;
    const persona = h(r.persona.existe ? 'a' : 'p', 'requisitoria-persona', texto);
    if (persona instanceof HTMLAnchorElement) persona.href = `#/persona/${r.persona.id}`;
    t.append(persona);
  }
  t.append(h('p', 'requisitoria-motivo', r.motivo), h('p', 'fila-detalle', `Emitida por ${r.emitidaPor} · ${fechaHora(r.emitida)}`));
  if (r.estado !== 'activa' && r.cerradaPor && r.cerrada !== null) {
    t.append(h('p', 'fila-detalle', `${r.estado === 'ejecutada' ? 'Ejecutada' : 'Anulada'} por ${r.cerradaPor} · ${fechaHora(r.cerrada)}${r.nota ? ` · «${r.nota}»` : ''}`));
  }
  const p = estadoActual.requisitorias;
  if (r.estado === 'activa' && (p.ejecutar || p.emitir)) {
    const acciones = h('div', 'acciones');
    const botones = (): HTMLElement[] => [
      ...(p.ejecutar ? [botonAccion('Marcar como ejecutada', 'primario', () => abrir('ejecutar'))] : []),
      ...(p.emitir ? [botonAccion('Anular', '', () => abrir('anular'))] : []),
    ];
    const abrir = (accion: 'ejecutar' | 'anular') => acciones.replaceChildren(formCierre(r, accion, alCambiar, () => acciones.replaceChildren(...botones())));
    acciones.append(...botones());
    t.append(acciones);
  }
  return t;
}

/** Formulario de un juez o fiscal para emitir una requisitoria contra esta persona. */
function formEmitir(ficha: FichaMdt, alEmitir: () => void, cancelar: () => void): HTMLElement {
  const id = uuid4(); // fijo: si el envío se repite, el bot no emite dos
  const caja = h('div', 'formulario-corto');
  const { el, area } = areaTexto(500, 'Delitos por los que se la busca, hechos y juzgado que la emite…');
  const aviso = mensaje('', 'mensaje error');
  const enviar = botonAccion('Emitir requisitoria', 'primario', async () => {
    const motivo = area.value.trim();
    if (motivo.length < 10) {
      aviso.textContent = 'Explica el motivo en al menos 10 caracteres.';
      return;
    }
    enviar.disabled = true;
    aviso.textContent = '';
    const res = await window.mdt.crearRequisitoria({ id, persona: ficha.id, motivo });
    if (!res.ok) {
      aviso.textContent = res.error;
      enviar.disabled = false;
      return;
    }
    cacheFichas.delete(ficha.id);
    alEmitir();
  });
  const acciones = h('div', 'acciones');
  acciones.append(enviar, botonAccion('Cancelar', '', cancelar));
  caja.append(grupo('Motivo', el, 'La verá toda la Guardia Civil y se avisará en su canal. No se puede editar: solo anular.'), aviso, acciones);
  return caja;
}

/** En la ficha: sus requisitorias en vigor (arriba y en rojo) y, para jueces y fiscales, el botón de emitir. */
function tarjetasRequisitoriasDe(ficha: FichaMdt): HTMLElement[] {
  // La ficha guardada ya no vale: se vuelve a pedir con la requisitoria nueva o cerrada.
  const recargar = () => {
    cacheFichas.delete(ficha.id);
    void pintar();
  };
  const piezas = ficha.requisitorias.map((r) => tarjetaRequisitoria(r, false, recargar));
  if (estadoActual.requisitorias.emitir && ficha.requisitorias.length === 0) {
    const t = tarjeta();
    const titulo = tituloTarjeta('Requisitorias', 'orden', 'Ninguna en vigor');
    const acciones = h('div', 'acciones');
    acciones.append(botonAccion('Emitir requisitoria', '', () => t.replaceChildren(titulo, formEmitir(ficha, recargar, recargar))));
    t.append(titulo, acciones);
    piezas.push(t);
  }
  return piezas;
}

async function paginaRequisitorias(todas: boolean): Promise<HTMLElement[]> {
  const p = estadoActual.requisitorias;
  const sub = p.emitir
    ? 'Para emitir una, abre la ficha de la persona desde Personas.'
    : 'Si ves a alguien con una requisitoria en vigor, detenlo y márcala como ejecutada.';
  const filtro = h('div', 'acciones');
  for (const [texto, destino, activo] of [
    ['En vigor', '#/requisitorias', !todas],
    ['Todas', '#/requisitorias?todas=1', todas],
  ] as const) {
    const a = h('a', `boton${activo ? ' primario' : ''}`, texto);
    a.href = destino;
    filtro.append(a);
  }
  const piezas: HTMLElement[] = [encabezado('Órdenes de busca y captura', 'Requisitorias', sub), filtro];
  const res = await window.mdt.requisitorias(todas ? 'todas' : 'activas');
  if (!res.ok) {
    const t = tarjeta();
    t.append(mensaje(res.error, 'mensaje error'));
    return [...piezas, t];
  }
  if (res.datos.length === 0) {
    const t = tarjeta();
    t.append(mensaje(todas ? 'Todavía no hay requisitorias.' : 'No hay ninguna requisitoria en vigor.', 'mensaje tenue'));
    return [...piezas, t];
  }
  return [...piezas, ...res.datos.map((r) => tarjetaRequisitoria(r, true, () => void pintar()))];
}

/**
 * Manda la marca al CAD abierto en este navegador (`BroadcastChannel`). Si no contesta enseguida,
 * abre el CAD con la marca en la dirección (`#marca=x,z,nombre`).
 */
function marcarEnCad(marca: Extract<MensajeMdtCad, { tipo: 'marca' }>): void {
  const abrir = () => abrirCad(`#marca=${Math.round(marca.x)},${Math.round(marca.z)},${encodeURIComponent(marca.nombre)}`);
  if (!('BroadcastChannel' in window)) return void abrir();
  const canal = new BroadcastChannel('ibiza-cad-mdt');
  let recibida = false;
  canal.onmessage = (e: MessageEvent<MensajeMdtCad>) => {
    if (e.data?.tipo === 'marca-recibida') recibida = true;
  };
  canal.postMessage(marca);
  setTimeout(() => {
    canal.close();
    if (!recibida) abrir();
  }, 500);
}

// ---------------------------------------------------------------------------
// SAMU y Bombers: avisos de su servicio
// ---------------------------------------------------------------------------

const EMOJI_SERVICIO: Record<string, string> = { policia: '🚓', bomberos: '🚒', sanitarios: '🚑' };

function filaAviso(a: AvisoCad, servicio: Servicio): HTMLLIElement {
  const li = h('li', `aviso ${a.estado}`);
  const cab = h('div', 'aviso-cabecera');
  cab.append(h('span', 'aviso-tipo', `${a.emoji} ${a.tipo}`), h('span', 'aviso-num', `Aviso ${a.numero}`), h('span', `estado ${a.estado}`, a.estado === 'atendido' ? 'Atendido' : 'Abierto'));
  li.append(cab, h('p', 'aviso-desc', a.descripcion), h('p', 'fila-detalle', `📍 ${a.ubicacion ?? 'Sin dirección'} · ${a.llamante} · ${cuando(a.creado)}`));
  const unidades = h('div', 'chips aviso-unidades');
  for (const u of a.unidades) unidades.append(h('span', `chip${u.servicio === servicio ? ' propia' : ''}`, `${EMOJI_SERVICIO[u.servicio] ?? '•'} ${u.indicativo ?? u.nombre}`));
  li.append(a.unidades.length > 0 ? unidades : h('p', 'fila-detalle', 'Aún sin unidades asignadas.'));
  const acciones = h('div', 'acciones');
  if (estadoActual.apps.cad && a.x !== null && a.z !== null) {
    const { x, z } = a;
    const verCad = h('button', 'boton');
    verCad.type = 'button';
    verCad.append(icono('mapa'), document.createTextNode('Ver en el CAD'));
    verCad.addEventListener('click', () => marcarEnCad({ tipo: 'marca', x, z, nombre: `Aviso ${a.numero} · ${a.tipo}` }));
    acciones.append(verCad);
  }
  const tipo = CONFIG.tipos[0];
  if (tipo && puedeRedactar()) acciones.append(botonNuevo(tipo, `?aviso=${a.numero}`, false, servicio === 'sanitarios' ? 'Hacer informe' : 'Hacer parte'));
  if (acciones.childElementCount > 0) li.append(acciones);
  return li;
}

/** Pinta (o refresca) la tarjeta de avisos del servicio. */
async function cargarAvisos(caja: HTMLElement, servicio: Servicio): Promise<void> {
  const res = await window.mdt.avisos(servicio);
  if (!caja.isConnected) return; // ya se ha cambiado de página
  const titulo = servicio === 'sanitarios' ? 'Avisos sanitarios' : 'Avisos de Bombers';
  if (!res.ok) {
    caja.replaceChildren(tituloTarjeta(titulo, 'sirena'), mensaje(res.error, 'mensaje error'));
    return;
  }
  const lista = res.datos;
  const ul = h('ul', 'filas');
  ul.append(...lista.map((a) => filaAviso(a, servicio)));
  caja.replaceChildren(
    tituloTarjeta(titulo, 'sirena', lista.length === 0 ? 'Ninguno abierto' : `${lista.length} sin cerrar`),
    lista.length > 0 ? ul : mensaje('No hay avisos sin cerrar de tu servicio.', 'mensaje tenue'),
    mensaje(`Se actualiza solo cada 20 segundos. Atiende y cierra los avisos desde ${estadoActual.apps.cad ? 'el CAD o desde Discord' : 'Discord'}.`, 'mensaje nota'),
  );
}

function paginaInicioServicio(servicio: Servicio): HTMLElement[] {
  const samu = servicio === 'sanitarios';
  const saludo = estadoActual.nombre ? `Hola, ${estadoActual.nombre}` : 'Hola';
  const avisos = tarjeta();
  avisos.append(tituloTarjeta(samu ? 'Avisos sanitarios' : 'Avisos de Bombers', 'sirena'), mensaje('Cargando avisos…', 'mensaje tenue'));
  avisosVivos = { caja: avisos, servicio };
  void cargarAvisos(avisos, servicio);
  if (samu) {
    const rapida = tarjeta();
    rapida.append(tituloTarjeta('Buscar paciente', 'buscar'), buscador('pacientes', '', 'Nombre y apellidos o DNI/NIE'));
    return [
      encabezado(CONFIG.etiqueta, saludo, 'Avisos sanitarios del servidor y fichas de pacientes.'),
      avisos,
      rapida,
      accesos([
        { titulo: 'Pacientes', texto: 'Identidad, edad, dónde está e historial clínico', icono: 'cruz', hash: '#/pacientes' },
        { titulo: 'Informes de asistencia', texto: 'Los del SAMU (secreto médico)', icono: 'informe', hash: '#/informes' },
      ]),
      notaRegistro(),
    ];
  }
  return [
    encabezado(CONFIG.etiqueta, saludo, 'Incendios, rescates y accidentes del servidor, y sus locales.'),
    avisos,
    accesos([
      { titulo: 'Locales', texto: 'Quién ocupa cada local y su inspección', icono: 'edificio', hash: '#/locales' },
      { titulo: 'Partes de intervención', texto: 'Incendios, rescates y accidentes', icono: 'informe', hash: '#/informes' },
      { titulo: 'Inspecciones', texto: 'Locales sin inspección al día', icono: 'revision', hash: '#/locales?f=revisar' },
    ]),
  ];
}

// ---------------------------------------------------------------------------
// SAMU: ficha de paciente (identidad y datos clínicos)
// ---------------------------------------------------------------------------

/** Datos clínicos fijos: grupo sanguíneo, antecedentes y alergias. */
function tarjetaClinica(c: ClinicoMdt): HTMLElement {
  const t = tarjeta();
  const rejilla = h('div', 'datos');
  rejilla.append(dato('Grupo sanguíneo', c.grupoSanguineo));
  const hayAlergias = c.alergias !== null && c.alergias !== 'Ninguna conocida';
  const alergias = h('p', `clinico-alergias${hayAlergias ? ' hay' : ''}`, c.alergias === null ? 'Alergias: sin declarar' : `${hayAlergias ? '⚠️ ' : ''}Alergias: ${c.alergias}`);
  t.append(tituloTarjeta('Datos clínicos', 'cruz'), rejilla, alergias, h('p', 'fila-detalle', `Antecedentes: ${c.antecedentes}`));
  return t;
}

async function paginaPaciente(id: string): Promise<HTMLElement[]> {
  const volver = enlaceVolver('pacientes', 'Pacientes');
  const guardada = cachePacientes.get(id);
  let ficha: PacienteSamuMdt;
  if (guardada && Date.now() - guardada.at < 60_000) {
    ficha = guardada.ficha;
  } else {
    const res = await window.mdt.paciente(id);
    if (!res.ok) {
      const t = tarjeta();
      t.append(mensaje(res.error, 'mensaje error'));
      return [volver, encabezado('Paciente', 'No disponible'), t];
    }
    ficha = res.datos;
    cachePacientes.set(id, { ficha, at: Date.now() });
  }
  const columnas = h('div', 'columnas');
  const izquierda = h('div', 'columna');
  izquierda.append(tarjetaClinica(ficha.clinico), tarjetaDatos(ficha));
  const derecha = h('div', 'columna');
  derecha.append(tarjetaInformesDe(ficha));
  columnas.append(izquierda, derecha);
  return [volver, tarjetaPerfil(ficha), columnas];
}

// ---------------------------------------------------------------------------
// Bombers: locales
// ---------------------------------------------------------------------------

const ESTADO_INSPECCION: Record<EstadoInspeccionMdt['estado'], string> = {
  'sin-inspeccion': 'Sin inspección',
  'al-dia': 'Al día',
  deficiencias: 'Deficiencias',
  'no-apto': 'No apto',
  caducada: 'Caducada',
};
const RESULTADO_INSPECCION: Record<ResultadoInspeccionMdt, string> = { apto: 'Apto', deficiencias: 'Con deficiencias', 'no-apto': 'No apto' };
/** Lo que guarda el bot en un «apto» firmado sin observaciones. */
const SIN_OBSERVACIONES = 'Sin observaciones.';

/** Inspección recién firmada: la página de locales lo anuncia una sola vez. */
let recienInspeccionado: string | null = null;

/** ¿Hay que volver a inspeccionarlo? (ocupado y sin una inspección favorable en vigor). */
const porRevisar = (l: LocalMdt) => !!l.empresa && l.inspeccion?.estado !== 'al-dia';

function hashLocales(q: string, revisar: boolean): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (revisar) params.set('f', 'revisar');
  const s = params.toString();
  return s ? `#/locales?${s}` : '#/locales';
}

/** Qué dice la última inspección de la empresa que ocupa el local. */
function lineasInspeccion(i: EstadoInspeccionMdt | null): HTMLElement[] {
  if (!i) return [h('p', 'local-inspeccion', 'Inspección: sin datos')];
  const u = i.ultima;
  if (i.estado === 'sin-inspeccion' || !u) return [h('p', 'local-inspeccion', 'Esta empresa aún no ha pasado ninguna inspección.')];
  const quien = `${u.inspector} · ${fecha(u.fecha)}`;
  const caduca = u.caduca ?? u.fecha;
  const linea =
    i.estado === 'al-dia'
      ? `✅ Apto hasta ${hasta(caduca)} · ${quien}`
      : i.estado === 'deficiencias'
        ? `⚠️ Con deficiencias: tiene hasta ${hasta(caduca)} para corregirlas · ${quien}`
        : i.estado === 'no-apto'
          ? `⛔ No apto desde el ${fecha(u.fecha)} · ${u.inspector}`
          : `${u.resultado === 'apto' ? 'La inspección caducó' : 'El plazo para corregir venció'} ${cuando(caduca)} · ${quien}`;
  const piezas: HTMLElement[] = [h('p', `local-inspeccion ${i.estado}`, linea)];
  if (u.notas !== SIN_OBSERVACIONES) piezas.push(h('p', 'local-notas', u.notas));
  return piezas;
}

/** Formulario de un bombero para inspeccionar el local: resultado, plazo y observaciones. */
function formInspeccion(l: LocalMdt, plazos: OpcionesInformesMdt['plazosInspeccion'], alFirmar: () => void, cancelar: () => void): HTMLElement {
  const id = uuid4(); // fijo: si el envío se repite, el bot no firma dos
  const caja = h('div', 'formulario-corto');
  const resultado = selector([
    { value: 'apto', label: 'Apto' },
    { value: 'deficiencias', label: 'Con deficiencias' },
    { value: 'no-apto', label: 'No apto' },
  ]);
  const plazo = h('select', 'campo');
  const grupoPlazo = grupo('Plazo', plazo);
  const { el, area } = areaTexto(500);
  const aviso = mensaje('', 'mensaje error');
  const actualizar = () => {
    const r = resultado.value as ResultadoInspeccionMdt;
    const dias = r === 'apto' ? plazos.apto : r === 'deficiencias' ? plazos.deficiencias : [];
    plazo.replaceChildren(
      ...dias.map((d) => {
        const o = h('option', '', r === 'apto' ? `Vale ${d} días` : `${d} días para corregirlas`);
        o.value = String(d);
        return o;
      }),
    );
    if (r === 'apto' && dias.includes(30)) plazo.value = '30';
    grupoPlazo.hidden = r === 'no-apto';
    area.placeholder =
      r === 'apto'
        ? 'Extintores, salidas de emergencia, instalación eléctrica… (opcional)'
        : r === 'deficiencias'
          ? 'Qué hay que corregir y cómo…'
          : 'Por qué no es apto y qué tiene que cambiar para serlo…';
  };
  resultado.addEventListener('change', actualizar);
  actualizar();
  const enviar = botonAccion('Firmar inspección', 'primario', async () => {
    const r = resultado.value as ResultadoInspeccionMdt;
    const notas = area.value.trim();
    if (r !== 'apto' && notas.length < 10) {
      aviso.textContent = `Explica ${r === 'deficiencias' ? 'las deficiencias' : 'por qué no es apto'} en al menos 10 caracteres.`;
      return;
    }
    const dias = r === 'no-apto' ? 0 : Number(plazo.value);
    enviar.disabled = true;
    aviso.textContent = '';
    const res = await window.mdt.crearInspeccion({ id, local: l.id, resultado: r, dias, notas });
    if (!res.ok) {
      aviso.textContent = res.error;
      enviar.disabled = false;
      return;
    }
    recienInspeccionado = `Inspección de ${l.nombre} firmada: ${RESULTADO_INSPECCION[res.datos.resultado].toLowerCase()}. A su dueño le llega un MD.`;
    alFirmar();
  });
  const acciones = h('div', 'acciones');
  acciones.append(enviar, botonAccion('Cancelar', '', cancelar));
  caja.append(
    grupo('Resultado', resultado),
    grupoPlazo,
    grupo('Observaciones', el, 'Al firmarla, a su dueño le llega un MD. No se puede editar ni borrar: si algo cambia, haz otra inspección.'),
    aviso,
    acciones,
  );
  return caja;
}

/** Historial del local: las últimas inspecciones, de todas las empresas que lo han ocupado. */
async function cargarHistorial(caja: HTMLElement, l: LocalMdt): Promise<void> {
  caja.replaceChildren(mensaje('Cargando el historial…', 'mensaje tenue'));
  const res = await window.mdt.inspecciones(l.id);
  if (!res.ok) {
    caja.replaceChildren(mensaje(res.error, 'mensaje error'));
    return;
  }
  if (res.datos.length === 0) {
    caja.replaceChildren(mensaje('Este local no tiene ninguna inspección.', 'mensaje tenue'));
    return;
  }
  const ul = h('ul', 'filas');
  for (const i of res.datos) {
    const li = h('li', `inspeccion ${i.resultado}`);
    const cab = h('div', 'multa-cabecera');
    cab.append(h('span', 'multa-importe', i.empresa), h('span', `estado insp-${i.resultado}`, RESULTADO_INSPECCION[i.resultado]));
    const plazo = i.caduca === null ? '' : ` · ${i.resultado === 'apto' ? 'válida' : 'plazo'} hasta el ${fecha(i.caduca)}`;
    li.append(cab, h('p', 'multa-motivo', i.notas), h('p', 'fila-detalle', `${fechaHora(i.fecha)} · ${i.inspector}${plazo}`));
    ul.append(li);
  }
  caja.replaceChildren(h('p', 'fila-detalle', `Últimas ${res.datos.length === 1 ? 'inspección' : `${res.datos.length} inspecciones`}`), ul);
}

/** Un local con su empresa, su inspección y los botones de inspeccionar y ver el historial. */
function tarjetaLocal(l: LocalMdt, recargar: () => void): HTMLLIElement {
  const li = h('li', `local${l.empresa ? '' : ' libre'}`);
  const cab = h('div', 'vehiculo-cabecera');
  cab.append(h('span', 'vehiculo-modelo', l.nombre));
  if (l.empresa && l.inspeccion) cab.append(h('span', `estado insp-${l.inspeccion.estado}`, ESTADO_INSPECCION[l.inspeccion.estado]));
  cab.append(h('span', `insignia${l.empresa ? ' ocupado' : ''}`, l.empresa ? 'Ocupado' : 'Libre'));
  li.append(cab, h('p', 'fila-detalle', `Zona: ${l.zona}`));
  if (l.empresa) {
    li.append(h('p', 'local-empresa', `${l.empresa.nombre} · ${l.empresa.tipo}`), h('p', 'fila-detalle', l.empresa.dueno ? `Dueño: ${l.empresa.dueno}` : 'Dueño sin DNI'));
    li.append(...lineasInspeccion(l.inspeccion));
  }
  const acciones = h('div', 'acciones');
  const historial = h('div', 'local-historial');
  historial.hidden = true;
  const verHistorial = botonAccion('Historial', '', () => {
    historial.hidden = !historial.hidden;
    verHistorial.textContent = historial.hidden ? 'Historial' : 'Ocultar historial';
    if (!historial.hidden) void cargarHistorial(historial, l);
  });
  const botones = (): HTMLElement[] => [...(l.empresa && estadoActual.inspeccionar ? [botonAccion('Inspeccionar', 'primario', () => void abrir())] : []), verHistorial];
  const abrir = async () => {
    if (!cacheOpciones) {
      const res = await window.mdt.opciones();
      if (!res.ok) return void acciones.replaceChildren(mensaje(res.error, 'mensaje error'), ...botones());
      cacheOpciones = res.datos;
    }
    const plazos = cacheOpciones.plazosInspeccion;
    if (plazos.apto.length === 0 || plazos.deficiencias.length === 0) {
      return void acciones.replaceChildren(mensaje('El bot no ha mandado los plazos de las inspecciones: avisa al staff.', 'mensaje error'), ...botones());
    }
    acciones.replaceChildren(formInspeccion(l, plazos, recargar, () => acciones.replaceChildren(...botones())));
  };
  acciones.append(...botones());
  li.append(acciones, historial);
  return li;
}

async function paginaLocales(q: string, revisar: boolean): Promise<HTMLElement[]> {
  const caja = tarjeta();
  const filtro = h('div', 'acciones');
  for (const [texto, soloRevisar] of [
    ['Todos', false],
    ['Por revisar', true],
  ] as const) {
    const a = h('a', `boton${soloRevisar === revisar ? ' primario' : ''}`, texto);
    a.href = hashLocales(q, soloRevisar);
    filtro.append(a);
  }
  caja.append(tituloTarjeta('Buscar local', 'edificio'), buscador('locales', q, 'Local, zona, empresa, dueño o estado', true), filtro);
  const resultados = tarjeta();
  if (cacheLocales.q !== q || (!cacheLocales.lista && !cacheLocales.error) || Date.now() - cacheLocales.at > 60_000) {
    cacheLocales.q = q;
    cacheLocales.lista = null;
    cacheLocales.error = '';
    cacheLocales.at = Date.now();
    resultados.append(mensaje('Buscando…', 'mensaje tenue'));
    const res = await window.mdt.locales(q);
    if (res.ok) cacheLocales.lista = res.datos;
    else cacheLocales.error = res.error;
    resultados.replaceChildren();
  }
  if (cacheLocales.error) {
    resultados.append(mensaje(cacheLocales.error, 'mensaje error'));
  } else {
    const todos = cacheLocales.lista ?? [];
    const lista = revisar ? todos.filter(porRevisar) : todos;
    const ocupados = todos.filter((l) => l.empresa).length;
    const pendientes = todos.filter(porRevisar).length;
    resultados.append(
      tituloTarjeta(
        `${lista.length} local${lista.length === 1 ? '' : 'es'}${revisar ? ' por revisar' : ''}`,
        undefined,
        q ? `«${q}»` : `${ocupados} ocupado${ocupados === 1 ? '' : 's'} · ${pendientes} por revisar`,
      ),
    );
    if (lista.length === 0) {
      resultados.append(mensaje(revisar ? 'Todos los locales ocupados tienen la inspección al día.' : 'Ningún local coincide con esa búsqueda.', 'mensaje tenue'));
    }
    // Tras firmar, la lista se vuelve a pedir con la inspección nueva.
    const recargar = () => {
      cacheLocales.lista = null;
      cacheLocales.error = '';
      void pintar();
    };
    const ul = h('ul', 'filas');
    for (const l of lista) ul.append(tarjetaLocal(l, recargar));
    resultados.append(ul);
  }
  const piezas: HTMLElement[] = [encabezado(CONFIG.etiqueta, 'Locales', 'Locales del servidor, la empresa de cada uno y su inspección.'), caja];
  if (recienInspeccionado) {
    const aviso = tarjeta('tarjeta-exito');
    aviso.append(mensaje(recienInspeccionado));
    piezas.push(aviso);
    recienInspeccionado = null;
  }
  piezas.push(resultados);
  return piezas;
}

// ---------------------------------------------------------------------------
// Informes (los tres MDT)
// ---------------------------------------------------------------------------

const TIPO_INFORME: Record<TipoInformeMdt, { nuevo: string; corto: string }> = {
  denuncia: { nuevo: 'Nueva denuncia', corto: 'Denuncia' },
  atestado: { nuevo: 'Nuevo atestado', corto: 'Atestado' },
  asistencia: { nuevo: 'Nuevo informe de asistencia', corto: 'Asistencia' },
  intervencion: { nuevo: 'Nuevo parte', corto: 'Parte' },
};

const QUIEN_FIRMA: Record<AmbitoInformeMdt, string> = {
  guardiaCivil: 'los agentes de la Guardia Civil',
  samu: 'los sanitarios del SAMU',
  bombers: 'los bomberos',
};

/** Opciones de los formularios (las manda el bot una vez por sesión). */
let cacheOpciones: OpcionesInformesMdt | null = null;
/** Informe recién firmado: su página lo anuncia una sola vez. */
let recienCreado: InformeCreadoMdt | null = null;

/** ¿Puede firmar informes en este MDT? (el bot lo vuelve a mirar al firmar). */
function puedeRedactar(): boolean {
  return !!CONFIG.ambito && estadoActual.redactar[CONFIG.ambito];
}

function botonNuevo(tipo: TipoInformeMdt, consulta = '', primario = true, texto = TIPO_INFORME[tipo].nuevo): HTMLAnchorElement {
  const a = h('a', `boton${primario ? ' primario' : ''}`);
  a.href = `#/nuevo/${tipo}${consulta}`;
  a.append(icono('mas'), document.createTextNode(texto));
  return a;
}

function filasInformes(lista: InformeResumenMdt[]): HTMLUListElement {
  const ul = h('ul', 'filas');
  for (const r of lista) {
    ul.append(fila(r.numero, `${TIPO_INFORME[r.tipo].corto} nº ${r.numero}/${r.anio} · ${r.titulo}`, `${r.resumen} · ${r.autor} · ${cuando(r.fecha)}`, null, () => ir(`#/informe/${r.id}`)));
  }
  return ul;
}

/** Pinta en `caja` los últimos informes de este MDT, o los de una persona. */
async function cargarInformes(caja: HTMLElement, persona: string | null, titulo: string, vacio: string, extra: HTMLElement | null = null): Promise<void> {
  if (!CONFIG.ambito) return;
  const res = await window.mdt.informes(CONFIG.ambito, persona);
  if (!caja.isConnected) return; // ya se ha cambiado de página
  const piezas: HTMLElement[] = [];
  if (!res.ok) {
    piezas.push(tituloTarjeta(titulo, 'informe'), mensaje(res.error, 'mensaje error'));
  } else {
    piezas.push(tituloTarjeta(titulo, 'informe', res.datos.length === 0 ? 'Ninguno' : `${res.datos.length}`));
    piezas.push(res.datos.length > 0 ? filasInformes(res.datos) : mensaje(vacio, 'mensaje tenue'));
  }
  if (extra) piezas.push(extra);
  caja.replaceChildren(...piezas);
}

/** Tarjeta de informes de una ficha (Guardia Civil) o historial clínico de un paciente (SAMU). */
function tarjetaInformesDe(p: PacienteMdt): HTMLElement {
  const samu = APP === 'samu';
  const titulo = samu ? 'Historial clínico' : 'Informes';
  const caja = tarjeta();
  let acciones: HTMLElement | null = null;
  if (puedeRedactar()) {
    acciones = h('div', 'acciones');
    for (const tipo of CONFIG.tipos) acciones.append(botonNuevo(tipo, `?persona=${p.id}`, false, tipo === 'denuncia' ? 'Denunciar' : tipo === 'atestado' ? 'Atestado' : 'Nuevo informe'));
  }
  caja.append(tituloTarjeta(titulo, 'informe'), mensaje('Cargando…', 'mensaje tenue'));
  void cargarInformes(caja, p.id, titulo, samu ? 'El SAMU aún no le ha atendido.' : 'Sin denuncias ni atestados.', acciones);
  return caja;
}

function paginaInformes(): HTMLElement[] {
  const ambito = CONFIG.ambito;
  const texto =
    APP === 'guardia-civil'
      ? 'Boletines de denuncia y atestados de detención.'
      : APP === 'samu'
        ? 'Informes de asistencia sanitaria. Son secreto médico: solo los ve el SAMU.'
        : 'Partes de intervención: incendios, rescates y accidentes.';
  const piezas: HTMLElement[] = [encabezado(CONFIG.etiqueta, 'Informes', texto)];
  if (puedeRedactar()) {
    const t = tarjeta();
    const acciones = h('div', 'acciones');
    for (const tipo of CONFIG.tipos) acciones.append(botonNuevo(tipo));
    const pista =
      APP === 'guardia-civil'
        ? 'También puedes denunciar o hacer un atestado desde la ficha de la persona.'
        : APP === 'samu'
          ? 'También desde la ficha del paciente o desde un aviso del inicio.'
          : 'También desde un aviso del inicio.';
    t.append(tituloTarjeta('Redactar', 'mas'), acciones, mensaje(pista, 'mensaje nota'));
    piezas.push(t);
  } else if (ambito) {
    const t = tarjeta('tarjeta-aviso');
    t.append(mensaje(`Puedes consultarlos, pero solo ${QUIEN_FIRMA[ambito]} pueden firmarlos.`, 'mensaje tenue'));
    piezas.push(t);
  }
  const lista = tarjeta();
  lista.append(tituloTarjeta('Últimos informes', 'informe'), mensaje('Cargando…', 'mensaje tenue'));
  void cargarInformes(lista, null, 'Últimos informes', 'Aún no hay informes.');
  piezas.push(lista);
  return piezas;
}

const fechaHora = (ts: number) => `${fecha(ts)} · ${new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

function volverInformes(): HTMLAnchorElement {
  const volver = h('a', 'volver');
  volver.href = '#/informes';
  volver.append(icono('atras'), document.createTextNode('Informes'));
  return volver;
}

/** Persona del informe: con enlace a su ficha si aún existe y este MDT tiene fichas. */
function datoSujeto(r: InformeMdt): HTMLElement {
  const s = r.sujeto!;
  const valor = s.documento ? `${s.nombre} · ${s.documento}` : s.nombre;
  const d = h('div', 'dato');
  d.append(h('span', 'dato-etiqueta', r.etiquetaSujeto));
  const destino = s.id ? (APP === 'guardia-civil' ? `#/persona/${s.id}` : APP === 'samu' ? `#/paciente/${s.id}` : null) : null;
  if (destino) {
    const a = h('a', 'dato-valor enlace', valor);
    a.href = destino;
    d.append(a);
  } else {
    d.append(h('span', 'dato-valor', valor));
  }
  return d;
}

function lineaInforme(l: InformeMdt['lineas'][number]): HTMLElement {
  const el = h('div', 'linea-informe');
  el.append(h('span', 'linea-etiqueta', l.etiqueta));
  const valor = h('div', 'linea-valor');
  if (l.enlaces) {
    for (const url of l.valor.split('\n')) {
      const a = h('a', 'enlace', url);
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.referrerPolicy = 'no-referrer';
      valor.append(a);
    }
  } else {
    valor.textContent = l.valor;
  }
  el.append(valor);
  return el;
}

function tarjetaMultaInforme(m: NonNullable<InformeMdt['multa']>): HTMLElement {
  const t = tarjeta();
  t.append(tituloTarjeta('Multa', 'informe', m.estado === 'pagada' ? 'Pagada' : 'Pendiente de pago'));
  const rejilla = h('div', 'datos');
  rejilla.append(dato('Importe', euros(m.importe)));
  if (m.estado === 'pagada' && m.pagado !== null) rejilla.append(dato('Pagado', m.pagado < m.importe ? `${euros(m.pagado)} (pronto pago)` : euros(m.pagado)));
  if (m.estado === 'pendiente') rejilla.append(dato('Pronto pago', m.descuentoHasta !== null ? `Con descuento hasta ${hasta(m.descuentoHasta)}` : 'Fuera de plazo: importe entero'));
  t.append(rejilla, mensaje('La paga la persona desde Discord, con /pagar-multa.', 'mensaje nota'));
  return t;
}

async function paginaInforme(id: string): Promise<HTMLElement[]> {
  const res = await window.mdt.informe(id);
  if (!res.ok) {
    const t = tarjeta();
    t.append(mensaje(res.error, 'mensaje error'));
    return [volverInformes(), encabezado('Informe', 'No disponible'), t];
  }
  const r = res.datos;
  const piezas: HTMLElement[] = [volverInformes()];
  if (recienCreado?.id === r.id) {
    const c = recienCreado;
    const aviso = tarjeta(c.publicado === false ? 'tarjeta-alerta' : 'tarjeta-exito');
    aviso.append(
      mensaje(
        c.repetido
          ? 'Este informe ya estaba firmado: no se ha duplicado.'
          : c.publicado === true
            ? 'Informe firmado y publicado en Discord.'
            : c.publicado === false
              ? 'Informe firmado y guardado, pero no se ha podido publicar en Discord. Avisa al staff.'
              : 'Informe firmado y guardado en el MDT.',
      ),
    );
    piezas.push(aviso);
    recienCreado = null;
  }
  const doc = tarjeta('documento');
  const cab = h('div', 'documento-cabecera');
  const titulos = h('div', 'documento-titulos');
  titulos.append(h('p', 'etiqueta', r.cabecera), h('h1', 'documento-titulo', `${r.emoji} ${r.documento}`), h('p', 'documento-num', `nº ${r.numero}/${r.anio}`));
  cab.append(titulos);
  const rejilla = h('div', 'datos');
  if (r.sujeto) rejilla.append(datoSujeto(r));
  rejilla.append(dato(r.etiquetaAutor, r.indicativo ? `${r.autor} (${r.indicativo})` : r.autor), dato('Fecha y hora', fechaHora(r.fecha)));
  if (r.lugar) rejilla.append(dato('Lugar', r.lugar));
  if (r.aviso !== null) rejilla.append(dato('Aviso del CAD', `nº ${r.aviso}`));
  const lineas = h('div', 'lineas-informe');
  for (const l of r.lineas) lineas.append(lineaInforme(l));
  doc.append(cab, rejilla, lineas, h('p', 'documento-pie', 'Registrado en el MDT · no se puede modificar ni borrar'));
  piezas.push(doc);
  if (r.multa) piezas.push(tarjetaMultaInforme(r.multa));
  return piezas;
}

// --- Formulario ---

/** UUID v4 (también fuera de https, donde no hay `crypto.randomUUID`). */
function uuid4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function grupo(etiqueta: string, control: HTMLElement, ayuda = ''): HTMLElement {
  // `label` solo envuelve un control simple; las áreas con contador o las listas van en un `div`.
  const simple = control instanceof HTMLInputElement || control instanceof HTMLSelectElement;
  const g = h(simple ? 'label' : 'div', 'campo-grupo');
  g.append(h('span', 'campo-etiqueta', etiqueta), control);
  if (ayuda) g.append(h('span', 'campo-ayuda', ayuda));
  return g;
}

function entrada(max: number, placeholder = '', valor = ''): HTMLInputElement {
  const i = h('input', 'campo');
  i.type = 'text';
  i.maxLength = max;
  i.placeholder = placeholder;
  i.value = valor;
  i.spellcheck = false;
  return i;
}

function campoNumero(min: number, max: number, placeholder = '', valor: number | null = null): HTMLInputElement {
  const i = h('input', 'campo');
  i.type = 'number';
  i.min = String(min);
  i.max = String(max);
  i.step = '1';
  i.inputMode = 'numeric';
  i.placeholder = placeholder;
  if (valor !== null) i.value = String(valor);
  return i;
}

/** Área de texto con contador de caracteres. */
function areaTexto(max: number, placeholder = ''): { el: HTMLElement; area: HTMLTextAreaElement } {
  const area = h('textarea', 'campo');
  area.maxLength = max;
  area.placeholder = placeholder;
  area.rows = 4;
  const contador = h('span', 'contador', `0/${max}`);
  area.addEventListener('input', () => (contador.textContent = `${area.value.length}/${max}`));
  const el = h('div', 'area-con-contador');
  el.append(area, contador);
  return { el, area };
}

function selector(opciones: OpcionInformeMdt[]): HTMLSelectElement {
  const s = h('select', 'campo');
  for (const o of opciones) {
    const op = h('option', '', o.label);
    op.value = o.value;
    s.append(op);
  }
  return s;
}

function casilla(texto: string): { el: HTMLLabelElement; input: HTMLInputElement } {
  const el = h('label', 'casilla');
  const input = h('input');
  input.type = 'checkbox';
  el.append(input, h('span', '', texto));
  return { el, input };
}

/** Número entero del campo (hasta 1.000 millones, el tope del bot), o `null` si no lo es (vacío vale `vacio`). */
function enteroDe(i: HTMLInputElement, vacio: number | null = null): number | null {
  const v = i.value.trim();
  if (v === '') return vacio;
  if (!/^\d{1,10}$/.test(v)) return null;
  const n = Number(v);
  return n <= 1_000_000_000 ? n : null;
}

interface PersonaElegida {
  id: string;
  nombre: string;
  documento: string;
}

/** Nombre y documento de una persona ya consultada (o se consulta su ficha). */
async function personaConocida(id: string): Promise<PersonaElegida | null> {
  const guardada = cacheFichas.get(id)?.ficha ?? cachePacientes.get(id)?.ficha;
  if (guardada) return { id, nombre: `${guardada.nombre} ${guardada.apellidos}`, documento: guardada.documento };
  const res = APP === 'samu' ? await window.mdt.paciente(id) : await window.mdt.ficha(id);
  return res.ok ? { id, nombre: `${res.datos.nombre} ${res.datos.apellidos}`, documento: res.datos.documento } : null;
}

/**
 * Elegir a la persona del informe: buscador (por nombre y apellidos o DNI/NIE) y la elegida con
 * «Cambiar». En el SAMU se puede marcar «paciente sin identificar».
 */
function selectorPersona(inicial: PersonaElegida | null, samu: boolean): { el: HTMLElement; valor(): PersonaElegida | null; desconocido(): boolean } {
  let elegida = inicial;
  const el = h('div', 'selector-persona');
  const cuerpo = h('div', 'selector-cuerpo');
  const sinIdentificar = samu ? casilla('Paciente sin identificar (no lleva documentación o no puede decir quién es)') : null;

  const pintarElegida = (p: PersonaElegida) => {
    const caja = h('div', 'persona-elegida');
    caja.append(icono('persona'), h('span', 'persona-nombre', `${p.nombre} · ${p.documento}`));
    const cambiar = h('button', 'boton');
    cambiar.type = 'button';
    cambiar.textContent = 'Cambiar';
    cambiar.addEventListener('click', () => {
      elegida = null;
      pintarBuscador();
    });
    caja.append(cambiar);
    cuerpo.replaceChildren(caja);
  };

  const pintarBuscador = () => {
    const fila1 = h('div', 'buscador');
    const campo = entrada(40, 'Nombre y apellidos o DNI/NIE');
    campo.type = 'search';
    const buscar = h('button', 'boton');
    buscar.type = 'button';
    buscar.append(icono('buscar'), document.createTextNode('Buscar'));
    const resultados = h('div', 'selector-resultados');
    const lanzar = async () => {
      const q = campo.value.trim();
      if (q.length < 2) {
        resultados.replaceChildren(mensaje('Escribe al menos 2 caracteres.', 'mensaje tenue'));
        return;
      }
      resultados.replaceChildren(mensaje('Buscando…', 'mensaje tenue'));
      const res = samu ? await window.mdt.pacientes(q) : await window.mdt.personas(q);
      if (!res.ok) {
        resultados.replaceChildren(mensaje(res.error, 'mensaje error'));
        return;
      }
      if (res.datos.length === 0) {
        resultados.replaceChildren(mensaje('Nadie coincide con esa búsqueda.', 'mensaje tenue'));
        return;
      }
      const ul = h('ul', 'filas');
      res.datos.forEach((p, i) =>
        ul.append(
          fila(i + 1, p.nombre, `${p.documento} · ${p.edad} años`, insignia(p.conectado), () => {
            elegida = { id: p.id, nombre: p.nombre, documento: p.documento };
            pintarElegida(elegida);
          }),
        ),
      );
      resultados.replaceChildren(ul);
    };
    buscar.addEventListener('click', () => void lanzar());
    campo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Intro busca, no firma el informe
        void lanzar();
      }
    });
    fila1.append(campo, buscar);
    cuerpo.replaceChildren(fila1, resultados);
  };

  if (elegida) pintarElegida(elegida);
  else pintarBuscador();
  if (sinIdentificar) {
    sinIdentificar.input.addEventListener('change', () => (cuerpo.hidden = sinIdentificar.input.checked));
    el.append(cuerpo, sinIdentificar.el);
  } else {
    el.append(cuerpo);
  }
  return { el, valor: () => elegida, desconocido: () => !!sinIdentificar?.input.checked };
}

interface FilaArticulo {
  articulo: HTMLInputElement;
  descripcion: HTMLInputElement;
  importe: HTMLInputElement | null;
}

/** Líneas de artículos (infracciones con importe, o delitos), de 1 a 10. */
function lineasArticulos(conImporte: boolean, alCambiar: () => void): { el: HTMLElement; filas: FilaArticulo[] } {
  const el = h('div', 'lineas-articulos');
  const filas: FilaArticulo[] = [];
  const anadir = h('button', 'boton');
  anadir.type = 'button';
  anadir.append(icono('mas'), document.createTextNode(conImporte ? 'Añadir infracción' : 'Añadir delito'));
  const nueva = () => {
    if (filas.length >= 10) return;
    const linea = h('div', `linea-articulo${conImporte ? '' : ' sin-importe'}`);
    const f: FilaArticulo = {
      articulo: entrada(20, 'Art. 12'),
      descripcion: entrada(80, conImporte ? 'Exceso de velocidad' : 'Robo con violencia'),
      importe: conImporte ? campoNumero(0, 1_000_000_000, 'Importe (€)') : null,
    };
    const quitar = h('button', 'boton-icono quitar', '✕');
    quitar.type = 'button';
    quitar.title = 'Quitar esta línea';
    quitar.setAttribute('aria-label', 'Quitar esta línea');
    quitar.addEventListener('click', () => {
      if (filas.length === 1) return;
      filas.splice(filas.indexOf(f), 1);
      linea.remove();
      anadir.disabled = false;
      alCambiar();
    });
    linea.append(f.articulo, f.descripcion, ...(f.importe ? [f.importe] : []), quitar);
    for (const i of [f.articulo, f.descripcion, f.importe]) i?.addEventListener('input', alCambiar);
    filas.push(f);
    el.insertBefore(linea, anadir);
    anadir.disabled = filas.length >= 10;
  };
  anadir.addEventListener('click', () => {
    nueva();
    alCambiar();
  });
  el.append(anadir);
  nueva();
  return { el, filas };
}

/** Lee las líneas de artículos; devuelve el mensaje de error si alguna no vale. */
function leerArticulos(filas: FilaArticulo[], que: string): { articulo: string; descripcion: string; importe: number | null }[] | string {
  const salida: { articulo: string; descripcion: string; importe: number | null }[] = [];
  for (const [n, f] of filas.entries()) {
    const descripcion = f.descripcion.value.trim();
    if (!descripcion) return `Escribe ${que} de la línea ${n + 1}.`;
    const importe = f.importe ? enteroDe(f.importe) : null;
    if (f.importe && importe === null) return `El importe de la línea ${n + 1} tiene que ser un número entero de euros.`;
    salida.push({ articulo: f.articulo.value.trim(), descripcion, importe });
  }
  return salida;
}

async function paginaNuevo(tipo: TipoInformeMdt, personaId: string | null, aviso: number | null): Promise<HTMLElement[]> {
  const cabecera = encabezado(CONFIG.etiqueta, TIPO_INFORME[tipo].nuevo, 'Al firmarlo queda registrado con tu nombre y ya no se puede modificar ni borrar.');
  const ambito = CONFIG.ambito;
  if (!ambito || !puedeRedactar()) {
    const t = tarjeta();
    t.append(mensaje(`Solo ${ambito ? QUIEN_FIRMA[ambito] : 'su servicio'} pueden firmar este informe.`, 'mensaje error'));
    return [volverInformes(), cabecera, t];
  }
  if (!cacheOpciones) {
    const res = await window.mdt.opciones();
    if (!res.ok) {
      const t = tarjeta();
      t.append(mensaje(res.error, 'mensaje error'));
      return [volverInformes(), cabecera, t];
    }
    cacheOpciones = res.datos;
  }
  const op = cacheOpciones;
  const inicial = personaId ? await personaConocida(personaId) : null;

  // El mismo id para todos los intentos de este formulario: reenviarlo no duplica el informe.
  const id = uuid4();
  const form = h('form', 'formulario');
  form.autocomplete = 'off';
  form.noValidate = true;

  // Comunes a todas las plantillas.
  const lugar = entrada(120, 'Calle, código postal o sitio');
  const avisoCampo = campoNumero(1, 1_000_000_000, 'Opcional', aviso);
  const companeros = entrada(120, tipo === 'intervencion' ? 'B-01, B-03' : tipo === 'asistencia' ? 'SAMU-02, SAMU-05' : 'GC-04, GC-07');
  const comunes = h('div', 'rejilla-campos');
  comunes.append(grupo('Lugar', lugar), grupo('Aviso del CAD nº', avisoCampo, 'Si viene de un aviso'));

  const tarjetaPersona = tarjeta();
  const personaSel = tipo === 'intervencion' ? null : selectorPersona(inicial, tipo === 'asistencia');
  if (personaSel) tarjetaPersona.append(tituloTarjeta(tipo === 'asistencia' ? 'Paciente' : tipo === 'atestado' ? 'Detenido' : 'Denunciado', 'persona'), personaSel.el);

  const cuerpo = tarjeta();
  const errorEl = mensaje('', 'mensaje error');
  errorEl.hidden = true;
  let recoger: () => NuevoInformeMdt | string;

  const persona = (obligatoria: string): string | null | Error => {
    if (!personaSel) return null;
    if (personaSel.desconocido()) return null;
    const p = personaSel.valor();
    return p ? p.id : new Error(obligatoria);
  };
  const avisoValor = (): number | null | Error => {
    const v = enteroDe(avisoCampo);
    if (avisoCampo.value.trim() !== '' && (v === null || v < 1)) return new Error('El número de aviso no es válido.');
    return v;
  };
  const base = () => ({ id, lugar: lugar.value, companeros: companeros.value });

  if (tipo === 'denuncia') {
    const total = h('p', 'total', 'Total: 0 €');
    const lineas = lineasArticulos(true, () => {
      const suma = lineas.filas.reduce((s, f) => s + (f.importe ? (enteroDe(f.importe, 0) ?? 0) : 0), 0);
      total.textContent = `Total: ${euros(suma)}`;
    });
    const matricula = entrada(16, 'ABC-123');
    const hechos = areaTexto(500, 'Qué ha pasado, en pocas líneas');
    cuerpo.append(
      tituloTarjeta('Infracciones', 'libro'),
      mensaje('Artículo, infracción e importe, una por línea. El total se suma solo.', 'mensaje nota'),
      lineas.el,
      total,
      h('div', 'separador'),
      grupo('Vehículo (matrícula)', matricula, 'Opcional'),
      grupo('Hechos', hechos.el),
      grupo('Agentes que intervienen', companeros, 'Opcional'),
    );
    recoger = () => {
      const p = persona('Elige a la persona denunciada.');
      if (p instanceof Error) return p.message;
      const a = avisoValor();
      if (a instanceof Error) return a.message;
      const infracciones = leerArticulos(lineas.filas, 'la infracción');
      if (typeof infracciones === 'string') return infracciones;
      if (infracciones.reduce((s, i) => s + (i.importe ?? 0), 0) <= 0) return 'La denuncia necesita al menos una infracción con importe.';
      if (!hechos.area.value.trim()) return 'Escribe los hechos.';
      return {
        tipo: 'denuncia',
        ...base(),
        aviso: a,
        persona: p,
        infracciones: infracciones.map((i) => ({ articulo: i.articulo, descripcion: i.descripcion, importe: i.importe ?? 0 })),
        matricula: matricula.value,
        hechos: hechos.area.value,
      };
    };
  } else if (tipo === 'atestado') {
    const lineas = lineasArticulos(false, () => undefined);
    const multa = campoNumero(0, 1_000_000_000, '0');
    const minutos = campoNumero(0, 1440, '0');
    const reclusion = selector(op.reclusiones);
    const derechos = casilla('Se le han leído sus derechos');
    const abogado = casilla('Ha pedido abogado');
    const intervenido = areaTexto(300, 'Armas, dinero, sustancias… (opcional)');
    const hechos = areaTexto(1000, 'Relato de los hechos');
    const pruebas = Array.from({ length: 5 }, () => entrada(300, 'https://…'));
    const cajaPruebas = h('div', 'pruebas');
    cajaPruebas.append(...pruebas);
    const condena = h('div', 'rejilla-campos');
    condena.append(grupo('Multa (€)', multa, '0 si no hay'), grupo('Minutos de cárcel', minutos, '0 si no hay (máx. 1440)'), grupo('Dónde cumple', reclusion));
    cuerpo.append(
      tituloTarjeta('Delitos', 'libro'),
      lineas.el,
      h('div', 'separador'),
      tituloTarjeta('Condena', 'orden'),
      condena,
      mensaje('Sin multa ni cárcel queda detenido a disposición judicial, sin condena.', 'mensaje nota'),
      h('div', 'separador'),
      derechos.el,
      abogado.el,
      grupo('Objetos intervenidos', intervenido.el),
      grupo('Relato de los hechos', hechos.el),
      grupo('Agentes que intervienen', companeros, 'Opcional'),
      grupo('Pruebas (enlaces)', cajaPruebas, `Opcional. Solo https de: ${op.webs.join(', ')}`),
    );
    recoger = () => {
      const p = persona('Elige a la persona detenida.');
      if (p instanceof Error) return p.message;
      const a = avisoValor();
      if (a instanceof Error) return a.message;
      const delitos = leerArticulos(lineas.filas, 'el delito');
      if (typeof delitos === 'string') return delitos;
      const m = enteroDe(multa, 0);
      const min = enteroDe(minutos, 0);
      if (m === null) return 'La multa tiene que ser un número entero de euros.';
      if (min === null || min > 1440) return 'Los minutos de cárcel van de 0 a 1440.';
      if (!derechos.input.checked) return 'Marca que se le han leído sus derechos: sin eso no hay atestado.';
      if (!hechos.area.value.trim()) return 'Escribe el relato de los hechos.';
      const enlaces = pruebas.map((i) => i.value.trim()).filter(Boolean);
      for (const [n, url] of enlaces.entries()) {
        let host = '';
        try {
          const u = new URL(url);
          host = u.protocol === 'https:' ? u.hostname.toLowerCase() : '';
        } catch {
          host = '';
        }
        if (!op.webs.includes(host)) return `La prueba ${n + 1} no es un enlace https de una web permitida.`;
      }
      return {
        tipo: 'atestado',
        ...base(),
        aviso: a,
        persona: p,
        delitos: delitos.map((d) => ({ articulo: d.articulo, descripcion: d.descripcion })),
        multa: m,
        minutos: min,
        reclusion: reclusion.value,
        derechos: true,
        abogado: abogado.input.checked,
        intervenido: intervenido.area.value,
        hechos: hechos.area.value,
        pruebas: enlaces,
      };
    };
  } else if (tipo === 'asistencia') {
    const motivo = selector(op.motivos);
    const gravedad = selector(op.gravedades);
    const consciencia = selector(op.consciencias);
    const respiracion = selector(op.respiraciones);
    const pulso = selector(op.pulsos);
    const traslado = selector(op.traslados);
    const lesiones = areaTexto(300, 'Lesiones y diagnóstico');
    const tratamiento = areaTexto(300, 'Tratamiento aplicado (opcional)');
    const parte = casilla('Comunicar parte de lesiones a la Guardia Civil (agresiones, armas, tráfico…). Solo le llega quién, cuándo, la gravedad y el motivo.');
    const rejilla1 = h('div', 'rejilla-campos');
    rejilla1.append(grupo('Motivo', motivo), grupo('Gravedad', gravedad));
    const rejilla2 = h('div', 'rejilla-campos');
    rejilla2.append(grupo('Consciencia', consciencia), grupo('Respiración', respiracion), grupo('Pulso', pulso));
    cuerpo.append(
      tituloTarjeta('Asistencia', 'cruz'),
      rejilla1,
      rejilla2,
      grupo('Lesiones y diagnóstico', lesiones.el),
      grupo('Tratamiento', tratamiento.el),
      grupo('Traslado', traslado),
      grupo('Sanitarios que intervienen', companeros, 'Opcional'),
      parte.el,
    );
    recoger = () => {
      const p = persona('Elige al paciente o marca «paciente sin identificar».');
      if (p instanceof Error) return p.message;
      const a = avisoValor();
      if (a instanceof Error) return a.message;
      if (!lesiones.area.value.trim()) return 'Escribe las lesiones y el diagnóstico.';
      return {
        tipo: 'asistencia',
        ...base(),
        aviso: a,
        persona: p,
        motivo: motivo.value,
        gravedad: gravedad.value,
        consciencia: consciencia.value,
        respiracion: respiracion.value,
        pulso: pulso.value,
        lesiones: lesiones.area.value,
        tratamiento: tratamiento.area.value,
        traslado: traslado.value,
        parteLesiones: parte.input.checked,
      };
    };
  } else {
    const clase = selector(op.clases);
    const local = selector([{ value: '', label: '— Ninguno —' }]);
    const causa = selector(op.causas);
    const danos = selector(op.danos);
    const heridos = campoNumero(0, 99, '0');
    const samu = casilla('Los heridos los ha atendido el SAMU');
    const actuacion = areaTexto(1000, 'Qué habéis hecho: extinción, rescate, ventilación…');
    // Locales del catálogo con su empresa (los mismos de la sección Locales).
    void window.mdt.locales('').then((res) => {
      if (!res.ok) return;
      for (const l of res.datos) {
        const o = h('option', '', l.empresa ? `${l.nombre} · ${l.empresa.nombre}` : `${l.nombre} · libre`);
        o.value = l.id;
        local.append(o);
      }
    });
    const rejilla1 = h('div', 'rejilla-campos');
    rejilla1.append(grupo('Tipo', clase), grupo('Local afectado', local, 'Si fue en un local'));
    const rejilla2 = h('div', 'rejilla-campos');
    rejilla2.append(grupo('Causa', causa), grupo('Daños', danos), grupo('Heridos', heridos));
    cuerpo.append(
      tituloTarjeta('Intervención', 'llama'),
      rejilla1,
      rejilla2,
      samu.el,
      grupo('Actuación', actuacion.el),
      grupo('Unidades que intervienen', companeros, 'Opcional'),
      mensaje('Si la causa es intencionada, el parte se manda también a la Guardia Civil para que lo investigue.', 'mensaje nota'),
    );
    recoger = () => {
      const a = avisoValor();
      if (a instanceof Error) return a.message;
      const n = enteroDe(heridos, 0);
      if (n === null || n > 99) return 'Los heridos van de 0 a 99.';
      if (!actuacion.area.value.trim()) return 'Escribe la actuación.';
      return {
        tipo: 'intervencion',
        ...base(),
        aviso: a,
        clase: clase.value,
        local: local.value || null,
        causa: causa.value,
        danos: danos.value,
        heridos: n,
        atendidosSamu: samu.input.checked,
        actuacion: actuacion.area.value,
      };
    };
  }

  const tarjetaLugar = tarjeta();
  tarjetaLugar.append(tituloTarjeta('Dónde y cuándo', 'ubicacion'), comunes, mensaje('La fecha y la hora las pone el bot al firmar.', 'mensaje nota'));

  // Firma en dos pulsaciones: la primera pide confirmación (un informe firmado no se puede deshacer).
  const firmar = h('button', 'boton primario boton-ancho');
  firmar.type = 'submit';
  const TEXTO_FIRMAR = 'Firmar y publicar';
  firmar.textContent = TEXTO_FIRMAR;
  let confirmando = 0;
  const final = tarjeta();
  final.append(errorEl, firmar);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // la CSP no deja enviar formularios: todo va por el socket
    if (firmar.disabled) return;
    errorEl.hidden = true;
    const datos = recoger();
    if (typeof datos === 'string') {
      errorEl.textContent = datos;
      errorEl.hidden = false;
      return;
    }
    if (!confirmando) {
      firmar.textContent = 'Pulsa otra vez para confirmar la firma';
      confirmando = window.setTimeout(() => {
        confirmando = 0;
        firmar.textContent = TEXTO_FIRMAR;
      }, 6000);
      return;
    }
    clearTimeout(confirmando);
    confirmando = 0;
    firmar.disabled = true;
    firmar.textContent = 'Firmando…';
    const res = await window.mdt.crearInforme(datos);
    if (!res.ok) {
      firmar.disabled = false;
      firmar.textContent = TEXTO_FIRMAR;
      errorEl.textContent = res.error;
      errorEl.hidden = false;
      return;
    }
    recienCreado = res.datos;
    // La ficha de la persona cambia (multa nueva, historial): que no se vea la de antes.
    const p = personaSel?.valor();
    if (p) {
      cacheFichas.delete(p.id);
      cachePacientes.delete(p.id);
    }
    ir(`#/informe/${res.datos.id}`);
  });

  if (personaSel) form.append(tarjetaPersona);
  form.append(tarjetaLugar, cuerpo, final);
  return [volverInformes(), cabecera, form];
}

// ---------------------------------------------------------------------------
// Pintado y navegación
// ---------------------------------------------------------------------------

let pintando = 0;

async function pintar(): Promise<void> {
  if (!dentro()) return;
  const ruta = rutaActual();
  const turno = ++pintando;
  avisosVivos = null;
  const seccion = ruta.pagina === 'persona' ? 'personas' : ruta.pagina === 'paciente' ? 'pacientes' : ruta.pagina === 'informe' || ruta.pagina === 'nuevo' ? 'informes' : ruta.pagina;
  for (const a of ui.navegacion.querySelectorAll<HTMLAnchorElement>('a[data-ruta]')) {
    const activa = a.dataset.ruta === seccion;
    a.classList.toggle('activa', activa);
    if (activa) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const apps = estadoActual.apps;
  let piezas: HTMLElement[];
  if (APP === 'portal') piezas = paginaPortal();
  else if (!conocidas(apps)) piezas = [encabezado(CONFIG.etiqueta, 'Conectando…')];
  else if (!CONFIG.puede(apps)) piezas = paginaSinAcceso();
  else if (ruta.pagina === 'personas' || ruta.pagina === 'pacientes') piezas = await paginaPersonas(ruta.q);
  else if (ruta.pagina === 'vehiculos') piezas = await paginaVehiculos(ruta.q, ruta.r, ruta.p);
  else if (ruta.pagina === 'requisitorias') piezas = await paginaRequisitorias(ruta.todas);
  else if (ruta.pagina === 'persona') piezas = await paginaPersona(ruta.id);
  else if (ruta.pagina === 'paciente') piezas = await paginaPaciente(ruta.id);
  else if (ruta.pagina === 'locales') piezas = await paginaLocales(ruta.q, ruta.revisar);
  else if (ruta.pagina === 'informes') piezas = paginaInformes();
  else if (ruta.pagina === 'informe') piezas = await paginaInforme(ruta.id);
  else if (ruta.pagina === 'nuevo') piezas = await paginaNuevo(ruta.tipo, ruta.persona, ruta.aviso);
  else if (APP === 'samu') piezas = paginaInicioServicio('sanitarios');
  else if (APP === 'bombers') piezas = paginaInicioServicio('bomberos');
  else piezas = paginaInicio();
  if (turno !== pintando) return; // otra navegación más reciente ya se está pintando
  const pagina = h('div', 'pagina');
  // Aviso de derechos al pie de cada página (ver LICENSE).
  pagina.append(...piezas, h('p', 'legal', '© 2026 Ibiza Roleplay · Todos los derechos reservados'));
  ui.contenido.replaceChildren(pagina);
  ui.contenido.scrollTop = 0;
}

const dentro = () => estadoActual.conSesion || estadoActual.conexion !== 'desconectado';

ui.navCad.addEventListener('click', () => abrirCad());

function aplicarEstado(estado: EstadoMdt): void {
  const antes = dentro();
  // Al llegar la bienvenida (nombre y aplicaciones) se vuelve a pintar; un cambio de conexión, no.
  const cambia =
    JSON.stringify([estado.nombre, estado.apps, estado.redactar, estado.requisitorias, estado.inspeccionar]) !==
    JSON.stringify([estadoActual.nombre, estadoActual.apps, estadoActual.redactar, estadoActual.requisitorias, estadoActual.inspeccionar]);
  estadoActual = estado;
  const ahora = dentro();
  const sinAcceso = APP !== 'portal' && conocidas(estado.apps) && !CONFIG.puede(estado.apps);
  ui.conexion.className = `conexion ${estado.conexion}`;
  ui.conexionTexto.textContent = TEXTO_CONEXION[estado.conexion];
  ui.agente.textContent = ahora && estado.nombre ? estado.nombre : '';
  ui.btnSalir.hidden = !ahora;
  ui.btnApps.hidden = !ahora || APP === 'portal';
  ui.contenido.hidden = !ahora;
  ui.navegacion.hidden = !ahora || APP === 'portal' || sinAcceso;
  ui.navCad.hidden = !estado.apps.cad;
  ui.login.hidden = ahora;
  if (ahora && (!antes || cambia || ui.contenido.childElementCount === 0)) void pintar();
  if (!ahora) ui.codigo.focus();
}

ui.btnLogin.addEventListener('click', async () => {
  ui.loginAviso.textContent = 'Conectando…';
  const res = await window.mdt.login(ui.codigo.value);
  ui.loginAviso.textContent = res.ok ? '' : (res.error ?? 'No se pudo entrar.');
  if (res.ok) ui.codigo.value = '';
});
ui.codigo.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ui.btnLogin.click();
});
ui.btnSalir.addEventListener('click', async () => {
  await window.mdt.cerrarSesion();
  cachePersonas.q = '';
  cachePersonas.lista = null;
  cacheVehiculos.q = '';
  cacheVehiculos.lista = null;
  cacheRegistro.clear();
  cacheLocales.lista = null;
  cacheFichas.clear();
  cachePacientes.clear();
  cacheOpciones = null;
  recienCreado = null;
  ui.contenido.replaceChildren();
  location.hash = '#/';
});

window.mdt.alEvento((evento) => {
  if (evento.tipo === 'estado') aplicarEstado(evento.estado);
  else if (evento.tipo === 'error') ui.loginAviso.textContent = evento.mensaje;
  else ui.loginAviso.textContent = 'Tu sesión se ha cerrado o ya no tienes acceso a Emergencias. Pide un código nuevo con /consola codigo.';
});

// Avisos del inicio del SAMU y de Bombers: se refrescan solos mientras se ven.
setInterval(() => {
  if (avisosVivos?.caja.isConnected && document.visibilityState === 'visible' && estadoActual.conexion === 'conectado') void cargarAvisos(avisosVivos.caja, avisosVivos.servicio);
}, 20_000);

// Reloj de la barra de estado de la tablet.
function pintarHora(): void {
  ui.hora.textContent = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
pintarHora();
setInterval(pintarHora, 15_000);

void window.mdt.estado().then(aplicarEstado);

// Módulo propio: sus nombres no chocan con los del CAD (`renderer.ts`), que es un script global.
export {};
