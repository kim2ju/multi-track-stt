import { Polly, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import * as fs from "fs";
import { Readable } from "stream";


// // Initialize the Polly client
const polly = new Polly({
    region: "ap-northeast-2", // AWS region, same as your STT setup
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
    },
});


// Function to convert text to speech using Amazon Polly
const doTTS = async (text: string, languageCode, voiceId): Promise<string> => {
    try {
        // Create an instance of Polly
        //const polly = new Polly({ region: 'ap-northeast-2' }); // Specify your desired AWS region
        // const voiceId = "Joanna"
        // const languageCode = "en-US"
        // Request to synthesize speech
        const command = new SynthesizeSpeechCommand({
            Text: text,
            OutputFormat: "mp3", // Can change to OGG, PCM
            VoiceId: voiceId, // For example, "Joanna", "Matthew". Need to check the documentation for different voices
            LanguageCode: languageCode, // For example, "en-US"
        });
        
        // Send the command and get the response
        const response = await polly.send(command);

        // Get the AudioStream from the response
        const audioStream = response.AudioStream as Readable; // Cast AudioStream to Readable

        // Specify the file path for the output audio
        const filePath = `./tts_output/${Date.now()}-${languageCode}.mp3`;

        // Write the AudioStream to an MP3 file
        const fileWriteStream = fs.createWriteStream(filePath);
        audioStream.pipe(fileWriteStream);

        // Wait for the file to finish writing
        await new Promise<void>((resolve, reject) => {
            fileWriteStream.on("finish", resolve);
            fileWriteStream.on("error", reject);
        });

        // Return the file path
        return filePath;
    } catch (error) {
        console.error("Error calling Amazon Polly", error);
        throw error; 
    }
};

export default doTTS;