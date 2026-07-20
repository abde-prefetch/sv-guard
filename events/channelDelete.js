const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { isOwner: checkOwner } = require('../config');

async function sendLog(guild, config, embed) {
  if (!config.logsChannel) return;
  const logsChan = guild.channels.cache.get(config.logsChannel);
  if (logsChan) await logsChan.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'channelDelete',
  async execute(channel, client) {
    const guild = channel.guild;
    const config = client.db.getGuildConfig(guild.id);
    if (config.antiRaid === false) return;

    try {
      let entry = null;
      for (let i = 0; i < 4; i++) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.ChannelDelete });
        entry = logs.entries.find(e => e.target.id === channel.id);
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
        await member.ban({ reason: '[S-V Guard] Suppression de salon non autorisée.' });
      }

      // 2. Restaurer le salon
      const restored = await channel.clone({ reason: '[S-V Guard] Restauration automatique du salon.' });
      if (channel.parent) await restored.setParent(channel.parent).catch(() => {});
      await restored.setPosition(channel.position).catch(() => {});

      // 3. Log
      const embed = new EmbedBuilder()
        .setTitle('🚨 Anti-Channel Delete — Salon restauré')
        .addFields(
          { name: 'Salon supprimé', value: `#${channel.name} (${channel.id})`, inline: true },
          { name: 'Restauré', value: `${restored}`, inline: true },
          { name: 'Responsable', value: `<@${executor.id}> (${executor.id})`, inline: false },
          { name: 'Sanction', value: '🔨 Banni définitivement', inline: true }
        )
        .setColor('#FF0000')
        .setTimestamp();

      await sendLog(guild, config, embed);
    } catch (err) {
      console.error('[S-V Guard] channelDelete error:', err);
    }
  },
};
