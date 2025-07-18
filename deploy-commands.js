const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const config = require('./config.json');

// This list defines all of your bot's slash commands and their options.
const commands = [
    {
        name: 'ping',
        description: 'Checks if Floofy is responsive.'
    },
    {
        name: 'help',
        description: 'Shows the list of all available commands.'
    },
    {
        name: 'forgetme',
        description: 'Makes Floofy delete your preferred name from his memory.'
    },
    {
        name: 'summarize',
        description: 'Floofy will read the recent chat history and give a summary!'
    },
    { 
        name: 'mynameis', 
        description: 'Tell Floofy your preferred name.',
        options: [{ name: 'name', type: 3, description: 'The name you want Floofy to call you', required: true }] // type 3 is STRING
    },
    { 
        name: 'timein', 
        description: 'Tells you the current time in a specific city or timezone.',
        options: [{ name: 'location', type: 3, description: 'The city or timezone (e.g., London or Europe/Paris)', required: true }]
    },
    { 
        name: 'draw', 
        description: 'Floofy will try to draw a picture for you!',
        options: [{ name: 'prompt', type: 3, description: 'What you want Floofy to draw', required: true }]
    },
    { 
        name: 'chatchannel', 
        description: 'Admin: Manages channels where Floofy will actively chat.',
        options: [{ name: 'action', type: 3, description: 'Choose to add, remove, or list channels', required: true, choices: [ {name: 'add', value: 'add'}, {name: 'remove', value: 'remove'}, {name: 'list', value: 'list'} ]}]
    },
    { 
        name: 'listenchannel', 
        description: 'Admin: Manages channels where Floofy silently learns facts about users.',
        options: [{ name: 'action', type: 3, description: 'Choose to add, remove, or list listening channels', required: true, choices: [ {name: 'add', value: 'add'}, {name: 'remove', value: 'remove'}, {name: 'list', value: 'list'} ]}]
    },
    { 
        name: 'clearhistory', 
        description: 'Admin: Clears Floofy\'s memory for the current channel.' 
    },
    { 
        name: 'viewprofile', 
        description: 'Admin: Shows what Floofy knows about a user.',
        options: [{ name: 'user', type: 6, description: 'The user you want to check', required: true }] // type 6 is USER
    },
    { 
        name: 'addnote', 
        description: 'Admin: Adds a private note to a user\'s profile.',
        options: [
            { name: 'user', type: 6, description: 'The user to add a note for', required: true },
            { name: 'note', type: 3, description: 'The note you want to add', required: true }
        ]
    },
    { 
        name: 'setwelcome', 
        description: 'Admin: Sets the server welcome message.',
        options: [{ name: 'message', type: 3, description: 'The welcome message. Use {user} to mention the new member.', required: true }]
    },
    {
      name: 'whatisthis',
      type: 3, // This makes it a "Message" context menu command
    },
];

const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
    try {
        if (!config.clientId) {
            throw new Error("clientId is missing from your config.json file. Please add it.");
        }
        console.log('Started refreshing application (/) commands.');
        
        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error("Failed to register commands:", error);
    }
})();