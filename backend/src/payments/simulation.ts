import { config } from '../config';
import type { PaymentProvider } from './types';

/** Opérateur fictif (PAYMENT_SIMULATION=1) : validé 5 s après la demande. */
export const simulation: PaymentProvider = {
  id: 'simulation',
  label: 'Simulation',
  prefixes: [],
  redirect: false,
  enabled: () => config.payments.simulation,

  async initiate(p) {
    return { providerRef: `SIM-${p.reference}` };
  },

  async status(p) {
    const elapsed = Date.now() - new Date(p.created_at).getTime();
    return elapsed > 5000 ? { status: 'success', txnId: `SIM${Date.now()}` } : { status: 'pending' };
  },
};
