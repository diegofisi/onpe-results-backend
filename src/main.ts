import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS por si quieres consumirlo desde un frontend
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
╔══════════════════════════════════════════════════════════╗
║          ONPE Extrapolador - Resultados 2026             ║
║                                                          ║
║  Endpoints disponibles:                                  ║
║                                                          ║
║  GET /resultados/departamentos                           ║
║      → Lista de departamentos y sus ubigeos              ║
║                                                          ║
║  GET /resultados/departamento/:ubigeo?confianza=95       ║
║      → Extrapolación por departamento                    ║
║      → Ejemplo: /resultados/departamento/140000          ║
║                                                          ║
║  GET /resultados/nacional?confianza=95                   ║
║      → Resumen nacional con todos los departamentos      ║
║                                                          ║
║  Niveles de confianza: 90, 95, 99                        ║
║                                                          ║
║  Servidor corriendo en: http://localhost:${port}            ║
╚══════════════════════════════════════════════════════════╝
  `);
}
bootstrap();
