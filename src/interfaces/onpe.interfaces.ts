// ── Respuestas crudas de la API de ONPE ──

export interface DepartamentoItem {
  ubigeo: string;
  nombre: string;
}

export interface TotalesData {
  actasContabilizadas: number;   // porcentaje de actas contabilizadas
  contabilizadas: number;        // cantidad de actas contabilizadas
  totalActas: number;            // total de actas
  participacionCiudadana: number;
  totalVotosEmitidos: number;
  totalVotosValidos: number;
  porcentajeVotosEmitidos: number;
  porcentajeVotosValidos: number;
  fechaActualizacion: number;
}

export interface ParticipanteData {
  nombreAgrupacionPolitica: string;
  codigoAgrupacionPolitica: number;
  nombreCandidato: string;
  dniCandidato: string;
  totalVotosValidos: number;
  porcentajeVotosValidos: number;
  porcentajeVotosEmitidos: number;
}

export interface OnpeApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ── Resultados de la extrapolación ──

export interface ResultadoExtrapolado {
  nombreAgrupacionPolitica: string;
  nombreCandidato: string;
  // Datos observados (muestra)
  votosObservados: number;
  porcentajeObservado: number;
  // Extrapolación
  votosExtrapolados: number;
  porcentajeExtrapoladoMin: number;  // límite inferior del IC
  porcentajeExtrapoladoMax: number;  // límite superior del IC
  // Error
  margenError: number;               // en puntos porcentuales
  margenErrorRelativo: number;       // en porcentaje relativo
}

export interface DepartamentoResultado {
  ubigeo: string;
  nombre: string;
  // Metadatos del conteo
  actasContabilizadas: number;
  totalActas: number;
  porcentajeConteo: number;
  totalVotosValidosMuestra: number;
  totalVotosEmitidosMuestra: number;
  // Factor de corrección
  factorCorreccionPoblacionFinita: number;
  // Nivel de confianza usado
  nivelConfianza: number;
  zScore: number;
  // Resultados por candidato
  candidatos: ResultadoExtrapolado[];
}

export interface ResumenNacional {
  fechaCalculo: string;
  nivelConfianza: number;
  totalDepartamentos: number;
  departamentos: DepartamentoResultado[];
  // Agregado nacional (ponderado)
  resultadoNacional: ResultadoExtrapolado[];
}

// ── Resumen "Todo en Uno" ──

export interface RegionResumen {
  ubigeo: string;
  nombre: string;
  porcentajeConteo: number;
  actasContabilizadas: number;
  totalActas: number;
  totalVotosValidos: number;
  totalVotosEmitidos: number;
}

export interface CandidatoResumenNacional {
  posicion: number;
  nombreAgrupacionPolitica: string;
  nombreCandidato: string;
  // Datos crudos agregados
  totalVotosValidosNacional: number;
  porcentajeVotosValidosNacional: number;
  // Desglose por región
  votosPorRegion: Array<{
    ubigeo: string;
    nombre: string;
    votos: number;
    porcentaje: number;
  }>;
  // Extrapolación con FPC
  votosExtrapolados: number;
  porcentajeExtrapoladoMin: number;
  porcentajeExtrapoladoMax: number;
  margenError: number;
  margenErrorRelativo: number;
}

export interface ResumenTodoEnUno {
  fechaCalculo: string;
  nivelConfianza: number;
  zScore: number;
  // Metadatos del conteo
  conteoNacional: {
    actasContabilizadasTotal: number;
    totalActasNacional: number;
    porcentajeConteoNacional: number;
    totalVotosValidosContados: number;
    totalVotosEmitidosContados: number;
    factorCorreccionPoblacionFinita: number;
  };
  // Resumen por región (metadatos)
  regiones: RegionResumen[];
  // Top candidatos con todo incluido
  topCandidatos: CandidatoResumenNacional[];
  // Todos los candidatos
  todosCandidatos: CandidatoResumenNacional[];
}
