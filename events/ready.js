const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ S-V Guard connecté en tant que ${client.user.tag}`);
    client.user.setActivity('la sécurité du serveur', { type: ActivityType.Watching });
  },
};
