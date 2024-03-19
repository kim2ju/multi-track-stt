const Eris = require("eris");
const fs = require("fs");
const wavConverter = require("wav-converter");
const path = require("path");
const ChannelData = require('./ChannelData');
const doSTT = require('./stt').default;
const doTranslation = require('./translate').default;
require('dotenv').config();


const bot = new Eris(process.env.DISCORD_BOT_TOKEN, {
    getAllUsers: true,
    intents: 98303	
});

const Constants = Eris.Constants;

const SENTENCE_INTERVAL = 1500; 

const channelDataMap = new Map();

function getChannelData(channelID) {
    let channelData = channelDataMap.get(channelID);
    if (!channelData) {
        channelData = new ChannelData(channelID);
        channelDataMap.set(channelID, channelData);
    }
    return channelData;
}

async function processChannelData(channelData) {
    const { userVoiceDataMap, memberMap, channelGame, ttsQueue } = channelData;
    const currentTime = Date.now();
    const samplerate = 48000;

    for (const [userID, userData] of userVoiceDataMap) {
        const elapsedTimeSinceLastSTT = currentTime - userData.startTime;

        if (currentTime - userData.lastTime >= SENTENCE_INTERVAL || elapsedTimeSinceLastSTT >= 15000) {
            const { filename } = userData;
            const inputFilePath = `./outputs/${filename}.pcm`;
            const outputFilePath = `./outputs/${filename}-mono.pcm`;

            const stereoBuffer = fs.readFileSync(inputFilePath);
            const monoBuffer = stereoToMono(stereoBuffer);

            fs.writeFileSync(outputFilePath, monoBuffer);

            const memberData = memberMap.get(userID);
            ttsQueue.push({ filename, text: "", name: memberData.name, language: memberData.language.split("-")[0], finish: false });

            doSTT(filename, memberData.language, samplerate, channelGame)
                .then(({ filename, text }) => {
                    const fileIndex = ttsQueue.findIndex(item => item.filename === filename);
                    ttsQueue[fileIndex].text = text;
                    ttsQueue[fileIndex].finish = true;
                })
                .catch(error => console.error(error));

            userVoiceDataMap.delete(userID);
            fs.unlink(inputFilePath, () => {});
        }
    }

    if (ttsQueue.length > 0 && ttsQueue[0].finish) {
        const { filename, text, name, language } = ttsQueue.shift();
        
        if (text !== "") {
            const translationPromises = ['de', 'ko', 'en'].map(targetLanguage => {
                return (language !== targetLanguage) ? doTranslation(text, language, targetLanguage, channelGame) : { TargetLanguageCode: targetLanguage, TranslatedText: text };
            });

            try {
                const results = await Promise.all(translationPromises);
                results.forEach(result => {
                    console.log(result.TargetLanguageCode, result.TranslatedText);
                    memberMap.forEach(user => {
                        if (user.language.split("-")[0] === result.TargetLanguageCode && name !== user.name) {
                            bot.getDMChannel(user.id).then(channel => {
                                channel.createMessage(`${name} : ${result.TranslatedText}`);
                            });
                        }
                    });
                });
            } catch (error) {
                console.error(error);
            }
        }
    }
}


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

//code for 48kHz audio  
bot.on("ready", () => {
    console.log("Ready!");
    setInterval(() => {
        channelDataMap.forEach(channelData => {
            processChannelData(channelData);
        });
    }, SENTENCE_INTERVAL);
});


