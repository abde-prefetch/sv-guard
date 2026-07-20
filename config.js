// Propriétaires absolus du bot — ont les permissions maximales sur TOUS les serveurs
const OWNER_IDS = [
  '578019414830743586',
  '1230594535957205003'
];

/**
 * Vérifie si un utilisateur est un owner absolu du bot.
 * @param {string} userId 
 * @returns {boolean}
 */
function isOwner(userId) {
  return OWNER_IDS.includes(userId);
}

module.exports = { OWNER_IDS, isOwner };
