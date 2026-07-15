const { AuditLogEvent, EmbedBuilder } = require('discord.js');

async function sendLog(guild, config, embed) {
  if (!config.logsChannel) return;
  const logsChan = guild.channels.cache.get(config.logsChannel);
  if (logsChan) await logsChan.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'roleDelete',
  async execute(role, client) {
    const guild = role.guild;
    const config = client.db.getGuildConfig(guild.id);

    try {
      await new Promise(r => setTimeout(r, 500));

      const logs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete });
      const entry = logs.entries.first();
      if (!entry) return;

      const { executor } = entry;
      if (executor.id === client.user.id) return;

      const isWhitelisted = executor.id === guild.ownerId || config.whitelist.includes(executor.id);
      if (isWhitelisted) return;

      // 1. Bannir
      const member = await guild.members.fetch(executor.id).catch(() => null);
      if (member && member.bannable) {
        await member.ban({ reason: '[S-V Guard] Suppression de rôle non autorisée.' });
      }

      // 2. Restaurer le rôle
      const restored = await guild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable,
        reason: '[S-V Guard] Restauration automatique du rôle.'
      });

      // 3. Log
      const embed = new EmbedBuilder()
        .setTitle('🚨 Anti-Role Delete — Rôle restauré')
        .addFields(
          { name: 'Rôle supprimé', value: `${role.name} (${role.id})`, inline: true },
          { name: 'Rôle restauré', value: `${restored}`, inline: true },
          { name: 'Responsable', value: `<@${executor.id}> (${executor.id})`, inline: false },
          { name: 'Sanction', value: '🔨 Banni définitivement', inline: true }
        )
        .setColor('#FF0000')
        .setTimestamp();

      await sendLog(guild, config, embed);
    } catch (err) {
      console.error('[S-V Guard] roleDelete error:', err);
    }
  },
};
