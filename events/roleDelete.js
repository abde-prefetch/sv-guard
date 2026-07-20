const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { isOwner: checkOwner } = require('../config');

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
    if (config.antiRaid === false) return;

    // Sauvegarder la position AVANT la suppression
    const savedPosition = role.position;

    try {
      let entry = null;
      for (let i = 0; i < 4; i++) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.RoleDelete });
        entry = logs.entries.find(e => e.target.id === role.id);
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

      // 3. Repositionner le rôle exactement où il était dans la hiérarchie
      await guild.roles.setPositions([
        { role: restored.id, position: savedPosition }
      ]).catch(() => {});

      // 4. Log
      const embed = new EmbedBuilder()
        .setTitle('🚨 Anti-Role Delete — Rôle restauré')
        .addFields(
          { name: 'Rôle supprimé', value: `${role.name} (${role.id})`, inline: true },
          { name: 'Rôle restauré', value: `${restored} (position ${savedPosition})`, inline: true },
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
