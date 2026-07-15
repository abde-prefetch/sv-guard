const { AuditLogEvent, EmbedBuilder } = require('discord.js');

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
      await new Promise(r => setTimeout(r, 500));

      const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate });
      const entry = logs.entries.first();
      if (!entry) return;

      // Si log trop vieux (>5s), ignorer
      if (Date.now() - entry.createdTimestamp > 5000) return;

      const { executor } = entry;
      if (executor.id === client.user.id) return;

      const GLOBAL_OWNER_ID = '578019414830743586';
      const isWhitelisted = executor.id === GLOBAL_OWNER_ID || config.whitelist.includes(executor.id);
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
