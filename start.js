require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Discord user manager bot is running.');
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start web server, then the bot
app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
  // Start the Discord bot after web server is up
  require('./discord_user_manager.js');
});
