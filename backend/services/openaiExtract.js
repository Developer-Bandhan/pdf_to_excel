require("dotenv").config();
const fs = require("fs-extra");
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Split array into chunks
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Robust OpenAI text extractor (Gemini-style)
function extractOpenAIText(response) {
  try {
    const t = response?.choices?.[0]?.message?.content;
    if (typeof t === "string" && t.trim()) return t.trim();
  } catch (err) {
    console.log(`Error extracting text from OpenAI response: ${err}`);
  }
  return null;
}

async function openaiExtract(imagePaths) {
  const BATCH_SIZE = 8;
  const batches = chunkArray(imagePaths, BATCH_SIZE);

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
- Page number = actual PDF page number (first image of this batch = page ${batchIndex * BATCH_SIZE + 1}).
- length_cm, breath_cm, height_cm, seat_height_cm must contain ONLY numeric value if available.

PRICE RULES:
- Detect currency from symbol/text and store in "currency" (USD/EURO/INR/GBP/UNKNOWN).
- Return "price" as numeric-only string (no symbol, no commas, no spaces).

DIMENSION RULES:
- Split numeric value and unit.

RETURN FORMAT (STRICT JSON ARRAY):
[
  {
    "brand_name": "",
    "product_name": "",
    "furniture_type": "",
    "design": "",
    "product_code": "",
    "system_code": "",
    "length_cm": "",
    "breath_cm": "",
    "height_cm": "",
    "seat_height_cm": "",
    "upholstery": "",
    "currency": "",
    "price": "",
    "other_material_comments": "",
    "special_feature": "",
    "additional_price": "",
    "cbm": "",
    "product_weight_kg": "",
    "remark": "",
    "initials": "",
    "date": ""
  }
]

FINAL CONSTRAINT:
- Never fabricate.
- Never merge rows.
- Output ONLY JSON array, No markdown, No extra text.
    `.trim();

    const contentParts = [{ type: "text", text: prompt }];

    // Build image parts exactly like Gemini flow
    for (const imgPath of batch) {
      const buffer = await fs.readFile(imgPath);
      const base64 = buffer.toString("base64");

      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${base64}`,
        },
      });
    }

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: contentParts,
        },
      ],
    });

    console.log(response);

    const responseText = extractOpenAIText(response);

    console.log(responseText);

    if (!responseText) {
      console.error(`No readable OpenAI output for batch ${batchIndex}`);
      continue;
    }

    const cleaned = responseText.replace(/```json|```/g, "").trim();

    if (cleaned === "[]") continue;

    if (!cleaned.startsWith("[")) {
      console.error(`Invalid JSON batch ${batchIndex}`);
      console.error(cleaned);
      continue;
    }

    let batchRows;
    try {
      batchRows = JSON.parse(cleaned);
    } catch (err) {
      console.error(`JSON parse failed batch ${batchIndex}`);
      console.error(cleaned);
      continue;
    }

    if (Array.isArray(batchRows) && batchRows.length > 0) {
      const normalized = batchRows.map((row) => ({
        brand_name: row.brand_name ?? "",
        product_name: row.product_name ?? "",
        furniture_type: row.furniture_type ?? "",
        design: row.design ?? "",
        product_code: row.product_code ?? "",
        system_code: row.system_code ?? "",
        length_cm: row.length_cm ?? "",
        breath_cm: row.breath_cm ?? "",
        height_cm: row.height_cm ?? "",
        seat_height_cm: row.seat_height_cm ?? "",
        upholstery: row.upholstery ?? "",
        currency: row.currency ?? "",
        price: row.price ?? "",
        other_material_comments: row.other_material_comments ?? "",
        special_feature: row.special_feature ?? "",
        additional_price: row.additional_price ?? "",
        cbm: row.cbm ?? "",
        product_weight_kg: row.product_weight_kg ?? "",
        remark: row.remark ?? "",
        initials: row.initials ?? "",
        date: row.date ?? "",
      }));

      allRows.push(...normalized);
    }
  }

  return allRows;
}

module.exports = openaiExtract;
