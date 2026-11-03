/**
 * Tipos compartidos entre el adaptador web (`web/web.ts`) y la interfaz (`renderer.ts`).
 * Declaraciones globales (sin import/export): cada uno se empaqueta por separado.
 */

type ServicioCad = 'policia' | 'bomberos';
type EstadoAvisoCad = 'abierto' | 'atendido' | 'cerrado';
type EstadoConexionCad = 'desconectado' | 'conectando' | 'conectado' | 'reconectando';
/** Estado de la API de ER:LC según el bot. */
type EstadoErlc = 'ok' | 'apagado' | 'limitado' | 'sin-api' | 'error';
/** Qué es un punto de interés (icono y color en el mapa). */
type TipoLugarCad =
  | 'comisaria'
  | 'hospital'
  | 'bomberos'
  | 'ayuntamiento'
  | 'juzgado'
  | 'carcel'
  | 'aerodromo'
  | 'puerto'
  | 'banco'
  | 'joyeria'
  | 'concesionario'
  | 'armeria'
  | 'gasolinera'
  | 'lugar';

/**
 * Unidad de emergencias conectada en ER:LC. Coordenadas de la API de ER:LC, que son a la vez los
 * píxeles del mapa oficial (origen arriba a la izquierda).
 */
interface UnidadCad {
  id: string;
  nombre: string;
  indicativo: string | null;
  servicio: ServicioCad;
  x: number;
  z: number;
  ubicacion: string | null;
  /** Número del aviso sin cerrar en el que está, o `null` si está libre. */
  aviso: number | null;
}

interface UnidadAsignadaCad {
  id: string;
  nombre: string;
  indicativo: string | null;
  servicio: string;
  distancia: number | null;
}

interface AvisoCad {
  id: string;
  numero: number;
  tipo: string;
  emoji: string;
  descripcion: string;
  llamante: string;
  ubicacion: string | null;
  x: number | null;
  z: number | null;
  estado: EstadoAvisoCad;
  origen: 'consola' | 'juego';
  creado: number;
  unidades: UnidadAsignadaCad[];
}

interface UnidadesCad {
  at: number;
  estado: EstadoErlc;
  unidades: UnidadCad[];
}

/** Posición de quien tiene el CAD abierto (sea o no una unidad). */
interface YoCad {
  x: number;
  z: number;
  ubicacion: string | null;
  equipo: string | null;
}

/** Rótulos del mapa con los nombres del callejero de Ibiza (los manda el bot). */
interface LugaresCad {
  distritos: { nombre: string; x: number; z: number }[];
  lugares: { nombre: string; cp: string; tipo: TipoLugarCad; x: number; z: number }[];
  postales: { cp: string; x: number; z: number }[];
  /** `angulo` en radianes (sentido de la pantalla), entre -π/2 y π/2. */
  calles: { nombre: string; x: number; z: number; angulo: number }[];
}

interface EstadoCad {
  conexion: EstadoConexionCad;
  conSesion: boolean;
  nombre: string | null;
  /** Cuenta de Roblox de quien tiene el CAD abierto (para marcarle en el mapa). */
  robloxId: string | null;
}

// --- MDT ---

interface PersonaMdt {
  id: string;
  nombre: string;
  documento: string;
  edad: number;
  roblox: string | null;
  conectado: boolean;
  /** Tiene una requisitoria en vigor. */
  buscado: boolean;
}

interface MultaMdt {
  importe: number;
  motivo: string;
  fecha: number;
  estado: 'pendiente' | 'pagada';
  /** Lo que se pagó de verdad (con o sin pronto pago), si está pagada. */
  pagado: number | null;
  /** Hasta cuándo puede pagarla con descuento, si está pendiente y aún en plazo. */
  descuentoHasta: number | null;
  reclusion: 'ninguna' | 'calabozo' | 'prision';
  minutos: number;
  agente: string | null;
}

/** Documentación de un coche visto en ER:LC: en regla si su dueño lo compró en el concesionario. */
type DocumentacionMdt = 'en-regla' | 'sin-documentacion';

interface VehiculoMdt {
  modelo: string;
  matricula: string | null;
  color: string | null;
  colorHex: string | null;
  visto: number;
  enDirecto: boolean;
  /** `null` si el bot aún no la manda. */
  documentacion: DocumentacionMdt | null;
  /** Matrícula registrada al comprarlo (`1234 BCD`). */
  matriculaRegistrada: string | null;
}

/** Coche comprado a nombre de la persona. */
interface CocheMdt {
  modelo: string;
  matricula: string;
  comprado: number;
}

/** Identidad de una persona: la ficha de paciente del SAMU. */
interface PacienteMdt {
  id: string;
  nombre: string;
  apellidos: string;
  edad: number;
  nacimiento: number | null;
  nacionalidad: string;
  tipoDocumento: 'DNI' | 'NIE';
  documento: string;
  /** Foto del avatar de Roblox (solo de `https://tr.rbxcdn.com/`). */
  foto: string | null;
  roblox: string | null;
  conectado: boolean;
}

