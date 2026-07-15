const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
}

let cachedData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

function save() {
  fs.writeFile(dbPath, JSON.stringify(cachedData, null, 2), (err) => {
    if (err) console.error("Erreur de sauvegarde DB S-V Guard :", err);
  });
}

module.exports = {
  getGuildConfig(guildId) {
    if (!cachedData[guildId]) {
      cachedData[guildId] = {
        prefix: '&',
        whitelist: [],
        owners: [],
        logsChannel: null,
        theme: '#5865F2'
      };
      save();
    }
    return cachedData[guildId];
  },
  updateGuildConfig(guildId, newConfig) {
    cachedData[guildId] = { ...this.getGuildConfig(guildId), ...newConfig };
    save();
    return cachedData[guildId];
  },
  getGlobalData() {
    if (!cachedData['global']) {
      cachedData['global'] = {
        backups: {}
      };
      save();
    }
    return cachedData['global'];
  },
  updateGlobalData(newData) {
    cachedData['global'] = { ...this.getGlobalData(), ...newData };
    save();
    return cachedData['global'];
  }
};
