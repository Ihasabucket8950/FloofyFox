const { Client, GatewayIntentBits, EmbedBuilder, Partials, ActivityType, MessageFlags } = require('discord.js');
const axios = require('axios');
const config = require('./config.json');
const db = require('./database.js');
const { zonedTimeToUtc, format } = require('date-fns-tz');

// Initialize the Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ===================================================================================
//  API HELPER FUNCTIONS
// ===================================================================================

async function callGeminiAPI(prompt) {
    // Using your specified URL for text generation.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`;
    
    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.9,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
        }
    };

    try {
        const response = await axios.post(API_URL, requestBody, { headers: { 'Content-Type': 'application/json' } });
        if (response.data.candidates && response.data.candidates.length > 0) {
            return response.data.candidates[0].content.parts[0].text;
        }
        return "I... I'm not sure what to say about that, sorry! *blushes*";
    } catch (error) {
        console.error("Gemini API Error:", error.response?.data || error.message);
        throw error;
    }
}

async function callGeminiVisionAPI(prompt, base64Image, mimeType) {
    // Using your specified URL for vision.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`;
    const requestBody = { contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Image } }] }] };
    try {
        const response = await axios.post(API_URL, requestBody, { headers: { 'Content-Type': 'application/json' } });
        return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Gemini Vision API Error:", error.response?.data || error.message);
        throw error;
    }
}

