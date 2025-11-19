import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { DeepPartial, Repository } from 'typeorm';
import ApiError from '@/common/error/entities/api-error.entity';
import { CommonUser } from '../common-user.entity';
import { FindOneOptions } from '@/common/types/find-one-options.type';
import { ListOptions } from '@/common/types/list-options.type';

@Injectable()
export class CommonUserRepository {
  constructor(
    @InjectRepository(CommonUser)
    private readonly userRepository: Repository<CommonUser>,
  ) {}

  async create(commonUser: CommonUser): Promise<CommonUser> {
    const dbUser = await this.userRepository.save(commonUser);
    return dbUser;
  }

  async list(options: ListOptions<CommonUser>): Promise<{
    commonUsers: (Partial<CommonUser> & { totalRaffles?: string })[];
    count: number;
  }> {
    const qb = this.userRepository.createQueryBuilder('common_users');
    const { page = 1, per_page = 10 } = options;
    if (options.name) {
      qb.andWhere(
        `common_users.name::VARCHAR ILIKE :value OR common_users.phone::VARCHAR ILIKE :value OR common_users.id::VARCHAR ILIKE :value`,
        {
          value: `%${options.name}%`,
        },
      );
    }

    if (options.where) {
      for (const where of options.where) {
        for (const [key, value] of Object.entries(where)) {
          qb.andWhere(`common_users.${key} = :${key}`, { [key]: value });
        }
      }
    }

    if (options.ids) {
      qb.andWhereInIds(options.ids);
    }

    if (options.additionalSelects) {
      for (const additionalSelect of options.additionalSelects) {
        qb.addSelect(`common_users.${additionalSelect}`);
      }
    }

    if (options.withPaymentsQtd) {
      if (!options.relations?.includes('payments'))
        qb.leftJoin('common_users.payments', 'payments');

      qb.addSelect(
        'COALESCE(SUM(payments.raffles_quantity), 0)',
        'totalraffles',
      );

      qb.groupBy('common_users.id');
    }

    if (options.relations) {
      options.relations.forEach((relation) =>
        qb.leftJoinAndSelect(`common_users.${relation}`, relation),
      );
    }

    if (options.orderBy) {
      if (
        options.orderBy == 'all_raffles_numbers_bought' &&
        options.withPaymentsQtd
      ) {
        qb.orderBy('totalraffles', options.direction ?? 'ASC');
      } else
        qb.orderBy(
          `common_users.${options.orderBy}`,
          options.direction ?? 'ASC',
        );
    }

    qb.offset((page - 1) * per_page);
    qb.limit(per_page);

    const count = await qb.getCount();
    const commonsUsersWithTotalRaffle = await qb.getRawMany();
    const commonUsers: (Partial<CommonUser> & { totalRaffles?: string })[] =
      commonsUsersWithTotalRaffle.map((user) => {
        return {
          id: user.common_users_id,
          name: user.common_users_name,
          phone: user.common_users_phone,
          created_at: user.common_users_created_at,
          updated_at: user.common_users_updated_at,
          totalRaffles: user.totalraffles,
        };
      });

    return { commonUsers, count };
  }

  async findOne(options: FindOneOptions<CommonUser>): Promise<CommonUser> {
    const qb = this.userRepository.createQueryBuilder('common_users');

    if (options.relations) {
      options.relations.forEach((relation) => {
        qb.leftJoinAndSelect(`common_users.${relation}`, relation);
      });
    }

    if (options.where) {
      for (const where of options.where) {
        for (const [key, value] of Object.entries(where)) {
          qb.andWhere(`common_users.${key} = :${key}`, { [key]: value });
        }
      }
    }

    if (options.with_users_raffle_number) {
      if (!options.relations.includes('payments')) {
        qb.leftJoinAndSelect('common_users.payments', 'payments');
      }
      qb.leftJoin('payments.users_raffle_number', 'users_raffle_number');
      qb.addSelect('users_raffle_number.number');
    }

    const commonUser = await qb.getOne();
    return commonUser;
  }

  async update(
    id: string,
    userData: DeepPartial<CommonUser>,
  ): Promise<CommonUser> {
    const user = await this.userRepository.findOne({ where: [{ id }] });
    if (!user)
      throw new ApiError('user-not-found', 'Usuário comum não encontrado', 404);
    Object.assign(user, userData);
    return await this.userRepository.save(user);
  }
}
