import { io, type Socket } from 'socket.io-client';
import {
  avisosLimpios,
  creadoLimpio,
  esUuid,
  fichaLimpia,
  informeLimpio,
  informesLimpios,
  inspeccionesLimpias,
  localesLimpios,
  matriculasLimpias,
  normalizarCodigo,
  opcionesLimpias,
  pacienteSamuLimpio,
  personasLimpias,
  registroLimpio,
  requisitoriasLimpias,
  texto,
  unaInspeccion,
  unaRequisitoria,
} from '../validar';

/**
 * Portal de emergencias y sus MDT. Expone a la interfaz (`mdt/app.ts`) la API `window.mdt` sobre el
 * canal `/mdt` del bot, que sirve esta página en `/emergencias/` y en la ruta de cada MDT (mismo
 * origen). Qué aplicaciones se ven lo dice el bot por los roles, y lo vuelve a mirar en cada consulta.
 *
 * La sesión se guarda en `localStorage` con la MISMA clave que el CAD: con entrar en uno, el otro
 * ya no pide código. Todo lo que llega del bot pasa por `validar.ts` antes de llegar a la interfaz.
 */

const CLAVE_SESION = 'ibiza-cad:sesion';

interface SesionGuardada {
  token: string;
  expiresAt: number;
  servidor: string;
}

const servidor = (): string => location.origin.replace(/^http/, 'ws');

function leerSesion(): SesionGuardada | null {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_SESION) ?? 'null') as Partial<SesionGuardada> | null;
    if (!datos || !texto(datos.token, 200) || typeof datos.expiresAt !== 'number' || datos.expiresAt <= Date.now()) return null;
    if (datos.servidor !== servidor()) return null;
    return { token: datos.token, expiresAt: datos.expiresAt, servidor: datos.servidor };
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

function guardarSesion(datos: SesionGuardada): void {
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento: la sesión dura lo que la pestaña abierta.
  }
}

function olvidarSesion(): void {
  sesion = null;
  try {
    localStorage.removeItem(CLAVE_SESION);
  } catch {
    // Nada que borrar.
  }
}

const ERRORES: Record<string, string> = {
  'codigo-invalido': 'Código no válido o caducado. Pide otro con /consola codigo.',
  'sesion-invalida': 'Tu sesión ha caducado o se ha cerrado. Entra de nuevo con un código.',
  'sin-permiso': 'Emergencias es solo para la Guardia Civil, el SAMU, Bombers, jueces, fiscales y staff.',
  'no-autorizado': 'Falta el código de acceso.',
  'demasiadas-sesiones': 'Ya tienes Emergencias abierto en otros dos sitios.',
  'demasiados intentos': 'Demasiados intentos fallidos. Espera unos minutos.',
  'origen no permitido': 'El servidor ha rechazado la conexión.',
  'error-interno': 'Error del servidor. Inténtalo de nuevo en un momento.',
};
const DEFINITIVOS = new Set(['codigo-invalido', 'sesion-invalida', 'sin-permiso', 'no-autorizado', 'demasiadas-sesiones', 'demasiados intentos', 'origen no permitido']);

const ERRORES_CONSULTA: Record<string, string> = {
  'sin-permiso': 'No tienes acceso a este MDT.',
  'rate-limit': 'Vas demasiado rápido: espera un momento.',
  'no-existe': 'Esa persona ya no tiene DNI (quizá le han hecho un CK).',
  'no-existe-informe': 'Ese informe no existe.',
  'payload-invalido': 'Búsqueda no válida.',
  'error-interno': 'Error del servidor.',
};

