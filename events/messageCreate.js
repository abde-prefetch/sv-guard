const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

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
            `\`${prefix}gbackup\` — Créer une sauvegarde des salons\n` +
            `\`${prefix}gloadbackup <id>\` — Charger une sauvegarde\n` +
            `\`${prefix}gstatus\` — Afficher le statut du bot`
          }
        )
        .setColor(config.theme || '#5865F2')
        .setFooter({ text: 'S-V Guard • Protection avancée' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // Commandes Owner uniquement
    if (['gwhitelist', 'gunwhitelist', 'glogs', 'gstatus', 'gpower', 'gbackup', 'gloadbackup'].includes(command)) {
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

    if (command === 'gbackup') {
      const guild = message.guild;
      const channels = [];

      const guildChannels = await guild.channels.fetch();
      
      guildChannels.forEach(c => {
        if (!c) return;
        channels.push({
          id: c.id,
          name: c.name,
          type: c.type,
          parentId: c.parentId,
          position: c.position
        });
      });

      if (!config.backups) config.backups = [];
      
      config.backups.push({
        date: new Date().toLocaleString('fr-FR'),
        channels: channels
      });

      client.db.updateGuildConfig(guild.id, { backups: config.backups });
      return message.reply(`✅ Sauvegarde créée avec succès (Index: ${config.backups.length - 1}).`);
    }

    if (command === 'gloadbackup') {
      const index = parseInt(args[0]);

      if (!config.backups || config.backups.length === 0) {
        return message.reply("❌ Aucune sauvegarde disponible.");
      }

      if (isNaN(index) || index < 0 || index >= config.backups.length) {
        const list = config.backups.map((b, idx) => `[${idx}] - Sauvegarde du ${b.date} (${b.channels.length} salons)`).join('\n');
        return message.reply(`Format correct: \`${prefix}gloadbackup <index>\`\nSauvegardes :\n${list}`);
      }

      const backup = config.backups[index];
      await message.reply("🚨 Restauration en cours... Les salons actuels vont être supprimés.");

      const guild = message.guild;
      const channels = await guild.channels.fetch();

      const currentChannelId = message.channel.id;
      for (const [id, c] of channels) {
        if (id !== currentChannelId) {
          await c.delete().catch(() => {});
        }
      }

      const categoryMap = new Map();
      const backupCategories = backup.channels.filter(c => c.type === ChannelType.GuildCategory);
      for (const cat of backupCategories) {
        const newCat = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory
        }).catch(() => null);
        if (newCat) categoryMap.set(cat.id, newCat.id);
      }

      const backupOther = backup.channels.filter(c => c.type !== ChannelType.GuildCategory);
      for (const ch of backupOther) {
        await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: categoryMap.get(ch.parentId) || null
        }).catch(() => null);
      }

      const oldChan = guild.channels.cache.get(currentChannelId);
      if (oldChan) await oldChan.delete().catch(() => {});
      return;
    }
  },
};
