// Importações necessárias do NestJS e módulos internos
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
//FileInterceptor é usado para upload de capa
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';

// Serviços e DTOs da rifa
import { CreateRaffleService } from '../services';
import { CreateRaffleDto } from '../dtos/create-raffle.dto';
import { UpdateRaffleDto } from '../dtos/update-raffle.dto';
import { ListRaffleDto } from '../dtos/list-raffle.dto';

// Entidades e enums
import { RaffleStatus } from '../enum/raffle-status.enum';
import { Raffle } from '../raffle.entity';

// Serviços auxiliares
import { QueryRaffleService } from '../services/query-raffle.service';
import { UploadRaffleMediaService } from '../services/upload-raffle-photos.service';
import { CreateUsersRaffleNumberService } from '@/modules/users-raffle-number/services/create-users-raffle-number.service';
import { QueryUsersRaffleNumberService } from '@/modules/users-raffle-number/services/query-users-raffle-number.service';
import { CreateOldUsersRaffleNumberService } from '@/modules/old-users-raffle-number/services/create-old-users-raffle-number.service';

// Autenticação e erros
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from '@/common/guards/jwt-auth.guard';
import ApiError from '@/common/error/entities/api-error.entity';
import { AdminUser } from '@/modules/admin-user/admin-user.entity';
import { ListOptions } from '@/common/types/list-options.type';
import { censorName } from '@/common/functions/censorName';

@Controller('raffles')
export class RaffleController {
  constructor(
    private readonly createRaffleService: CreateRaffleService,
    private readonly queryUsersRaffleNumberService: QueryUsersRaffleNumberService,
    private readonly createUsersRaffleNumberService: CreateUsersRaffleNumberService,
    private readonly queryRaffleService: QueryRaffleService,
    private readonly uploadRaffleMediaService: UploadRaffleMediaService,
    private readonly createOldUsersRaffleNumberService: CreateOldUsersRaffleNumberService,
  ) {}

  // Criação de nova rifa
  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createRaffle(
    @Req() req: Request,
    @Body() createRaffleDto: CreateRaffleDto,
  ) {
    const adminUser = req.user as AdminUser;

    // Cria a rifa com os dados recebidos e vincula ao usuário administrador
    const raffle = await this.createRaffleService.createRaffle(
      createRaffleDto,
      adminUser,
    );

    return { ok: true, raffle };
  }

  // Listagem de rifas com filtros
  @Get('list')
  @UseGuards(OptionalJwtAuthGuard)
  async listRaffle(@Query() query: ListRaffleDto, @Req() req: Request) {
    const adminRequesting = req.user as AdminUser;

    // Define opções de consulta incluindo relações e filtros
    const queryOptions: ListOptions<Raffle> = {
      ...query,
      relations: ['winner_common_user'],
    };

    // Se for admin, inclui campo adicional
    if (adminRequesting.id) {
      queryOptions.additionalSelects = ['available_numbers_qtd'];
    }

    // Aplica filtro por status se presente
    if (query.status) queryOptions.where = [{ status: query.status }];

    // Executa consulta
    const { raffles, count } =
      await this.queryRaffleService.queryRaffle(queryOptions);

    // Remove campo sensível antes de retornar
    raffles.forEach((raffle) => {
      delete raffle.available_numbers;
    });

    return { ok: true, raffles, total: count };
  }
  // Atualização de dados da rifa
  @Post('update/:raffleId')
  @UseGuards(JwtAuthGuard)
  async updateRaffle(
    @Param('raffleId') raffleId: string,
    @Body() updateRaffleDto: UpdateRaffleDto,
  ) {
    // Busca a rifa pelo ID
    const raffle = await this.queryRaffleService.findOneRaffle({
      where: [{ id: raffleId }],
    });

    // Converte os números de premiação instantânea para inteiros
    updateRaffleDto.gift_numbers = updateRaffleDto.gift_numbers?.map((number) =>
      parseInt(number as any),
    );

    if (!raffle) {
      throw new ApiError('raffle-not-found', 'Rifa não encontrada', 404);
    }

    // Atualiza os dados da rifa
    const updatedRaffle = await this.createRaffleService.updateRaffle(
      raffleId,
      updateRaffleDto,
    );

    return { ok: true, raffle: updatedRaffle };
  }

  // Upload de imagens adicionais da rifa (galeria)
  @Post('upload-photo/:raffleId')
  @UseInterceptors(FilesInterceptor('medias')) // Usa FilesInterceptor para múltiplos arquivos
  @UseGuards(JwtAuthGuard)
  async uploadPhoto(
    @UploadedFiles() media: Express.Multer.File[],
    @Param('raffleId') raffleId: string,
  ) {
    // Busca a rifa
    const raffle = await this.queryRaffleService.findOneRaffle({
      where: [{ id: raffleId }],
    });

    if (!raffle) {
      throw new ApiError('raffle-not-found', 'Rifa não encontrada', 404);
    }

    // Faz upload das imagens para o Cloudinary
    const medias_url = await this.uploadRaffleMediaService.uploadMedia(media);

    // Atualiza a rifa com as novas imagens adicionadas à galeria
    const updatedRaffle = await this.createRaffleService.updateRaffle(
      raffleId,
      { medias_url: [...raffle.medias_url, ...medias_url] },
    );

    return { ok: true, raffle: updatedRaffle };
  }