let socket: Socket | null = null;
let sesion: SesionGuardada | null = null;
let conexion: EstadoConexionCad = 'desconectado';
let nombre: string | null = null;
const SIN_APPS: AppsEmergencias = { cad: false, cadProximamente: false, guardiaCivil: false, samu: false, bombers: false };
const SIN_REDACTAR: EstadoMdt['redactar'] = { guardiaCivil: false, samu: false, bombers: false };
const SIN_REQUISITORIAS: EstadoMdt['requisitorias'] = { emitir: false, ejecutar: false };
let apps: AppsEmergencias = SIN_APPS;
let redactar = SIN_REDACTAR;
let requisitorias = SIN_REQUISITORIAS;
let inspeccionar = false;
let staff = false;

let suscriptor: ((evento: EventoMdt) => void) | null = null;
const anteriores: EventoMdt[] = [];
function emitir(evento: EventoMdt): void {
  if (suscriptor) suscriptor(evento);
  else anteriores.push(evento);
}

function estado(): EstadoMdt {
  return { conexion, conSesion: !!sesion, nombre, apps, redactar, requisitorias, inspeccionar, staff };
}

function setConexion(nueva: EstadoConexionCad): void {
  if (conexion === nueva) return;
  conexion = nueva;
  emitir({ tipo: 'estado', estado: estado() });
}

function desconectar(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  setConexion('desconectado');
}

function conectar(auth: { code: string } | { session: string }): void {
  desconectar();
  setConexion('conectando');
  const s = io(`${servidor()}/mdt`, { transports: ['websocket'], auth, timeout: 10_000, reconnectionDelayMax: 30_000 });
  socket = s;

  s.on('connect', () => setConexion('conectado'));
  s.on('disconnect', (motivo) => setConexion(motivo === 'io server disconnect' ? 'desconectado' : 'reconectando'));
  s.on('connect_error', (err: Error) => {
    if (DEFINITIVOS.has(err.message)) {
      if (err.message === 'sesion-invalida') olvidarSesion();
      desconectar();
      emitir({ tipo: 'error', mensaje: ERRORES[err.message] ?? err.message });
      emitir({ tipo: 'estado', estado: estado() });
      return;
    }
    setConexion('reconectando');
  });

  s.on('mdt:bienvenida', (datos: {
    nombre?: unknown;
    apps?: Record<string, unknown>;
    redactar?: Record<string, unknown>;
    requisitorias?: Record<string, unknown>;
    inspeccionar?: unknown;
    staff?: unknown;
    sesion?: { token?: unknown; expiresAt?: unknown };
  }) => {
    nombre = texto(datos?.nombre, 80) ? datos.nombre : null;
    const a = typeof datos?.apps === 'object' && datos.apps !== null ? datos.apps : {};
    apps = { cad: a.cad === true, cadProximamente: a.cadProximamente === true, guardiaCivil: a.guardiaCivil === true, samu: a.samu === true, bombers: a.bombers === true };
    const r = typeof datos?.redactar === 'object' && datos.redactar !== null ? datos.redactar : {};
    redactar = { guardiaCivil: r.guardiaCivil === true, samu: r.samu === true, bombers: r.bombers === true };
    const q = typeof datos?.requisitorias === 'object' && datos.requisitorias !== null ? datos.requisitorias : {};
    requisitorias = { emitir: q.emitir === true, ejecutar: q.ejecutar === true };
    inspeccionar = datos?.inspeccionar === true;
    staff = datos?.staff === true;
    const nueva = datos?.sesion;
    if (nueva && texto(nueva.token, 200) && typeof nueva.expiresAt === 'number') {
      sesion = { token: nueva.token, expiresAt: nueva.expiresAt, servidor: servidor() };
      guardarSesion(sesion);
      s.auth = { session: nueva.token };
    }
    emitir({ tipo: 'estado', estado: estado() });
  });
  s.on('mdt:expulsado', (datos: { motivo?: unknown }) => {
    if (datos?.motivo === 'sesion-invalida') olvidarSesion();
    desconectar();
    emitir({ tipo: 'expulsado', motivo: texto(datos?.motivo, 40) ? datos.motivo : 'desconocido' });
    emitir({ tipo: 'estado', estado: estado() });
  });
}

