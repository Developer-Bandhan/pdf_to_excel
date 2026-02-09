const MODEL_PRICING = [
    {
        model: "gemini-2.5-pro",
        inputPer1M: 1.25,
        outputPer1M: 10.0,
    },
    {
        model: "gemini-2.5-flash",
        inputPer1M: 0.30,
        outputPer1M: 2.50,
    },
    {
        model: "gemini-3-pro-preview",
        inputPer1M: 2.0,
        outputPer1M: 12.0,
    },
    {
        model: "gemini-3-flash-preview",
        inputPer1M: 0.50,
        outputPer1M: 3.0,
    },
    {
        model: "gemini-2.0-flash",
        inputPer1M: 0.10,
        outputPer1M: 0.40,
    },
];

function getModelPricing(modelName) {
    return MODEL_PRICING.find(p => p.model === modelName);
}

function calculateCost({ model, inputTokens = 0, outputTokens = 0 }) {
    const pricing = getModelPricing(model);
    if (!pricing) return null;

    const inputCostUSD = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCostUSD = (outputTokens / 1_000_000) * pricing.outputPer1M;

    const totalUSD = inputCostUSD + outputCostUSD;
    // Fallback to 87 if env var is missing to avoid NaN
    const exchangeRate = process.env.USD_TO_INR || 90.7;
    const totalINR = totalUSD * Number(exchangeRate);

    console.log("totalUSD", totalUSD);
    console.log("totalINR", totalINR);

    return {
        model,
        tokens: {
            input: inputTokens,
            output: outputTokens,
        },
        cost: {
            usd: Number(totalUSD.toFixed(6)),
            inr: Number(totalINR.toFixed(6))
        }
    }
}

module.exports = {
    MODEL_PRICING,
    getModelPricing,
    calculateCost
}