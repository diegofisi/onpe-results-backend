import { Controller, Get, Param, Query } from '@nestjs/common';
import { ExtrapolacionService } from './extrapolacion.service';

@Controller('resultados')
export class ExtrapolacionController {
  constructor(private readonly extrapolacionService: ExtrapolacionService) {}

  /**
   * GET /resultados/nacional?confianza=95
   *
   * Devuelve la extrapolación de TODOS los departamentos
   * junto con un resumen nacional ponderado.
   *
   * Query params:
   *   - confianza: nivel de confianza (90, 95, 99). Default: 95
   */
  @Get('nacional')
  async getResultadosNacionales(
    @Query('confianza') confianza?: string,
  ) {
    const nivel = confianza ? parseInt(confianza, 10) : 95;
    return this.extrapolacionService.extraporarNacional(nivel);
  }

  /**
   * GET /resultados/departamento/:ubigeo?confianza=95
   *
   * Devuelve la extrapolación de UN departamento específico.
   *
   * Params:
   *   - ubigeo: código ubigeo del departamento (ej: 140000 para Lima)
   *
   * Query params:
   *   - confianza: nivel de confianza (90, 95, 99). Default: 95
   */
  @Get('departamento/:ubigeo')
  async getResultadosDepartamento(
    @Param('ubigeo') ubigeo: string,
    @Query('confianza') confianza?: string,
  ) {
    const nivel = confianza ? parseInt(confianza, 10) : 95;
    return this.extrapolacionService.extraporarPorDepartamento(ubigeo, nivel);
  }

  /**
   * GET /resultados/resumen?confianza=95&top=7
   *
   * ENDPOINT TODO EN UNO:
   * - Hace fetch de TODAS las regiones en paralelo
   * - Agrega votos por candidato a nivel nacional
   * - Incluye desglose por región para cada candidato
   * - Calcula extrapolación con FPC y margen de error
   * - Devuelve top N candidatos + lista completa
   *
   * Query params:
   *   - confianza: nivel de confianza (90, 95, 99). Default: 95
   *   - top: cantidad de primeros candidatos destacados. Default: 7
   */
  @Get('resumen')
  async getResumenTodoEnUno(
    @Query('confianza') confianza?: string,
    @Query('top') top?: string,
  ) {
    const nivel = confianza ? parseInt(confianza, 10) : 95;
    const topN = top ? parseInt(top, 10) : 7;
    return this.extrapolacionService.resumenTodoEnUno(nivel, topN);
  }

  /**
   * GET /resultados/resumen-estratificado?confianza=95&top=7
   *
   * EXTRAPOLACIÓN ESTRATIFICADA POR REGIÓN:
   * - Cada región extrapola por separado con su propio FPC
   * - Las varianzas se combinan ponderadas por peso regional
   * - Corrige el sesgo urbano/rural del conteo
   * - Produce intervalos de confianza más realistas (más amplios)
   *
   * Query params:
   *   - confianza: nivel de confianza (90, 95, 99). Default: 95
   *   - top: cantidad de primeros candidatos destacados. Default: 7
   */
  @Get('resumen-estratificado')
  async getResumenEstratificado(
    @Query('confianza') confianza?: string,
    @Query('top') top?: string,
  ) {
    const nivel = confianza ? parseInt(confianza, 10) : 95;
    const topN = top ? parseInt(top, 10) : 7;
    return this.extrapolacionService.resumenEstratificado(nivel, topN);
  }

  /**
   * GET /resultados/debug/:ubigeo
   *
   * Endpoint de diagnóstico: hace UNA sola llamada a la API de ONPE
   * y devuelve la respuesta cruda para verificar que funciona.
   */
  @Get('debug/:ubigeo')
  async debug(@Param('ubigeo') ubigeo: string) {
    const axios = require('axios');
    const url = `https://resultadoelectoral.onpe.gob.pe/presentacion-backend/resumen-general/totales`;
    const params = {
      idEleccion: 10,
      tipoFiltro: 'ubigeo_nivel_01',
      idAmbitoGeografico: 1,
      idUbigeoDepartamento: ubigeo,
    };

    try {
      const resp = await axios.get(url, {
        params,
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://resultadoelectoral.onpe.gob.pe/main/resumen',
          'Origin': 'https://resultadoelectoral.onpe.gob.pe',
        },
      });

      const isHtml = typeof resp.data === 'string' && resp.data.includes('<!doctype');
      return {
        diagnostico: {
          status: resp.status,
          contentType: resp.headers['content-type'],
          esJSON: !isHtml,
          esHTML: isHtml,
          cookiesRecibidas: resp.headers['set-cookie'] || [],
        },
        dataPreview: isHtml
          ? { html: resp.data.slice(0, 500) }
          : resp.data,
      };
    } catch (error: any) {
      return {
        error: true,
        message: error?.message,
        status: error?.response?.status,
        responsePreview: error?.response?.data
          ? String(error.response.data).slice(0, 500)
          : null,
      };
    }
  }

  /**
   * GET /resultados/departamentos
   *
   * Devuelve la lista de departamentos disponibles con sus ubigeos
   */
  @Get('departamentos')
  getDepartamentos() {
    return {
      success: true,
      message: 'Usa el ubigeo en /resultados/departamento/:ubigeo',
      data: this.extrapolacionService.getDepartamentos(),
    };
  }
}