/** Pide algo al bot y valida la respuesta; los errores llegan traducidos o con el texto del bot. */
async function pedir<T>(
  evento: string,
  payload: Record<string, unknown>,
  limpiar: (d: unknown) => T | null,
  nuloValido = false,
  errores: Record<string, string> = ERRORES_CONSULTA,
): Promise<RespuestaMdt<T>> {
  if (!socket?.connected) return { ok: false, error: 'Sin conexión con el bot.' };
  try {
    const res = (await socket.timeout(10_000).emitWithAck(evento, payload)) as { ok?: unknown; error?: unknown; mensaje?: unknown; datos?: unknown };
    if (res?.ok === true) {
      if (nuloValido && res.datos === null) return { ok: true, datos: null as T };
      const datos = limpiar(res.datos);
      return datos === null ? { ok: false, error: 'El bot ha enviado datos no válidos.' } : { ok: true, datos };
    }
    if (res?.error === 'mensaje' && texto(res.mensaje, 200)) return { ok: false, error: res.mensaje };
    const codigo = texto(res?.error, 40) ? res.error : 'error-interno';
    return { ok: false, error: errores[codigo] ?? ERRORES_CONSULTA[codigo] ?? 'No se pudo hacer.' };
  } catch {
    return { ok: false, error: 'El bot no ha respondido.' };
  }
}

const busqueda = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 && v.length <= 40 ? v.trim() : null);
const AMBITOS: readonly AmbitoInformeMdt[] = ['guardiaCivil', 'samu', 'bombers'];
const RESULTADOS: readonly ResultadoInspeccionMdt[] = ['apto', 'deficiencias', 'no-apto'];
const ERRORES_FIRMA: Record<string, string> = { 'payload-invalido': 'Revisa el formulario: hay algún campo que no es válido.' };