/** Ficha de la Guardia Civil: la identidad con licencias, multas y vehículos. */
interface FichaMdt extends PacienteMdt {
  licencias: string[];
  multas: MultaMdt[];
  pendiente: number;
  /** Multas sin pagar y si eso le hace deudor (lo decide el bot). */
  multasPendientes: number;
  deudor: boolean;
  vehiculos: VehiculoMdt[];
  coches: CocheMdt[];
  /** Requisitorias en vigor. */
  requisitorias: RequisitoriaMdt[];
}

/** Requisitoria (orden de busca y captura) de un juez o fiscal. */
interface RequisitoriaMdt {
  id: string;
  numero: number;
  anio: number;
  /** `id` es el de su DNI; `existe` es falso tras un CK. */
  persona: { id: string; nombre: string; documento: string; existe: boolean };
  motivo: string;
  emitidaPor: string;
  emitida: number;
  estado: 'activa' | 'ejecutada' | 'anulada';
  cerradaPor: string | null;
  cerrada: number | null;
  nota: string | null;
}

/** Datos clínicos fijos del paciente (SAMU). */
interface ClinicoMdt {
  grupoSanguineo: string;
  antecedentes: string;
  /** `null`: sin declarar. */
  alergias: string | null;
}

/** Ficha del SAMU: la identidad y los datos clínicos. */
interface PacienteSamuMdt extends PacienteMdt {
  clinico: ClinicoMdt;
}

interface MatriculaMdt {
  matricula: string;
  modelo: string;
  color: string | null;
  colorHex: string | null;
  enDirecto: boolean;
  visto: number;
  dueno: { id: string | null; nombre: string | null; roblox: string };
  documentacion: DocumentacionMdt | null;
  matriculaRegistrada: string | null;
}

/** Local del catálogo (MDT de Bombers) con la empresa que lo ocupa, si hay, y su inspección. */
interface LocalMdt {
  id: string;
  nombre: string;
  zona: string;
  empresa: { nombre: string; tipo: string; dueno: string | null } | null;
  /** `null` si está libre (o si el bot aún no manda inspecciones). */
  inspeccion: EstadoInspeccionMdt | null;
}

type ResultadoInspeccionMdt = 'apto' | 'deficiencias' | 'no-apto';

/** Inspección de Bombers a un local (inmutable: una nueva sustituye a la anterior). */
interface InspeccionMdt {
  id: string;
  /** Clave del local. */
  local: string;
  /** Empresa que lo ocupaba al inspeccionarlo. */
  empresa: string;
  resultado: ResultadoInspeccionMdt;
  notas: string;
  inspector: string;
  fecha: number;
  /** Hasta cuándo vale o plazo para corregir; `null` si no es apto. */
  caduca: number | null;
}

/** Situación del local para la empresa que lo ocupa ahora (la calcula el bot). */
interface EstadoInspeccionMdt {
  estado: 'sin-inspeccion' | 'al-dia' | 'deficiencias' | 'no-apto' | 'caducada';
  ultima: InspeccionMdt | null;
}

type RespuestaMdt<T> = { ok: true; datos: T } | { ok: false; error: string };

type EventoCad =
  | { tipo: 'estado'; estado: EstadoCad }
  | { tipo: 'avisos'; avisos: AvisoCad[] }
  | { tipo: 'aviso'; aviso: AvisoCad }
  | { tipo: 'unidades'; unidades: UnidadesCad }
  | { tipo: 'yo'; yo: YoCad | null }
  | { tipo: 'lugares'; lugares: LugaresCad }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'expulsado'; motivo: string };

/** API que el adaptador web expone a la interfaz (`window.cad`). */
interface CadApi {
  estado(): Promise<EstadoCad>;
  login(codigo: string): Promise<{ ok: boolean; error?: string }>;
  accion(id: string, accion: 'atender' | 'cerrar'): Promise<{ ok: boolean; error?: string }>;
  cerrarSesion(): Promise<void>;
  alEvento(callback: (evento: EventoCad) => void): void;
}

/**
 * API Document Picture-in-Picture (Chrome y Edge de escritorio 116+): una ventana pequeña siempre
 * encima con nuestro propio HTML. La versión de TypeScript del proyecto aún no la declara.
 */
interface DocumentPictureInPicture extends EventTarget {
  readonly window: Window | null;
  requestWindow(opciones?: { width?: number; height?: number }): Promise<Window>;
}

interface Window {
  cad: CadApi;
  /** Solo existe en los navegadores que admiten la ventana flotante. */
  readonly documentPictureInPicture?: DocumentPictureInPicture;
}
