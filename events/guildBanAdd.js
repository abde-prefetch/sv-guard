const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { checkAndRegisterAction, clearHistory } = require('../utils/rateLimiter');
const { isOwner: checkOwner } = require('../config');

async function sendLog(guild, config, embed) {
  if (!config.logsChannel) return;
  const logsChan = guild.channels.cache.get(config.logsChannel);
  if (logsChan) await logsChan.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'guildBanAdd',
  async execute(ban, client) {
    const guild = ban.guild;
    const config = client.db.getGuildConfig(guild.id);
    if (config.antiRaid === false) return; // Si la protection est éteinte, on ignore

    try {
      let entry = null;
      for (let i = 0; i < 4; i++) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberBanAdd });
        entry = logs.entries.find(e => e.target.id === ban.user.id);
        if (entry) break;
        await new Promise(r => setTimeout(r, 500));
      }

      if (!entry) return;

      const { executor, reason } = entry;
      if (executor.id === client.user.id) return; // Ignorer les bans faits par le bot lui-même

      const isWhitelisted = checkOwner(executor.id) || (config.whitelist && config.whitelist.includes(executor.id));

      // 1. Envoyer le log du ban
      const logEmbed = new EmbedBuilder()
        .setTitle('🔨 Action de Modération — Bannissement')
        .addFields(
          { name: 'Membre Banni', value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
          { name: 'Responsable', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: 'Raison', value: reason || 'Aucune raison spécifiée', inline: false }
        )
        .setColor('#FF5500')
        .setTimestamp();
      
      await sendLog(guild, config, logEmbed);

      // 2. Vérification Anti-Mass-Ban si non whitelisté
      if (!isWhitelisted) {
        const isRateLimited = checkAndRegisterAction(executor.id);
        if (isRateLimited) {
          clearHistory(executor.id); // Reset pour éviter de spammer
          
          // Bannir l'attaquant
          const attacker = await guild.members.fetch(executor.id).catch(() => null);
          if (attacker && attacker.bannable) {
            await attacker.ban({ reason: '[S-V Guard] Anti-Mass-Ban déclenché (Trop de bans en 30s).' }).catch(() => {});
            
            const attackEmbed = new EmbedBuilder()
              .setTitle('🚨 SÉCURITÉ CRITIQUE — Anti-Mass-Ban')
              .setDescription(`L'utilisateur <@${executor.id}> a banni trop de membres rapidement et a été banni par sécurité.`)
              .setColor('#FF0000')
              .setTimestamp();
            
            await sendLog(guild, config, attackEmbed);
          }
        }
      }
    } catch (err) {
      console.error('[S-V Guard] guildBanAdd error:', err);
    }
  },
};
