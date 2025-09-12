export type ID = number;

export interface Zone {
  id: ID;
  name: string;
}

export interface Rate {
  id: ID;
  zone_id: ID;
  price_per_hour: number;
  currency: string;
}

export type TicketStatus = 'open' | 'closed' | 'paid';

export interface Ticket {
  id: ID;
  vehicle: string;
  zone_id: ID;
  started_at: string;
  ended_at?: string | null;
  amount?: number | null;
  status: TicketStatus;
}

export interface PaymentRequest {
  ticketId: ID;
  amount: number;
  currency: string;
}

export interface PaymentResponse {
  paymentId: string;
  status: 'success' | 'failed';
}
