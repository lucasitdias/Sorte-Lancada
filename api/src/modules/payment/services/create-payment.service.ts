import { Injectable } from '@nestjs/common';
import { PaymentRepository } from '../repositories/payment.repository';
import { GeneratePaymentDto } from '../dtos/generate-payment.dto';
import { Payment } from '../payment.entity';
import { CommonUser } from '@/modules/common-user/common-user.entity';
import { QueryRaffleService } from '@/modules/raffles/services';
import ApiError from '@/common/error/entities/api-error.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { createPixPayment } from '@/common/mercadopago/api';
import moment from '@/common/libs/moment';

@Injectable()
export class CreatePaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly queryRaffleService: QueryRaffleService,
  ) {}

  /**
   * Cria um pagamento PIX para um usuário comum vinculado a uma rifa
   * @param generatePaymentDto - dados da requisição
   * @param user - usuário comum que está comprando
   * @returns pagamento criado
   */
  async createPayment(
    generatePaymentDto: GeneratePaymentDto,
    user: CommonUser,
  ): Promise<Payment> {
    // Busca a rifa pelo ID
    const raffle = await this.queryRaffleService.findOneRaffle({
      where: [{ id: generatePaymentDto.raffle_id }],
    });
    if (!raffle)
      throw new ApiError('raffle-not-found', 'Rifa não encontrada', 404);

    try {
      // Define data de expiração do pagamento
      const date_of_expiration = moment().add(10, 'minutes');

      // Cria instância do pagamento
      const payment = new Payment();
      payment.raffles_quantity = generatePaymentDto.amount;
      payment.raffle_id = `${generatePaymentDto.raffle_id}`;
      payment.common_user_id = user.id;
      payment.status = PaymentStatus.PENDING;
      payment.expires_at = date_of_expiration.toDate();
      payment.value =
        Math.round(raffle.price_number * generatePaymentDto.amount * 100) / 100;

      // Salva pagamento no banco
      const paymentDb = await this.paymentRepository.createPayment(payment);

      // Chama API do MercadoPago para gerar pagamento PIX
      const { id, point_of_interaction } = await createPixPayment({
        user_id: user.id,
        user_phone: user.phone,
        payment_id: paymentDb.id,
        users_raffle_amount: generatePaymentDto.amount,
        transaction_amount: paymentDb.value,
        internal_payment_id: paymentDb.id,
        date_of_expiration: date_of_expiration.toISOString(),
      });

      // ✅ ALTERAÇÃO: log para inspecionar retorno da API
      console.log(
        'Retorno MercadoPago:',
        JSON.stringify({ id, point_of_interaction }, null, 2),
      );

      // ✅ ALTERAÇÃO: proteção contra erro de desestruturação
      if (
        !point_of_interaction?.transaction_data?.qr_code ||
        !point_of_interaction?.transaction_data?.qr_code_base64
      ) {
        throw new ApiError(
          'invalid-pix-response',
          'Erro ao gerar código PIX, tente novamente mais tarde',
          400,
        );
      }

      // Extrai dados do QR Code
      const { qr_code: pix_code, qr_code_base64: pix_qr_code } =
        point_of_interaction.transaction_data;

      // Atualiza pagamento com dados do PIX
      const finalPayment = await this.paymentRepository.updatePaymentData(
        paymentDb.id,
        {
          mercadopago_id: `${id}`,
          pix_code,
          pix_qr_code,
        },
      );

      return finalPayment;
    } catch (error) {
      // Loga erro e retorna mensagem genérica
      console.log('Erro ao criar pagamento:', error);
      throw new ApiError(
        'payment-error',
        'Erro ao criar pagamento, tente novamente mais tarde',
        400,
      );
    }
  }

  /**
   * Atualiza o status de um pagamento
   */
  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
  ): Promise<Payment> {
    return this.paymentRepository.updatePaymentStatus(id, status);
  }

  /**
   * Remove pagamentos inválidos ou expirados
   */
  async removePayments(payments: Payment[]) {
    return this.paymentRepository.removePayments(payments);
  }
}
