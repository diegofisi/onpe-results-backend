import { Injectable, Logger } from '@nestjs/common';
import { OnpeService } from '../onpe/onpe.service';
import {
  TotalesData,
  ParticipanteData,
  ResultadoExtrapolado,
  DepartamentoResultado,
  ResumenNacional,
  ResumenTodoEnUno,
  CandidatoResumenNacional,
  RegionResumen,
} from '../interfaces/onpe.interfaces';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  FACTOR DE CORRECCIÓN POR POBLACIÓN FINITA (FPC)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Cuando muestreamos sin reemplazo de una población finita N,
 *  el error estándar se reduce porque la varianza disminuye
 *  a medida que n se acerca a N.
 *
 *  FPC = sqrt( (N - n) / (N - 1) )
 *
 *  Margen de error para una proporción:
 *
 *    ME = z * sqrt( p̂(1 - p̂) / n ) * FPC
 *
 *  Donde:
 *    N  = total de actas (población)
 *    n  = actas contabilizadas (muestra)
 *    p̂  = proporción observada del candidato
 *    z  = valor z según nivel de confianza (1.96 para 95%)
 *
 *  El intervalo de confianza es:  p̂ ± ME
 *
 *  Si n = N (conteo completo), FPC = 0 → ME = 0 (sin error)
 * ═══════════════════════════════════════════════════════════════════
 */

// Tabla de z-scores comunes
const Z_SCORES: Record<number, number> = {
  90: 1.645,
  95: 1.96,
  99: 2.576,
};

@Injectable()
export class ExtrapolacionService {
  private readonly logger = new Logger(ExtrapolacionService.name);

  constructor(private readonly onpeService: OnpeService) {}

  /**
   * Calcula el factor de corrección por población finita
   */
  private calcularFPC(N: number, n: number): number {
    if (N <= 1 || n >= N) return 0;
    return Math.sqrt((N - n) / (N - 1));
  }

  /**
   * Calcula el margen de error para una proporción
   * con corrección por población finita
   */
  private calcularMargenError(
    p: number,      // proporción observada (0 a 1)
    n: number,      // tamaño de muestra (actas contabilizadas)
    N: number,      // tamaño de población (total de actas)
    z: number,      // z-score
  ): number {
    if (n <= 0) return 100;
    const fpc = this.calcularFPC(N, n);
    const errorEstandar = Math.sqrt((p * (1 - p)) / n);
    return z * errorEstandar * fpc;
  }

  /**
   * Extrapola los resultados de un departamento
   */
  private extrapolarDepartamento(
    totales: TotalesData,
    participantes: ParticipanteData[],
    nivelConfianza: number,
    z: number,
  ): { fpc: number; candidatos: ResultadoExtrapolado[] } {
    const N = totales.totalActas;
    const n = totales.contabilizadas;
    const fpc = this.calcularFPC(N, n);

    const candidatos: ResultadoExtrapolado[] = participantes.map((p) => {
      // La proporción observada viene en porcentaje, la convertimos a [0,1]
      const proporcion = p.porcentajeVotosValidos / 100;

      // Margen de error en proporción [0,1]
      const me = this.calcularMargenError(proporcion, n, N, z);

      // Convertimos todo a porcentaje
      const mePorcentual = me * 100;

      // Intervalo de confianza (acotado a [0, 100])
      const limInf = Math.max(0, p.porcentajeVotosValidos - mePorcentual);
      const limSup = Math.min(100, p.porcentajeVotosValidos + mePorcentual);

      // Votos extrapolados (usando proporción sobre total de votos válidos estimado)
      // Estimamos total votos válidos = votosValidosMuestra * (N/n)
      const factorExpansion = n > 0 ? N / n : 1;
      const votosExtrapolados = Math.round(p.totalVotosValidos * factorExpansion);

      // Error relativo
      const margenErrorRelativo =
        p.porcentajeVotosValidos > 0
          ? (mePorcentual / p.porcentajeVotosValidos) * 100
          : 0;

      return {
        nombreAgrupacionPolitica: p.nombreAgrupacionPolitica,
        nombreCandidato: p.nombreCandidato,
        votosObservados: p.totalVotosValidos,
        porcentajeObservado: p.porcentajeVotosValidos,
        votosExtrapolados,
        porcentajeExtrapoladoMin: Math.round(limInf * 1000) / 1000,
        porcentajeExtrapoladoMax: Math.round(limSup * 1000) / 1000,
        margenError: Math.round(mePorcentual * 1000) / 1000,
        margenErrorRelativo: Math.round(margenErrorRelativo * 100) / 100,
      };
    });

    // Ordenar de mayor a menor porcentaje observado
    candidatos.sort((a, b) => b.porcentajeObservado - a.porcentajeObservado);

    return { fpc, candidatos };
  }

