import { channel } from "diagnostics_channel";

const Eris = require("eris");
const fs = require("fs");
const wavConverter = require("wav-converter");
const path = require("path");
const doSTT = require('./stt').default;
const doTranslation = require('./translate').default;
const doTTS = require('./tts').default;

require('dotenv').config();


const bot = new Eris(process.env.DISCORD_BOT_TOKEN, {
    getAllUsers: true,
    intents: 98303	
});
const { createAudioResource, createAudioPlayer, getVoiceConnection } = require('@discordjs/voice');

const Constants = Eris.Constants;

const SENTENCE_INTERVAL = 1500; 

const userVoiceDataMap = new Map();
const memberMap = new Map();
const channelGame = "LOL";
const ttsQueue = [];

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
        userVoiceDataMap.forEach((userData, userID) => {
            const currentTime = Date.now();
            const elapsedTimeSinceLastSTT = currentTime - userData.startTime;
            const samplerate = 48000
            if (currentTime - userData.lastTime >= SENTENCE_INTERVAL || elapsedTimeSinceLastSTT >= 15000 ) {
                const filename = userData.filename;

                const inputFilePath = `./outputs/${filename}.pcm`;
                const outputFilePath = `./outputs/${filename}-mono.pcm`;

                const stereoBuffer = fs.readFileSync(inputFilePath);

                const monoBuffer = stereoToMono(stereoBuffer);

                fs.writeFileSync(outputFilePath, monoBuffer);

                const memberData = memberMap.get(userID);
                ttsQueue.push({filename, text: "", name: memberData.name, language: memberData.language.split("-")[0], finish: false});
                doSTT(filename, memberData.language, samplerate, channelGame) //STT on mono-pcm file
                .then(({filename, text}) => {
                    const fileIndex = ttsQueue.findIndex((item) => item.filename === filename);
                    ttsQueue[fileIndex].text = text;
                    ttsQueue[fileIndex].finish = true;
                })

                userVoiceDataMap.delete(userID);
                fs.unlink(`./outputs/${filename}.pcm`, () => {});
                // fs.unlink(`./outputs/    ${filename}-mono.pcm`, () => {});
            }
        });

        if (ttsQueue.length > 0 && ttsQueue[0].finish) {
            const { filename, text, name, language, result } = ttsQueue.shift();
            console.log(text, name, language);
            if (text !== "") {
                const translationPromises = ['tr', 'ko', 'en'].map(targetLanguage => {
                    if (language !== targetLanguage) {
                        return doTranslation(text, language, targetLanguage, channelGame);
                    } else {
                        return {TargetLanguageCode: targetLanguage, TranslatedText: text};
                    }
                });
                Promise.all(translationPromises)
                .then((results) => {
                    results.forEach(result => {
                        console.log(result.TargetLanguageCode, result.TranslatedText);
                        //save mp3 file for each language
                        if (result.TargetLanguageCode === 'tr'){
                            const filePath_tr = doTTS(result.TranslatedText, 'tr-TR', "Joanna"); 
                        } else if (result.TargetLanguageCode === 'ko') {
                            const filePath_ko = doTTS(result.TranslatedText, 'ko-KR', "Joanna"); 
                        } else{
                            const filePath_en = doTTS(result.TranslatedText, 'en-US', "Joanna"); 
                        }
                        //console.log('done STT-translate-TTS')
                        // bot.getDMChannel(userID).then((channel) => {
                        //     channel.createMessage(`${memberData.name} : ${result.TranslatedText}`);}
                        // )
                        memberMap.forEach((user) => {
                            if (user.language.split("-")[0] === result.TargetLanguageCode) {
                                bot.getDMChannel(user.id).then((channel) => {
                                    channel.createMessage(`${name} : ${result.TranslatedText}`);}
                                    
                                )
                                //play mp3file TODO
                                // connection => {
                                //     const dispatcher = connection.playFile('./tts_output/1708433815373-en-US.mp3');
                                //     //dispatcher.on("end", end => {message.member.voiceChannel.leave()});
                                // }

                            }
                        });
                    });
                })

            }
        }
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
                            custom_id: "tr-TR",
                            label: "Türkçe",
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
    } else if (msg.content == "!getGameSettings") {
        bot.createMessage(msg.channel.id, `The game is set to ${channelGame}.`);
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
        if (["LOL", "overwatch", "AmongUs", "pubg"].includes(interaction.data.custom_id)) {
            const channelGame = interaction.data.custom_id;
            if (channelGame === "LOL") {
                return interaction.createMessage({
                    content: "League of Legends is set."
                })
            } else if (channelGame === "overwatch") {    
                return interaction.createMessage({
                    content: "Overwatch is set."
                })
            } else if (channelGame === "AmongUs") {
                return interaction.createMessage({
                    content: "Among Us is set."
                })
            } else if (channelGame === "pubg") {
                return interaction.createMessage({
                    content: "Battlegrounds is set."
                })
            }
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
            } else if (userLanguage === "tr-TR") {
                return interaction.createMessage({
                    content: `<@${userId}> Türkçe olarak ayarlandı.`
                })
            }
        }
    }
});

bot.connect();
