const Eris = require("eris");
const fs = require("fs");
const wavConverter = require("wav-converter");
const path = require("path");

require('dotenv').config();


const bot = new Eris(process.env.DISCORD_BOT_TOKEN, {
    getAllUsers: true,
    intents: 98303	
});

const Constants = Eris.Constants;

const SENTENCE_INTERVAL = 500;

const userVoiceDataMap = new Map();
const memberMap = new Map();

bot.on("ready", () => {
    console.log("Ready!");

    setInterval(() => {
        userVoiceDataMap.forEach((userData, userID) => {
          const currentTime = Date.now();

          if (currentTime - userData.lastTime >= SENTENCE_INTERVAL) {
            const filename = userData.filename;
            const pcmData = fs.readFileSync(path.resolve(__dirname, `../outputs/${filename}.pcm`))
            const wavData = wavConverter.encodeWav(pcmData, {
                numChannels: 2,
                sampleRate: 48000,
                byteRate: 16
            });
 
            fs.writeFileSync(path.resolve(__dirname, `../outputs/${filename}.wav`), wavData);
    
            userVoiceDataMap.delete(userID);
            fs.unlink(`./outputs/${filename}.pcm`, (err) => {
                if (err) {
                    console.error(`${filename}.pcm 파일 삭제 중 오류 발생`);
                } else {
                    console.log(`${filename}.pcm 파일 삭제 완료`);
                }
            });
          }
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
                            custom_id: "ko",
                            label: "한국어",
                            disabled: false
                        },
                        {
                            type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "en",
                            label: "English",
                            disabled: false
                        },
                        {
                            type: Constants.ComponentTypes.BUTTON,
                            style: Constants.ButtonStyles.PRIMARY,
                            custom_id: "tr",
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
});

bot.on("voiceChannelJoin", (member, newChannel) => {
     if (!memberMap.has(member.id) && !member.bot)
        memberMap.set(member.id, {
            id: member.id,
            name: member.username,
            language: "en" //default language is English
        });
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

        if(userLanguage === "ko") {
            return interaction.createMessage({
                    content: `<@${userId}> 한국어로 설정되었습니다.` 
            })
        } else if (userLanguage === "en") {
            return interaction.createMessage({
                content: `<@${userId}> English is set.`    
            })
        } else if (userLanguage === "tr") {
            return interaction.createMessage({
                content: `<@${userId}> Türkçe olarak ayarlandı.`
            })
        }
    }
});

bot.connect();