  /**
   * Obtiene los resultados extrapolados de UN departamento
   */
  async extraporarPorDepartamento(
    ubigeo: string,
    nivelConfianza: number = 95,
  ): Promise<DepartamentoResultado> {
    const z = Z_SCORES[nivelConfianza] || 1.96;

    const departamentos = this.onpeService.getDepartamentos();
    const dep = departamentos.find((d) => d.ubigeo === ubigeo);

    const [totales, participantes] = await Promise.all([
      this.onpeService.getTotales(ubigeo),
      this.onpeService.getParticipantes(ubigeo),
    ]);

    const { fpc, candidatos } = this.extrapolarDepartamento(
      totales,
      participantes,
      nivelConfianza,
      z,
    );

    return {
      ubigeo,
      nombre: dep?.nombre || ubigeo,
      actasContabilizadas: totales.contabilizadas,
      totalActas: totales.totalActas,
      porcentajeConteo: totales.actasContabilizadas,
      totalVotosValidosMuestra: totales.totalVotosValidos,
      totalVotosEmitidosMuestra: totales.totalVotosEmitidos,
      factorCorreccionPoblacionFinita: Math.round(fpc * 10000) / 10000,
      nivelConfianza,
      zScore: z,
      candidatos,
    };
  }

  /**
   * Obtiene el resumen nacional con extrapolación de todos los departamentos
   * y un agregado nacional ponderado por votos
   */
  async extraporarNacional(nivelConfianza: number = 95): Promise<ResumenNacional> {
    const z = Z_SCORES[nivelConfianza] || 1.96;

    const datosCompletos = await this.onpeService.getTodosLosDepartamentos();

    const departamentos: DepartamentoResultado[] = datosCompletos.map(
      ({ departamento, totales, participantes }) => {
        const { fpc, candidatos } = this.extrapolarDepartamento(
          totales,
          participantes,
          nivelConfianza,
          z,
        );

        return {
          ubigeo: departamento.ubigeo,
          nombre: departamento.nombre,
          actasContabilizadas: totales.contabilizadas,
          totalActas: totales.totalActas,
          porcentajeConteo: totales.actasContabilizadas,
          totalVotosValidosMuestra: totales.totalVotosValidos,
          totalVotosEmitidosMuestra: totales.totalVotosEmitidos,
          factorCorreccionPoblacionFinita: Math.round(fpc * 10000) / 10000,
          nivelConfianza,
          zScore: z,
          candidatos,
        };
      },
    );

    // ── Agregado nacional ponderado ──
    // Recolectamos votos totales observados por candidato a nivel nacional
    const votosNacionales = new Map<
      string,
      {
        nombreAgrupacionPolitica: string;
        nombreCandidato: string;
        votosObservados: number;
        votosExtrapolados: number;
      }
    >();

    let totalVotosObservadosNacional = 0;
    let totalVotosExtrapoladosNacional = 0;

    for (const dep of departamentos) {
      for (const cand of dep.candidatos) {
        const key = cand.nombreCandidato;
        const existing = votosNacionales.get(key) || {
          nombreAgrupacionPolitica: cand.nombreAgrupacionPolitica,
          nombreCandidato: cand.nombreCandidato,
          votosObservados: 0,
          votosExtrapolados: 0,
        };
        existing.votosObservados += cand.votosObservados;
        existing.votosExtrapolados += cand.votosExtrapolados;
        votosNacionales.set(key, existing);
        totalVotosObservadosNacional += cand.votosObservados;
        totalVotosExtrapoladosNacional += cand.votosExtrapolados;
      }
    }

    // Calcular porcentaje nacional y margen de error compuesto
    // Para el error nacional usamos n_total y N_total (suma de actas)
    const nTotal = departamentos.reduce((s, d) => s + d.actasContabilizadas, 0);
    const NTotal = departamentos.reduce((s, d) => s + d.totalActas, 0);
    const fpcNacional = this.calcularFPC(NTotal, nTotal);

    const resultadoNacional: ResultadoExtrapolado[] = [];

    for (const [, cand] of votosNacionales) {
      const pObs =
        totalVotosObservadosNacional > 0
          ? cand.votosObservados / totalVotosObservadosNacional
          : 0;

      const me = this.calcularMargenError(pObs, nTotal, NTotal, z);
      const mePorcentual = me * 100;
      const porcentajeObs = pObs * 100;

      resultadoNacional.push({
        nombreAgrupacionPolitica: cand.nombreAgrupacionPolitica,
        nombreCandidato: cand.nombreCandidato,
        votosObservados: cand.votosObservados,
        porcentajeObservado: Math.round(porcentajeObs * 1000) / 1000,
        votosExtrapolados: cand.votosExtrapolados,
        porcentajeExtrapoladoMin:
          Math.round(Math.max(0, porcentajeObs - mePorcentual) * 1000) / 1000,
        porcentajeExtrapoladoMax:
          Math.round(Math.min(100, porcentajeObs + mePorcentual) * 1000) / 1000,
        margenError: Math.round(mePorcentual * 1000) / 1000,
        margenErrorRelativo:
          porcentajeObs > 0
            ? Math.round((mePorcentual / porcentajeObs) * 10000) / 100
            : 0,
      });
    }

    // Ordenar de mayor a menor
    resultadoNacional.sort((a, b) => b.porcentajeObservado - a.porcentajeObservado);

    return {
      fechaCalculo: new Date().toISOString(),
      nivelConfianza,
      totalDepartamentos: departamentos.length,
      departamentos,
      resultadoNacional,
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════
   *  ENDPOINT "TODO EN UNO"
   *
   *  1. Fetch de TODAS las regiones (totales + participantes)
   *  2. Agrega los votos a nivel nacional por candidato
   *  3. Calcula desglose por región para cada candidato
   *  4. Aplica extrapolación con FPC
   *  5. Devuelve resumen limpio con top N y todos los candidatos
   * ═══════════════════════════════════════════════════════════════
   */
  async resumenTodoEnUno(
    nivelConfianza: number = 95,
    topN: number = 7,
  ): Promise<ResumenTodoEnUno> {
    const z = Z_SCORES[nivelConfianza] || 1.96;

    this.logger.log('Iniciando fetch de todas las regiones...');
    const datosCrudos = await this.onpeService.getTodosLosDepartamentos();
    this.logger.log(`Datos obtenidos de ${datosCrudos.length} regiones`);

    // Filtrar regiones que tengan totales válidos
    const datosCompletos = datosCrudos.filter(
      (d) => d.totales && d.totales.totalActas != null && d.participantes,
    );
    this.logger.log(`Regiones con datos válidos: ${datosCompletos.length}`);

    // ── 1. Resumen de metadatos por región ──
    const regiones: RegionResumen[] = datosCompletos.map(({ departamento, totales }) => ({
      ubigeo: departamento.ubigeo,
      nombre: departamento.nombre,
      porcentajeConteo: totales.actasContabilizadas || 0,
      actasContabilizadas: totales.contabilizadas || 0,
      totalActas: totales.totalActas || 0,
      totalVotosValidos: totales.totalVotosValidos || 0,
      totalVotosEmitidos: totales.totalVotosEmitidos || 0,
    }));

    // ── 2. Totales nacionales ──
    const actasContabilizadasTotal = regiones.reduce((s, r) => s + r.actasContabilizadas, 0);
    const totalActasNacional = regiones.reduce((s, r) => s + r.totalActas, 0);
    const totalVotosValidosContados = regiones.reduce((s, r) => s + r.totalVotosValidos, 0);
    const totalVotosEmitidosContados = regiones.reduce((s, r) => s + r.totalVotosEmitidos, 0);
    const porcentajeConteoNacional =
      totalActasNacional > 0
        ? Math.round((actasContabilizadasTotal / totalActasNacional) * 10000) / 100
        : 0;
    const fpcNacional = this.calcularFPC(totalActasNacional, actasContabilizadasTotal);

    // ── 3. Agregar votos por candidato a nivel nacional con desglose regional ──
    const candidatosMap = new Map<
      number, // codigoAgrupacionPolitica
      {
        nombreAgrupacionPolitica: string;
        nombreCandidato: string;
        codigoAgrupacionPolitica: number;
        totalVotosValidosNacional: number;
        votosPorRegion: Array<{
          ubigeo: string;
          nombre: string;
          votos: number;
          porcentaje: number;
        }>;
      }
    >();

    for (const { departamento, participantes } of datosCompletos) {
      for (const p of participantes) {
        const existing = candidatosMap.get(p.codigoAgrupacionPolitica);
        if (existing) {
          existing.totalVotosValidosNacional += p.totalVotosValidos;
          existing.votosPorRegion.push({
            ubigeo: departamento.ubigeo,
            nombre: departamento.nombre,
            votos: p.totalVotosValidos,
            porcentaje: p.porcentajeVotosValidos,
          });
        } else {
          candidatosMap.set(p.codigoAgrupacionPolitica, {
            nombreAgrupacionPolitica: p.nombreAgrupacionPolitica,
            nombreCandidato: p.nombreCandidato,
            codigoAgrupacionPolitica: p.codigoAgrupacionPolitica,
            totalVotosValidosNacional: p.totalVotosValidos,
            votosPorRegion: [
              {
                ubigeo: departamento.ubigeo,
                nombre: departamento.nombre,
                votos: p.totalVotosValidos,
                porcentaje: p.porcentajeVotosValidos,
              },
            ],
          });
        }
      }
    }

    // ── 4. Calcular porcentajes nacionales y extrapolación con FPC ──
    const todosCandidatos: CandidatoResumenNacional[] = [];

    for (const [, cand] of candidatosMap) {
      const porcentajeNacional =
        totalVotosValidosContados > 0
          ? (cand.totalVotosValidosNacional / totalVotosValidosContados) * 100
          : 0;

      // Proporción para el cálculo de error
      const p = porcentajeNacional / 100;
      const me = this.calcularMargenError(
        p,
        actasContabilizadasTotal,
        totalActasNacional,
        z,
      );
      const mePorcentual = me * 100;

      // Votos extrapolados
      const factorExpansion =
        actasContabilizadasTotal > 0
          ? totalActasNacional / actasContabilizadasTotal
          : 1;
      const votosExtrapolados = Math.round(
        cand.totalVotosValidosNacional * factorExpansion,
      );

      todosCandidatos.push({
        posicion: 0, // se asigna después de ordenar
        nombreAgrupacionPolitica: cand.nombreAgrupacionPolitica,
        nombreCandidato: cand.nombreCandidato,
        totalVotosValidosNacional: cand.totalVotosValidosNacional,
        porcentajeVotosValidosNacional: Math.round(porcentajeNacional * 1000) / 1000,
        votosPorRegion: cand.votosPorRegion.sort((a, b) => b.votos - a.votos),
        votosExtrapolados,
        porcentajeExtrapoladoMin:
          Math.round(Math.max(0, porcentajeNacional - mePorcentual) * 1000) / 1000,
        porcentajeExtrapoladoMax:
          Math.round(Math.min(100, porcentajeNacional + mePorcentual) * 1000) / 1000,
        margenError: Math.round(mePorcentual * 1000) / 1000,
        margenErrorRelativo:
          porcentajeNacional > 0
            ? Math.round((mePorcentual / porcentajeNacional) * 10000) / 100
            : 0,
      });
    }

    // Ordenar de mayor a menor y asignar posición
    todosCandidatos.sort(
      (a, b) => b.porcentajeVotosValidosNacional - a.porcentajeVotosValidosNacional,
    );
    todosCandidatos.forEach((c, i) => (c.posicion = i + 1));

    // Top N
    const topCandidatos = todosCandidatos.slice(0, topN);

    return {
      fechaCalculo: new Date().toISOString(),
      nivelConfianza,
      zScore: z,
      conteoNacional: {
        actasContabilizadasTotal,
        totalActasNacional,
        porcentajeConteoNacional,
        totalVotosValidosContados,
        totalVotosEmitidosContados,
        factorCorreccionPoblacionFinita: Math.round(fpcNacional * 10000) / 10000,
      },
      regiones,
      topCandidatos,
      todosCandidatos,
    };
  }
}
