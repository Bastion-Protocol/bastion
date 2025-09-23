# Bastion Protocol - Monorepo Setup

This document describes the monorepo setup and available commands for the Bastion Protocol.

## 🏗️ Monorepo Architecture

Bastion Protocol is organized as a monorepo using **Lerna** for workspace management, with the following packages:

- **@bastion/frontend** - React frontend application
- **@bastion/backend** - Node.js backend services  
- **@bastion/contracts** - Solidity smart contracts
- **@bastion/telegram-bot** - Telegram bot for social verification

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm 8+

### Installation
```bash
# Install root dependencies and all workspace dependencies
npm run install:all

# Or install individually
npm install
npm install --workspaces
```

### Development Commands

#### Global Commands (affects all workspaces)
```bash
# Build all packages
npm run build

# Type check all packages
npm run type-check

# Run all development servers in parallel
npm run dev

# Clean all build artifacts
npm run clean
```

#### Individual Service Commands
```bash
# Backend
npm run backend:dev     # Start backend dev server
npm run backend:build   # Build backend

# Frontend  
npm run frontend:dev    # Start frontend dev server
npm run frontend:build  # Build frontend

# Contracts
npm run contracts:dev   # Start local Hardhat network
npm run contracts:build # Compile contracts

# Telegram Bot
npm run telegram-bot:dev   # Start telegram bot
npm run telegram-bot:build # Build telegram bot
```

## 🔧 Configuration

### Environment Variables

Environment configuration is handled through `.env` files:

- `.env.example` - Template with all available variables
- `.env.development` - Development environment settings
- `.env.staging` - Staging environment settings  
- `.env.production` - Production environment settings

Copy `.env.example` to `.env` and configure for your local development.

### TypeScript Configuration

- Root `tsconfig.json` provides base configuration with strict mode enabled
- Each workspace extends the root config with package-specific settings
- All packages are configured for strict TypeScript compilation

### Core Dependencies

The monorepo includes the following core dependencies:

#### Backend Dependencies
- Express.js - Web framework
- PostgreSQL (pg) - Database driver
- Redis - Caching and session store
- JWT - Authentication
- Aave SDK - DeFi protocol integration
- dotenv - Environment configuration

#### Frontend Dependencies  
- React 18+ - UI framework
- Vite - Build tool and dev server
- Tailwind CSS - Styling
- Aave SDK - DeFi protocol integration
- Wagmi - Ethereum interactions
- Zustand - State management

#### Telegram Bot Dependencies
- Telegraf - Telegram bot framework
- PostgreSQL/Redis - Data persistence

#### Contracts Dependencies
- Hardhat - Ethereum development environment
- OpenZeppelin - Secure contract libraries
- Aave Protocol - DeFi integration
- TypeChain - TypeScript bindings

## 🌍 Environment Management

The backend uses a centralized configuration system that loads environment-specific settings:

```typescript
import config from './config/env';

// Access typed configuration
console.log(config.API_PORT);
console.log(config.DATABASE_HOST);
```

This system:
- Provides type safety for all environment variables
- Supports environment-specific overrides
- Includes sensible defaults for development
- Validates configuration at startup

## 📁 Workspace Structure

```
bastion/
├── package.json              # Root package with workspace config
├── lerna.json               # Lerna configuration
├── tsconfig.json            # Root TypeScript config
├── .env.example             # Environment template
├── .env.development         # Development settings
├── .env.staging            # Staging settings
├── .env.production         # Production settings
├── frontend/               # React frontend workspace
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
├── backend/                # Node.js backend workspace
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── config/         # Environment configuration
│       └── index.ts
├── contracts/              # Solidity contracts workspace
│   ├── package.json
│   ├── tsconfig.json
│   ├── hardhat.config.ts
│   ├── contracts/
│   └── scripts/
└── telegram-bot/           # Telegram bot workspace
    ├── package.json
    ├── tsconfig.json
    └── src/
```

## 🔗 Inter-Package Dependencies

Packages can depend on each other using workspace references:

```json
{
  "dependencies": {
    "@bastion/shared-types": "workspace:*"
  }
}
```

## 🚀 Deployment

Each package can be built and deployed independently:

```bash
# Build specific package
npm run backend:build
npm run frontend:build

# Or build all packages
npm run build
```

## 🧪 Testing

Run tests across all workspaces:

```bash
npm run test
```

## 🔍 Troubleshooting

### Common Issues

1. **Dependency installation fails**
   ```bash
   # Clear node_modules and reinstall
   npm run clean
   npm run install:all
   ```

2. **TypeScript compilation errors**
   ```bash
   # Check types across all workspaces
   npm run type-check
   ```

3. **Build failures**
   ```bash
   # Build packages individually to isolate issues
   npm run backend:build
   npm run frontend:build
   ```

### Network Issues

If you encounter network issues (like contract compilation failing), this is expected as the environment may not have access to external Solidity compiler downloads. The monorepo is configured to handle this gracefully.

## 📚 Next Steps

1. Configure your environment variables in `.env`
2. Set up your database and Redis instances
3. Configure your Yellow Network and Aave API keys
4. Start developing individual services using the package-specific commands
5. Use the global `npm run dev` to run all services in parallel during development