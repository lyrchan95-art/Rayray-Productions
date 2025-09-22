const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');

const router = express.Router();
const baseURL = "https://api.aimlapi.com/v1";
const apiKey = '374c551f9f6e47eeb657000c5b1de2e5'; // Replace with your actual API key

const api = new OpenAI({
    apiKey,
    baseURL,
});

router.use(bodyParser.json());

// Endpoint to draft a prenup
router.post('/draft-prenup2', async (req, res) => {
    const userInput = "Draft a prenup contract. Create a comprehensive prenuptial agreement that includes asset identification, debt responsibility, income division, spousal support terms, dispute resolution methods, and amendment procedures. Ensure it outlines the governing law and emphasizes the need for independent legal advice for both parties to ensure fairness and enforceability.";

    const systemPrompt = "You are a lawyer. Be descriptive and helpful";

    try {
        const completion = await api.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: userInput,
                },
            ],
            temperature: 0.7,
            max_tokens: 1024,
        });

        const response = completion.choices[0].message.content;
        res.json({ result: response });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error occurred while calling the API' });
    }
});

module.exports = router;