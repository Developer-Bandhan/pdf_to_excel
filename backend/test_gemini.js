require("dotenv").config({ path: "./.env" });
const { GoogleGenAI } = require("@google/genai");

async function testConnection() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API Key found in .env");
        return;
    }

    const ai = new GoogleGenAI({
        apiKey: apiKey,
    });

    try {
        console.log("Attempting a simple Gemini call...");
        const result = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: "Hello, are you there?" }] }],
        });
        console.log("Success! Response:");
        console.log(result.response.text());
    } catch (error) {
        console.error("Gemini Test Failed:");
        console.error(error);
    }
}

testConnection();
