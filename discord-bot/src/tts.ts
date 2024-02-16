const axios = require('axios');
require('dotenv').config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_ENDPOINT = "https://api.elevenlabs.io/speech";

// Function to call ElevenLabs TTS API and get the speech audio URL
async function generateSpeechFromText(text, voiceModel = 'default') {
    try {
        const response = await axios.post(ELEVENLABS_ENDPOINT, {
            text: text,
            voice: voiceModel,
        }, {
            headers: {
                'Authorization': `Bearer ${ELEVENLABS_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Assuming the API response includes the URL directly
        if(response.data && response.data.url) {
            return response.data.url;
        } else {
            throw new Error('No audio URL in response');
        }
    } catch (error) {
        console.error('Error generating speech from text:', error);
        throw error; 
    }
}
export default { generateSpeechFromText };