const api: MdtApi = {
  estado: async () => estado(),
  login: async (codigo) => {
    const limpio = typeof codigo === 'string' ? normalizarCodigo(codigo) : null;
    if (!limpio) return { ok: false, error: 'El código tiene 10 caracteres (por ejemplo, ABCDE-FGHJK).' };
    conectar({ code: limpio });
    return { ok: true };
  },
  personas: async (t) => {
    const q = busqueda(t);
    return q ? pedir('mdt:buscar', { tipo: 'persona', texto: q }, personasLimpias) : { ok: false, error: 'Escribe qué buscar (como mucho 40 caracteres).' };
  },
  matriculas: async (t) => {
    const q = busqueda(t);
    return q ? pedir('mdt:buscar', { tipo: 'matricula', texto: q }, matriculasLimpias) : { ok: false, error: 'Escribe la matrícula.' };
  },
  registroVehiculos: async (t, p) =>
    pedir('mdt:registro-vehiculos', { texto: typeof t === 'string' ? t.trim().slice(0, 40) : '', pagina: Number.isInteger(p) && p >= 0 && p <= 500 ? p : 0 }, registroLimpio),
  ficha: async (id) => (esUuid(id) ? pedir('mdt:ficha', { id }, fichaLimpia) : { ok: false, error: 'Ficha no válida.' }),
  pacientes: async (t) => {
    const q = busqueda(t);
    return q ? pedir('mdt:pacientes', { texto: q }, personasLimpias) : { ok: false, error: 'Escribe qué buscar (como mucho 40 caracteres).' };
  },
  paciente: async (id) => (esUuid(id) ? pedir('mdt:paciente', { id }, pacienteSamuLimpio) : { ok: false, error: 'Ficha no válida.' }),
  requisitorias: async (e) => pedir('mdt:requisitorias', { estado: e === 'todas' ? 'todas' : 'activas' }, requisitoriasLimpias),
  crearRequisitoria: async (d) =>
    esUuid(d?.id) && esUuid(d.persona) && texto(d.motivo, 500)
      ? pedir('mdt:requisitoria:crear', { id: d.id, persona: d.persona, motivo: d.motivo }, unaRequisitoria, false, ERRORES_FIRMA)
      : { ok: false, error: 'Formulario no válido.' },
  cerrarRequisitoria: async (id, accion, nota) =>
    esUuid(id) && (accion === 'ejecutar' || accion === 'anular') && texto(nota, 300)
      ? pedir('mdt:requisitoria:cerrar', { id, accion, nota }, unaRequisitoria, false, ERRORES_FIRMA)
      : { ok: false, error: 'Formulario no válido.' },
  avisos: async (servicio) => pedir('mdt:avisos', { servicio: servicio === 'bomberos' ? 'bomberos' : 'sanitarios' }, avisosLimpios),
  locales: async (t) => {
    const q = typeof t === 'string' ? t.trim().slice(0, 40) : '';
    return pedir('mdt:locales', { texto: q }, localesLimpios);
  },
  inspecciones: async (local) => (texto(local, 40) && local.length > 0 ? pedir('mdt:inspecciones', { local }, inspeccionesLimpias) : { ok: false, error: 'Local no válido.' }),
  crearInspeccion: async (d) =>
    esUuid(d?.id) &&
    texto(d.local, 40) &&
    d.local.length > 0 &&
    RESULTADOS.includes(d.resultado) &&
    Number.isInteger(d.dias) &&
    d.dias >= 0 &&
    d.dias <= 90 &&
    texto(d.notas, 500)
      ? pedir('mdt:inspeccion:crear', { id: d.id, local: d.local, resultado: d.resultado, dias: d.dias, notas: d.notas }, unaInspeccion, false, ERRORES_FIRMA)
      : { ok: false, error: 'Formulario no válido.' },
  opciones: async () => pedir('mdt:opciones', {}, opcionesLimpias),
  informes: async (ambito, persona) =>
    AMBITOS.includes(ambito) && (persona === null || esUuid(persona)) ? pedir('mdt:informes', { ambito, persona }, informesLimpios) : { ok: false, error: 'Consulta no válida.' },
  informe: async (id) => (esUuid(id) ? pedir('mdt:informe', { id }, informeLimpio) : { ok: false, error: 'Informe no válido.' }),
  crearInforme: async (datos) => (esUuid(datos?.id) ? pedir('mdt:informe:crear', datos, creadoLimpio, false, ERRORES_FIRMA) : { ok: false, error: 'Formulario no válido.' }),
  cerrarSesion: async () => {
    if (socket?.connected) await socket.timeout(5000).emitWithAck('mdt:cerrar-sesion').catch(() => undefined);
    olvidarSesion();
    desconectar();
    nombre = null;
    apps = SIN_APPS;
    redactar = SIN_REDACTAR;
    requisitorias = SIN_REQUISITORIAS;
    inspeccionar = false;
    staff = false;
    emitir({ tipo: 'estado', estado: estado() });
  },
  alEvento: (callback) => {
    suscriptor = callback;
    for (const evento of anteriores.splice(0)) callback(evento);
  },
};

Object.defineProperty(window, 'mdt', { value: Object.freeze(api), writable: false, configurable: false });

/** Enlace con el código (`/emergencias/#codigo=ABCDE-FGHJK`): entra sin pegar nada y se borra de la barra. */
function codigoDelEnlace(): string | null {
  const codigo = new URLSearchParams(location.hash.slice(1)).get('codigo');
  if (codigo) history.replaceState(null, '', location.pathname + location.search);
  return codigo ? normalizarCodigo(codigo) : null;
}

const codigoEnlace = codigoDelEnlace();
const guardada = leerSesion();
if (codigoEnlace) {
  conectar({ code: codigoEnlace });
} else if (guardada) {
  sesion = guardada;
  conectar({ session: guardada.token });
}
