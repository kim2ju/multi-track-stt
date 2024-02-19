const Eris = require("eris");
const fs = require("fs");
const wavConverter = require("wav-converter");
const path = require("path");
const doSTT = require('./stt').default;
const doTTS = require('./tts').default;

require('dotenv').config();


const bot = new Eris(process.env.DISCORD_BOT_TOKEN, {
    getAllUsers: true,
    intents: 98303	
});

const Constants = Eris.Constants;

const SENTENCE_INTERVAL = 5000;

const userVoiceDataMap = new Map();
const memberMap = new Map();

function stereoToMono(stereoBuffer) {
    const numChannels = 2;
    const bytesPerSample = 2;

    const totalSamples = stereoBuffer.length / (numChannels * bytesPerSample);

    const monoBuffer = Buffer.alloc(totalSamples * bytesPerSample);

    for (let i = 0; i < totalSamples; i++) {
        const leftIndex = i * numChannels * bytesPerSample;
        const rightIndex = leftIndex + bytesPerSample;

        const leftValue = stereoBuffer.readInt16LE(leftIndex);
        const rightValue = stereoBuffer.readInt16LE(rightIndex);

        const averageValue = Math.round((leftValue + rightValue) / 2);

        monoBuffer.writeInt16LE(averageValue, i * bytesPerSample);
    }

    return monoBuffer;
}

function playTTSInVoiceChannel(voiceChannelId, filePath) {
    bot.joinVoiceChannel(voiceChannelId).then((voiceConnection) => {
        voiceConnection.play(filePath, {format: "mp3"}); 
        voiceConnection.on("end", () => {
            voiceConnection.disconnect(); // Leave the channel after playing the speech
            fs.unlink(filePath, (err) => { // Optionally delete the file after playing
                if (err) console.error("Error deleting TTS file:", err);
            });
        });
    }).catch((err) => {
        console.error("Error joining voice channel:", err);
    });
}


  
bot.on("ready", () => {
    console.log("Ready!");

    setInterval(() => {
        userVoiceDataMap.forEach((userData, userID) => {
            const currentTime = Date.now();

            if (currentTime - userData.lastTime >= SENTENCE_INTERVAL) {
                const filename = userData.filename;

                const inputFilePath = `./outputs/${filename}.pcm`;
                const outputFilePath = `./outputs/${filename}-mono.pcm`;

                const stereoBuffer = fs.readFileSync(inputFilePath);

                const monoBuffer = stereoToMono(stereoBuffer);

                fs.writeFileSync(outputFilePath, monoBuffer);
                const pcmData = fs.readFileSync(`./outputs/${filename}-mono.pcm`)
                const wavData = wavConverter.encodeWav(pcmData, {
                    numChannels: 1,
                    sampleRate: 48000,
                    byteRate: 16
                });
    
                fs.writeFileSync(`./outputs/${filename}.wav`, wavData);

                const memberData = memberMap.get(userID);
                doSTT(`./outputs/${filename}.wav`, memberData.language);

                userVoiceDataMap.delete(userID);
                fs.unlink(`./outputs/${filename}.pcm`, () => {});
                fs.unlink(`./outputs/${filename}-mono.pcm`, () => {});
            }
        });
    }, SENTENCE_INTERVAL);
});

