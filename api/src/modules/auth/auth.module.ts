// Importações principais do NestJS e módulos internos
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './services/auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './controllers/auth.controller';
import { AdminUserModule } from '../admin-user/admin-user.module';

@Module({
  controllers: [AuthController],
  imports: [
    AdminUserModule,
    ConfigModule, // Garante que as variáveis do .env estejam disponíveis

    // Configuração do JWT usando variável de ambiente JWT_SECRET
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET, // Chave secreta usada para assinar os tokens
        signOptions: { expiresIn: '1d' }, // ⏱Token expira em 1 dia
      }),
    }),

    PassportModule, // Necessário para estratégias de autenticação
  ],
  providers: [
    AuthService, // Serviço que gerencia autenticação
    LocalStrategy, // Estratégia de login com usuário/senha
    JwtStrategy, // Estratégia de autenticação via token JWT
  ],
})
export class AuthModule {}
