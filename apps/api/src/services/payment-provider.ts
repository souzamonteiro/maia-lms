import { FakePaymentProvider, MercadoPagoProvider } from '@maia/providers';
import type { PaymentProvider } from '@maia/providers';
import type { Config } from '../config.js';

export function createPaymentProvider(config: Config): PaymentProvider {
  return config.PAYMENT_PROVIDER === 'mercado_pago'
    ? new MercadoPagoProvider(config.MP_ACCESS_TOKEN ?? '', config.MP_WEBHOOK_SECRET ?? '')
    : new FakePaymentProvider();
}