require("dotenv").config();
const fs = require("fs-extra");
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Split array into chunks
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Robust Gemini text extractor
function extractGeminiText(result) {
  try {
    if (result?.response?.text) {
      const t = result.response.text();
      if (t) return t;
    }
  } catch (err) {
    console.log(`Error extracting text from result: ${err}`);
  }

  const parts = result?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((p) => p.text)
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }

  return null;
}

async function geminiExtract(imagePaths) {
  const BATCH_SIZE = 8;
  const batches = chunkArray(imagePaths, BATCH_SIZE);

  let allRows = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    const imageParts = [];
    for (const imgPath of batch) {
      const buffer = await fs.readFile(imgPath);
      imageParts.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: "image/png",
        },
      });
    }

    const prompt = `
You are extracting structured product data from a batch of pages of the SAME PDF document.
Each image corresponds to one page.

CRITICAL RULES:
- Extract ONLY what is clearly visible.
- DO NOT guess, infer, calculate, or merge data.
- DO NOT convert units or currencies.
- Missing values → empty string.
- ONE product variant = ONE row.
- Page number = actual PDF page number (first image of this batch = page ${batchIndex * BATCH_SIZE + 1 }).

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

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, ...imageParts],
        },
      ],
    });


    const responseText = extractGeminiText(result);

    console.log("Gemini response:", responseText);

    if (!responseText) {
      console.error(` No readable Gemini output for batch ${batchIndex}`);
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
      console.error(` JSON parse failed batch ${batchIndex}`);
      console.error(cleaned);
      continue;
    }

    if (Array.isArray(batchRows) && batchRows.length > 0) {
      allRows.push(...batchRows);
    }
  }

  return allRows;
}

module.exports = geminiExtract;
