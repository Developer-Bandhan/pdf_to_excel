const { calculateCost } = require("./costCalculator.js");


const TOKEN_USAGE = {
    byModel: {},
    overall: {
        input: 0,
        output: 0,
        thoughts: 0,
        total: 0,
        costUSD: 0,
        costINR: 0
    }
};


function trackTokens(model, usage) {
    if (!usage) return;

    const input = usage.promptTokenCount || 0;
    const output = usage.candidatesTokenCount || 0;
    const thoughts = usage.thoughtsTokenCount || 0;
    const total = usage.totalTokenCount || (input + output + thoughts);

    if (!TOKEN_USAGE.byModel[model]) {
        TOKEN_USAGE.byModel[model] = {
            input: 0,
            output: 0,
            thoughts: 0,
            total: 0,
            costUSD: 0,
            costINR: 0
        };
    }

    TOKEN_USAGE.byModel[model].input += input;
    TOKEN_USAGE.byModel[model].output += output;
    TOKEN_USAGE.byModel[model].thoughts += thoughts;
    TOKEN_USAGE.byModel[model].total += total;

    TOKEN_USAGE.overall.input += input;
    TOKEN_USAGE.overall.output += output;
    TOKEN_USAGE.overall.thoughts += thoughts;
    TOKEN_USAGE.overall.total += total;

    const cost = calculateCost({
        model,
        inputTokens: input,
        outputTokens: output + thoughts,
    });

    if (cost) {
        TOKEN_USAGE.byModel[model].costUSD += cost.cost.usd;
        TOKEN_USAGE.byModel[model].costINR += cost.cost.inr;
        TOKEN_USAGE.overall.costUSD += cost.cost.usd;
        TOKEN_USAGE.overall.costINR += cost.cost.inr;
    }


    console.log("total input token", TOKEN_USAGE.overall.input);
    console.log("total output token", TOKEN_USAGE.overall.output);
    console.log("total thoughts token", TOKEN_USAGE.overall.thoughts);
    console.log("total token", TOKEN_USAGE.overall.total);
}


function getTokenUsage() {
    return TOKEN_USAGE;
}

function resetTokenUsage() {
    TOKEN_USAGE.byModel = {};
    TOKEN_USAGE.overall = {
        input: 0,
        output: 0,
        thoughts: 0,
        total: 0,
        costUSD: 0,
        costINR: 0
    };
}

module.exports = {
    trackTokens,
    getTokenUsage,
    resetTokenUsage
}