const { REST } = require("discord.js");

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

let rest = null;

function getRestClient() {
  if (!rest) {
    rest = new REST().setToken(DISCORD_BOT_TOKEN);
  }
  return rest;
}

function discordPermalink(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/**
 * Fetch recent messages for a user across all channels using Discord's search API.
 * GET /guilds/{guild_id}/messages/search?author_id={user_id}
 */
async function fetchRecentMessages(discordUserId, limit = 50) {
  const guildId = DISCORD_GUILD_ID;
  if (!guildId) throw new Error("DISCORD_GUILD_ID not configured");

  const client = getRestClient();
  const params = new URLSearchParams({
    author_id: discordUserId,
    sort_by: "timestamp",
    sort_order: "desc",
    limit: String(Math.min(limit, 25)) // Discord search caps at 25 per page
  });

  const results = [];
  let offset = 0;
  const maxPages = Math.ceil(limit / 25);

  for (let page = 0; page < maxPages; page++) {
    if (page > 0) params.set("offset", String(offset));

    try {
      const data = await client.get(
        `/guilds/${guildId}/messages/search?${params.toString()}`
      );

      if (!data.messages || data.messages.length === 0) break;

      for (const group of data.messages) {
        // Search returns arrays of message groups (the hit + context)
        // The first message in each group with matching author is the hit
        const hit = group.find(m => m.author.id === discordUserId) || group[0];
        results.push({
          messageId: hit.id,
          content: hit.content,
          channelId: hit.channel_id,
          timestamp: hit.timestamp,
          attachments: (hit.attachments || []).map(a => ({ url: a.url, name: a.filename })),
          permalink: discordPermalink(guildId, hit.channel_id, hit.id)
        });
      }

      offset += data.messages.length;
      if (data.messages.length < 25 || results.length >= limit) break;
    } catch (err) {
      console.error("[DiscordAPI] Search failed:", err.message);
      break;
    }
  }

  return results.slice(0, limit);
}

module.exports = { fetchRecentMessages, discordPermalink };
