const Eris = require("eris");
const fs = require("fs");
const wavConverter = require("wav-converter");
const path = require("path");
const axios = require('axios');

require('dotenv').config();

const uploadFile = async (filename) => {
    try {
        const filepath = `./outputs/${filename}`;
        const formData = new FormData();
        formData.append("file", fs.createReadStream(filepath));

        const response = await axios.post('http://server.com/upload', formData, { // will change this part to our server
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }); 

        console.log(`${filename} uploaded successfully: `, response.data);
    } catch (error) {
        console.error('Error during file upload:', error);
    }
};

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
        userVoiceDataMap.forEach(async (userData, userID) => {
            const currentTime = Date.now();

            if (currentTime - userData.lastTime >= SENTENCE_INTERVAL) {
                const filename = userData.filename;
                const pcmData = fs.readFileSync(path.resolve(__dirname, `../outputs/${filename}.pcm`));
                const wavData = wavConverter.encodeWav(pcmData, {
                    numChannels: 2,
                    sampleRate: 48000,
                    byteRate: 16
                });

                fs.writeFileSync(path.resolve(__dirname, `../outputs/${filename}.wav`), wavData);

                // Call the new upload function
                await uploadFile(`${filename}.wav`);

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

    //get all users in the guild initially
    bot.users.forEach((user) => {
        if (!memberMap.has(user.id) && !user.bot)
            memberMap.set(user.id, {
                id: user.id,
                name: user.username,
            });
    });
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
    }
});

bot.on("interactionCreate", (interaction) => {
    if(interaction instanceof Eris.ComponentInteraction) { 
        if(interaction.data.custom_id === "ko") {
            return interaction.createMessage({
                    content: `<@${interaction.member.user.id}> 한국어로 설정되었습니다.`, 
                    allowedMentions: {
                        users: [interaction.member.user.id]
                    }
            })
        } else if (interaction.data.custom_id === "en") {
            return interaction.createMessage({
                content: `<@${interaction.member.user.id}> English is set.`,
                allowedMentions: {
                    users: [interaction.member.user.id]
                }
            })
        } else if (interaction.data.custom_id === "tr") {
            return interaction.createMessage({
                content:   `<@${interaction.member.user.id}> Türkçe olarak ayarlandı.`,
                allowedMentions: {
                    users: [interaction.member.user.id]
                }
            })
        }
    }
});

bot.connect();

