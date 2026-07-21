const { AuditLogEvent, EmbedBuilder } = require('discord.js');
const { isOwner: checkOwner } = require('../config');

async function sendLog(guild, config, embed) {
  if (!config.logsChannel) return;
  const logsChan = guild.channels.cache.get(config.logsChannel);
  if (logsChan) await logsChan.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const guild = member.guild;
    const config = client.db.getGuildConfig(guild.id);

    // Si la protection anti-raid est coupée, on ignore
    if (config.antiRaid === false) return;

    // Si le membre qui rejoint N'EST PAS un bot, on s'en fiche (le bot Gestion s'en occupe)
    if (!member.user.bot) return;

    try {
      let entry = null;
      // Boucle d'attente pour être sûr que l'audit log soit peuplé
      for (let i = 0; i < 4; i++) {
        const logs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.BotAdd });
        entry = logs.entries.find(e => e.target.id === member.id);
        if (entry) break;
        await new Promise(r => setTimeout(r, 500));
      }

      if (!entry) {
        // Si l'audit log n'a pas pu être récupéré, on bannit le bot par précaution
        await member.ban({ reason: 'S-V Guard: Bot externe détecté (Auteur inconnu)' });
        
        const logEmbed = new EmbedBuilder()
          .setTitle('🚨 Alerte Sécurité — Bot Non Autorisé')
          .setDescription(`Un bot externe a rejoint le serveur, mais l'auteur de l'ajout n'a pas pu être identifié dans les temps.`)
          .addFields(
            { name: '🤖 Bot Suspect', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: '🛡️ Action prise', value: 'Le bot suspect a été **banni** par précaution.', inline: true }
          )
          .setColor('#ED4245')
          .setTimestamp();
        
        await sendLog(guild, config, logEmbed);
        return;
      }

      const { executor } = entry;
      
      // Ignorer si c'est le bot lui-même
      if (executor.id === client.user.id) return;

      const isWhitelisted = checkOwner(executor.id) || (config.whitelist && config.whitelist.includes(executor.id));
      
      // Si la personne qui a ajouté le bot est Whitelist / Owner, on autorise
      if (isWhitelisted) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🤖 Bot Autorisé Ajouté')
          .setDescription(`Un bot a été ajouté sur le serveur par un membre autorisé.`)
          .addFields(
            { name: '🤖 Bot', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: '👤 Ajouté par', value: `${executor} (${executor.id})`, inline: true }
          )
          .setColor('#57F287')
          .setTimestamp();
        
        await sendLog(guild, config, logEmbed);
        return;
      }

      // Si non autorisé : BAN le bot ET BAN la personne qui l'a ajouté
      await member.ban({ reason: `S-V Guard: Bot non autorisé ajouté par ${executor.tag}` });
      
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      let executorActionText = "Impossible de bannir l'auteur (permissions insuffisantes)";
      
      if (executorMember && executorMember.bannable) {
        await executorMember.ban({ reason: `S-V Guard: Ajout d'un bot non autorisé (${member.user.tag})` });
        executorActionText = "Banni définitivement";
      }

      const logEmbed = new EmbedBuilder()
        .setTitle('🚨 Alerte Sécurité — Intrusion de Bot')
        .setDescription(`Un membre non autorisé a tenté d'ajouter un bot sur le serveur.`)
        .addFields(
          { name: '🤖 Bot Suspect', value: `${member.user.tag} (${member.id})`, inline: true },
          { name: '👤 Ajouté par', value: `${executor} (${executor.id})`, inline: true },
          { name: '🛡️ Action prise', value: `Bot suspect **banni**.\nUtilisateur **${executorActionText}**.`, inline: false }
        )
        .setColor('#ED4245')
        .setTimestamp();

      await sendLog(guild, config, logEmbed);

    } catch (err) {
      console.error("Erreur lors de la vérification de l'ajout de bot :", err);
    }
  }
};
