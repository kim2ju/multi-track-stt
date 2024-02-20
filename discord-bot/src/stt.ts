const fs = require('fs');
const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require('@aws-sdk/client-transcribe-streaming');

require('dotenv').config();

function wait(time) {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    })
}

async function* audioSource(filePath) {
    const chunkSize = 10 * 1000;
    const fileBuf = fs.readFileSync(filePath);
    let index = 0;
    let i = 0;
    while(index < fileBuf.length) {
        const chunk = fileBuf.slice(index, Math.min(index + chunkSize, fileBuf.byteLength));
        await wait(300);
        yield chunk;
        index += chunkSize;
    }
}

const doSTT = async (filename, language, sample_rate, channelGame) => {
    //console.log('doSTT')
    const startTime = process.hrtime();
    const filePath = `./outputs/${filename}-mono.pcm`;
    async function * audioStream() {
        for await(const chunk of audioSource(filePath)) {
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
        LanguageCode: language,
        MediaSampleRateHertz: sample_rate,
        MediaEncoding: 'pcm',
        AudioStream: audioStream(),
        VocabularyName: channelGame + '_' + language
    });

    try {
        const data = await client.send(command, {sessionTimeout: 2000});
        // console.log(filename)
        let text = '';
        for await (const event of data.TranscriptResultStream) {
            if(event.TranscriptEvent) {
                const results = event.TranscriptEvent.Transcript.Results;
                results.map(result => {
                    if (!result.IsPartial)
                        (result.Alternatives).map(alternative => {
                            console.log(alternative.Transcript)
                            text += alternative.Transcript;
                        })
                })
                //text = results[results.length - 1].slice(-1).Transcript;
            }
        }
        const endTime = process.hrtime(startTime);
        console.log('Transcribe 실행 시간: %ds %dms', endTime[0], endTime[1] / 1000000);
        client.destroy();
        fs.unlink(filePath, () => {});
        return {filename: filename, text: text};
    } catch(e) {
        console.log('ERROR: ', e);
        fs.unlink(filePath, () => {});
        process.exit(1);
        
    }
}

export default doSTT;