bot.on("messageCreate", (msg) => {
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
                            custom_id: "de-DE",
                            label: "Deutsch",
                            disabled: false
                        }
                    ]
                }
            ]
        }); 
    } else if (msg.content === "!game") {
        bot.createMessage(msg.channel.id, {
            content: "Choose your game!",
            components: [
                {
                    type: Constants.ComponentTypes.ACTION_ROW,
                    components: [
                        {   type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "LOL",
                            label: "League of Legends",
                            disabled: false
                        },
                        {
                            type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "overwatch",
                            label: "Overwatch",
                            disabled: false
                        },
                        {
                            type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "AmongUs",
                            label: "Among Us",
                            disabled: false
                        },
                        {
                            type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "pubg",
                            label: "Battlegrounds",
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

                const channelData = new ChannelData(msg.member.voiceState.channelID);
                channelDataMap.set(msg.member.voiceState.channelID, channelData);

                const channel = channelDataMap.get(msg.member.voiceState.channelID);
                const userVoiceDataMap = channel.userVoiceDataMap;

                bot.getChannel(msg.member.voiceState.channelID).voiceMembers.forEach((member) => {
                    if (!member.bot)
                        channelData.addMember(member.id, member.username);
                })

                const voiceReceiver = voiceConnection.receive("pcm")
                voiceReceiver.on("data", (voiceData, userID, timestamp, sequence) => {
                    if (userID) {
                        const currentTime = Date.now();
                        if (!userVoiceDataMap.has(userID)) {
                            userVoiceDataMap.set(userID, {
                                streams: fs.createWriteStream(`./outputs/${userID}-${currentTime}.pcm`),
                                lastTime: currentTime,
                                startTime: currentTime,
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
            channelDataMap.delete(msg.member.voiceState.channelID);
            bot.leaveVoiceChannel(msg.member.voiceState.channelID)
            bot.createMessage(msg.channel.id, "bye");
        }
    } else if (msg.content == "!getLanguageSettings") {
        let languageSettings = "";
        const channel = channelDataMap.get(msg.member.voiceState.channelID);
        if (channel === undefined) {
            bot.createMessage(msg.channel.id, "Bot is not in a voice channel.");
            return;
        }
        const memberMap = channel.memberMap;
        memberMap.forEach((user) => {
            languageSettings += `${user.name} : ${user.language}\n`;
        });
        
        if (languageSettings === "") {
            bot.createMessage(msg.channel.id, "No user has set the language yet.");
        } else {
            bot.createMessage(msg.channel.id, languageSettings);
        }
    } else if (msg.content == "!getGameSettings") {
        const channel = channelDataMap.get(msg.member.voiceState.channelID);
        if (channel === undefined) {
            bot.createMessage(msg.channel.id, "Bot is not in a voice channel.");
            return;
        }
        const channelGame = channel.channelGame;
        bot.createMessage(msg.channel.id, `The game is set to ${channelGame}.`);
    }
});

bot.on("voiceChannelJoin", (member, newChannel) => {
    const channel = channelDataMap.get(member.voiceState.channelID);
    if (channel === undefined) {
        return null;
    }

    if (!member.bot)
        channel.addMember(member.id, member.username);
});

bot.on("voiceChannelLeave", (member, newChannel) => {
    const channel = channelDataMap.get(member.voiceState.channelID);
    if (channel === undefined) {
        return null;
    }

    if (!member.bot)
        channel.removeMember(member.id);
});

bot.on("interactionCreate", (interaction) => {
    const channel = channelDataMap.get(interaction.member.voiceState.channelID);
    if (channel === undefined) {
        return interaction.createMessage("Bot is not in a voice channel.");
    }
    const memberMap = channel.memberMap;
    if(interaction instanceof Eris.ComponentInteraction) { 
        if (["LOL", "overwatch", "AmongUs", "pubg"].includes(interaction.data.custom_id)) {
            channel.channelGame = interaction.data.custom_id;
            return interaction.createMessage({
                content: `${interaction.data.custom_id} is set.`
            })
        } else {
            const userId = interaction.member.user.id;
            const userLanguage = interaction.data.custom_id;

            if (memberMap.has(userId)) {
                const user = memberMap.get(userId);
                user.language = userLanguage; 
                memberMap.set(userId, user);
            } else {
                return interaction.createMessage({
                        content: "Please select a language after the bot enters the voice channel."
                })
            }

            if(userLanguage === "ko-KR") {
                return interaction.createMessage({
                        content: `<@${userId}> 한국어로 설정되었습니다.` 
                })
            } else if (userLanguage === "en-US") {
                return interaction.createMessage({
                    content: `<@${userId}> English is set.`    
                })
            } else if (userLanguage === "de-DE") {
                return interaction.createMessage({
                    content: `<@${userId}> Auf Deutsch eingestellt.`
                })
            }
        }
    }
});

bot.connect();
