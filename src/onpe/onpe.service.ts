import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import {
  DepartamentoItem,
  TotalesData,
  ParticipanteData,
  OnpeApiResponse,
} from '../interfaces/onpe.interfaces';

const BASE_URL = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend';
const ID_ELECCION = 10;

@Injectable()
export class OnpeService {
  private readonly logger = new Logger(OnpeService.name);
  private client: AxiosInstance;

  private readonly departamentos: DepartamentoItem[] = [
    { ubigeo: '010000', nombre: 'AMAZONAS' },
    { ubigeo: '020000', nombre: 'ÁNCASH' },
    { ubigeo: '030000', nombre: 'APURÍMAC' },
    { ubigeo: '040000', nombre: 'AREQUIPA' },
    { ubigeo: '050000', nombre: 'AYACUCHO' },
    { ubigeo: '060000', nombre: 'CAJAMARCA' },
    { ubigeo: '240000', nombre: 'CALLAO' },
    { ubigeo: '070000', nombre: 'CUSCO' },
    { ubigeo: '080000', nombre: 'HUANCAVELICA' },
    { ubigeo: '090000', nombre: 'HUÁNUCO' },
    { ubigeo: '100000', nombre: 'ICA' },
    { ubigeo: '110000', nombre: 'JUNÍN' },
    { ubigeo: '120000', nombre: 'LA LIBERTAD' },
    { ubigeo: '130000', nombre: 'LAMBAYEQUE' },
    { ubigeo: '140000', nombre: 'LIMA' },
    { ubigeo: '150000', nombre: 'LORETO' },
    { ubigeo: '160000', nombre: 'MADRE DE DIOS' },
    { ubigeo: '170000', nombre: 'MOQUEGUA' },
    { ubigeo: '180000', nombre: 'PASCO' },
    { ubigeo: '190000', nombre: 'PIURA' },
    { ubigeo: '200000', nombre: 'PUNO' },
    { ubigeo: '210000', nombre: 'SAN MARTÍN' },
    { ubigeo: '220000', nombre: 'TACNA' },
    { ubigeo: '230000', nombre: 'TUMBES' },
    { ubigeo: '250000', nombre: 'UCAYALI' },
    { ubigeo: '910000', nombre: 'ÁFRICA' },
    { ubigeo: '920000', nombre: 'AMÉRICA' },
    { ubigeo: '930000', nombre: 'ASIA' },
    { ubigeo: '940000', nombre: 'EUROPA' },
    { ubigeo: '950000', nombre: 'OCEANÍA' },
  ];

  constructor() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'es-419,es-US;q=0.9,es;q=0.8',
        'Content-Type': 'application/json',
        Referer: 'https://resultadoelectoral.onpe.gob.pe/main/resumen',
        'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
    });
  }

  getDepartamentos(): DepartamentoItem[] {
    return this.departamentos;
  }

  private esExtranjero(ubigeo: string): boolean {
    return ubigeo.startsWith('9');
  }

  async getTotales(ubigeo: string): Promise<TotalesData | null> {
    const url = `${BASE_URL}/resumen-general/totales`;
    const params = {
      idEleccion: ID_ELECCION,
      tipoFiltro: 'ubigeo_nivel_01',
      idAmbitoGeografico: this.esExtranjero(ubigeo) ? 2 : 1,
      idUbigeoDepartamento: ubigeo,
    };

    try {
      const response = await this.client.get<OnpeApiResponse<TotalesData>>(url, { params });
      const data = response.data;

      if (typeof data === 'string') {
        this.logger.warn(`Totales ${ubigeo}: recibió HTML (status=${response.status}, content-type=${response.headers['content-type']}, preview=${String(data).slice(0, 200)})`);
        return null;
      }
      if (!data?.data) {
        this.logger.warn(`Totales vacío para ${ubigeo}: ${JSON.stringify(data)}`);
        return null;
      }
      return data.data;
    } catch (error: any) {
      this.logger.error(`Error totales ${ubigeo}: status=${error?.response?.status} msg=${error?.message} headers=${JSON.stringify(error?.response?.headers || {})}`);
      return null;
    }
  }

  async getParticipantes(ubigeo: string): Promise<ParticipanteData[]> {
    const url = `${BASE_URL}/resumen-general/participantes`;
    const params = {
      idEleccion: ID_ELECCION,
      tipoFiltro: 'ubigeo_nivel_01',
      idAmbitoGeografico: this.esExtranjero(ubigeo) ? 2 : 1,
      idUbigeoDepartamento: ubigeo,
    };

    try {
      const response = await this.client.get<OnpeApiResponse<ParticipanteData[]>>(url, { params });
      const data = response.data;

      if (typeof data === 'string') {
        this.logger.warn(`Participantes ${ubigeo}: recibió HTML (status=${response.status}, content-type=${response.headers['content-type']}, preview=${String(data).slice(0, 200)})`);
        return [];
      }
      if (!data?.data || !Array.isArray(data.data)) {
        this.logger.warn(`Participantes vacío para ${ubigeo}`);
        return [];
      }
      return data.data;
    } catch (error: any) {
      this.logger.error(`Error participantes ${ubigeo}: ${error?.message}`);
      return [];
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getTodosLosDepartamentos(): Promise<
    Array<{
      departamento: DepartamentoItem;
      totales: TotalesData;
      participantes: ParticipanteData[];
    }>
  > {
    const BATCH_SIZE = 5;
    const DELAY_MS = 300;
    const validos: Array<{
      departamento: DepartamentoItem;
      totales: TotalesData;
      participantes: ParticipanteData[];
    }> = [];

    for (let i = 0; i < this.departamentos.length; i += BATCH_SIZE) {
      const batch = this.departamentos.slice(i, i + BATCH_SIZE);
      this.logger.log(`Fetch lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(this.departamentos.length / BATCH_SIZE)}: ${batch.map((d) => d.nombre).join(', ')}`);

      const resultados = await Promise.allSettled(
        batch.map(async (dep) => {
          const [totales, participantes] = await Promise.all([
            this.getTotales(dep.ubigeo),
            this.getParticipantes(dep.ubigeo),
          ]);
          return { departamento: dep, totales, participantes };
        }),
      );

      for (const r of resultados) {
        if (r.status === 'fulfilled' && r.value.totales != null) {
          validos.push(r.value);
        }
      }

      if (i + BATCH_SIZE < this.departamentos.length) {
        await this.delay(DELAY_MS);
      }
    }

    this.logger.log(`Regiones con datos válidos: ${validos.length}/${this.departamentos.length}`);
    return validos;
  }
}