  // Upload da imagem de capa da rifa
  @Post('update-cover/:raffleId')
  @UseInterceptors(FileInterceptor('cover')) // Usa FileInterceptor para um único arquivo
  @UseGuards(JwtAuthGuard)
  async updateCover(
    @UploadedFile() cover: Express.Multer.File, // Recebe um único arquivo
    @Param('raffleId') raffleId: string,
  ) {
    // Busca a rifa
    const raffle = await this.queryRaffleService.findOneRaffle({
      where: [{ id: raffleId }],
    });

    if (!raffle) {
      throw new ApiError('raffle-not-found', 'Rifa não encontrada', 404);
    }

    if (!cover) {
      throw new ApiError('invalid-cover', 'Capa inválida', 400);
    }

    // Log para testes: nome do arquivo recebido
    console.log('Arquivo recebido:', cover?.originalname);

    // Faz upload da nova imagem de capa
    const [cover_url] = await this.uploadRaffleMediaService.uploadMedia([
      cover,
    ]);

    // Remove a capa anterior, se existir
    if (raffle.cover_url)
      await this.uploadRaffleMediaService.deleteMedia(raffle.cover_url);

    // Atualiza a rifa com a nova URL da capa
    const updatedRaffle = await this.createRaffleService.updateRaffle(
      raffleId,
      { cover_url },
    );

    return { ok: true, raffle: updatedRaffle };
  }
  // Exclusão de imagem da galeria da rifa
  @Delete('delete-photo/:raffleId')
  async updatePhoto(
    @Param('raffleId') raffleId: string,
    @Body() { mediaUrl }: { mediaUrl: string },
  ) {
    // Busca a rifa
    const raffle = await this.queryRaffleService.findOneRaffle({
      where: [{ id: raffleId }],
    });

    if (!raffle) {
      throw new ApiError('raffle-not-found', 'Rifa não encontrada', 404);
    }

    // Remove a imagem da lista de URLs
    const filteredPhotos = raffle.medias_url.filter(
      (photo) => photo !== mediaUrl,
    );

    // Atualiza a rifa com a nova lista de imagens
    const updatedRaffle = await this.createRaffleService.updateRaffle(
      raffleId,
      { medias_url: filteredPhotos },
    );

    // Deleta a imagem do Cloudinary
    await this.uploadRaffleMediaService.deleteMedia(mediaUrl);

    return { ok: true, raffle: updatedRaffle };
  }

  // Finalização da rifa e definição de ganhadores
  @Post('finish/:raffleId')
  async finishRaffle(@Param('raffleId') raffleId: string) {
    // Busca a rifa
    const raffle = await this.queryRaffleService.findOneRaffle({
      where: [{ id: raffleId }],
    });

    // Busca os números comprados pelos usuários
    const { urns } =
      await this.queryUsersRaffleNumberService.listUsersRaffleNumber({
        where: [{ raffle_id: raffleId }],
      });

    if (!raffle) {
      throw new ApiError('raffle-not-found', 'Rifa não encontrada', 404);
    }

    if (raffle.status === RaffleStatus.FINISHED)
      throw new ApiError('raffle-finished', 'Rifa já finalizada', 400);

    // Gera os ganhadores
    const { winner: winnerRaffleNumber, giftWinners } =
      await this.queryRaffleService.getWinners(raffleId);

    if (!winnerRaffleNumber)
      throw new ApiError('winner-not-found', 'Vencedor não encontrado', 404);

    // Atualiza a rifa com os ganhadores
    const updatedRaffle = await this.createRaffleService.updateRaffle(
      raffleId,
      {
        status: RaffleStatus.FINISHED,
        winner_common_user_id: winnerRaffleNumber?.common_user_id,
        gift_numbers_winners: JSON.stringify(
          giftWinners.map((urn) => ({
            ...urn.common_user,
            number: urn.number,
          })),
        ),
      },
    );

    // Move os dados para histórico
    await this.createOldUsersRaffleNumberService.insertAll(urns);

    // Remove os números ativos da rifa
    await this.createUsersRaffleNumberService.deleteUsersRaffleNumberByRaffleId(
      raffleId,
    );

    return { ok: true, raffle: updatedRaffle };
  }

  // Consulta de rifa por ID
  @Get(':raffleId')
  async findOneRaffle(
    @Param('raffleId') raffleId: string,
    @Query('with-gift-winners') withGiftWinners: string,
  ) {
    // Busca a rifa e os ganhadores
    const { winners, ...raffle } = await this.queryRaffleService.findOneRaffle({
      where: [{ id: raffleId }],
      relations: ['winner_common_user'],
      raffle_with_gift_winners: withGiftWinners === 'true',
    });

    // Calcula porcentagem vendida
    const { initial_numbers_qtd, available_numbers_qtd } = raffle;
    const percentage = (available_numbers_qtd / initial_numbers_qtd) * 100;
    delete raffle.available_numbers_qtd;

    // Censura os nomes dos ganhadores
    let censoredWinners = [];
    if (winners?.length > 0) {
      censoredWinners = winners.map((winner) => ({
        ...winner,
        common_user: {
          name: censorName(winner?.common_user.name),
          phone: '',
        },
      }));
    }

    return { ok: true, raffle, percentage, winners: censoredWinners };
  }

  // Consulta de ganhadores da rifa
  @Get('winners/:raffleId')
  @UseGuards(JwtAuthGuard)
  async getWinners(@Param('raffleId') raffleId: string) {
    const { winner, giftWinners } =
      await this.queryRaffleService.getWinners(raffleId);
    return { ok: true, winner, giftWinners };
  }

  // Consulta dos maiores compradores da rifa
  @Get('top-buyers/:raffleId')
  async getTopBuyers(@Param('raffleId') raffleId: string) {
    const topBuyers =
      await this.queryUsersRaffleNumberService.getTopBuyers(raffleId);
    return { ok: true, topBuyers };
  }
}
