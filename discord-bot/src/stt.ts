const fs = require('fs');
const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');

require('dotenv').config();

function wait(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    })
}

async function* audioSource(filename) {
    const chunkSize = 10 * 1000;
    const fileBuf = fs.readFileSync(filename);
    let index = 0;
    let i = 0;
    while(index < fileBuf.length) {
        const chunk = fileBuf.slice(index, Math.min(index + chunkSize, fileBuf.byteLength));
        await wait(300);
        yield chunk;
        index += chunkSize;
    }
}

const doSTT = async (filename) => {
    console.log(`***start: [${new Date()}]`);
    async function * audioStream() {
        for await(const chunk of audioSource(filename)) {
            yield {AudioEvent: {AudioChunk: chunk}}
        }
    }
    const client = new TranscribeStreamingClient({
        region: 'ap-northeast-2',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY,
            secretAccessKey: process.env.AWS_SECRET_KEY,
        },
    });

    const command = new StartStreamTranscriptionCommand({
        LanguageCode: 'ko-KR',
        MediaSampleRateHertz: 48000,
        MediaEncoding: 'pcm',
        AudioStream: audioStream(),
    });

    try {
        const data = await client.send(command, {sessionTimeout: 2000});
        for await (const event of data.TranscriptResultStream) {
            if(event.TranscriptEvent) {
                const results = event.TranscriptEvent.Transcript.Results;
                results.map(result => {
                    (result.Alternatives || []).map(alternative => {
                        const str = alternative.Items.map(item => item.Content).join(' ');
                        console.log(str)
                    })
                })
            }
        }
        console.log('DONE', data);
        client.destroy();
    } catch(e) {
        console.log('ERROR: ', e);
        process.exit(1);
    }
}

export default doSTT;
