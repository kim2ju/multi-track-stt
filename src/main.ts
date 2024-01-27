const Eris = require("eris");
const fs = require("fs");
const wavConverter = require("wav-converter");
const path = require("path");

require('dotenv').config();


const bot = new Eris(process.env.DISCORD_BOT_TOKEN);

const SENTENCE_INTERVAL = 500;

const userVoiceDataMap = new Map();

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
    }  else if (msg.content === "!leave") {
        if (!msg.member.voiceState.channelID) {
            bot.createMessage(msg.channel.id, "You are not in a voice channel.");
            return;
        } else {
            bot.leaveVoiceChannel(msg.member.voiceState.channelID)
            bot.createMessage(msg.channel.id, "bye");
        }
    }
});

bot.connect();