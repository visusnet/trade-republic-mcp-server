#!/usr/bin/env node
import { config } from 'dotenv';
import { logger } from './logger';
import { TradeRepublicMcpServer } from './server/TradeRepublicMcpServer.js';

config({ quiet: true }); // Load .env file

function main(): void {
  const phoneNumber = process.env.TRADE_REPUBLIC_PHONE_NUMBER;
  const pin = process.env.TRADE_REPUBLIC_PIN;

  if (!phoneNumber || !pin) {
    logger.server.error(
      'TRADE_REPUBLIC_PHONE_NUMBER and TRADE_REPUBLIC_PIN environment variables must be set',
    );
    process.exit(1);
  }

  const server = new TradeRepublicMcpServer(phoneNumber, pin);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port);
}

main();
