import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const Zone = registry.register('Zone', z.object({ id: z.number().int(), name: z.string() }));
const Ticket = registry.register('Ticket', z.object({
  id: z.number().int(),
  vehicle: z.string(),
  zone_id: z.number().int(),
  started_at: z.string(),
  ended_at: z.string().nullish(),
  amount: z.number().nullish(),
  status: z.enum(['open','closed','paid'])
}));
const Payment = registry.register('Payment', z.object({ paymentId: z.string(), status: z.enum(['success','failed']), amount: z.number().optional(), currency: z.string().optional() }));

const CreateTicketBody = registry.register('CreateTicketBody', z.object({ vehicle: z.string(), zoneId: z.number().int() }));

registry.registerPath({
  method: 'get',
  path: '/api/health',
  responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } } } }
});

registry.registerPath({
  method: 'get',
  path: '/api/zones',
  responses: { 200: { description: 'Zones', content: { 'application/json': { schema: z.array(Zone) } } } }
});

registry.registerPath({
  method: 'post',
  path: '/api/tickets',
  request: { body: { content: { 'application/json': { schema: CreateTicketBody } } } },
  responses: { 201: { description: 'Created', content: { 'application/json': { schema: Ticket } } } }
});

registry.registerPath({
  method: 'post',
  path: '/api/tickets/{id}/close',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Closed', content: { 'application/json': { schema: Ticket } } } }
});

registry.registerPath({
  method: 'post',
  path: '/api/tickets/{id}/waiting',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Waiting', content: { 'application/json': { schema: Ticket } } } }
});

registry.registerPath({
  method: 'post',
  path: '/api/payments/{ticketId}/pay',
  request: { params: z.object({ ticketId: z.string() }) },
  responses: { 200: { description: 'Paid', content: { 'application/json': { schema: z.object({ payment: Payment, ticket: Ticket }).partial() } } } }
});

export function generateOpenApi() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: 'Smart Parking API Gateway', version: '0.1.0' }
  });
}
