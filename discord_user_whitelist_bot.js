import { Client, GatewayIntentBits, AttachmentBuilder } from 'discord.js';
import axios from 'axios';

export async function startBot() {
  const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OWNER = 'eere34';
  const REPO = 'premium.github.io';
  const FILEPATH = 'user.json';
  const ALLOWED_ROLE_ID = '1485288512839225425';
  const ALLOWED_GUILD_ID = '1485071702227554427';

  if (!DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN is not set! Bot cannot start.');
    return;
  }
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is not set! Bot cannot update whitelist.');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });

  async function getFile() {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILEPATH}`;
    const res = await axios.get(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    const content = Buffer.from(res.data.content, 'base64').toString('utf8');
    return {
      json: JSON.parse(content),
      sha: res.data.sha,
    };
  }

  async function updateFile(newJson, sha, username, action) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILEPATH}`;
    const content = Buffer.from(JSON.stringify(newJson, null, 2)).toString('base64');
    await axios.put(url, {
      message: `[Bot] ${action} ${username} in user.json`,
      content,
      sha,
    }, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
  }

  function isAllowed(message) {
    if (
      !message.guild
      || message.guild.id !== ALLOWED_GUILD_ID
      || !message.member
      || !message.member.roles.cache.has(ALLOWED_ROLE_ID)
    ) {
      return false;
    }
    return true;
  }

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!isAllowed(message)) return;

    if (message.content.startsWith('.add ')) {
      const username = message.content.split(' ')[1];
      if (!username) return message.reply('Provide a Roblox username. Usage: .add name');
      try {
        const { json, sha } = await getFile();
        json.allowed_users = json.allowed_users || [];
        if (json.allowed_users.includes(username)) {
          return message.reply(`${username} is already whitelisted.`);
        }
        json.allowed_users.push(username);
        await updateFile(json, sha, username, 'Added');
        return message.reply(`${username} added to the whitelist!`);
      } catch (err) {
        console.error(err);
        return message.reply('Failed to update the whitelist. Check logs or permissions.');
      }
    }

    if (message.content.startsWith('.remove ')) {
      const username = message.content.split(' ')[1];
      if (!username) return message.reply('Provide a Roblox username. Usage: .remove name');
      try {
        const { json, sha } = await getFile();
        json.allowed_users = json.allowed_users || [];
        const idx = json.allowed_users.indexOf(username);
        if (idx === -1) {
          return message.reply(`${username} is not in the whitelist.`);
        }
        json.allowed_users.splice(idx, 1);
        await updateFile(json, sha, username, 'Removed');
        return message.reply(`${username} removed from the whitelist!`);
      } catch (err) {
        console.error(err);
        return message.reply('Failed to update the whitelist. Check logs or permissions.');
      }
    }

    if (message.content === '.list') {
      try {
        const { json } = await getFile();
        const users = json.allowed_users || [];
        if (!users.length) {
          return message.reply('Whitelist is empty.');
        }
        if (users.length > 50) {
          const text = users.join('\n');
          const buffer = Buffer.from(text, 'utf8');
          const attachment = new AttachmentBuilder(buffer, { name: 'allowed_users.txt' });
          return message.reply({ content: `There are ${users.length} whitelisted users:`, files: [attachment] });
        } else {
          return message.reply('**Allowed users:**\n' + users.join(', '));
        }
      } catch (err) {
        console.error(err);
        return message.reply('Could not fetch the whitelist.');
      }
    }
  });

  client.on('error', (err) => {
    console.error('Discord client error:', err);
  });

  client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
  });

  try {
    await client.login(DISCORD_TOKEN);
  } catch (err) {
    console.error('❌ Failed to login to Discord:', err.message);
  }
}
