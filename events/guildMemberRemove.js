const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { checkAndRegisterAction, clearHistory } = require('../utils/rateLimiter');
const { isOwner: checkOwner } = require('../config');

async function sendLog(guild, config, embed) {
  if (!config.logsChannel) return;
  const logsChan = guild.channels.cache.get(config.logsChannel);
  if (logsChan) await logsChan.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const guild = member.guild;
    const config = client.db.getGuildConfig(guild.id);
    if (config.antiRaid === false) return;

    try {
      let entry = null;
      for (let i = 0; i < 4; i++) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.MemberKick });
        entry = logs.entries.find(e => e.target.id === member.id && (Date.now() - e.createdTimestamp < 10000));
        if (entry) break;
        await new Promise(r => setTimeout(r, 500));
      }

      // Si aucune entrée récente n'est trouvée, c'est juste un membre qui a quitté de lui-même
      if (!entry) return;

      const { executor, reason } = entry;
      if (executor.id === client.user.id) return; // Ignorer les kicks faits par le bot lui-même

      const isWhitelisted = checkOwner(executor.id) || (config.whitelist && config.whitelist.includes(executor.id));

      // 1. Envoyer le log du kick
      const logEmbed = new EmbedBuilder()
        .setTitle('👢 Action de Modération — Expulsion (Kick)')
        .addFields(
          { name: 'Membre Expulsé', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Responsable', value: `<@${executor.id}> (${executor.tag})`, inline: true },
          { name: 'Raison', value: reason || 'Aucune raison spécifiée', inline: false }
        )
        .setColor('#FFAA00')
        .setTimestamp();
      
      await sendLog(guild, config, logEmbed);

      // 2. Vérification Anti-Mass-Kick si non whitelisté
      if (!isWhitelisted) {
        const isRateLimited = checkAndRegisterAction(executor.id);
        if (isRateLimited) {
          clearHistory(executor.id); // Reset pour éviter de spammer
          
          // Bannir l'attaquant
          const attacker = await guild.members.fetch(executor.id).catch(() => null);
          if (attacker && attacker.bannable) {
            await attacker.ban({ reason: '[S-V Guard] Anti-Mass-Kick déclenché (Trop d\'expulsions en 30s).' }).catch(() => {});
            
            const attackEmbed = new EmbedBuilder()
              .setTitle('🚨 SÉCURITÉ CRITIQUE — Anti-Mass-Kick')
              .setDescription(`L'utilisateur <@${executor.id}> a expulsé trop de membres rapidement et a été banni par sécurité.`)
              .setColor('#FF0000')
              .setTimestamp();
            
            await sendLog(guild, config, attackEmbed);
          }
        }
      }
    } catch (err) {
      console.error('[S-V Guard] guildMemberRemove error:', err);
    }
  },
};
