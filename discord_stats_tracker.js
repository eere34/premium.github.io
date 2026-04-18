import { Client, GatewayIntentBits } from 'discord.js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';

const MOD_LOG_CHANNEL_ID = '1484299289063587890';
const ALERT_CHANNEL_ID = '1417960723363008722';
const WATCHED_ROLE_ID = '1469467899063439459';
const RINGTA_MENTION = '<@608461552034643992>';

const WATCHED_USER_IDS = new Set([
  '1375343450538377216',
  '1359885286632587345',
  '1464939857791942780',
]);

const ROLES_TO_REMOVE = [
  '1417996044985434213',
  '1417970131291865260',
  '1426759815140605952',
];

const BAN_WINDOW_MS = 60 * 1000;
const BAN_RATE_LIMIT = 5;

const recentBans = new Map();

function detectAction(text) {
  const t = text.toLowerCase();
  if (t.includes('timeout')) return 'timeout';
  if (t.includes('mute')) return 'mute';
  if (t.includes('unban')) return 'unban';
  if (t.includes('ban')) return 'ban';
  if (t.includes('warn')) return 'warn';
  if (t.includes('kick')) return 'kick';
  return null;
}

function getAllText(message) {
  const parts = [message.content || ''];
  for (const e of message.embeds) {
    if (e.title) parts.push(e.title);
    if (e.description) parts.push(e.description);
    if (e.author?.name) parts.push(e.author.name);
    if (e.footer?.text) parts.push(e.footer.text);
    for (const f of e.fields || []) {
      parts.push(f.name, f.value);
    }
  }
  return parts.join(' ');
}

async function stripRoles(member, includeWatchedRole = false) {
  const rolesToStrip = includeWatchedRole
    ? [...ROLES_TO_REMOVE, WATCHED_ROLE_ID]
    : ROLES_TO_REMOVE;

  for (const roleId of rolesToStrip) {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(e =>
        console.error(`[Watcher] Failed to remove role ${roleId}:`, e.message)
      );
    }
  }
}

export async function startBot() {
  if (!DISCORD_TOKEN) {
    console.error('[Watcher] DISCORD_TOKEN is not set — bot will not start');
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once('ready', () => {
    console.log(`[Watcher] Logged in as ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    if (message.channelId !== MOD_LOG_CHANNEL_ID) return;

    const guild = message.guild;
    if (!guild || guild.id !== '1347804635989016617') return;

    const authorId = message.author.id;
    const isWatchedUser = WATCHED_USER_IDS.has(authorId);

    let member = null;
    try {
      member = await guild.members.fetch(authorId);
    } catch {}

    const hasWatchedRole = member ? member.roles.cache.has(WATCHED_ROLE_ID) : false;

    if (!isWatchedUser && !hasWatchedRole) return;

    const action = detectAction(getAllText(message));
    if (!action) return;

    const displayName = member
      ? (member.nickname || member.user.username)
      : `<@${authorId}>`;

    if (isWatchedUser) {
      if (member) await stripRoles(member, false);

      const alertChannel = guild.channels.cache.get(ALERT_CHANNEL_ID);
      if (alertChannel) {
        await alertChannel
          .send(
            `**${displayName}** is abusing and lost his roles because he abused. To get roles back wait for ${RINGTA_MENTION}.`
          )
          .catch(console.error);
      }

      console.log(`[Watcher] Watched user ${displayName} punished for: ${action}`);
      return;
    }

    if (hasWatchedRole && action === 'ban') {
      const now = Date.now();
      const timestamps = recentBans.get(authorId) || [];
      const recent = timestamps.filter(t => now - t < BAN_WINDOW_MS);
      recent.push(now);
      recentBans.set(authorId, recent);

      if (recent.length < BAN_RATE_LIMIT) return;

      recentBans.set(authorId, []);

      if (member) await stripRoles(member, true);

      console.log(`[Watcher] Role holder ${displayName} hit ban rate limit — roles removed silently`);
    }
  });

  await client.login(DISCORD_TOKEN);
}
