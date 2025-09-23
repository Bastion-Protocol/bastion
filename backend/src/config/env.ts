import dotenv from 'dotenv';
import path from 'path';

// Load environment-specific .env file
const environment = process.env.NODE_ENV || 'development';
const envPath = path.resolve(process.cwd(), `.env.${environment}`);

// Load default .env file as fallback
dotenv.config();

// Load environment-specific file
dotenv.config({ path: envPath });

export interface EnvConfig {
  NODE_ENV: string;
  API_PORT: number;
  API_HOST: string;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_NAME: string;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  YELLOW_NETWORK_API_KEY?: string;
  YELLOW_NETWORK_RPC_URL: string;
  YELLOW_NETWORK_CHAIN_ID: number;
  AAVE_LENDING_POOL_ADDRESS: string;
  AAVE_DATA_PROVIDER_ADDRESS: string;
  LOG_LEVEL: string;
  SENTRY_DSN?: string;
}

export const config: EnvConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: parseInt(process.env.API_PORT || '3001', 10),
  API_HOST: process.env.API_HOST || 'localhost',
  DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT || '5432', 10),
  DATABASE_NAME: process.env.DATABASE_NAME || 'bastion_dev',
  DATABASE_USER: process.env.DATABASE_USER || 'bastion',
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || '',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  YELLOW_NETWORK_API_KEY: process.env.YELLOW_NETWORK_API_KEY,
  YELLOW_NETWORK_RPC_URL: process.env.YELLOW_NETWORK_RPC_URL || 'https://testnet-rpc.yellow.network',
  YELLOW_NETWORK_CHAIN_ID: parseInt(process.env.YELLOW_NETWORK_CHAIN_ID || '5001', 10),
  AAVE_LENDING_POOL_ADDRESS: process.env.AAVE_LENDING_POOL_ADDRESS || '0x7b5C526B7F8dfdff278b4a3e045083FBA4028790',
  AAVE_DATA_PROVIDER_ADDRESS: process.env.AAVE_DATA_PROVIDER_ADDRESS || '0x927F584d4321C1dCcBf5e2902368124b02419a1E',
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  SENTRY_DSN: process.env.SENTRY_DSN,
};

export default config;