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

    // &help : Accessible à tous
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Protect — Menu d\'aide')
        .setDescription(`Préfixe : \`${prefix}\`\nPropriétaire absolu : <@${GLOBAL_OWNER_ID}>`)
        .addFields(
          { name: '🛡️ Protection', value:
            `\`${prefix}power on/off\` — Activer/Désactiver la protection\n` +
            `\`${prefix}status\` — Afficher le statut & modules actifs`,
            inline: false
          },
          { name: '💾 Sauvegarde', value:
            `\`${prefix}backup create <nom>\` — Créer une sauvegarde complète\n` +
            `\`${prefix}backup load <nom>\` — Charger une sauvegarde\n` +
            `\`${prefix}backup list\` — Lister les sauvegardes`,
            inline: false
          },
          { name: '👑 Permissions (Owner)', value:
            `\`${prefix}whitelist @user\` — Ajouter à la whitelist locale\n` +
            `\`${prefix}unwhitelist @user\` — Retirer de la whitelist\n` +
            `\`${prefix}listowner\` — Voir le propriétaire absolu\n` +
            `\`${prefix}listwhitelist\` — Voir la whitelist du serveur`,
            inline: false
          },
          { name: '⚙️ Configuration', value:
            `\`${prefix}logs #salon\` — Configurer le salon de logs`,
            inline: false
          },
          { name: '⚠️ Actions dangereuses (Owner)', value:
            `\`${prefix}nuke\` — Supprimer tous les salons & rôles\n` +
            `\`${prefix}restart\` — Redémarrer le bot`,
            inline: false
          }
        )
        .setColor(config.theme || '#5865F2')
        .setFooter({ text: 'Protect • Protection avancée' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // Commandes Owner uniquement (Seul le GLOBAL_OWNER_ID absolu peut les faire)
    if (['restart', 'whitelist', 'unwhitelist', 'logs', 'power', 'backup', 'loadbackup', 'nuke'].includes(command)) {
      if (!isOwner) {
        return message.reply(`❌ Seul le propriétaire global du bot (<@${GLOBAL_OWNER_ID}>) peut utiliser cette commande.`);
      }
    }

    if (command === 'restart') {
      await message.reply("🔄 Redémarrage du bot **Protect** en cours...");
      process.exit(0);
    }

    if (command === 'listowner') {
      const embed = new EmbedBuilder()
        .setTitle('👑 Propriétaire Global du Bot')
        .setDescription(`Le propriétaire absolu de ce bot est : <@${GLOBAL_OWNER_ID}> (${GLOBAL_OWNER_ID})`)
        .setColor(config.theme || '#5865F2')
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (command === 'listwhitelist') {
      const whitelistMembers = config.whitelist.map(id => `• <@${id}> (${id})`).join('\n') || 'Aucun membre whitelisté sur ce serveur.';
      const embed = new EmbedBuilder()
        .setTitle('📋 Membres Whitelistés (Ce Serveur)')
        .setDescription(whitelistMembers)
        .setColor(config.theme || '#5865F2')
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (command === 'whitelist') {
      const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
      if (!target) return message.reply(`❌ Usage : \`${prefix}whitelist @user\``);
      if (config.whitelist.includes(target.id)) return message.reply("❌ Cet utilisateur est déjà dans la whitelist.");

      config.whitelist.push(target.id);
      client.db.updateGuildConfig(guildId, { whitelist: config.whitelist });
      return message.reply(`✅ **${target.username}** a été ajouté à la whitelist S-V Guard.`);
    }

    if (command === 'unwhitelist') {
      const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
      if (!target) return message.reply(`❌ Usage : \`${prefix}unwhitelist @user\``);
      if (!config.whitelist.includes(target.id)) return message.reply("❌ Cet utilisateur n'est pas dans la whitelist.");

      config.whitelist = config.whitelist.filter(id => id !== target.id);
      client.db.updateGuildConfig(guildId, { whitelist: config.whitelist });
      return message.reply(`✅ **${target.username}** a été retiré de la whitelist S-V Guard.`);
    }

    if (command === 'logs') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply(`❌ Usage : \`${prefix}logs #salon\``);

      client.db.updateGuildConfig(guildId, { logsChannel: channel.id });
      return message.reply(`✅ Salon de logs configuré sur ${channel}.`);
    }

    if (command === 'power') {
      const opt = args[0]?.toLowerCase();
      if (opt !== 'on' && opt !== 'off') return message.reply(`❌ Usage : \`${prefix}power on\` ou \`${prefix}power off\``);

      const isActive = opt === 'on';
      client.db.updateGuildConfig(guildId, { antiRaid: isActive });
      return message.reply(`✅ S-V Guard est maintenant **${isActive ? 'ACTIVÉ 🟢' : 'DÉSACTIVÉ 🔴'}**.`);
    }

    if (command === 'status') {
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

    if (command === 'nuke') {
      await message.reply("🚨 **Destruction en cours...** Tous les salons et rôles de ce serveur vont être supprimés.");
      const guild = message.guild;
      const guildChannels = await guild.channels.fetch();
      const currentChannelId = message.channel.id;
      
      let deletedChannels = 0;
      for (const [id, c] of guildChannels) {
        if (id !== currentChannelId && c.deletable) {
          await c.delete().catch(() => {});
          deletedChannels++;
        }
      }

      const guildRoles = await guild.roles.fetch();
      let deletedRoles = 0;
      for (const [id, r] of guildRoles) {
        if (r.id !== guild.id && r.editable && !r.managed && r.id !== guild.roles.botRoleFor(client.user)?.id) {
          await r.delete().catch(() => {});
          deletedRoles++;
        }
      }

      return message.reply(`✅ Destruction terminée. **${deletedChannels}** salons et **${deletedRoles}** rôles ont été supprimés.`);
    }

    if (command === 'backup') {
      const subCommand = args[0]?.toLowerCase();
      const backupName = args.slice(1).join(' ');
      const globalData = client.db.getGlobalData();
      if (!globalData.backups) globalData.backups = {};

      if (subCommand === 'help' || !subCommand) {
        const embed = new EmbedBuilder()
          .setTitle('🛡️ S-V Guard — Système de Sauvegarde Global')
          .setDescription(`Voici les commandes disponibles pour le système de sauvegarde cross-server :`)
          .addFields(
            { name: `\`${prefix}backup create <nom>\``, value: "Crée une sauvegarde complète du serveur actuel (Rôles, Salons, Permissions) stockée globalement." },
            { name: `\`${prefix}backup load <nom>\``, value: "Charge une sauvegarde sur le serveur actuel. ⚠️ **Supprime tout le serveur actuel** avant de restaurer les rôles et les salons." },
            { name: `\`${prefix}backup list\``, value: "Liste toutes les sauvegardes stockées." }
          )
          .setColor(config.theme || '#5865F2');
        return message.reply({ embeds: [embed] });
      }

      if (subCommand === 'list') {
        const backups = Object.keys(globalData.backups);
        if (backups.length === 0) return message.reply("❌ Aucune sauvegarde globale disponible.");
        const list = backups.map(name => `• **${name}** (Créée le ${globalData.backups[name].date})`).join('\n');
        return message.reply(`**Sauvegardes globales existantes :**\n${list}`);
      }

      if (subCommand === 'create') {
        if (!backupName) return message.reply(`❌ Veuillez spécifier un nom de sauvegarde : \`${prefix}backup create <nom>\``);
        const guild = message.guild;
        
        const roles = [];
        const guildRoles = await guild.roles.fetch();
        guildRoles.forEach(r => {
          // On ne sauvegarde pas le rôle @everyone (on le fera plus tard via ID) ni les rôles gérés/bots
          if (r.managed || r.id === guild.id) return;
          roles.push({
            id: r.id,
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            position: r.position,
            permissions: r.permissions.bitfield.toString(),
            mentionable: r.mentionable
          });
        });
        
        // Trier les rôles par position descendante (du plus haut au plus bas)
        roles.sort((a, b) => b.position - a.position);

        const channels = [];
        const guildChannels = await guild.channels.fetch();
        guildChannels.forEach(c => {
          if (!c) return;
          const overwrites = [];
          c.permissionOverwrites.cache.forEach(ow => {
            // Uniquement les overwrites de rôles
            if (ow.type === 0) { 
              overwrites.push({
                id: ow.id,
                allow: ow.allow.bitfield.toString(),
                deny: ow.deny.bitfield.toString()
              });
            }
          });

          channels.push({
            id: c.id,
            name: c.name,
            type: c.type,
            parentId: c.parentId,
            position: c.position,
            overwrites: overwrites
          });
        });

        globalData.backups[backupName] = {
          date: new Date().toLocaleString('fr-FR'),
          guildId: guild.id,
          roles: roles,
          channels: channels
        };

        client.db.updateGlobalData({ backups: globalData.backups });
        return message.reply(`✅ Sauvegarde complète **${backupName}** créée avec succès !`);
      }

      if (subCommand === 'load') {
        if (!backupName) return message.reply(`❌ Veuillez spécifier un nom de sauvegarde : \`${prefix}backup load <nom>\``);
        const backup = globalData.backups[backupName];
        if (!backup) return message.reply(`❌ La sauvegarde **${backupName}** n'existe pas.`);

        await message.reply("🚨 **Restauration en cours...** Le serveur actuel va être purgé, veuillez patienter.");
        const guild = message.guild;

        // 1. SUPPRESSION
        const currentChannelId = message.channel.id;
        const guildChannels = await guild.channels.fetch();
        for (const [id, c] of guildChannels) {
          if (id !== currentChannelId && c.deletable) {
            await c.delete().catch(() => {});
          }
        }
        
        const guildRoles = await guild.roles.fetch();
        for (const [id, r] of guildRoles) {
          if (r.id !== guild.id && r.editable && !r.managed && r.id !== guild.roles.botRoleFor(client.user)?.id) {
            await r.delete().catch(() => {});
          }
        }

        // 2. CREATION DES ROLES
        const roleMapping = new Map();
        // Le rôle @everyone est l'id de la guilde actuelle
        roleMapping.set(backup.guildId, guild.id); 

        // Rôles inversés (du plus bas au plus haut) pour la création
        const reversedRoles = [...backup.roles].reverse();
        for (const r of reversedRoles) {
          try {
            const newRole = await guild.roles.create({
              name: r.name,
              color: r.color,
              hoist: r.hoist,
              permissions: BigInt(r.permissions),
              mentionable: r.mentionable,
              reason: `Restauration de backup ${backupName}`
            });
            roleMapping.set(r.id, newRole.id);
          } catch(err) {
            console.error(`Impossible de créer le rôle ${r.name}`);
          }
        }

        // 3. CREATION DES SALONS
        const categoryMap = new Map();
        const backupCategories = backup.channels.filter(c => c.type === ChannelType.GuildCategory);
        const backupOther = backup.channels.filter(c => c.type !== ChannelType.GuildCategory);

        const createChannelWithOverwrites = async (ch, parentId = null) => {
          const newOverwrites = [];
          for (const ow of ch.overwrites) {
            const newRoleId = roleMapping.get(ow.id);
            if (newRoleId) {
              newOverwrites.push({
                id: newRoleId,
                allow: BigInt(ow.allow),
                deny: BigInt(ow.deny)
              });
            }
          }

          return await guild.channels.create({
            name: ch.name,
            type: ch.type,
            parent: parentId,
            permissionOverwrites: newOverwrites
          }).catch(() => null);
        };

        for (const cat of backupCategories) {
          const newCat = await createChannelWithOverwrites(cat, null);
          if (newCat) categoryMap.set(cat.id, newCat.id);
        }

        for (const ch of backupOther) {
          const parentId = categoryMap.get(ch.parentId) || null;
          await createChannelWithOverwrites(ch, parentId);
        }

        // Fin, supprimer le salon de log si possible
        const oldChan = guild.channels.cache.get(currentChannelId);
        if (oldChan) await oldChan.delete().catch(() => {});
        return;
      }
    }
  },
};
