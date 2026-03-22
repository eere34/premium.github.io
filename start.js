import 'dotenv/config';
import express from 'express';
import { startBot } from './discord_user_whitelist_bot.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Discord user manager bot is running.');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

startBot().catch((err) => {
  console.error('Unhandled error in startBot:', err);
});
