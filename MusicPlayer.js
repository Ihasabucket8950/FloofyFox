const {
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    NoSubscriberBehavior,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const play = require('play-dl');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database.js'); // We need the database to find the UI message

class MusicPlayer {
    constructor() {
        this.queues = new Map();
    }

    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            const player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Stop },
            });

            // When the player finishes a song, play the next one
            player.on(AudioPlayerStatus.Idle, () => {
                const queue = this.getQueue(guildId);
                if (!queue.loop) {
                    queue.songs.shift();
                }
                this.playNext(guildId);
            });

            const queue = {
                textChannel: null,
                voiceChannel: null,
                connection: null,
                player: player,
                songs: [],
                playing: false,
                paused: false,
                loop: false,
                uiMessage: null
            };

            this.queues.set(guildId, queue);
        }
        return this.queues.get(guildId);
    }

    async play(interaction) {
        const query = interaction.options.getString('query');
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to play music!', ephemeral: true });
        }
        
        await interaction.deferReply();

        const queue = this.getQueue(interaction.guild.id);
        queue.textChannel = interaction.channel;
        queue.voiceChannel = voiceChannel;

        try {
            if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
                queue.connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                queue.connection.subscribe(queue.player);
            }
        } catch (error) {
            console.error(error);
            this.queues.delete(interaction.guild.id);
            return interaction.editReply('Could not join your voice channel!');
        }

        const searchResult = await play.search(query, { limit: 1 });
        if (searchResult.length === 0) {
            return interaction.editReply(`Sorry, I couldn't find any results for "${query}"`);
        }

        let songsToAdd = [];
        const playlist = searchResult[0].playlist;
        if (playlist) {
            const playlistVideos = await playlist.all_videos();
            songsToAdd = playlistVideos.map(video => ({
                title: video.title,
                url: video.url,
                duration: video.durationRaw,
                thumbnail: video.thumbnails[0]?.url,
                user: interaction.user.tag
            }));
        } else {
            const video = searchResult[0];
            songsToAdd.push({
                title: video.title,
                url: video.url,
                duration: video.durationRaw,
                thumbnail: video.thumbnails[0]?.url,
                user: interaction.user.tag
            });
        }
        
        queue.songs.push(...songsToAdd);
        
        const replyMessage = playlist 
            ? `🎵 Added **${songsToAdd.length}** songs from the playlist **${playlist.title}** to the queue!`
            : `🎵 Added **${songsToAdd[0].title}** to the queue!`;

        await interaction.editReply(replyMessage);

        if (!queue.playing) {
            this.playNext(interaction.guild.id);
        } else {
            this.updateUi(interaction.guild.id);
        }
    }

    async playNext(guildId) {
        const queue = this.getQueue(guildId);
        if (queue.songs.length === 0) {
            queue.playing = false;
            this.updateUi(guildId);
            // Set a timer to disconnect after 5 minutes of inactivity
            setTimeout(() => {
                const currentQueue = this.queues.get(guildId);
                if (currentQueue && !currentQueue.playing && currentQueue.connection) {
                    currentQueue.connection.destroy();
                    this.queues.delete(guildId);
                }
            }, 300000);
            return;
        }

        queue.playing = true;
        queue.paused = false;
        const song = queue.songs[0];

        try {
            const stream = await play.stream(song.url);
            const resource = createAudioResource(stream.stream, { inputType: stream.type });
            queue.player.play(resource);
            this.updateUi(guildId);
        } catch (error) {
            console.error("Error playing song:", error);
            queue.textChannel.send(`Error playing **${song.title}**. Skipping...`);
            queue.songs.shift();
            this.playNext(guildId);
        }
    }

    pauseOrResume(interaction) {
        const queue = this.getQueue(interaction.guild.id);
        if (queue.songs.length === 0) return interaction.reply({ content: 'There is nothing to pause or resume!', ephemeral: true });

        if (queue.paused) {
            queue.player.unpause();
            queue.paused = false;
            interaction.reply({ content: '▶️ Resumed!', ephemeral: true });
        } else {
            queue.player.pause();
            queue.paused = true;
            interaction.reply({ content: '⏸️ Paused!', ephemeral: true });
        }
        this.updateUi(interaction.guild.id);
    }

    skip(interaction) {
        const queue = this.getQueue(interaction.guild.id);
        if (queue.songs.length === 0) return interaction.reply({ content: 'There are no songs to skip!', ephemeral: true });
        queue.player.stop(); // This triggers the 'idle' event, which plays the next song
        interaction.reply({ content: '⏭️ Skipped!', ephemeral: true });
    }

    stop(interaction) {
        const queue = this.getQueue(interaction.guild.id);
        if (!queue.connection) return interaction.reply({ content: 'I\'m not in a voice channel!', ephemeral: true });
        queue.songs = [];
        queue.player.stop();
        // Disconnecting is handled by the voiceStateUpdate event
        interaction.reply({ content: '⏹️ Stopped the music and cleared the queue!', ephemeral: true });
    }

    disconnect(interaction) {
        const queue = this.getQueue(interaction.guild.id);
        if (!queue.connection) return interaction.reply({ content: 'I\'m not in a voice channel!', ephemeral: true });
        queue.songs = [];
        queue.player.stop();
        queue.connection.destroy();
        this.queues.delete(interaction.guild.id);
        interaction.reply({ content: '👋 Disconnected!', ephemeral: true });
    }
    
    // --- Persistent UI Methods ---

    createUiEmbed(queue) {
        const song = queue?.songs[0];
        const embed = new EmbedBuilder();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_pauseplay').setLabel('▶️ / ⏸️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('music_skip').setLabel('⏭️ Skip').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('music_queue').setLabel('📜 Queue').setStyle(ButtonStyle.Secondary)
        );

        if (!queue || !song) {
            embed.setTitle('No song playing')
                 .setDescription('Use `/play` or paste a link in this channel to start!')
                 .setImage('https://media.tenor.com/D-s_hJ_l-9EAAAAC/fox-femboy.gif'); // A default image
            return { embeds: [embed], components: [row] };
        }

        embed.setTitle('Now Playing')
             .setDescription(`[${song.title}](${song.url})`)
             .setThumbnail(song.thumbnail)
             .addFields(
                 { name: 'Duration', value: song.duration, inline: true },
                 { name: 'Requested by', value: song.user, inline: true }
             )
             .setFooter({ text: `${queue.songs.length - 1} songs left in queue` });

        return { embeds: [embed], components: [row] };
    }

    async initUi(guild) {
        const musicChannelId = db.getMusicChannelId(guild.id);
        if (!musicChannelId) return;

        const channel = guild.channels.cache.get(musicChannelId);
        if (!channel) return;

        // Delete old messages from the bot
        const messages = await channel.messages.fetch({ limit: 10 });
        messages.filter(msg => msg.author.id === guild.client.user.id).forEach(msg => msg.delete().catch(() => {}));
        
        const queue = this.getQueue(guild.id);
        const uiPayload = this.createUiEmbed(queue);
        const uiMessage = await channel.send(uiPayload);
        
        queue.uiMessage = uiMessage;
        db.setMusicUiMessageId(guild.id, uiMessage.id);
        await db.save();
    }

    async updateUi(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue || !queue.uiMessage) return;
        
        try {
            const uiPayload = this.createUiEmbed(queue);
            await queue.uiMessage.edit(uiPayload);
        } catch (error) {
            // This can happen if the message was deleted. Re-initialize.
            if (error.code === 10008) { // Unknown Message
                console.log(`UI message for guild ${guildId} not found, re-initializing.`);
                this.initUi(queue.uiMessage.guild);
            } else {
                console.error("Failed to update UI:", error);
            }
        }
    }
}

module.exports = MusicPlayer;
