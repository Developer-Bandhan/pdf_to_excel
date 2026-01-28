require("dotenv").config();

const fs = require("fs-extra");
const OpenAI = require("openai");

const client = new OpenAI({
    apikey: process.env.OPENAI_API_KEY
});

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
}

async function openaiExtract(imageParts) {
    const BATCH_SIZE = 8;
    const batches = chunkArray(imageParts, BATCH_SIZE);

    let allRows = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        const prompt = `
You are extracting structured product data from a batch of pages of the SAME PDF document.
Each image corresponds to one page.

CRITICAL RULES:
- Extract ONLY what is clearly visible.
- DO NOT guess, infer, calculate, or merge data.
- DO NOT convert units or currencies.
- Missing values → empty string.
- ONE product variant = ONE row.
- Page number = actual PDF page number (first image of this batch = page ${batchIndex * BATCH_SIZE + 1
            }).

PRICE RULES:
- Return price as STRING exactly as shown (e.g. "€ 2450", "$120").

DIMENSION RULES:
- Split numeric value and unit.

RETURN FORMAT (STRICT JSON ARRAY):
[
  {
    "brand_name": "",
    "product_code": "",
    "product_name": "",
    "product_type": "",
    "description": "",
    "variant_code": "",
    "variant_details": "",
    "upholstery": "",
    "materials": "",
    "height_value": "",
    "height_unit": "",
    "length_value": "",
    "length_unit": "",
    "breadth_value": "",
    "breadth_unit": "",
    "seat_height_value": "",
    "seat_height_unit": "",
    "diameter_value": "",
    "diameter_unit": "",
    "weight_value": "",
    "weight_unit": "",
    "volume_value": "",
    "volume_unit": "",
    "currency": "",
    "price": "",
    "page_number": 0
  }
]

FINAL CONSTRAINT:
- Never fabricate.
- Never merge rows.
- Output ONLY JSON array.
    `.trim();

        const contentParts = [{ type: "text", text: prompt }];

        for (const imgPath of batch) {
            const buffer = await fs.readFile(imgPath);
            const base64 = buffer.toString("base64");

            contentParts.push({
                type: "image_url",
                image_url: { url: `data:image/png;base64,${base64}` },
            });
        }

        const response = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL,
            messages: [
                {
                    role: "user",
                    content: contentParts
                },
            ],
        });



        const responseText = response?.choices?.[0]?.message?.content?.trim();

        console.log("OpenAI response:", responseText);

        if (!responseText) {
            console.log(`No OpenAI output for batch ${batchIndex}`);
            continue;
        }

        const cleaned = responseText.replace(/```json|```/g, "").trim();
        if (cleaned === "[]") continue;

        let batchRows;
        try {
            batchRows = JSON.parse(cleaned);
        } catch (err) {
            console.error(`OpenAI JSON parse failed batch ${batchIndex}`);
            console.error(cleaned);
            continue;
        }

        if (Array.isArray(batchRows) && batchRows.length > 0) {
            allRows.push(...batchRows);
        }
    }

    return allRows;
}


module.exports = openaiExtract;