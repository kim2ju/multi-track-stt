// Install the AWS Polly SDK by running npm install @aws-sdk/client-polly.

// Import necessary modules
import { Polly } from "@aws-sdk/client-polly";
import fs from "fs";
import { getAudioDurationInSeconds } from 'get-audio-duration';

// Initialize the Polly client
const polly = new Polly({
    region: "ap-northeast-2", // AWS region, same as your STT setup
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Function to convert text to speech using Amazon Polly
const doTTS = async (text: string, languageCode: string, voiceId: string): Promise<string> => {
    try {
        // Request to synthesize speech
        const { AudioStream } = await polly.synthesizeSpeech({
            Text: text,
            OutputFormat: "mp3", // Can change to OGG, PCM
            VoiceId: voiceId, // For example, "Joanna", "Matthew". Need to check the documentation for different voices
            LanguageCode: languageCode, // For example, "en-US"
        });

        // Specify the file path for the output audio
        const filePath = `./tts_output/${Date.now()}.mp3`;
        // Write the AudioStream to an MP3 file
        const fileWriteStream = fs.createWriteStream(filePath);
        AudioStream.pipe(fileWriteStream);

        await new Promise((resolve, reject) => {
            fileWriteStream.on("close", resolve);
            fileWriteStream.on("error", reject);
            AudioStream.on("error", reject);
        });
        return filePath;
    } catch (error) {
        console.error("Error calling Amazon Polly", error);
        throw error; 
    }
};

export default doTTS;
