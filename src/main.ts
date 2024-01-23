const Eris = require("eris");
const fs = require("fs");
const { bufferToBuffer } = require("bufferutil");


const bot = new Eris("DISCORD_BOT_TOKEN");

const CHUNK_TIME = 100000;

const userVoiceDataMap = new Map();

bot.on("ready", () => {
    console.log("Ready!");
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
                    // console.log(userVoiceDataMap);
                    // map key: 유저 ID
                    if (!userVoiceDataMap.has(userID)) {
                        userVoiceDataMap.set(userID, {
                            data: [],
                            startTime: timestamp,
                        });
                    }

                    // voiceData 배열에 추가
                    const userVoiceData = userVoiceDataMap.get(userID);
                    userVoiceData.data.push(voiceData);

                    // 처음 기록한 timestamp와 지금 timestamp의 차가 지정한 크기보다 클 때 파일 저장
                    // 파일 저장 방식은 이후에 변경 가능 (ex. 파일을 분리하지 않고 하나로 합치기)
                    if (timestamp - userVoiceData.startTime > CHUNK_TIME) {
                        const fileName = `${userID}-${timestamp}.pcm`;
                        const buffer = Buffer.concat(userVoiceData.data);

                        fs.writeFileSync(fileName, buffer);

                        // map key=userID 초기화
                        userVoiceDataMap.set(userID, {
                            data: [],
                            startTime: timestamp,
                        });
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

            userVoiceDataMap.clear();
        }
    }
});

bot.connect();