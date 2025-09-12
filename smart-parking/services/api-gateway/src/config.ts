export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  centralUrl: process.env.CENTRAL_URL || 'http://localhost:4000',
  aiUrl: process.env.AI_URL || 'http://localhost:8000',
  paymentUrl: process.env.PAYMENT_URL || 'http://localhost:5002',
  assistantUrl: process.env.ASSISTANT_URL || 'http://localhost:5005'
};
