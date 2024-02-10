const Eris = require("eris");
const fs = require("fs");
const wavConverter = require("wav-converter");
const path = require("path");
const doSTT = require('./stt').default;

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
            doSTT(`./outputs/${filename}.wav`);
            
            userVoiceDataMap.delete(userID);
            fs.unlink(`./outputs/${filename}.pcm`, (err) => {
                if (err) {
                    console.error(`${filename}.pcm 파일 삭제 중 오류 발생`);
                } else {
                    console.log(`${filename}.pcm 파일 삭제 완료`);
                }
            });
            fs.unlink(`./outputs/${filename}-mono.pcm`, (err) => {
                if (err) {
                    console.error(`${filename}-mono.pcm 파일 삭제 중 오류 발생`);
                } else {
                    console.log(`${filename}-mono.pcm 파일 삭제 완료`);
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
                console.log(memberMap);
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
            language: "en-US" //default language is English
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
