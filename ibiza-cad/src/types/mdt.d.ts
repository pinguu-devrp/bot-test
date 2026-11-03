/**
 * Tipos del portal de emergencias (`/emergencias/`) y sus MDT: adaptador (`mdt/web.ts`) e interfaz
 * (`mdt/app.ts`). Los datos de fichas, matrículas y avisos (`PersonaMdt`, `FichaMdt`, `AvisoCad`…)
 * están en `cad.d.ts`, compartidos. Declaraciones globales (sin import/export): cada parte se
 * empaqueta por separado.
 */

/** Aplicaciones del portal que puede abrir quien ha entrado (las decide el bot por sus roles). */
interface AppsEmergencias {
  cad: boolean;
  /** Entrará al CAD cuando deje de ser solo del staff: el portal lo enseña como «Próximamente». */
  cadProximamente: boolean;
  guardiaCivil: boolean;
  samu: boolean;
  bombers: boolean;
}

/** Coche del registro del concesionario (todos los comprados). */
interface CocheRegistradoMdt {
  matricula: string;
  modelo: string;
  comprado: number;
  enDirecto: boolean;
  dueno: { id: string; nombre: string };
}

/** Una página del registro del concesionario. */
interface RegistroVehiculosMdt {
  total: number;
  pagina: number;
  porPagina: number;
  vehiculos: CocheRegistradoMdt[];
}

/** MDT al que pertenece cada plantilla de informe. */
type AmbitoInformeMdt = 'guardiaCivil' | 'samu' | 'bombers';
type TipoInformeMdt = 'denuncia' | 'atestado' | 'asistencia' | 'intervencion';

interface EstadoMdt {
  conexion: EstadoConexionCad;
  conSesion: boolean;
  /** Nombre del personaje de quien tiene el portal abierto. */
  nombre: string | null;
  apps: AppsEmergencias;
  /** En qué MDT puede FIRMAR informes (solo su servicio). */
  redactar: Record<AmbitoInformeMdt, boolean>;
  /** Requisitorias: emitirlas y anularlas (jueces y fiscales) y marcarlas como ejecutadas (agentes). */
  requisitorias: { emitir: boolean; ejecutar: boolean };
  /** Puede firmar inspecciones de locales (bomberos). */
  inspeccionar: boolean;
  /** Es staff. */
  staff: boolean;
}

/** Informe en una lista (inicio de Informes o ficha de la persona). */
interface InformeResumenMdt {
  id: string;
  tipo: TipoInformeMdt;
  numero: number;
  anio: number;
  fecha: number;
  titulo: string;
  autor: string;
  resumen: string;
}

/** Informe completo, ya en texto plano (lo compone el bot). */
interface InformeMdt {
  id: string;
  tipo: TipoInformeMdt;
  numero: number;
  anio: number;
  fecha: number;
  documento: string;
  emoji: string;
  cabecera: string;
  etiquetaAutor: string;
  autor: string;
  indicativo: string | null;
  etiquetaSujeto: string;
  /** `id` es el de su DNI (para abrir su ficha), si aún existe. */
  sujeto: { id: string | null; nombre: string; documento: string | null } | null;
  aviso: number | null;
  lugar: string | null;
  lineas: { etiqueta: string; valor: string; enlaces: boolean }[];
  multa: { importe: number; estado: 'pendiente' | 'pagada'; pagado: number | null; descuentoHasta: number | null } | null;
}

interface OpcionInformeMdt {
  value: string;
  label: string;
}

/** Opciones de las listas de los formularios (las manda el bot). */
interface OpcionesInformesMdt {
  reclusiones: OpcionInformeMdt[];
  motivos: OpcionInformeMdt[];
  gravedades: OpcionInformeMdt[];
  consciencias: OpcionInformeMdt[];
  respiraciones: OpcionInformeMdt[];
  pulsos: OpcionInformeMdt[];
  traslados: OpcionInformeMdt[];
  clases: OpcionInformeMdt[];
  causas: OpcionInformeMdt[];
  danos: OpcionInformeMdt[];
  /** Webs aceptadas como pruebas de un atestado. */
  webs: string[];
  /** Días que se pueden dar en una inspección: lo que vale un «apto» y el plazo para corregir deficiencias. */
  plazosInspeccion: { apto: number[]; deficiencias: number[] };
}

