const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { isOwner: checkOwner } = require('../config');

async function sendLog(guild, config, embed) {
  if (!config.logsChannel) return;
  const logsChan = guild.channels.cache.get(config.logsChannel);
  if (logsChan) await logsChan.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole, client) {
    const guild = newRole.guild;
    const config = client.db.getGuildConfig(guild.id);
    if (config.antiRaid === false) return;

    // Vérifier si les permissions ont changé
    if (oldRole.permissions.bitfield === newRole.permissions.bitfield) return;

    try {
      let entry = null;
      for (let i = 0; i < 4; i++) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.RoleUpdate });
        entry = logs.entries.find(e => e.target.id === newRole.id);
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
        await member.ban({ reason: '[S-V Guard] Modification des permissions de rôle non autorisée.' });
      }

      // 2. Restaurer les anciennes permissions
      await newRole.setPermissions(oldRole.permissions, '[S-V Guard] Restauration automatique des permissions.').catch(() => {});

      // 3. Log
      const embed = new EmbedBuilder()
        .setTitle('🚨 Anti-Role Permissions Edit — Permissions restaurées')
        .addFields(
          { name: 'Rôle modifié', value: `${newRole.name} (${newRole.id})`, inline: true },
          { name: 'Responsable', value: `<@${executor.id}> (${executor.id})`, inline: false },
          { name: 'Action', value: 'Permissions rétablies aux valeurs d\'origine.', inline: false },
          { name: 'Sanction', value: '🔨 Banni définitivement', inline: true }
        )
        .setColor('#FF0000')
        .setTimestamp();

      await sendLog(guild, config, embed);
    } catch (err) {
      console.error('[S-V Guard] roleUpdate error:', err);
    }
  },
};
