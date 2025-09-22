// api.js
const baseURL = "https://api.aimlapi.com/v1";
const apiKey = '374c551f9f6e47eeb657000c5b1de2e5'; // Replace with your actual API key // Replace with your actual API endpoint

async function fetchData() {
    try {
        const userInput = "Draft a prenup contract. Create a comprehensive prenuptial agreement that includes asset identification, debt responsibility, income division, spousal support terms, dispute resolution methods, and amendment procedures. Ensure it outlines the governing law and emphasizes the need for independent legal advice for both parties to ensure fairness and enforceability.";

        const systemPrompt = "You are a lawyer. Be descriptive and helpful";
    
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

    }
);


        const response = await fetch(baseUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(data); // Log the data to the console

        // You can also display the data in an HTML element
        const outputElement = document.getElementById('output');
        outputElement.textContent = JSON.stringify(data, null, 2);

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Call the function to initiate the API request when the script loads
fetchData();