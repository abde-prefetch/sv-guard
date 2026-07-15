const { AuditLogEvent, EmbedBuilder } = require('discord.js');

async function sendLog(guild, config, embed) {
  if (!config.logsChannel) return;
  const logsChan = guild.channels.cache.get(config.logsChannel);
  if (logsChan) await logsChan.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'roleCreate',
  async execute(role, client) {
    const guild = role.guild;
    const config = client.db.getGuildConfig(guild.id);

    try {
      await new Promise(r => setTimeout(r, 500));

      const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleCreate });
      const entry = logs.entries.first();
      if (!entry) return;

      const { executor } = entry;
      if (executor.id === client.user.id) return;

      const isWhitelisted = executor.id === guild.ownerId || config.whitelist.includes(executor.id);
      if (isWhitelisted) return;

      // 1. Bannir
      const member = await guild.members.fetch(executor.id).catch(() => null);
      if (member && member.bannable) {
        await member.ban({ reason: '[S-V Guard] Création de rôle non autorisée.' });
      }

      // 2. Supprimer le rôle
      await role.delete('[S-V Guard] Suppression automatique.').catch(() => {});

      // 3. Log
      const embed = new EmbedBuilder()
        .setTitle('🚨 Anti-Role Create — Rôle supprimé')
        .addFields(
          { name: 'Rôle créé', value: `${role.name} (${role.id})`, inline: true },
          { name: 'Responsable', value: `<@${executor.id}> (${executor.id})`, inline: false },
          { name: 'Sanction', value: '🔨 Banni définitivement', inline: true }
        )
        .setColor('#FF0000')
        .setTimestamp();

      await sendLog(guild, config, embed);
    } catch (err) {
      console.error('[S-V Guard] roleCreate error:', err);
    }
  },
};
