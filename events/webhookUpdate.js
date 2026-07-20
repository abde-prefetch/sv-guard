const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { isOwner: checkOwner } = require('../config');

async function sendLog(guild, config, embed) {
  if (!config.logsChannel) return;
  const logsChan = guild.channels.cache.get(config.logsChannel);
  if (logsChan) await logsChan.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'webhookUpdate',
  async execute(channel, client) {
    const guild = channel.guild;
    const config = client.db.getGuildConfig(guild.id);
    if (config.antiRaid === false) return;

    try {
      let entry = null;
      for (let i = 0; i < 4; i++) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.WebhookCreate });
        entry = logs.entries.find(e => e.target.channelId === channel.id || e.target.id === channel.id);
        if (entry) break;
        await new Promise(r => setTimeout(r, 500));
      }

      if (!entry) return;

      const { executor } = entry;
      if (executor.id === client.user.id) return;

      const isWhitelisted = checkOwner(executor.id) || config.whitelist.includes(executor.id);
      if (isWhitelisted) return;

      // 1. Bannir
      const member = await guild.members.fetch(executor.id).catch(() => null);
      if (member && member.bannable) {
        await member.ban({ reason: '[S-V Guard] Création de webhook non autorisée.' });
      }

      // 2. Supprimer le webhook
      const webhooks = await channel.fetchWebhooks().catch(() => null);
      if (webhooks) {
        const webhook = webhooks.find(w => w.owner?.id === executor.id);
        if (webhook) await webhook.delete('[S-V Guard] Suppression automatique.').catch(() => {});
      }

      // 3. Log
      const embed = new EmbedBuilder()
        .setTitle('🚨 Anti-Webhook Create — Webhook supprimé')
        .addFields(
          { name: 'Salon', value: `${channel}`, inline: true },
          { name: 'Responsable', value: `<@${executor.id}> (${executor.id})`, inline: false },
          { name: 'Sanction', value: '🔨 Banni définitivement', inline: true }
        )
        .setColor('#FF0000')
        .setTimestamp();

      await sendLog(guild, config, embed);
    } catch (err) {
      console.error('[S-V Guard] webhookUpdate error:', err);
    }
  },
};
