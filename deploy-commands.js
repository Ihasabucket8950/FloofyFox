const { REST } = require('@discordjs/rest');
const { Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const commands = [];

// --- Standard User Commands ---
commands.push(new SlashCommandBuilder().setName('ping').setDescription('Checks if Floofy is responsive.').toJSON());
commands.push(new SlashCommandBuilder().setName('help').setDescription('Shows the list of all available commands.').toJSON());
commands.push(new SlashCommandBuilder().setName('forgetme').setDescription('Makes Floofy delete your preferred name from his memory.').toJSON());
commands.push(new SlashCommandBuilder().setName('summarize').setDescription('Floofy will read the recent chat history and give a summary!').toJSON());
commands.push(new SlashCommandBuilder().setName('mynameis').setDescription('Tell Floofy your preferred name.').addStringOption(option => option.setName('name').setDescription('The name you want Floofy to call you').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('timein').setDescription('Tells you the current time in a specific city or timezone.').addStringOption(option => option.setName('location').setDescription('The city or timezone (e.g., London or Europe/Paris)').setRequired(true)).toJSON());

// --- Leveling & Economy Commands ---
commands.push(new SlashCommandBuilder().setName('level').setDescription('Check your level, or check another user\'s level if you are an Admin.').addUserOption(option => option.setName('user').setDescription('The user whose level you want to see (optional)').setRequired(false)).toJSON());
commands.push(new SlashCommandBuilder().setName('leaderboard').setDescription('Shows the server\'s top 10 users by level.').toJSON());
commands.push(new SlashCommandBuilder().setName('balance').setDescription('Checks your server currency balance.').addUserOption(option => option.setName('user').setDescription('The user whose balance you want to see (Admin only)').setRequired(false)).toJSON());
commands.push(new SlashCommandBuilder().setName('give').setDescription('Give some of your currency to another user.').addUserOption(option => option.setName('user').setDescription('The user to give currency to.').setRequired(true)).addIntegerOption(option => option.setName('amount').setDescription('The amount to give.').setRequired(true)).toJSON());

// --- Memory Management Command ---
commands.push(new SlashCommandBuilder().setName('mymemory').setDescription('Manage the facts Floofy has learned about you.')
    .addSubcommand(sub => sub.setName('view').setDescription('View the facts and traits Floofy has learned about you.'))
    .addSubcommand(sub => sub.setName('forget').setDescription('Tell Floofy to forget a specific fact about you.').addIntegerOption(option => option.setName('number').setDescription('The number of the fact to forget.').setRequired(true)))
    .toJSON()
);

// --- Music Commands ---
commands.push(new SlashCommandBuilder().setName('play').setDescription('Plays a song or playlist from YouTube or Spotify.').addStringOption(option => option.setName('query').setDescription('A song name or URL').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('skip').setDescription('Skips the current song.').toJSON());
commands.push(new SlashCommandBuilder().setName('stop').setDescription('Stops the music and clears the queue.').toJSON());
commands.push(new SlashCommandBuilder().setName('pause').setDescription('Pauses the current song.').toJSON());
commands.push(new SlashCommandBuilder().setName('resume').setDescription('Resumes the paused song.').toJSON());
commands.push(new SlashCommandBuilder().setName('queue').setDescription('Shows the current music queue.').toJSON());
commands.push(new SlashCommandBuilder().setName('disconnect').setDescription('Disconnects the bot from the voice channel.').toJSON());

// --- Admin Commands ---
commands.push(new SlashCommandBuilder().setName('clearhistory').setDescription('Admin: Clears Floofy\'s memory for the current channel.').toJSON());
commands.push(new SlashCommandBuilder().setName('viewprofile').setDescription('Admin: Shows what Floofy knows about a user.').addUserOption(option => option.setName('user').setDescription('The user you want to check').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('addnote').setDescription('Admin: Adds a private note to a user\'s profile.').addUserOption(option => option.setName('user').setDescription('The user to add a note for').setRequired(true)).addStringOption(option => option.setName('note').setDescription('The note you want to add').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('setwelcome').setDescription('Admin: Sets the server welcome message.').addStringOption(option => option.setName('message').setDescription('The welcome message. Use {user} to mention the new member.').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('chatchannel').setDescription('Admin: Manages channels where Floofy will actively chat.').addStringOption(option => option.setName('action').setDescription('Choose action').setRequired(true).addChoices({name: 'add', value: 'add'}, {name: 'remove', value: 'remove'}, {name: 'list', value: 'list'})).toJSON());
commands.push(new SlashCommandBuilder().setName('listenchannel').setDescription('Admin: Manages channels where Floofy silently learns facts.').addStringOption(option => option.setName('action').setDescription('Choose action').setRequired(true).addChoices({name: 'add', value: 'add'}, {name: 'remove', value: 'remove'}, {name: 'list', value: 'list'})).toJSON());
commands.push(new SlashCommandBuilder().setName('setwelcomechannel').setDescription('Admin: Sets the channel for welcome messages.').addChannelOption(option => option.setName('channel').setDescription('The channel to send welcomes to').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('setlogchannel').setDescription('Admin: Sets the channel for message logging.').addChannelOption(option => option.setName('channel').setDescription('The channel to send message logs to').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('setquestchannel').setDescription('Admin: Sets the channel for AI-generated quests.').addChannelOption(option => option.setName('channel').setDescription('The channel for quests.').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('setcurrencyname').setDescription('Admin: Sets the name of the server\'s currency.').addStringOption(option => option.setName('name').setDescription('The new name for the currency (e.g., "Gold").').setRequired(true)).toJSON());
commands.push(new SlashCommandBuilder().setName('leveladmin').setDescription('Admin: Manage user levels.').addSubcommand(sub => sub.setName('set').setDescription('Set a user\'s level.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('level').setRequired(true).setDescription('The level.')))
    .addSubcommand(sub => sub.setName('add').setDescription('Add levels to a user.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('amount').setRequired(true).setDescription('Levels to add.')))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove levels from a user.').addUserOption(opt => opt.setName('user').setRequired(true).setDescription('The user.')).addIntegerOption(opt => opt.setName('amount').setRequired(true).setDescription('Levels to remove.')))
    .toJSON());
commands.push(new SlashCommandBuilder().setName('customcommand').setDescription('Admin: Manage simple custom commands.')
    .addSubcommand(sub => sub.setName('add').setDescription('Add or update a custom command.').addStringOption(opt => opt.setName('command').setDescription('The name of the command.').setRequired(true)).addStringOption(opt => opt.setName('response').setDescription('What the bot should say.').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a custom command.').addStringOption(opt => opt.setName('command').setDescription('The name of the command to remove.').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List all custom commands.'))
    .toJSON());

// Context Menu Command (Right-Click App)
commands.push({ name: 'whatisthis', type: 3 });

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
