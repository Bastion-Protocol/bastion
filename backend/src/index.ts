import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from './config/env';

const app = express();
const PORT = config.API_PORT;

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN
}));
app.use(morgan('combined'));
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'bastion-backend' 
  });
});

// API routes
app.get('/api/v1/status', (_req, res) => {
  res.json({ 
    message: 'Bastion Protocol Backend API',
    version: '1.0.0',
    environment: config.NODE_ENV,
    chainId: config.YELLOW_NETWORK_CHAIN_ID
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bastion Backend server running on port ${PORT}`);
  console.log(`📝 Environment: ${config.NODE_ENV}`);
  console.log(`🌍 Chain ID: ${config.YELLOW_NETWORK_CHAIN_ID}`);
});

export default app;