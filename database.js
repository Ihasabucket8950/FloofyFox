const fs = require('fs').promises;
const path = require('path');

// Define file paths
const profilesPath = path.join(__dirname, 'profiles.json');
const conversationsPath = path.join(__dirname, 'conversations.json');
const settingsPath = path.join(__dirname, 'settings.json');

// In-memory cache
let profiles = {};
let conversations = {};
let settings = {}; // Will now be keyed by guildId

const MAX_HISTORY = 20;
// Formula for XP needed for a given level. Creates a smooth progression curve.
const xpForLevel = level => 5 * (level ** 2) + 50 * level + 100;

// --- Database Module ---
const Database = {
    // --- Load all data from files at startup ---
    async load() {
        try {
            profiles = JSON.parse(await fs.readFile(profilesPath, 'utf8'));
            console.log('User profiles loaded.');
        } catch (e) {
            console.log('No profiles.json found. Starting fresh.');
            profiles = {};
        }
        try {
            conversations = JSON.parse(await fs.readFile(conversationsPath, 'utf8'));
            console.log('Conversations loaded.');
        } catch (e) {
            console.log('No conversations.json found. Starting fresh.');
            conversations = {};
        }
        try {
            settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
            console.log('Settings loaded.');
        } catch (e) {
            console.log('No settings.json found. Using defaults.');
            settings = {};
        }
    },

    // --- Save all data to files ---
    async save() {
        await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
        await fs.writeFile(conversationsPath, JSON.stringify(conversations, null, 2));
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    },

    // --- Guild Settings Management ---
    _ensureGuildSettings(guildId) {
        if (!settings[guildId]) {
            settings[guildId] = {
                enabledChannels: [],
                listeningChannels: [],
                welcomeChannelId: null,
                logChannelId: null,
                questChannelId: null,
                musicChannelId: null,
                musicUiMessageId: null,
                welcomeMessage: "Welcome, {user}!",
                currencyName: "Sparkles",
                customCommands: {}
            };
        }
    },

    // --- Profile Functions ---
    getProfile(userId) { return profiles[userId]; },
    createProfile(userId) {
        if (!profiles[userId]) {
            profiles[userId] = {
                preferredName: null,
                notes: [],
                xp: 0,
                level: 0,
                currency: 0
            };
        }
    },
    setPreferredName(userId, name) { if (!profiles[userId]) this.createProfile(userId); profiles[userId].preferredName = name; },
    addNoteToProfile(userId, note) { if (!profiles[userId]) this.createProfile(userId); profiles[userId].notes.push(note); },
    getAllProfiles() { return profiles; },
    deleteProfile(userId) { if (profiles[userId]) { delete profiles[userId]; return true; } return false; },
    deleteNoteByIndex(userId, index) { if (profiles[userId] && profiles[userId].notes[index]) { profiles[userId].notes.splice(index, 1); return true; } return false; },
    
    // --- Leveling & Economy Functions ---
    addXp(userId, amount) {
        if (!profiles[userId]) this.createProfile(userId);
        if (profiles[userId].xp === undefined) profiles[userId].xp = 0;
        if (profiles[userId].level === undefined) profiles[userId].level = 0;

        profiles[userId].xp += amount;
        
        let leveledUp = false;
        let xpNeeded = xpForLevel(profiles[userId].level);
        while (profiles[userId].xp >= xpNeeded) {
            profiles[userId].level++;
            leveledUp = true;
            xpNeeded = xpForLevel(profiles[userId].level);
        }
        return { leveledUp, newLevel: profiles[userId].level };
    },
    setLevel(userId, level) {
        if (!profiles[userId]) this.createProfile(userId);
        const targetLevel = Math.max(0, level);
        profiles[userId].level = targetLevel;
        profiles[userId].xp = (targetLevel > 0) ? xpForLevel(targetLevel - 1) : 0;
        return targetLevel;
    },
    addLevels(userId, amount) {
        if (!profiles[userId]) this.createProfile(userId);
        if (profiles[userId].level === undefined) profiles[userId].level = 0;
        const newLevel = profiles[userId].level + amount;
        return this.setLevel(userId, newLevel);
    },
    getXpForNextLevel(level) {
        return xpForLevel(level);
    },
    addCurrency(userId, amount) {
        if (!profiles[userId]) this.createProfile(userId);
        if (profiles[userId].currency === undefined) profiles[userId].currency = 0;
        profiles[userId].currency += amount;
        return profiles[userId].currency;
    },
    removeCurrency(userId, amount) {
        if (!profiles[userId] || profiles[userId].currency < amount) return false;
        profiles[userId].currency -= amount;
        return true;
    },

    // --- Conversation History Functions ---
    getHistory(channelId) { if (!conversations[channelId] || conversations[channelId].length === 0) return "This is the start of a new conversation."; return conversations[channelId].map(msg => `${msg.name}: ${msg.content}`).join('\n'); },
    addMessageToHistory(channelId, name, content) { if (!conversations[channelId]) { conversations[channelId] = []; } conversations[channelId].push({ name, content }); if (conversations[channelId].length > MAX_HISTORY) { conversations[channelId].shift(); } },
    clearHistory(channelId) { if (conversations[channelId]) { delete conversations[channelId]; console.log(`History cleared for channel ${channelId}`); } },

    // --- Settings Functions ---
    isChannelEnabled(guildId, channelId) { this._ensureGuildSettings(guildId); return settings[guildId].enabledChannels.includes(channelId); },
    addChatChannel(guildId, channelId) { this._ensureGuildSettings(guildId); if (!settings[guildId].enabledChannels.includes(channelId)) { settings[guildId].enabledChannels.push(channelId); return true; } return false; },
    removeChatChannel(guildId, channelId) { this._ensureGuildSettings(guildId); const i = settings[guildId].enabledChannels.indexOf(channelId); if (i > -1) { settings[guildId].enabledChannels.splice(i, 1); return true; } return false; },
    listChatChannels(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].enabledChannels; },
    
    isListenChannel(guildId, channelId) { this._ensureGuildSettings(guildId); return settings[guildId].listeningChannels.includes(channelId); },
    addListenChannel(guildId, channelId) { this._ensureGuildSettings(guildId); if (!settings[guildId].listeningChannels.includes(channelId)) { settings[guildId].listeningChannels.push(channelId); return true; } return false; },
    removeListenChannel(guildId, channelId) { this._ensureGuildSettings(guildId); const i = settings[guildId].listeningChannels.indexOf(channelId); if (i > -1) { settings[guildId].listeningChannels.splice(i, 1); return true; } return false; },
    listListenChannels(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].listeningChannels; },

    getWelcomeMessage(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].welcomeMessage; },
    setWelcomeMessage(guildId, message) { this._ensureGuildSettings(guildId); settings[guildId].welcomeMessage = message; },

    getWelcomeChannelId(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].welcomeChannelId; },
    setWelcomeChannelId(guildId, channelId) { this._ensureGuildSettings(guildId); settings[guildId].welcomeChannelId = channelId; },

    getLogChannelId(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].logChannelId; },
    setLogChannelId(guildId, channelId) { this._ensureGuildSettings(guildId); settings[guildId].logChannelId = channelId; },

    getQuestChannelId(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].questChannelId; },
    setQuestChannelId(guildId, channelId) { this._ensureGuildSettings(guildId); settings[guildId].questChannelId = channelId; },

    getCurrencyName(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].currencyName; },
    setCurrencyName(guildId, name) { this._ensureGuildSettings(guildId); settings[guildId].currencyName = name; },

    getCustomCommand(guildId, name) { this._ensureGuildSettings(guildId); return settings[guildId].customCommands[name.toLowerCase()]; },
    addCustomCommand(guildId, name, response) { this._ensureGuildSettings(guildId); settings[guildId].customCommands[name.toLowerCase()] = response; },
    removeCustomCommand(guildId, name) { this._ensureGuildSettings(guildId); if(settings[guildId].customCommands[name.toLowerCase()]) { delete settings[guildId].customCommands[name.toLowerCase()]; return true; } return false; },
    listCustomCommands(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].customCommands; },

    getMusicChannelId(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].musicChannelId; },
    setMusicChannelId(guildId, channelId) { this._ensureGuildSettings(guildId); settings[guildId].musicChannelId = channelId; },
    
    getMusicUiMessageId(guildId) { this._ensureGuildSettings(guildId); return settings[guildId].musicUiMessageId; },
    setMusicUiMessageId(guildId, messageId) { this._ensureGuildSettings(guildId); settings[guildId].musicUiMessageId = messageId; }
};

module.exports = Database;
