import { io, type Socket } from 'socket.io-client';
import { avisoLimpio, esUuid, lugaresLimpios, normalizarCodigo, texto, unidadesLimpias, yoLimpio } from '../validar';

/**
 * CAD web. Expone a la interfaz (`renderer.ts`) la API `window.cad` sobre el canal `/cad` del bot.
 * El bot sirve esta página en `/cad/`: el servidor es siempre el mismo origen.
 *
 * La sesión se guarda en `localStorage` de este dominio. La CSP estricta y el pintado con
 * `textContent` evitan que un script ajeno la lea. Todo lo que llega del bot pasa por
 * `validar.ts` antes de llegar a la interfaz.
 */

const CLAVE_SESION = 'ibiza-cad:sesion';

interface SesionGuardada {
  token: string;
  expiresAt: number;
  servidor: string;
}

/** El propio origen de la página, en ws:// o wss://. */
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
    // Sin almacenamiento (modo privado): la sesión dura lo que la pestaña abierta.
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
  'sin-permiso': 'Ahora mismo no tienes acceso al CAD.',
  'no-autorizado': 'Falta el código de acceso.',
  'demasiadas-sesiones': 'Ya tienes el CAD abierto en otros dos sitios.',
  'demasiados intentos': 'Demasiados intentos fallidos. Espera unos minutos.',
  'origen no permitido': 'El servidor ha rechazado la conexión.',
  'error-interno': 'Error del servidor. Inténtalo de nuevo en un momento.',
};
/** Errores que no se arreglan reintentando: se corta y se avisa. */
const DEFINITIVOS = new Set(['codigo-invalido', 'sesion-invalida', 'sin-permiso', 'no-autorizado', 'demasiadas-sesiones', 'demasiados intentos', 'origen no permitido']);

const ERRORES_ACCION: Record<string, string> = {
  'ya-cambiado': 'Otra unidad se ha adelantado: el aviso ya estaba atendido o cerrado.',
  'no-existe': 'Ese aviso ya no existe.',
  'sin-permiso': 'Ya no tienes acceso al CAD.',
  'rate-limit': 'Vas demasiado rápido.',
  'payload-invalido': 'Acción no válida.',
  'error-interno': 'Error del servidor.',
};

let socket: Socket | null = null;
let sesion: SesionGuardada | null = null;
let conexion: EstadoConexionCad = 'desconectado';
let nombre: string | null = null;
let robloxId: string | null = null;

// La interfaz se suscribe al cargar; lo que llegue antes se guarda y se le entrega entonces.
let suscriptor: ((evento: EventoCad) => void) | null = null;
const anteriores: EventoCad[] = [];
function emitir(evento: EventoCad): void {
  if (suscriptor) suscriptor(evento);
  else anteriores.push(evento);
}

