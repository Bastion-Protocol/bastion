import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Bot commands
bot.start((ctx) => {
  ctx.reply(
    '🏛️ Welcome to Bastion Protocol!\n\n' +
    'The decentralized lending circles platform with social verification.\n\n' +
    'Commands:\n' +
    '/help - Show this help message\n' +
    '/status - Check bot status'
  );
});

bot.help((ctx) => {
  ctx.reply(
    '🤖 Bastion Protocol Bot Help\n\n' +
    'Commands available:\n' +
    '/start - Welcome message\n' +
    '/help - Show this help\n' +
    '/status - Bot status\n\n' +
    'This bot will help you with social verification and lending circle notifications.'
  );
});

bot.command('status', (ctx) => {
  ctx.reply(
    '✅ Bot Status: Online\n' +
    `🕐 Uptime: ${process.uptime()} seconds\n` +
    `🌍 Environment: ${process.env.NODE_ENV || 'development'}`
  );
});

// Error handling
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start bot
if (process.env.NODE_ENV === 'production') {
  // Use webhooks in production
  console.log('🤖 Starting Telegram bot with webhooks...');
} else {
  // Use polling in development
  bot.launch();
  console.log('🤖 Bastion Telegram bot started in development mode');
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;