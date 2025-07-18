const { REST } = require('@discordjs/rest');
const { Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config.json');

// This list defines all your bot's slash commands directly.
const commands = [
    new SlashCommandBuilder().setName('ping').setDescription('Checks if Floofy is responsive.'),
    new SlashCommandBuilder().setName('help').setDescription('Shows the list of all available commands.'),
    new SlashCommandBuilder().setName('forgetme').setDescription('Makes Floofy delete your preferred name from his memory.'),
    new SlashCommandBuilder().setName('summarize').setDescription('Floofy will read the recent chat history and give a summary!'),
    new SlashCommandBuilder().setName('mynameis').setDescription('Tell Floofy your preferred name.')
        .addStringOption(option => option.setName('name').setDescription('The name you want Floofy to call you').setRequired(true)),
    new SlashCommandBuilder().setName('timein').setDescription('Tells you the current time in a specific city or timezone.')
        .addStringOption(option => option.setName('location').setDescription('The city or timezone (e.g., London or Europe/Paris)').setRequired(true)),
    new SlashCommandBuilder().setName('chatchannel').setDescription('Admin: Manages channels where Floofy will actively chat.')
        .addStringOption(option => option.setName('action').setDescription('Choose action').setRequired(true).addChoices({name: 'add', value: 'add'}, {name: 'remove', value: 'remove'}, {name: 'list', value: 'list'})),
    new SlashCommandBuilder().setName('listenchannel').setDescription('Admin: Manages channels where Floofy silently learns facts.')
        .addStringOption(option => option.setName('action').setDescription('Choose action').setRequired(true).addChoices({name: 'add', value: 'add'}, {name: 'remove', value: 'remove'}, {name: 'list', value: 'list'})),
    new SlashCommandBuilder().setName('clearhistory').setDescription('Admin: Clears Floofy\'s memory for the current channel.'),
    new SlashCommandBuilder().setName('viewprofile').setDescription('Admin: Shows what Floofy knows about a user.')
        .addUserOption(option => option.setName('user').setDescription('The user you want to check').setRequired(true)),
    new SlashCommandBuilder().setName('addnote').setDescription('Admin: Adds a private note to a user\'s profile.')
        .addUserOption(option => option.setName('user').setDescription('The user to add a note for').setRequired(true))
        .addStringOption(option => option.setName('note').setDescription('The note you want to add').setRequired(true)),
    new SlashCommandBuilder().setName('setwelcome').setDescription('Admin: Sets the server welcome message.')
        .addStringOption(option => option.setName('message').setDescription('The welcome message. Use {user} to mention.').setRequired(true)),
    new SlashCommandBuilder().setName('setwelcomechannel').setDescription('Admin: Sets the channel for welcome messages.')
        .addChannelOption(option => option.setName('channel').setDescription('The channel to send welcomes to').setRequired(true)),
    new SlashCommandBuilder().setName('setlogchannel').setDescription('Admin: Sets the channel for message logging.')
        .addChannelOption(option => option.setName('channel').setDescription('The channel to send message logs to').setRequired(true)),
    new SlashCommandBuilder().setName('level').setDescription('Check your level, or an admin can check another user\'s.')
        .addUserOption(option => option.setName('user').setDescription('The user whose level you want to see (optional)').setRequired(false)),
    new SlashCommandBuilder().setName('leveladmin').setDescription('Admin: Manage user levels.')
        .addSubcommand(sub => sub.setName('set').setDescription('Set a user\'s level.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('level').setRequired(true).setDescription('The level.')))
        .addSubcommand(sub => sub.setName('add').setDescription('Add levels to a user.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('amount').setRequired(true).setDescription('Levels to add.')))
        .addSubcommand(sub => sub.setName('remove').setDescription('Remove levels from a user.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('amount').setRequired(true).setDescription('Levels to remove.'))),
    new SlashCommandBuilder().setName('leaderboard').setDescription('Shows the server\'s top 10 users by level.'),
    new SlashCommandBuilder().setName('privacy').setDescription('Provides a link to the bot\'s privacy policy.'),
    new SlashCommandBuilder().setName('tos').setDescription('Provides a link to the bot\'s terms of service.'),
    new SlashCommandBuilder().setName('announce').setDescription('Admin: Sends an announcement to a specific channel.')
        .addChannelOption(opt => opt.setName('channel').setDescription('The channel to send the message to').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('The message to send').setRequired(true)),
    new SlashCommandBuilder().setName('purge').setDescription('Admin: Deletes a specified number of recent messages.')
        .addIntegerOption(opt => opt.setName('amount').setDescription('The number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),
    // Context Menu Command (Right-Click App)
    { name: 'whatisthis', type: 3 }
].map(command => command.toJSON ? command.toJSON() : command);


const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} global application (/) commands.`);
        
        const data = await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
