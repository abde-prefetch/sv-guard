const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const config = client.db.getGuildConfig(guildId);
    const prefix = config.prefix || '&';

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const GLOBAL_OWNER_ID = '578019414830743586';
    const isOwner = message.author.id === GLOBAL_OWNER_ID;

    // &ghelp : Accessible à tous
    if (command === 'ghelp') {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ S-V Guard — Aide')
        .setDescription(`Préfixe actuel : \`${prefix}\`\n\n**Seul le propriétaire global du bot (<@${GLOBAL_OWNER_ID}>) peut configurer le bot.**`)
        .addFields(
          { name: '━━ Configuration ━━', value:
            `\`${prefix}gwhitelist @user\` — Ajouter à la whitelist\n` +
            `\`${prefix}gunwhitelist @user\` — Retirer de la whitelist\n` +
            `\`${prefix}glogs #salon\` — Configurer le salon de logs\n` +
            `\`${prefix}gpower on/off\` — Activer/Désactiver la protection\n` +
            `\`${prefix}gstatus\` — Afficher le statut du bot`
          }
        )
        .setColor(config.theme || '#5865F2')
        .setFooter({ text: 'S-V Guard • Protection avancée' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // Commandes Owner uniquement
    if (['gwhitelist', 'gunwhitelist', 'glogs', 'gstatus'].includes(command)) {
      if (!isOwner) {
        return message.reply(`❌ Seul le propriétaire global du bot (<@${GLOBAL_OWNER_ID}>) peut utiliser cette commande.`);
      }
    }

    if (command === 'gwhitelist') {
      const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
      if (!target) return message.reply(`❌ Usage : \`${prefix}gwhitelist @user\``);
      if (config.whitelist.includes(target.id)) return message.reply("❌ Cet utilisateur est déjà dans la whitelist.");

      config.whitelist.push(target.id);
      client.db.updateGuildConfig(guildId, { whitelist: config.whitelist });
      return message.reply(`✅ **${target.username}** a été ajouté à la whitelist S-V Guard.`);
    }

    if (command === 'gunwhitelist') {
      const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
      if (!target) return message.reply(`❌ Usage : \`${prefix}gunwhitelist @user\``);
      if (!config.whitelist.includes(target.id)) return message.reply("❌ Cet utilisateur n'est pas dans la whitelist.");

      config.whitelist = config.whitelist.filter(id => id !== target.id);
      client.db.updateGuildConfig(guildId, { whitelist: config.whitelist });
      return message.reply(`✅ **${target.username}** a été retiré de la whitelist S-V Guard.`);
    }

    if (command === 'glogs') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply(`❌ Usage : \`${prefix}glogs #salon\``);

      client.db.updateGuildConfig(guildId, { logsChannel: channel.id });
      return message.reply(`✅ Salon de logs configuré sur ${channel}.`);
    }

    if (command === 'gpower') {
      const opt = args[0]?.toLowerCase();
      if (opt !== 'on' && opt !== 'off') return message.reply(`❌ Usage : \`${prefix}gpower on\` ou \`${prefix}gpower off\``);

      const isActive = opt === 'on';
      client.db.updateGuildConfig(guildId, { antiRaid: isActive });
      return message.reply(`✅ S-V Guard est maintenant **${isActive ? 'ACTIVÉ 🟢' : 'DÉSACTIVÉ 🔴'}**.`);
    }

    if (command === 'gstatus') {
      const whitelistMembers = config.whitelist.map(id => `<@${id}>`).join(', ') || 'Aucun';
      const statusIcon = config.antiRaid ? '🟢' : '🔴';
      
      const embed = new EmbedBuilder()
        .setTitle('🛡️ S-V Guard — Statut')
        .addFields(
          { name: '👑 Propriétaire Global', value: `<@${GLOBAL_OWNER_ID}>`, inline: true },
          { name: '📣 Salon de logs', value: config.logsChannel ? `<#${config.logsChannel}>` : 'Non configuré', inline: true },
          { name: '⚡ Protection Globale', value: config.antiRaid ? '**ACTIVÉE** 🟢' : '**DÉSACTIVÉE** 🔴', inline: true },
          { name: '📋 Whitelist', value: whitelistMembers, inline: false },
          { name: '⚙️ Modules (Si protection activée)', value:
            `• Anti-Channel Delete : ${statusIcon}\n` +
            `• Anti-Channel Create : ${statusIcon}\n` +
            `• Anti-Role Delete : ${statusIcon}\n` +
            `• Anti-Role Create : ${statusIcon}\n` +
            `• Anti-Role Permissions Edit : ${statusIcon}\n` +
            `• Anti-Webhook Create : ${statusIcon}`
          }
        )
        .setColor(config.theme || '#5865F2')
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  },
};
