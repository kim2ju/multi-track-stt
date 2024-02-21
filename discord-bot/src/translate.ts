const { TranslateClient, TranslateTextCommand } = require("@aws-sdk/client-translate");
require('dotenv').config();

const doTranslation = (text, sourceLanguage, targetLanguage) => {
    const client = new TranslateClient({
        region: 'ap-northeast-2',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY,
            secretAccessKey: process.env.AWS_SECRET_KEY,
        },
    });

    const command = new TranslateTextCommand({
        SourceLanguageCode: sourceLanguage,
        TargetLanguageCode: targetLanguage,
        Text: text
    });

    return new Promise((resolve, reject) => {
        client.send(command, {sessionTimeout: 2000})
            .then(data => resolve(data))
            .catch(error => reject(error));
    });
};

export default doTranslation;