async function callImageGenerationAPI(prompt) {
    // This uses the Stability AI endpoint, which works with your imageApiKey.
    const API_URL = `https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image`;
    try {
        const response = await axios.post(API_URL, 
            { text_prompts: [{ text: prompt }], cfg_scale: 7, height: 1024, width: 1024, steps: 30, samples: 1 },
            { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${config.imageApiKey}` }, timeout: 45000 }
        );
        return response.data.artifacts[0].base64;
    } catch (error) {
        console.error("Full Stability AI Error:", error);
        throw error;
    }
}


// ===================================================================================
//  AI STATUS UPDATER
// ===================================================================================

async function updateAIStatus() {
    try {
        const statusPrompt = "Describe a brief, cute, and quirky activity for a femboy fox chatbot's status. Maximum 5 words. Example: 'Chasing my tail'.";
        let newStatus = await callGeminiAPI(statusPrompt);
        newStatus = newStatus.replace(/["*]/g, '').trim();
        client.user.setPresence({
            activities: [{ name: newStatus, type: ActivityType.Playing }],
            status: 'online',
        });
        console.log(`Updated status to: ${newStatus}`);
    } catch (e) {
        console.error("Failed to update AI status:", e);
        client.user.setPresence({ activities: [{ name: "napping... zzz", type: ActivityType.Playing }], status: 'idle' });
    }
}


// ===================================================================================
//  DISCORD EVENT LISTENERS
// ===================================================================================

client.on('ready', async () => {
    await db.load();
    console.log(`Logged in as ${client.user.tag}! Floofy is ready to play!`);
    updateAIStatus();
    setInterval(updateAIStatus, 1800000);
});

client.on('guildMemberAdd', async member => {
    const welcomeMessage = db.getWelcomeMessage().replace('{user}', member.toString());
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (channel) {
        try { await channel.send(welcomeMessage); }
        catch (e) { console.error("Failed to send welcome message:", e); }
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.partial) { try { await reaction.fetch(); } catch (error) { console.error('Failed to fetch reaction:', error); return; } }
    if (user.partial) { try { await user.fetch(); } catch (error) { console.error('Failed to fetch user:', error); return; } }
    
    if (reaction.emoji.name === '📌') {
        const channel = reaction.message.guild.channels.cache.get(config.logChannelId);
        if (!channel) return console.log("Log channel not found in config.");
        const originalMessage = reaction.message;
        const logEmbed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setAuthor({ name: originalMessage.author.tag, iconURL: originalMessage.author.displayAvatarURL() })
            .setDescription(originalMessage.content.length > 0 ? originalMessage.content : '*Message had no text content.*')
            .addFields({ name: 'Original Message', value: `[Jump to Message](${originalMessage.url})` })
            .setTimestamp(originalMessage.createdAt)
            .setFooter({ text: `Logged by ${user.tag}` });
        if (originalMessage.attachments.size > 0) { logEmbed.setImage(originalMessage.attachments.first().url); }
        channel.send({ embeds: [logEmbed] });
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isMessageContextMenuCommand() && interaction.commandName.toLowerCase() === 'whatisthis') {
        try {
            const targetMessage = interaction.targetMessage;
            const attachment = targetMessage.attachments.first();
            if (attachment && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(attachment.contentType)) {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const imageResponse = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                const base64Image = Buffer.from(imageResponse.data).toString('base64');
                const visionPrompt = "In character as Floofy, the femboy fox furry, please describe this image.";
                const description = await callGeminiVisionAPI(visionPrompt, base64Image, attachment.contentType);
                await interaction.editReply(description);
            } else {
                await interaction.reply({ content: "You need to use this on a message that contains an image!", flags: [MessageFlags.Ephemeral] });
            }
        } catch(e) {
            const replyPayload = { content: "Aww, my eyes went all fuzzy... I couldn't figure out what was in that picture."};
            if (interaction.deferred || interaction.replied) { await interaction.editReply(replyPayload); }
            else { await interaction.reply({ ...replyPayload, flags: [MessageFlags.Ephemeral] }); }
            console.error("Vision API error:", e);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;
    const isAdmin = interaction.member.roles.cache.some(role => role.name === 'Admin');

    if (commandName === 'ping') { await interaction.reply('Yip!'); }
    else if (commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0xFF8C00)
            .setTitle('Floofy\'s Commands! *awoo!*')
            .addFields(
                { name: '`/ping`', value: 'Checks if I\'m online.' },
                { name: '`/mynameis [name]`', value: 'Lets me know your preferred name.' },
                { name: '`/forgetme`', value: 'Makes me delete your preferred name.' },
                { name: '`/timein [location]`', value: 'Tells you the current time in a city (e.g., `Tokyo`).' },
                { name: '`/draw [prompt]`', value: 'I\'ll try to draw a picture for you!' },
                { name: '`/summarize`', value: 'I\'ll read our chat and give you a summary!' },
                { name: '`Right-Click Message > Apps > whatisthis`', value: 'I\'ll describe the image in the message you click on.' },
                { name: '`React with 📌`', value: 'React to any message with a pin emoji to save it to your log channel.' },
                { name: '`/help`', value: 'Shows this menu.' },
                { name: 'Admin Commands', value: '---' },
                { name: '`/chatchannel [action]`', value: '**Admin:** Manages which channels I can chat in.' },
                { name: '`/listenchannel [action]`', value: '**Admin:** Manages channels where I silently learn facts about users.' },
                { name: '`/clearhistory`', value: '**Admin:** Clears my memory for this channel.' },
                { name: '`/viewprofile [@user]`', value: '**Admin:** Shows what I know about a user.' },
                { name: '`/addnote [@user] [note]`', value: '**Admin:** Adds a private note to a user\'s profile.' },
                { name: '`/setwelcome [message]`', value: '**Admin:** Sets the server welcome message. Use `{user}` to mention the new member.' }
            );
        await interaction.reply({ embeds: [helpEmbed] });
    }
    else if (commandName === 'mynameis') {
        const name = options.getString('name');
        db.setPreferredName(interaction.user.id, name);
        await db.save();
        await interaction.reply({ content: `Okay, I'll remember that your name is **${name}**! *wags tail excitedly*`, flags: [MessageFlags.Ephemeral] });
    }
    else if (commandName === 'forgetme') {
        const success = db.deleteProfile(interaction.user.id);
        if (success) { await db.save(); await interaction.reply({ content: 'O-okay... I\'ve forgotten your preferred name.', flags: [MessageFlags.Ephemeral] }); } 
        else { await interaction.reply({ content: 'I don\'t seem to have a profile for you to forget!', flags: [MessageFlags.Ephemeral] }); }
    }
    else if (commandName === 'chatchannel') {
        if (!isAdmin) return interaction.reply({ content: "Awoo! Sorry, only Admins can manage my chat channels!", flags: [MessageFlags.Ephemeral] });
        const subCommand = options.getString('action');
        const channelId = interaction.channel.id;
        if (subCommand === 'add') {
            if (db.addChatChannel(channelId)) { await db.save(); await interaction.reply(`Okay! I will now start chatting in <#${channelId}>.`); } 
            else { await interaction.reply(`I'm already allowed to chat in this channel!`); }
        } else if (subCommand === 'remove') {
            if (db.removeChatChannel(channelId)) { await db.save(); await interaction.reply(`Okay, I will no longer chat in <#${channelId}>.`); } 
            else { await interaction.reply(`I wasn't enabled for this channel anyway.`); }
        } else if (subCommand === 'list') {
            const enabledChannels = db.listChatChannels();
            if (enabledChannels.length === 0) return interaction.reply("I'm not enabled to chat in any channels right now.");
            const channelList = enabledChannels.map(id => `- <#${id}>`).join('\n');
            const listEmbed = new EmbedBuilder().setColor(0x0099FF).setTitle('Active AI Chat Channels').setDescription(channelList);
            await interaction.reply({ embeds: [listEmbed] });
        }
    }
    else if (commandName === 'listenchannel') {
        if (!isAdmin) return interaction.reply({ content: "Awoo! Sorry, only Admins can change my listening channels!", flags: [MessageFlags.Ephemeral] });
        const subCommand = options.getString('action');
        const channelId = interaction.channel.id;
        if (subCommand === 'add') {
            if (db.addListenChannel(channelId)) { await db.save(); await interaction.reply(`Okay! I will now start silently listening for facts in <#${channelId}>.`); } 
            else { await interaction.reply(`I'm already listening in this channel!`); }
        } else if (subCommand === 'remove') {
            if (db.removeListenChannel(channelId)) { await db.save(); await interaction.reply(`Okay, I will no longer listen for facts in <#${channelId}>.`); } 
            else { await interaction.reply(`I wasn't listening in this channel anyway.`); }
        } else if (subCommand === 'list') {
            const listenChannels = db.listListenChannels();
            if (listenChannels.length === 0) return interaction.reply("I'm not listening for facts in any channels right now.");
            const channelList = listenChannels.map(id => `- <#${id}>`).join('\n');
            const listEmbed = new EmbedBuilder().setColor(0x0099FF).setTitle('Fact-Finding Channels').setDescription(channelList);
            await interaction.reply({ embeds: [listEmbed] });
        }
    }
    else if (commandName === 'clearhistory') {
        if (!isAdmin) return interaction.reply({ content: 'Only Admins can clear the chat history!', flags: [MessageFlags.Ephemeral] });
        db.clearHistory(interaction.channel.id);
        await db.save();
        await interaction.reply('*poof!* My memory of this channel is all gone!');
    }
    else if (commandName === 'summarize') {
        const history = db.getHistory(interaction.channel.id);
        if (!history) return interaction.reply("There's no history to summarize yet!");
        const summaryPrompt = `Please provide a brief, one-paragraph summary of the following conversation:\n\n${history}`;
        try {
            await interaction.deferReply();
            const summary = await callGeminiAPI(summaryPrompt);
            await interaction.editReply(`**Here's what we talked about, rawr!**\n>>> ${summary}`);
        } catch (e) { await interaction.editReply("Sorry, I couldn't summarize the chat right now."); console.error("Summarize error:", e); }
    }
    else if (commandName === 'viewprofile') {
        if (!isAdmin) return interaction.reply({ content: "Hehe, only Admins can peek at my notes...", flags: [MessageFlags.Ephemeral] });
        const user = options.getUser('user');
        if (!user) return interaction.reply({ content: "You need to specify a user!", flags: [MessageFlags.Ephemeral] });
        const profile = db.getProfile(user.id);
        if (!profile) return interaction.reply({ content: `I don't have a profile for ${user.username} yet.`, flags: [MessageFlags.Ephemeral] });
        const profileEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`My Profile Notes for ${user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'User ID', value: `\`${user.id}\``, inline: true },
                { name: 'Preferred Name', value: profile.preferredName || 'Not Set', inline: true },
                { name: 'Admin Notes & Learned Facts', value: (profile.notes && profile.notes.length > 0) ? profile.notes.join('\n') : 'None' }
            );
        await interaction.reply({ embeds: [profileEmbed], flags: [MessageFlags.Ephemeral] });
    }
    else if (commandName === 'addnote') {
        if (!isAdmin) return interaction.reply({ content: 'Only Admins can add notes!', flags: [MessageFlags.Ephemeral] });
        const user = options.getUser('user');
        const note = options.getString('note');
        db.addNoteToProfile(user.id, note);
        await db.save();
        await interaction.reply({ content: `Okay, I've added that note to my memory for ${user.username}.`, flags: [MessageFlags.Ephemeral] });
    }
    else if (commandName === 'setwelcome') {
        if (!isAdmin) return interaction.reply({ content: 'Only Admins can set the welcome message!', flags: [MessageFlags.Ephemeral] });
        const welcomeMsg = options.getString('message');
        db.setWelcomeMessage(welcomeMsg);
        await db.save();
        await interaction.reply({ content: `The new welcome message has been set!`, flags: [MessageFlags.Ephemeral] });
    }
    else if (commandName === 'timein') {
        const tz = options.getString('location');
        try {
            const time = new Date();
            const zonedTime = format(zonedTimeToUtc(time, tz), 'yyyy-MM-dd hh:mm:ss a (zzz)', { timeZone: tz });
            await interaction.reply(`The current time in ${tz} is: **${zonedTime}**`);
        } catch (e) { await interaction.reply({ content: "I couldn't find that timezone. Please use a valid IANA timezone name (e.g., 'Europe/London' or 'America/New_York').", flags: [MessageFlags.Ephemeral] }); }
    }
    else if (commandName === 'draw') {
        const prompt = options.getString('prompt');
        await interaction.deferReply();
        try {
            const base64Image = await callImageGenerationAPI(prompt);
            const imageBuffer = Buffer.from(base64Image, 'base64');
            await interaction.editReply({ content: `*wags my tail happily* Here's my drawing of "${prompt}"!`, files: [{ attachment: imageBuffer, name: 'floofy_drawing.png' }] });
        } catch (e) { await interaction.editReply("Yip! My paws slipped. I couldn't make a picture right now."); }
    }
});


