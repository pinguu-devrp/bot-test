/**
 * Validación de lo que llega del bot antes de pasarlo a la interfaz. No se fía del servidor: si
 * estuviera comprometido, un campo inesperado no debe llegar a la pantalla. Se copian solo los
 * campos conocidos, con longitudes y rangos acotados.
 */

export const texto = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const textoONulo = (v: unknown, max: number): v is string | null => v === null || texto(v, max);
const numero = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const numeroONulo = (v: unknown, min: number, max: number): v is number | null => v === null || numero(v, min, max);

/** Las coordenadas de ER:LC van de 0 a unos 5400 (los píxeles del mapa); con margen de sobra. */
const COORD = 100_000;
const SERVICIOS: readonly ServicioCad[] = ['policia', 'bomberos'];
const ESTADOS_AVISO: readonly EstadoAvisoCad[] = ['abierto', 'atendido', 'cerrado'];
const ESTADOS_ERLC: readonly EstadoErlc[] = ['ok', 'apagado', 'limitado', 'sin-api', 'error'];
const TIPOS_LUGAR: readonly TipoLugarCad[] = [
  'comisaria', 'hospital', 'bomberos', 'ayuntamiento', 'juzgado', 'carcel', 'aerodromo', 'puerto', 'banco', 'joyeria', 'concesionario', 'armeria', 'gasolinera', 'lugar',
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function esUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

function unidadAsignada(u: unknown): UnidadAsignadaCad | null {
  if (typeof u !== 'object' || u === null) return null;
  const x = u as Record<string, unknown>;
  if (!texto(x.id, 32) || !texto(x.nombre, 80) || !textoONulo(x.indicativo, 32) || !texto(x.servicio, 20) || !numeroONulo(x.distancia, 0, 1e7)) return null;
  return { id: x.id, nombre: x.nombre, indicativo: x.indicativo, servicio: x.servicio, distancia: x.distancia };
}

export function avisoLimpio(a: unknown): AvisoCad | null {
  if (typeof a !== 'object' || a === null) return null;
  const x = a as Record<string, unknown>;
  if (
    !esUuid(x.id) ||
    !numero(x.numero, 1, 1e9) ||
    !texto(x.tipo, 60) ||
    !texto(x.emoji, 8) ||
    !texto(x.descripcion, 300) ||
    !texto(x.llamante, 80) ||
    !textoONulo(x.ubicacion, 120) ||
    !numeroONulo(x.x, -COORD, COORD) ||
    !numeroONulo(x.z, -COORD, COORD) ||
    !ESTADOS_AVISO.includes(x.estado as EstadoAvisoCad) ||
    (x.origen !== 'consola' && x.origen !== 'juego') ||
    !numero(x.creado, 0, 1e15) ||
    !Array.isArray(x.unidades)
  ) {
    return null;
  }
  const unidades = x.unidades.slice(0, 20).map(unidadAsignada);
  if (unidades.some((u) => u === null)) return null;
  return {
    id: x.id,
    numero: x.numero,
    tipo: x.tipo,
    emoji: x.emoji,
    descripcion: x.descripcion,
    llamante: x.llamante,
    ubicacion: x.ubicacion,
    x: x.x,
    z: x.z,
    estado: x.estado as EstadoAvisoCad,
    origen: x.origen,
    creado: x.creado,
    unidades: unidades as UnidadAsignadaCad[],
  };
}

function unidadLimpia(u: unknown): UnidadCad | null {
  if (typeof u !== 'object' || u === null) return null;
  const x = u as Record<string, unknown>;
  if (
    !texto(x.id, 32) ||
    !texto(x.nombre, 80) ||
    !textoONulo(x.indicativo, 32) ||
    !SERVICIOS.includes(x.servicio as ServicioCad) ||
    !numero(x.x, -COORD, COORD) ||
    !numero(x.z, -COORD, COORD) ||
    !textoONulo(x.ubicacion, 120) ||
    !numeroONulo(x.aviso, 1, 1e9)
  ) {
    return null;
  }
  return { id: x.id, nombre: x.nombre, indicativo: x.indicativo, servicio: x.servicio as ServicioCad, x: x.x, z: x.z, ubicacion: x.ubicacion, aviso: x.aviso };
}

export function unidadesLimpias(d: unknown): UnidadesCad | null {
  if (typeof d !== 'object' || d === null) return null;
  const x = d as Record<string, unknown>;
  if (!numero(x.at, 0, 1e15) || !ESTADOS_ERLC.includes(x.estado as EstadoErlc) || !Array.isArray(x.unidades)) return null;
  // Como mucho 200: un servidor comprometido no puede inundar la interfaz.
  const unidades = x.unidades.slice(0, 200).map(unidadLimpia).filter((u): u is UnidadCad => u !== null);
  return { at: x.at, estado: x.estado as EstadoErlc, unidades };
}

function lista<T>(v: unknown, max: number, limpiar: (x: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const salida: T[] = [];
  for (const item of v.slice(0, max)) {
    if (typeof item !== 'object' || item === null) continue;
    const limpio = limpiar(item as Record<string, unknown>);
    if (limpio) salida.push(limpio);
  }
  return salida;
}

/** Posición propia (`cad:yo`), o `null` si no está en el servidor de ER:LC. */
export function yoLimpio(d: unknown): YoCad | null {
  if (typeof d !== 'object' || d === null) return null;
  const x = d as Record<string, unknown>;
  if (!numero(x.x, -COORD, COORD) || !numero(x.z, -COORD, COORD) || !textoONulo(x.ubicacion, 120)) return null;
  return { x: x.x, z: x.z, ubicacion: x.ubicacion, equipo: texto(x.equipo, 40) ? x.equipo : null };
}

/** Rótulos del mapa. Topes por tipo: un servidor comprometido no puede inundar el mapa. */
export function lugaresLimpios(d: unknown): LugaresCad | null {
  if (typeof d !== 'object' || d === null) return null;
  const x = d as Record<string, unknown>;
  const punto = (p: Record<string, unknown>) => numero(p.x, -COORD, COORD) && numero(p.z, -COORD, COORD);
  return {
    distritos: lista(x.distritos, 60, (p) => (texto(p.nombre, 80) && punto(p) ? { nombre: p.nombre, x: p.x as number, z: p.z as number } : null)),
    lugares: lista(x.lugares, 120, (p) =>
      texto(p.nombre, 80) && texto(p.cp, 40) && punto(p)
        ? { nombre: p.nombre, cp: p.cp, tipo: TIPOS_LUGAR.includes(p.tipo as TipoLugarCad) ? (p.tipo as TipoLugarCad) : 'lugar', x: p.x as number, z: p.z as number }
        : null,
    ),
    postales: lista(x.postales, 500, (p) => (texto(p.cp, 8) && punto(p) ? { cp: p.cp, x: p.x as number, z: p.z as number } : null)),
    calles: lista(x.calles, 500, (p) =>
      texto(p.nombre, 80) && punto(p) && numero(p.angulo, -Math.PI, Math.PI) ? { nombre: p.nombre, x: p.x as number, z: p.z as number, angulo: p.angulo } : null,
    ),
  };
}

// --- MDT ---

const HEX = /^#[0-9a-f]{6}$/;
const FOTO_ROBLOX = 'https://tr.rbxcdn.com/';
const booleano = (v: unknown): v is boolean => typeof v === 'boolean';

export function personasLimpias(d: unknown): PersonaMdt[] | null {
  if (!Array.isArray(d)) return null;
  return lista(d, 20, (p) =>
    esUuid(p.id) && texto(p.nombre, 80) && texto(p.documento, 12) && numero(p.edad, 0, 200) && textoONulo(p.roblox, 32) && booleano(p.conectado)
      ? // `buscado` es opcional: un bot sin requisitorias no lo manda.
        { id: p.id, nombre: p.nombre, documento: p.documento, edad: p.edad, roblox: p.roblox, conectado: p.conectado, buscado: p.buscado === true }
      : null,
  );
}

function multaLimpia(m: Record<string, unknown>): MultaMdt | null {
  if (
    !numero(m.importe, 0, 1e12) ||
    !texto(m.motivo, 400) ||
    !numero(m.fecha, 0, 1e15) ||
    (m.estado !== 'pendiente' && m.estado !== 'pagada') ||
    (m.reclusion !== 'ninguna' && m.reclusion !== 'calabozo' && m.reclusion !== 'prision') ||
    !numero(m.minutos, 0, 1e6) ||
    !textoONulo(m.agente, 80)
  ) {
    return null;
  }
  return {
    importe: m.importe,
    motivo: m.motivo,
    fecha: m.fecha,
    estado: m.estado,
    // Opcionales: un bot sin el pronto pago no los manda.
    pagado: numero(m.pagado, 0, 1e12) ? m.pagado : null,
    descuentoHasta: numero(m.descuentoHasta, 0, 1e15) ? m.descuentoHasta : null,
    reclusion: m.reclusion,
    minutos: m.minutos,
    agente: m.agente,
  };
}

const MATRICULA_ES = /^[0-9]{4} [BCDFGHJKLMNPRSTVWXYZ]{3}$/;

function vehiculoLimpio(v: Record<string, unknown>): VehiculoMdt | null {
  if (!texto(v.modelo, 80) || !textoONulo(v.matricula, 16) || !textoONulo(v.color, 40) || !numero(v.visto, 0, 1e15) || !booleano(v.enDirecto)) return null;
  return {
    modelo: v.modelo,
    matricula: v.matricula,
    color: v.color,
    colorHex: texto(v.colorHex, 7) && HEX.test(v.colorHex) ? v.colorHex : null,
    visto: v.visto,
    enDirecto: v.enDirecto,
    // Opcionales: un bot sin concesionario no los manda.
    documentacion: v.documentacion === 'en-regla' || v.documentacion === 'sin-documentacion' ? v.documentacion : null,
    matriculaRegistrada: texto(v.matriculaRegistrada, 8) && MATRICULA_ES.test(v.matriculaRegistrada) ? v.matriculaRegistrada : null,
  };
}

/** Ficha de paciente del SAMU (solo la identidad). */
export function pacienteLimpio(d: unknown): PacienteMdt | null {
  if (typeof d !== 'object' || d === null) return null;
  const x = d as Record<string, unknown>;
  if (
    !esUuid(x.id) ||
    !texto(x.nombre, 40) ||
    !texto(x.apellidos, 60) ||
    !numero(x.edad, 0, 200) ||
    !numeroONulo(x.nacimiento, -1e15, 1e15) ||
    !texto(x.nacionalidad, 60) ||
    (x.tipoDocumento !== 'DNI' && x.tipoDocumento !== 'NIE') ||
    !texto(x.documento, 12) ||
    !textoONulo(x.roblox, 32) ||
    !booleano(x.conectado)
  ) {
    return null;
  }
  return {
    id: x.id,
    nombre: x.nombre,
    apellidos: x.apellidos,
    edad: x.edad,
    nacimiento: x.nacimiento,
    nacionalidad: x.nacionalidad,
    tipoDocumento: x.tipoDocumento,
    documento: x.documento,
    foto: texto(x.foto, 400) && x.foto.startsWith(FOTO_ROBLOX) ? x.foto : null,
    roblox: x.roblox,
    conectado: x.conectado,
  };
}

export function fichaLimpia(d: unknown): FichaMdt | null {
  const identidad = pacienteLimpio(d);
  if (!identidad) return null;
  const x = d as Record<string, unknown>;
  if (!Array.isArray(x.licencias) || !numero(x.pendiente, 0, 1e15)) return null;
  return {
    ...identidad,
    licencias: x.licencias.slice(0, 20).filter((l): l is string => texto(l, 60)),
    multas: lista(x.multas, 50, multaLimpia),
    pendiente: x.pendiente,
    multasPendientes: numero(x.multasPendientes, 0, 1e6) ? x.multasPendientes : 0,
    deudor: x.deudor === true,
    requisitorias: lista(x.requisitorias, 10, requisitoriaLimpia),
    vehiculos: lista(x.vehiculos, 20, vehiculoLimpio),
    coches: lista(x.coches, 50, (c) =>
      texto(c.modelo, 80) && texto(c.matricula, 8) && MATRICULA_ES.test(c.matricula) && numero(c.comprado, 0, 1e15) ? { modelo: c.modelo, matricula: c.matricula, comprado: c.comprado } : null,
    ),
  };
}

const ESTADOS_REQUISITORIA: readonly RequisitoriaMdt['estado'][] = ['activa', 'ejecutada', 'anulada'];

function requisitoriaLimpia(r: Record<string, unknown>): RequisitoriaMdt | null {
  const p = typeof r.persona === 'object' && r.persona !== null ? (r.persona as Record<string, unknown>) : null;
  if (
    !esUuid(r.id) ||
    !numero(r.numero, 1, 1e9) ||
    !numero(r.anio, 2000, 9999) ||
    !p ||
    !esUuid(p.id) ||
    !texto(p.nombre, 120) ||
    !texto(p.documento, 12) ||
    !booleano(p.existe) ||
    !texto(r.motivo, 500) ||
    !texto(r.emitidaPor, 120) ||
    !numero(r.emitida, 0, 1e15) ||
    !ESTADOS_REQUISITORIA.includes(r.estado as RequisitoriaMdt['estado']) ||
    !textoONulo(r.cerradaPor, 120) ||
    !numeroONulo(r.cerrada, 0, 1e15) ||
    !textoONulo(r.nota, 300)
  ) {
    return null;
  }
  return {
    id: r.id,
    numero: r.numero,
    anio: r.anio,
    persona: { id: p.id, nombre: p.nombre, documento: p.documento, existe: p.existe },
    motivo: r.motivo,
    emitidaPor: r.emitidaPor,
    emitida: r.emitida,
    estado: r.estado as RequisitoriaMdt['estado'],
    cerradaPor: r.cerradaPor,
    cerrada: r.cerrada,
    nota: r.nota,
  };
}

export function requisitoriasLimpias(d: unknown): RequisitoriaMdt[] | null {
  return Array.isArray(d) ? lista(d, 50, requisitoriaLimpia) : null;
}

/** Una requisitoria recién emitida o cerrada. */
export function unaRequisitoria(d: unknown): RequisitoriaMdt | null {
  return typeof d === 'object' && d !== null ? requisitoriaLimpia(d as Record<string, unknown>) : null;
}

const GRUPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-'];

/** Ficha del SAMU: la identidad y los datos clínicos. */
export function pacienteSamuLimpio(d: unknown): PacienteSamuMdt | null {
  const identidad = pacienteLimpio(d);
  if (!identidad) return null;
  const c = (d as Record<string, unknown>).clinico;
  if (typeof c !== 'object' || c === null) return null;
  const x = c as Record<string, unknown>;
  if (
    !texto(x.grupoSanguineo, 3) ||
    !GRUPOS_SANGUINEOS.includes(x.grupoSanguineo) ||
    !texto(x.antecedentes, 120) ||
    !textoONulo(x.alergias, 150)
  ) {
    return null;
  }
  return { ...identidad, clinico: { grupoSanguineo: x.grupoSanguineo, antecedentes: x.antecedentes, alergias: x.alergias } };
}

export function matriculasLimpias(d: unknown): MatriculaMdt[] | null {
  if (!Array.isArray(d)) return null;
  return lista(d, 20, (m) => {
    const v = vehiculoLimpio({ ...m, visto: m.visto, enDirecto: m.enDirecto });
    const dueno = typeof m.dueno === 'object' && m.dueno !== null ? (m.dueno as Record<string, unknown>) : null;
    if (!v || !texto(m.matricula, 16) || !dueno || !(dueno.id === null || esUuid(dueno.id)) || !textoONulo(dueno.nombre, 80) || !texto(dueno.roblox, 32)) return null;
    return {
      matricula: m.matricula,
      modelo: v.modelo,
      color: v.color,
      colorHex: v.colorHex,
      enDirecto: v.enDirecto,
      visto: v.visto,
      dueno: { id: dueno.id as string | null, nombre: dueno.nombre, roblox: dueno.roblox },
      documentacion: v.documentacion,
      matriculaRegistrada: v.matriculaRegistrada,
    };
  });
}

/** Una página del registro del concesionario. */
export function registroLimpio(d: unknown): RegistroVehiculosMdt | null {
  if (typeof d !== 'object' || d === null) return null;
  const x = d as Record<string, unknown>;
  if (!numero(x.total, 0, 1e9) || !numero(x.pagina, 0, 10_000) || !numero(x.porPagina, 1, 100) || !Array.isArray(x.vehiculos)) return null;
  return {
    total: x.total,
    pagina: x.pagina,
    porPagina: x.porPagina,
    vehiculos: lista(x.vehiculos, 100, (v) => {
      const dueno = typeof v.dueno === 'object' && v.dueno !== null ? (v.dueno as Record<string, unknown>) : null;
      if (!texto(v.matricula, 8) || !MATRICULA_ES.test(v.matricula) || !texto(v.modelo, 80) || !numero(v.comprado, 0, 1e15) || !booleano(v.enDirecto)) return null;
      if (!dueno || !esUuid(dueno.id) || !texto(dueno.nombre, 120)) return null;
      return { matricula: v.matricula, modelo: v.modelo, comprado: v.comprado, enDirecto: v.enDirecto, dueno: { id: dueno.id, nombre: dueno.nombre } };
    }),
  };
}

/** Avisos de un servicio (inicio del MDT del SAMU y de Bombers). */
export function avisosLimpios(d: unknown): AvisoCad[] | null {
  if (!Array.isArray(d)) return null;
  return d
    .slice(0, 50)
    .map(avisoLimpio)
    .filter((a): a is AvisoCad => a !== null);
}

const RESULTADOS_INSPECCION: readonly ResultadoInspeccionMdt[] = ['apto', 'deficiencias', 'no-apto'];
const ESTADOS_INSPECCION: readonly EstadoInspeccionMdt['estado'][] = ['sin-inspeccion', 'al-dia', 'deficiencias', 'no-apto', 'caducada'];

function inspeccionLimpia(i: Record<string, unknown>): InspeccionMdt | null {
  if (
    !esUuid(i.id) ||
    !texto(i.local, 40) ||
    !texto(i.empresa, 80) ||
    !RESULTADOS_INSPECCION.includes(i.resultado as ResultadoInspeccionMdt) ||
    !texto(i.notas, 500) ||
    !texto(i.inspector, 120) ||
    !numero(i.fecha, 0, 1e15) ||
    !numeroONulo(i.caduca, 0, 1e15)
  ) {
    return null;
  }
  return {
    id: i.id,
    local: i.local,
    empresa: i.empresa,
    resultado: i.resultado as ResultadoInspeccionMdt,
    notas: i.notas,
    inspector: i.inspector,
    fecha: i.fecha,
    caduca: i.caduca,
  };
}

/** Estado de la inspección de un local: `null` si falta o no es válido (se pinta «sin datos»). */
function estadoInspeccionLimpio(v: unknown): EstadoInspeccionMdt | null {
  if (typeof v !== 'object' || v === null) return null;
  const x = v as Record<string, unknown>;
  if (!ESTADOS_INSPECCION.includes(x.estado as EstadoInspeccionMdt['estado'])) return null;
  const ultima = typeof x.ultima === 'object' && x.ultima !== null ? inspeccionLimpia(x.ultima as Record<string, unknown>) : null;
  if (x.estado !== 'sin-inspeccion' && !ultima) return null;
  return { estado: x.estado as EstadoInspeccionMdt['estado'], ultima };
}

/** Locales del MDT de Bombers. */
export function localesLimpios(d: unknown): LocalMdt[] | null {
  if (!Array.isArray(d)) return null;
  return lista(d, 50, (l) => {
    if (!texto(l.id, 40) || !texto(l.nombre, 80) || !texto(l.zona, 60)) return null;
    if (l.empresa === null) return { id: l.id, nombre: l.nombre, zona: l.zona, empresa: null, inspeccion: null };
    const e = typeof l.empresa === 'object' ? (l.empresa as Record<string, unknown>) : null;
    if (!e || !texto(e.nombre, 80) || !texto(e.tipo, 60) || !textoONulo(e.dueno, 80)) return null;
    return { id: l.id, nombre: l.nombre, zona: l.zona, empresa: { nombre: e.nombre, tipo: e.tipo, dueno: e.dueno }, inspeccion: estadoInspeccionLimpio(l.inspeccion) };
  });
}

/** Historial de inspecciones de un local. */
export function inspeccionesLimpias(d: unknown): InspeccionMdt[] | null {
  return Array.isArray(d) ? lista(d, 20, inspeccionLimpia) : null;
}

/** Una inspección recién firmada. */
export function unaInspeccion(d: unknown): InspeccionMdt | null {
  return typeof d === 'object' && d !== null ? inspeccionLimpia(d as Record<string, unknown>) : null;
}

// --- Informes ---

const TIPOS_INFORME: readonly TipoInformeMdt[] = ['denuncia', 'atestado', 'asistencia', 'intervencion'];
const esTipoInforme = (v: unknown): v is TipoInformeMdt => TIPOS_INFORME.includes(v as TipoInformeMdt);

/** Enlace de una prueba: solo `https` (el bot ya lo filtró por web; aquí no se fía). */
export function enlaceSeguro(v: string): boolean {
  try {
    const url = new URL(v);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function informesLimpios(d: unknown): InformeResumenMdt[] | null {
  if (!Array.isArray(d)) return null;
  return lista(d, 50, (r) =>
    esUuid(r.id) && esTipoInforme(r.tipo) && numero(r.numero, 1, 1e9) && numero(r.anio, 2000, 9999) && numero(r.fecha, 0, 1e15) && texto(r.titulo, 120) && texto(r.autor, 120) && texto(r.resumen, 200)
      ? { id: r.id, tipo: r.tipo, numero: r.numero, anio: r.anio, fecha: r.fecha, titulo: r.titulo, autor: r.autor, resumen: r.resumen }
      : null,
  );
}

export function informeLimpio(d: unknown): InformeMdt | null {
  if (typeof d !== 'object' || d === null) return null;
  const x = d as Record<string, unknown>;
  if (
    !esUuid(x.id) ||
    !esTipoInforme(x.tipo) ||
    !numero(x.numero, 1, 1e9) ||
    !numero(x.anio, 2000, 9999) ||
    !numero(x.fecha, 0, 1e15) ||
    !texto(x.documento, 60) ||
    !texto(x.emoji, 8) ||
    !texto(x.cabecera, 80) ||
    !texto(x.etiquetaAutor, 30) ||
    !texto(x.autor, 80) ||
    !textoONulo(x.indicativo, 32) ||
    !texto(x.etiquetaSujeto, 30) ||
    !numeroONulo(x.aviso, 1, 1e9) ||
    !textoONulo(x.lugar, 120) ||
    !Array.isArray(x.lineas)
  ) {
    return null;
  }
  let sujeto: InformeMdt['sujeto'] = null;
  if (x.sujeto !== null) {
    const s = typeof x.sujeto === 'object' ? (x.sujeto as Record<string, unknown>) : null;
    if (!s || !(s.id === null || esUuid(s.id)) || !texto(s.nombre, 120) || !textoONulo(s.documento, 12)) return null;
    sujeto = { id: s.id as string | null, nombre: s.nombre, documento: s.documento };
  }
  let multa: InformeMdt['multa'] = null;
  if (x.multa !== null) {
    const m = typeof x.multa === 'object' ? (x.multa as Record<string, unknown>) : null;
    if (!m || !numero(m.importe, 0, 1e12) || (m.estado !== 'pendiente' && m.estado !== 'pagada') || !numeroONulo(m.pagado, 0, 1e12) || !numeroONulo(m.descuentoHasta, 0, 1e15)) return null;
    multa = { importe: m.importe, estado: m.estado, pagado: m.pagado, descuentoHasta: m.descuentoHasta };
  }
  const lineas = lista(x.lineas, 30, (l) => {
    if (!texto(l.etiqueta, 40) || !texto(l.valor, 2000) || !booleano(l.enlaces)) return null;
    // Un enlace que no sea https no se pinta como enlace (ni se pinta).
    if (l.enlaces && !l.valor.split('\n').every(enlaceSeguro)) return null;
    return { etiqueta: l.etiqueta, valor: l.valor, enlaces: l.enlaces };
  });
  return {
    id: x.id,
    tipo: x.tipo,
    numero: x.numero,
    anio: x.anio,
    fecha: x.fecha,
    documento: x.documento,
    emoji: x.emoji,
    cabecera: x.cabecera,
    etiquetaAutor: x.etiquetaAutor,
    autor: x.autor,
    indicativo: x.indicativo,
    etiquetaSujeto: x.etiquetaSujeto,
    sujeto,
    aviso: x.aviso,
    lugar: x.lugar,
    lineas,
    multa,
  };
}

export function opcionesLimpias(d: unknown): OpcionesInformesMdt | null {
  if (typeof d !== 'object' || d === null) return null;
  const x = d as Record<string, unknown>;
  const opciones = (v: unknown) => lista(v, 30, (o) => (texto(o.value, 40) && texto(o.label, 60) ? { value: o.value, label: o.label } : null));
  const claves = ['reclusiones', 'motivos', 'gravedades', 'consciencias', 'respiraciones', 'pulsos', 'traslados', 'clases', 'causas', 'danos'] as const;
  const salida = Object.fromEntries(claves.map((k) => [k, opciones(x[k])])) as Omit<OpcionesInformesMdt, 'webs' | 'plazosInspeccion'>;
  if (claves.some((k) => salida[k].length === 0)) return null;
  const webs = Array.isArray(x.webs) ? x.webs.slice(0, 50).filter((w): w is string => texto(w, 80)) : [];
  // Plazos de las inspecciones (días enteros de 1 a 90); un bot antiguo no los manda.
  const p = typeof x.plazosInspeccion === 'object' && x.plazosInspeccion !== null ? (x.plazosInspeccion as Record<string, unknown>) : {};
  const dias = (v: unknown) => (Array.isArray(v) ? v.slice(0, 10).filter((n): n is number => Number.isInteger(n) && numero(n, 1, 90)) : []);
  return { ...salida, webs, plazosInspeccion: { apto: dias(p.apto), deficiencias: dias(p.deficiencias) } };
}

export function creadoLimpio(d: unknown): InformeCreadoMdt | null {
  if (typeof d !== 'object' || d === null) return null;
  const x = d as Record<string, unknown>;
  if (!esUuid(x.id) || !numero(x.numero, 1, 1e9) || !numero(x.anio, 2000, 9999) || !(x.publicado === null || booleano(x.publicado)) || !booleano(x.repetido)) return null;
  return { id: x.id, numero: x.numero, anio: x.anio, publicado: x.publicado, repetido: x.repetido };
}

/** Normaliza el código que pega el usuario (sin espacios ni guiones). `null` si no tiene 10 caracteres. */
export function normalizarCodigo(codigo: string): string | null {
  const limpio = codigo.toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z0-9]{10}$/.test(limpio) ? limpio : null;
}
