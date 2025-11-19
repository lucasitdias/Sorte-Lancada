import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppValidationPipe } from './common/pipes/app-validation.pipe';
import { ApiErrorFilter } from './common/pipes/filter-error.pipe';
import { config } from 'dotenv';
config();

// Adicionado para permitir arquivos grandes
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permite envio de arquivos grandes via multipart/form-data
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Validação global
  app.useGlobalPipes(new AppValidationPipe());

  // Filtro de erros global
  app.useGlobalFilters(new ApiErrorFilter());

  // Habilita CORS
  app.enableCors();

  console.log('App listening in ' + process.env.PORT);

  // Inicia o servidor
  await app.listen(process.env.PORT ?? 1337);
}
bootstrap();
