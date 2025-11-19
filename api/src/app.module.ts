import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from 'dotenv';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { AdminUserModule } from './modules/admin-user/admin-user.module';
import { CommonUserModule } from './modules/common-user/common-user.module';
import { RaffleModule } from './modules/raffles/raffle.module';
import { PaymentModule } from './modules/payment/payment.module';
import { UsersRaffleNumberModule } from './modules/users-raffle-number/users-raffle-number.module';
import { ScheduleModule } from '@nestjs/schedule';

// Carrega variáveis de ambiente do arquivo .env
config();

@Module({
  imports: [
    // Habilita o uso de variáveis de ambiente em toda a aplicação
    ConfigModule.forRoot(),

    // Habilita agendamentos e tarefas recorrentes
    ScheduleModule.forRoot(),

    // Configuração principal do TypeORM para conexão com o banco PostgreSQL
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST, // Ex: localhost
      port: Number(process.env.DB_PORT), // Ex: 5436
      username: process.env.DB_USERNAME, // Ex: sortelancada
      password: process.env.DB_PASSWORD, // Ex: 123@Mudar
      database: process.env.DB_DATABASE, // Ex: sortelancada
      entities: [__dirname + '/**/*.entity{.ts,.js}'],

      // IMPORTANTE: Desativado para evitar que o TypeORM sobrescreva tabelas existentes no banco restaurado
      synchronize: false,
    }),

    // Módulos da aplicação organizados por domínio
    AuthModule,
    CommonUserModule,
    AdminUserModule,
    RaffleModule,
    PaymentModule,
    UsersRaffleNumberModule,
  ],
})
export class AppModule {}
