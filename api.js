const { OpenAI } = require("openai");
const baseURL = "https://api.aimlapi.com/v1";

// Insert your AIML API Key in the quotation marks instead of my_key:
const apiKey = "374c551f9f6e47eeb657000c5b1de2e5"; 

const userPrompt = "Draft a prenup contract. Create a comprehensive prenuptial agreement that includes asset identification, debt responsibility, income division, spousal support terms, dispute resolution methods, and amendment procedures. Ensure it outlines the governing law and emphasizes the need for independent legal advice for both parties to ensure fairness and enforceability.";
const systemPrompt = "You are a lawyer. Be descriptive and helpful";

const api = new OpenAI({
  apiKey,
  baseURL,
});

router.use(bodyParser.json());

// Endpoint to draft a prenup
router.post('/draft-prenup2', async (req, res) => {

const main = async () => {
  const completion = await api.chat.completions.create({
    model: "mistralai/Mistral-7B-Instruct-v0.2",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 256,
  });

  const response = completion.choices[0].message.content;

  console.log("User:", userPrompt);
  console.log("AI:", response);
};

main();

module.exports = router;