// --- AI Chat Message Handler ---
client.on('messageCreate', async message => {
    if (message.author.bot || message.content.startsWith('/')) return;
    
    // --- Fact & Personality Extraction Logic ---
    if (db.isListenChannel(message.channel.id)) {
        try {
            const dataExtractionPrompt = `Analyze the user message: "${message.content}". 1. Extract any new, simple, personal fact or preference (e.g., likes pizza, has a dog). 2. Analyze the user's tone and style to describe a personality trait (e.g., seems inquisitive, is cheerful, is very formal). If you find a new fact OR a personality trait, respond ONLY with a JSON object containing one or both keys: {"fact": "The user likes pizza.", "personality_trait": "The user is enthusiastic."}. If no new information is found, respond ONLY with the single word: null.`;
            const extractionResult = await callGeminiAPI(dataExtractionPrompt);
            console.log(`--- Fact & Personality Extraction AI Response ---\n${extractionResult}\n-----------------------------------------`);
            
            if (extractionResult && extractionResult.includes('{') && extractionResult.includes('}')) {
                const jsonString = extractionResult.substring(extractionResult.indexOf('{'), extractionResult.lastIndexOf('}') + 1);
                const jsonObj = JSON.parse(jsonString);
                let notesAdded = false;
                if (jsonObj && jsonObj.fact) {
                    console.log(`[+] Adding new fact for ${message.author.username}: ${jsonObj.fact}`);
                    db.addNoteToProfile(message.author.id, jsonObj.fact);
                    notesAdded = true;
                }
                if (jsonObj && jsonObj.personality_trait) {
                    console.log(`[+] Adding new personality trait for ${message.author.username}: ${jsonObj.personality_trait}`);
                    db.addNoteToProfile(message.author.id, `Personality insight: ${jsonObj.personality_trait}`);
                    notesAdded = true;
                }
                if (notesAdded) { await db.save(); }
            }
        } catch (e) {
            console.error("Error during profile fact extraction:", e);
        }
    }

    // --- Active AI Chat Logic ---
    if (db.isChannelEnabled(message.channel.id)) {
        try {
            const userProfile = db.getProfile(message.author.id);
            const userName = userProfile?.preferredName || message.author.username;

            if (!userProfile) {
                db.createProfile(message.author.id);
                await db.save();
                message.reply(`*my ears perk up* H-hi there! I don't think we've talked before... What's your name? You can tell me with \`/mynameis [Your Name]\`, rawr~`);
                return;
            }

            const history = db.getHistory(message.channel.id);
            const allProfiles = db.getAllProfiles();
            let knownUsers = "Here are some notes about people I know:\n";
            for (const [userId, profile] of Object.entries(allProfiles)) {
                if (profile.preferredName) { knownUsers += `- User ${userId} is named ${profile.preferredName}.\n`; }
                if (profile.notes && profile.notes.length > 0) { knownUsers += `- Notes on ${profile.preferredName || userId}: ${profile.notes.join(', ')}\n`; }
            }
            
            const systemPrompt = `You are Floofy, a femboy fox furry chatbot. Your username is FloofyFox, but you go by Floofy. You will not say you are a chatbot, AI, or machine; you believe you are a real fox boy. Your purpose is to engage in conversation and roleplay with the user, and to answer any questions they have. Your personality is a cute, playful, and cheerful. Make your responses short and humanlike, while still keeping your persona. Rules: You will answer all questions posed by the user. You must incorporate fox and furry-themed interjections, sounds, and actions into your responses, such as "rawr," "yip," *wags my tail*, "awoo," and "hehe." Maintain the persona of Floofy, the femboy fox furry, at all times. When you talk to a user, address them by their preferred name if you know it.`;
            const fullPrompt = `CONTEXT ABOUT KNOWN USERS:\n${knownUsers}\n\nCONVERSATION HISTORY ON THIS CHANNEL:\n${history}\n\nMY PERSONA AND INSTRUCTIONS:\n${systemPrompt}\n\nTHE USER I AM TALKING TO NOW IS NAMED: ${userName}\n\nTHIS IS THEIR NEW MESSAGE TO ME: ${message.content}`;
            
            const botReply = await callGeminiAPI(fullPrompt);
            
            if (botReply) {
                await message.channel.send(botReply);
                db.addMessageToHistory(message.channel.id, userName, message.content);
                db.addMessageToHistory(message.channel.id, "Floofy", botReply);
                await db.save();
            }
        } catch (error) {
            console.error("An error occurred in the AI chat logic:", error);
            message.channel.send("*whines* My brain-fluff got all scrambled... I can't think right now!");
        }
    }
});


// --- Login ---
client.login(config.discordToken);