bot.on("messageCreate", async (msg) => {
    if(msg.content === "!ping") {
        bot.createMessage(msg.channel.id, "Pong!");
    } else if (msg.content == "!language"){
        bot.createMessage(msg.channel.id, {
            content: "Choose your language!",
            components: [
                {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: [
                        {   type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "ko-KR",
                            label: "한국어",
                            disabled: false
                        },
                        {
                            type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "en-US",
                            label: "English",
                            disabled: false
                        },
                        {
                            type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "tr-TR",
                            label: "Türkçe",
                            disabled: false
                        }
                    ]
                }
            ]
        }); 
    } else if (msg.content === "!join") {
        if (!msg.member.voiceState.channelID) {
            bot.createMessage(msg.channel.id, "You are not in a voice channel.");
            return;
        } else {
            bot.joinVoiceChannel(msg.member.voiceState.channelID).catch((err) => {
                bot.createMessage(msg.channel.id, "Error joining voice channel: " + err.message);
                console.log(err);
            }).then((voiceConnection) => {
                bot.createMessage(msg.channel.id, "hello");
                bot.getChannel(msg.member.voiceState.channelID).voiceMembers.forEach((member) => {
                    if (!memberMap.has(member.id) && !member.bot)
                        memberMap.set(member.id, {
                        id: member.id,
                        name: member.username,
                        language: "en-US"
                    });
                })
                const voiceReceiver = voiceConnection.receive("pcm")
                voiceReceiver.on("data", (voiceData, userID, timestamp, sequence) => {
                    if (userID) {
                        const currentTime = Date.now();
                        if (!userVoiceDataMap.has(userID)) {
                            userVoiceDataMap.set(userID, {
                                streams: fs.createWriteStream(`./outputs/${userID}-${currentTime}.pcm`),
                                lastTime: currentTime,
                                filename: `${userID}-${currentTime}`
                            });
                        }
                        const userVoiceData = userVoiceDataMap.get(userID);
                        userVoiceData.streams.write(voiceData);
                        userVoiceData.lastTime = currentTime;
                    }
                })
            })
        } 
    } else if (msg.content === "!leave") {
        if (!msg.member.voiceState.channelID) {
            bot.createMessage(msg.channel.id, "You are not in a voice channel.");
            return;
        } else {
            bot.leaveVoiceChannel(msg.member.voiceState.channelID)
            bot.createMessage(msg.channel.id, "bye");
        }
    } else if (msg.content == "!getLanguageSettings") {
        let languageSettings = "";
        memberMap.forEach((user) => {
            languageSettings += `${user.name} : ${user.language}\n`;
        });
        
        if (languageSettings === "") {
            bot.createMessage(msg.channel.id, "No user has set the language yet.");
        } else {
            bot.createMessage(msg.channel.id, languageSettings);
        }
        
    }

    if (msg.content.startsWith("!say ")) {
        const text = msg.content.slice(5); // Remove "!say " to get the text
        if (!msg.member.voiceState.channelID) {
            bot.createMessage(msg.channel.id, "You need to be in a voice channel to use this command.");
            return;
        }
        
        try {
            const voiceChannelId = msg.member.voiceState.channelID;
            const languageCode = memberMap.has(msg.author.id) ? memberMap.get(msg.author.id).language : "en-US";
            const voiceId = "Joanna"; // Example: Set this based on languageCode or user preference

            const filePath = await doTTS(text, languageCode, voiceId);
            // Play the generated speech file in the user's voice channel
            playTTSInVoiceChannel(voiceChannelId, filePath);
        } catch (error) {
            console.error("Error generating speech:", error);
            bot.createMessage(msg.channel.id, "There was an error generating the speech.");
        }
    }
});

bot.on("voiceChannelJoin", (member, newChannel) => {
     if (!memberMap.has(member.id) && !member.bot)
        memberMap.set(member.id, {
            id: member.id,
            name: member.username,
            language: "en-US" //default language is English
        });
});

bot.on("voiceChannelLeave", (member, newChannel) => {
    if (memberMap.has(member.id) && !member.bot)
       memberMap.delete(member.id);
});

bot.on("interactionCreate", (interaction) => {
    if(interaction instanceof Eris.ComponentInteraction) { 
        const userId = interaction.member.user.id;
        const userLanguage = interaction.data.custom_id;

        if (memberMap.has(userId)) {
            const user = memberMap.get(userId);
            user.language = userLanguage; 
            memberMap.set(userId, user);
        } else {
            memberMap.set(userId, {
                id: userId,
                name: interaction.member.user.username,
                language: userLanguage
            });
        }

        if(userLanguage === "ko-KR") {
            return interaction.createMessage({
                    content: `<@${userId}> 한국어로 설정되었습니다.` 
            })
        } else if (userLanguage === "en-US") {
            return interaction.createMessage({
                content: `<@${userId}> English is set.`    
            })
        } else if (userLanguage === "tr-TR") {
            return interaction.createMessage({
                content: `<@${userId}> Türkçe olarak ayarlandı.`
            })
        }
    }
});

bot.connect();
