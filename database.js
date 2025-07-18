const fs = require('fs').promises;
const path = require('path');

// Define file paths
const profilesPath = path.join(__dirname, 'profiles.json');
const conversationsPath = path.join(__dirname, 'conversations.json');
const settingsPath = path.join(__dirname, 'settings.json');

// In-memory cache
let profiles = {};
let conversations = {};
let settings = { enabledChannels: [], listeningChannels: [] };

const MAX_HISTORY = 20;

// --- Database Module ---
const Database = {
    // --- Load all data from files at startup ---
    async load() {
        try {
            profiles = JSON.parse(await fs.readFile(profilesPath, 'utf8'));
            console.log('User profiles loaded.');
        } catch (e) { console.log('No profiles.json found. Starting fresh.'); profiles = {}; }
        try {
            conversations = JSON.parse(await fs.readFile(conversationsPath, 'utf8'));
            console.log('Conversations loaded.');
        } catch (e) { console.log('No conversations.json found. Starting fresh.'); conversations = {}; }
        try {
            settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
            if (!settings.enabledChannels) settings.enabledChannels = [];
            if (!settings.listeningChannels) settings.listeningChannels = [];
            console.log('Settings loaded.');
        } catch (e) { console.log('No settings.json found. Using defaults.'); settings = { enabledChannels: [], listeningChannels: [] }; }
    },

    // --- Save all data to files ---
    async save() {
        await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2));
        await fs.writeFile(conversationsPath, JSON.stringify(conversations, null, 2));
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    },

    // --- Profile Functions ---
    getProfile(userId) { return profiles[userId]; },
    createProfile(userId) { if (!profiles[userId]) { profiles[userId] = { preferredName: null, notes: [] }; } },
    setPreferredName(userId, name) { if (!profiles[userId]) this.createProfile(userId); profiles[userId].preferredName = name; },
    addNoteToProfile(userId, note) { if (!profiles[userId]) this.createProfile(userId); profiles[userId].notes.push(note); },
    getAllProfiles() { return profiles; },
    deleteProfile(userId) { if (profiles[userId]) { delete profiles[userId]; return true; } return false; },

    // --- Conversation History Functions ---
    getHistory(channelId) { if (!conversations[channelId]) return ""; return conversations[channelId].map(msg => `${msg.name}: ${msg.content}`).join('\n'); },
    addMessageToHistory(channelId, name, content) { if (!conversations[channelId]) { conversations[channelId] = []; } conversations[channelId].push({ name, content }); if (conversations[channelId].length > MAX_HISTORY) { conversations[channelId].shift(); } },
    clearHistory(channelId) { if (conversations[channelId]) { delete conversations[channelId]; console.log(`History cleared for channel ${channelId}`); } },

    // --- Settings Functions ---
    isChannelEnabled: (channelId) => settings.enabledChannels.includes(channelId),
    addChatChannel(channelId) { if (!settings.enabledChannels.includes(channelId)) { settings.enabledChannels.push(channelId); return true; } return false; },
    removeChatChannel(channelId) { const i = settings.enabledChannels.indexOf(channelId); if (i > -1) { settings.enabledChannels.splice(i, 1); return true; } return false; },
    listChatChannels: () => settings.enabledChannels,
    
    isListenChannel: (channelId) => settings.listeningChannels.includes(channelId),
    addListenChannel(channelId) { if (!settings.listeningChannels.includes(channelId)) { settings.listeningChannels.push(channelId); return true; } return false; },
    removeListenChannel(channelId) { const i = settings.listeningChannels.indexOf(channelId); if (i > -1) { settings.listeningChannels.splice(i, 1); return true; } return false; },
    listListenChannels: () => settings.listeningChannels,

    getWelcomeMessage: () => settings.welcomeMessage || "Welcome, {user}!",
    setWelcomeMessage(message) { settings.welcomeMessage = message; }
};

module.exports = Database;
