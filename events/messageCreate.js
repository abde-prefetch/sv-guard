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

    const isOwner = message.author.id === message.guild.ownerId;

    // &ghelp : Accessible à tous
    if (command === 'ghelp') {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ S-V Guard — Aide')
        .setDescription(`Préfixe actuel : \`${prefix}\`\n\n**Seul le propriétaire du serveur peut configurer le bot.**`)
        .addFields(
          { name: '━━ Configuration ━━', value:
            `\`${prefix}gwhitelist @user\` — Ajouter à la whitelist\n` +
            `\`${prefix}gunwhitelist @user\` — Retirer de la whitelist\n` +
            `\`${prefix}glogs #salon\` — Configurer le salon de logs\n` +
            `\`${prefix}gstatus\` — Afficher le statut du bot`
          }
        )
        .setColor(config.theme || '#5865F2')
        .setFooter({ text: 'S-V Guard • Protection avancée' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // Commandes Owner uniquement
    if (!isOwner) {
      if (['gwhitelist', 'gunwhitelist', 'glogs', 'gstatus'].includes(command)) {
        return message.reply("❌ Seul le propriétaire du serveur peut configurer S-V Guard.");
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

    if (command === 'gstatus') {
      const whitelistMembers = config.whitelist.map(id => `<@${id}>`).join(', ') || 'Aucun';
      const embed = new EmbedBuilder()
        .setTitle('🛡️ S-V Guard — Statut')
        .addFields(
          { name: '👑 Propriétaire', value: `<@${message.guild.ownerId}>`, inline: true },
          { name: '📋 Whitelist', value: whitelistMembers, inline: false },
          { name: '📣 Salon de logs', value: config.logsChannel ? `<#${config.logsChannel}>` : 'Non configuré', inline: true },
          { name: '⚙️ Modules actifs', value:
            `• Anti-Channel Delete : 🟢\n` +
            `• Anti-Channel Create : 🟢\n` +
            `• Anti-Role Delete : 🟢\n` +
            `• Anti-Role Create : 🟢\n` +
            `• Anti-Role Permissions Edit : 🟢\n` +
            `• Anti-Webhook Create : 🟢`
          }
        )
        .setColor(config.theme || '#5865F2')
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }
  },
};
