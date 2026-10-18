// Mercado Pago Checkout Pro adapter
import crypto from 'node:crypto';
import type {
  PaymentProvider,
  CheckoutResult,
  PaymentState,
  RefundResult,
  WebhookVerification,
} from './index.js';

const MP_API_BASE = 'https://api.mercadopago.com';

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercado_pago';

  constructor(
    private readonly accessToken: string,
    private readonly webhookSecret: string,
  ) {}

  async createCheckout(params: {
    orderId: string;
    courseTitle: string;
    amountMinor: number;
    currency: string;
    idempotencyKey: string;
    backUrl: string;
  }): Promise<CheckoutResult> {
    const amount = (params.amountMinor / 100).toFixed(2);
    const response = await fetch(`${MP_API_BASE}/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        'X-Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        type: 'online',
        processing_mode: 'manual',
        capture_mode: 'automatic_async',
        total_amount: amount,
        external_reference: params.orderId,
        items: [
          {
            title: params.courseTitle,
            quantity: 1,
            unit_price: amount,
            total_amount: amount,
          },
        ],
        config: {
          online: {
            success_url: params.backUrl,
            failure_url: params.backUrl,
            pending_url: params.backUrl,
            auto_return: 'approved',
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MercadoPago createCheckout failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { id: string; checkout_url: string };
    return {
      checkoutUrl: data.checkout_url,
      providerOrderId: data.id,
    };
  }

  async getPayment(providerPaymentId: string): Promise<PaymentState> {
    const response = await fetch(`${MP_API_BASE}/v1/orders/${encodeURIComponent(providerPaymentId)}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`MercadoPago getPayment failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      status_detail?: string;
      total_amount: string;
      total_paid_amount?: string;
      currency: string;
      external_reference?: string;
    };
    const status = this.normalizeStatus(data.status, data.status_detail);
    const amount = data.total_paid_amount ?? data.total_amount;

    return {
      providerPaymentId: String(data.id),
      status,
      amountMinor: Math.round(Number(amount) * 100),
      currency: data.currency,
      metadata: data as Record<string, unknown>,
    };
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string>,
    dataId = '',
  ): WebhookVerification {
    const signature = headers['x-signature'] ?? '';
    const requestId = headers['x-request-id'] ?? '';

    const tsMatch = signature.match(/(?:^|,)ts=(\d+)/);
    const v1Match = signature.match(/(?:^|,)v1=([a-f0-9]+)/i);

    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    if (!tsMatch || !v1Match || !requestId || !dataId) {
      return { valid: false, externalEventId: null, payloadHash };
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${tsMatch[1]};`;
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(manifest).digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(v1Match[1], 'hex');
    const valid =
      expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

    let eventId: string | null = null;
    try {
      const payload = JSON.parse(rawBody.toString('utf8')) as { id?: string | number };
      if (payload.id !== undefined) eventId = String(payload.id);
    } catch {
      return { valid: false, externalEventId: null, payloadHash };
    }

    return {
      valid,
      externalEventId: eventId,
      payloadHash,
    };
  }

  async refund(params: {
    providerOrderId: string;
    transactionId?: string;
    amountMinor?: number;
    idempotencyKey: string;
  }): Promise<RefundResult> {
    if ((params.amountMinor === undefined) !== (params.transactionId === undefined))
      throw new Error('Partial order refunds require both a transaction ID and amount');
    const response = await fetch(
      `${MP_API_BASE}/v1/orders/${encodeURIComponent(params.providerOrderId)}/refund`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        'X-Idempotency-Key': params.idempotencyKey,
      },
      ...(params.amountMinor !== undefined && params.transactionId
        ? {
            body: JSON.stringify({
              transactions: [{ id: params.transactionId, amount: (params.amountMinor / 100).toFixed(2) }],
            }),
          }
        : {}),
      },
    );

    if (!response.ok) {
      throw new Error(`MercadoPago refund failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
      transactions?: { refunds?: Array<{ id: string; amount: string; status: string }> };
    };
    const refunds = data.transactions?.refunds ?? [];
    const amount = params.amountMinor ?? refunds.reduce((total, refund) => total + Number(refund.amount), 0) * 100;
    const refundStatus = refunds.at(-1)?.status;
    return {
      providerRef: refunds.at(-1)?.id ?? String(data.id),
      amountMinor: Math.round(amount),
      status:
        (refundStatus === 'processed' || data.status === 'refunded')
          ? 'approved'
          : (refundStatus === 'pending' || data.status === 'processing')
            ? 'pending'
            : 'rejected',
    };
  }

  private normalizeStatus(status: string, detail = ''): PaymentState['status'] {
    if (status === 'processed' && detail === 'accredited') return 'approved';
    if (status === 'processed' && detail === 'partially_refunded') return 'partially_refunded';
    if (status === 'refunded' || (status === 'processed' && detail === 'refunded')) return 'refunded';
    if (status === 'charged_back' || detail.includes('chargeback')) return 'charged_back';
    if (status === 'failed') return 'rejected';
    if (status === 'canceled' || status === 'cancelled') return 'cancelled';
    return 'pending';
  }
}
