// Port interfaces
export * from './payment/index.js';
export * from './storage/index.js';
export * from './email/index.js';

// Concrete adapters
export { MercadoPagoProvider } from './payment/mercado-pago.js';
export { FakePaymentProvider } from './payment/fake.js';
export { LocalStorageProvider } from './storage/local.js';
export { NodemailerEmailProvider } from './email/nodemailer.js';
