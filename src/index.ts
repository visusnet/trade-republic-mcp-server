#!/usr/bin/env node
import { config } from 'dotenv';
import { TradeRepublicMcpServer } from './server/TradeRepublicMcpServer.js';

config();

const server = new TradeRepublicMcpServer();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
server.listen(port);
