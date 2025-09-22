// api.js - Browser-compatible version
const AIML_API_URL = "https://api.aimlapi.com/v1";
const AIML_API_KEY = "374c551f9f6e47eeb657000c5b1de2e5";

async function askAIML(userPrompt, systemPrompt = "You are a travel agent. Be descriptive and helpful") {
    try {
        const response = await fetch(`${AIML_API_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AIML_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 256
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const completion = await response.json();
        const aiResponse = completion.choices[0].message.content;

        // For debugging - shows in browser console
        console.log("User:", userPrompt);
        console.log("AI:", aiResponse);

        return aiResponse;
    } catch (error) {
        console.error('Error calling AIML API:', error);
        return 'Sorry, I encountered an error. Please try again.';
    }
}

// Make function available globally
window.askAIML = askAIML;

// Optional: Add a simple test function
window.testAIML = async function() {
    const testResponse = await askAIML("Tell me about San Francisco");
    console.log("Test response:", testResponse);
    return testResponse;
};