interface InformeCreadoMdt {
  id: string;
  numero: number;
  anio: number;
  /** `true` publicado en Discord, `false` no se pudo, `null` sin canal o aún publicándose. */
  publicado: boolean | null;
  /** Ya estaba firmado (se reenvió el mismo formulario). */
  repetido: boolean;
}

/** Lo que manda el formulario al firmar: lo valida el bot campo a campo. */
type NuevoInformeMdt = { tipo: TipoInformeMdt; id: string } & Record<string, unknown>;

type EventoMdt = { tipo: 'estado'; estado: EstadoMdt } | { tipo: 'error'; mensaje: string } | { tipo: 'expulsado'; motivo: string };

/** API que el adaptador web expone a la interfaz (`window.mdt`). */
interface MdtApi {
  estado(): Promise<EstadoMdt>;
  login(codigo: string): Promise<{ ok: boolean; error?: string }>;
  personas(texto: string): Promise<RespuestaMdt<PersonaMdt[]>>;
  matriculas(texto: string): Promise<RespuestaMdt<MatriculaMdt[]>>;
  /** Guardia Civil: registro de todos los coches comprados (filtro por modelo, matrícula o titular; por páginas). */
  registroVehiculos(texto: string, pagina: number): Promise<RespuestaMdt<RegistroVehiculosMdt>>;
  ficha(id: string): Promise<RespuestaMdt<FichaMdt>>;
  /** Guardia Civil: requisitorias en vigor (o las últimas de todas), emitir una y cerrarla. */
  requisitorias(estado: 'activas' | 'todas'): Promise<RespuestaMdt<RequisitoriaMdt[]>>;
  crearRequisitoria(datos: { id: string; persona: string; motivo: string }): Promise<RespuestaMdt<RequisitoriaMdt>>;
  cerrarRequisitoria(id: string, accion: 'ejecutar' | 'anular', nota: string): Promise<RespuestaMdt<RequisitoriaMdt>>;
  /** SAMU: buscar pacientes y abrir su ficha (identidad y datos clínicos). */
  pacientes(texto: string): Promise<RespuestaMdt<PersonaMdt[]>>;
  paciente(id: string): Promise<RespuestaMdt<PacienteSamuMdt>>;
  /** SAMU y Bombers: avisos sin cerrar de su servicio. */
  avisos(servicio: 'sanitarios' | 'bomberos'): Promise<RespuestaMdt<AvisoCad[]>>;
  /** Bombers: locales (sin texto, todos), historial de inspecciones de uno y firmar una nueva. */
  locales(texto: string): Promise<RespuestaMdt<LocalMdt[]>>;
  inspecciones(local: string): Promise<RespuestaMdt<InspeccionMdt[]>>;
  crearInspeccion(datos: { id: string; local: string; resultado: ResultadoInspeccionMdt; dias: number; notas: string }): Promise<RespuestaMdt<InspeccionMdt>>;
  /** Informes: opciones de los formularios, listas, un informe y firmar uno nuevo. */
  opciones(): Promise<RespuestaMdt<OpcionesInformesMdt>>;
  informes(ambito: AmbitoInformeMdt, persona: string | null): Promise<RespuestaMdt<InformeResumenMdt[]>>;
  informe(id: string): Promise<RespuestaMdt<InformeMdt>>;
  crearInforme(datos: NuevoInformeMdt): Promise<RespuestaMdt<InformeCreadoMdt>>;
  cerrarSesion(): Promise<void>;
  alEvento(callback: (evento: EventoMdt) => void): void;
}

/** Mensajes entre el MDT y el CAD abiertos en el mismo navegador (`BroadcastChannel`). */
type MensajeMdtCad = { tipo: 'marca'; x: number; z: number; nombre: string } | { tipo: 'marca-recibida' };

interface Window {
  mdt: MdtApi;
}
