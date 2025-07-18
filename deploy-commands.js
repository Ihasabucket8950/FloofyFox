const { REST } = require('@discordjs/rest');
const { Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

// Add commands that don't have their own files
commands.push({ name: 'ping', description: 'Checks if Floofy is responsive.' });
commands.push({ name: 'help', description: 'Shows the list of all available commands.' });
commands.push({ name: 'forgetme', description: 'Makes Floofy delete your preferred name from his memory.' });
commands.push({ name: 'summarize', description: 'Floofy will read the recent chat history and give a summary!' });
commands.push({ name: 'mynameis', description: 'Tell Floofy your preferred name.', options: [{ name: 'name', type: 3, description: 'The name you want Floofy to call you', required: true }] });
commands.push({ name: 'timein', description: 'Tells you the current time in a specific city or timezone.', options: [{ name: 'location', type: 3, description: 'The city or timezone (e.g., London)', required: true }] });
commands.push({ name: 'chatchannel', description: 'Admin: Manages channels where Floofy will actively chat.', options: [{ name: 'action', type: 3, description: 'Choose action', required: true, choices: [ {name: 'add', value: 'add'}, {name: 'remove', value: 'remove'}, {name: 'list', value: 'list'} ]}] });
commands.push({ name: 'listenchannel', description: 'Admin: Manages channels where Floofy silently learns facts.', options: [{ name: 'action', type: 3, description: 'Choose action', required: true, choices: [ {name: 'add', value: 'add'}, {name: 'remove', value: 'remove'}, {name: 'list', value: 'list'} ]}] });
commands.push({ name: 'clearhistory', description: 'Admin: Clears Floofy\'s memory for the current channel.' });
commands.push({ name: 'viewprofile', description: 'Admin: Shows what Floofy knows about a user.', options: [{ name: 'user', type: 6, description: 'The user you want to check', required: true }] });
commands.push({ name: 'addnote', description: 'Admin: Adds a private note to a user\'s profile.', options: [ { name: 'user', type: 6, description: 'The user to add a note for', required: true }, { name: 'note', type: 3, description: 'The note you want to add', required: true } ] });
commands.push({ name: 'setwelcome', description: 'Admin: Sets the server welcome message.', options: [{ name: 'message', type: 3, description: 'The welcome message. Use {user} to mention.', required: true }] });
commands.push({ name: 'whatisthis', type: 3 });
commands.push({ name: 'setwelcomechannel', description: 'Admin: Sets the channel for welcome messages.', options: [{ name: 'channel', type: 7, description: 'The channel to send welcomes to', required: true }] });
commands.push({ name: 'setlogchannel', description: 'Admin: Sets the channel for message logging.', options: [{ name: 'channel', type: 7, description: 'The channel to send message logs to', required: true }] });
commands.push({ name: 'level', description: 'Check your level, or an admin can check another user\'s.', options: [{ name: 'user', type: 6, description: 'The user whose level you want to see (optional)', required: false }] });
commands.push( new SlashCommandBuilder().setName('leveladmin').setDescription('Admin: Manage user levels.').addSubcommand(sub => sub.setName('set').setDescription('Set a user\'s level.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('level').setRequired(true).setDescription('The level.'))).addSubcommand(sub => sub.setName('add').setDescription('Add levels to a user.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('amount').setRequired(true).setDescription('Levels to add.'))).addSubcommand(sub => sub.setName('remove').setDescription('Remove levels from a user.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('amount').setRequired(true).setDescription('Levels to remove.'))).toJSON());
commands.push({ name: 'leaderboard', description: 'Shows the server\'s top 10 users by level.' });
commands.push({ name: 'privacy', description: 'Provides a link to the bot\'s privacy policy.' });
commands.push({ name: 'tos', description: 'Provides a link to the bot\'s terms of service.' });
// --- ADDED NEW COMMANDS ---
commands.push(new SlashCommandBuilder().setName('announce').setDescription('Admin: Sends an announcement to a specific channel.').addChannelOption(opt => opt.setName('channel').setDescription('The channel to send the message to').setRequired(true)).addStringOption(opt => opt.setName('message').setDescription('The message to send').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('purge').setDescription('Admin: Deletes a specified number of recent messages.').addIntegerOption(opt => opt.setName('amount').setDescription('The number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)).toJSON());


const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} global application (/) commands.`);
        const data = await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );
        console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
    } catch (error) { console.error(error); }
})();