function estado(): EstadoCad {
  return { conexion, conSesion: !!sesion, nombre, robloxId };
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
  const s = io(`${servidor()}/cad`, { transports: ['websocket'], auth, timeout: 10_000, reconnectionDelayMax: 30_000 });
  socket = s;

  s.on('connect', () => setConexion('conectado'));
  s.on('disconnect', (motivo) => setConexion(motivo === 'io server disconnect' ? 'desconectado' : 'reconectando'));
  s.on('connect_error', (err: Error) => {
    if (DEFINITIVOS.has(err.message)) {
      // Sin permiso para el CAD la sesión sigue valiendo para el portal y los MDT (la comparten):
      // aquí se suelta, pero no se borra del navegador.
      if (err.message === 'sesion-invalida') olvidarSesion();
      else if (err.message === 'sin-permiso') sesion = null;
      desconectar();
      emitir({ tipo: 'error', mensaje: ERRORES[err.message] ?? err.message });
      emitir({ tipo: 'estado', estado: estado() });
      return;
    }
    // Red caída o bot apagado: Socket.IO reintenta solo.
    setConexion('reconectando');
  });

  s.on('cad:bienvenida', (datos: { nombre?: unknown; robloxId?: unknown; sesion?: { token?: unknown; expiresAt?: unknown } }) => {
    nombre = texto(datos?.nombre, 64) ? datos.nombre : null;
    robloxId = texto(datos?.robloxId, 32) ? datos.robloxId : null;
    const nueva = datos?.sesion;
    if (nueva && texto(nueva.token, 200) && typeof nueva.expiresAt === 'number') {
      sesion = { token: nueva.token, expiresAt: nueva.expiresAt, servidor: servidor() };
      guardarSesion(sesion);
      // Los reintentos usan la sesión: el código era de un solo uso.
      s.auth = { session: nueva.token };
    }
    emitir({ tipo: 'estado', estado: estado() });
  });
  s.on('cad:avisos', (lista: unknown) => {
    if (!Array.isArray(lista)) return;
    // Como mucho 100: un servidor comprometido no puede inundar la interfaz.
    emitir({ tipo: 'avisos', avisos: lista.slice(0, 100).map(avisoLimpio).filter((a): a is AvisoCad => a !== null) });
  });
  s.on('cad:aviso', (datos: unknown) => {
    const aviso = avisoLimpio(datos);
    if (aviso) emitir({ tipo: 'aviso', aviso });
  });
  s.on('cad:unidades', (datos: unknown) => {
    const unidades = unidadesLimpias(datos);
    if (unidades) emitir({ tipo: 'unidades', unidades });
  });
  s.on('cad:yo', (datos: unknown) => emitir({ tipo: 'yo', yo: yoLimpio(datos) }));
  s.on('cad:lugares', (datos: unknown) => {
    const lugares = lugaresLimpios(datos);
    if (lugares) emitir({ tipo: 'lugares', lugares });
  });
  s.on('cad:expulsado', (datos: { motivo?: unknown }) => {
    if (datos?.motivo === 'sesion-invalida') olvidarSesion();
    else sesion = null; // quizá sigue valiendo para el portal y los MDT
    desconectar();
    emitir({ tipo: 'expulsado', motivo: texto(datos?.motivo, 40) ? datos.motivo : 'desconocido' });
    emitir({ tipo: 'estado', estado: estado() });
  });
}

const api: CadApi = {
  estado: async () => estado(),
  login: async (codigo) => {
    const limpio = typeof codigo === 'string' ? normalizarCodigo(codigo) : null;
    if (!limpio) return { ok: false, error: 'El código tiene 10 caracteres (por ejemplo, ABCDE-FGHJK).' };
    conectar({ code: limpio });
    return { ok: true };
  },
  accion: async (id, accion) => {
    if (!esUuid(id) || (accion !== 'atender' && accion !== 'cerrar')) return { ok: false, error: 'Acción no válida.' };
    if (!socket?.connected) return { ok: false, error: 'Sin conexión con el bot.' };
    try {
      const res = (await socket.timeout(8000).emitWithAck('cad:accion', { id, accion })) as { ok?: unknown; error?: unknown };
      if (res?.ok === true) return { ok: true };
      const codigo = texto(res?.error, 40) ? res.error : 'error-interno';
      return { ok: false, error: ERRORES_ACCION[codigo] ?? 'No se pudo hacer.' };
    } catch {
      return { ok: false, error: 'El bot no ha respondido.' };
    }
  },
  cerrarSesion: async () => {
    // Se revoca también en el bot: si no, el token seguiría valiendo hasta caducar.
    if (socket?.connected) await socket.timeout(5000).emitWithAck('cad:cerrar-sesion').catch(() => undefined);
    olvidarSesion();
    desconectar();
    nombre = null;
    robloxId = null;
    emitir({ tipo: 'estado', estado: estado() });
  },
  alEvento: (callback) => {
    suscriptor = callback;
    for (const evento of anteriores.splice(0)) callback(evento);
  },
};

// No se puede reemplazar desde fuera (un script colado no podría interceptar el código).
Object.defineProperty(window, 'cad', { value: Object.freeze(api), writable: false, configurable: false });

/**
 * Enlace con el código (`/cad/#codigo=ABCDE-FGHJK`): entra sin pegar nada. El código va tras `#`,
 * así que el navegador no lo envía al servidor ni sale en ningún registro, y se borra de la barra
 * de direcciones al momento. Aunque quedara en el historial, es de un solo uso y caduca enseguida.
 */
function codigoDelEnlace(): string | null {
  const codigo = new URLSearchParams(location.hash.slice(1)).get('codigo');
  // Solo se borra si trae el código: `#marca=…` (desde el MDT) lo lee después la interfaz.
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
