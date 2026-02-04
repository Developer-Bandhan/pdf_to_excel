require("dotenv").config();
const fs = require("fs-extra");
const { GoogleGenAI } = require("@google/genai");
const prompts = require("../utils/prompts.js");

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

function cleanJsonText(t) {
  return (t || "").replace(/```json|```/g, "").trim();
}

function extractStrictJson(text) {
  if (!text) return null;

  const cleanedText = cleanJsonText(text);

  const startObj = cleanedText.indexOf("{");
  const startArr = cleanedText.indexOf("[");

  let start = -1;

  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);

  if (start === -1) return null;

  const lastObj = cleanedText.lastIndexOf("}");
  const lastArr = cleanedText.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);

  if (end === -1 || end <= start) return null;

  return cleanedText.substring(start, end + 1).trim();
}


async function generateJsonWithRetry({ model, parts, maxAttempts = 2 }) {
  let last = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
    });

    console.log("res from generateJsonWithRetry", res);

    const text = extractGeminiText(res);
    last = text;
    if (!text) continue;

    const cleaned = extractStrictJson(text);
    if (!cleaned) continue;


    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch (err) {
      parts = [
        {
          text: "Fix the following into STRICT valid JSON only. No markdown, no extra text."
        },
        { text: cleaned }
      ];
    }
  }

  return null;
}

async function classifyPages(imageParts) {
  const CLASS_BATCH_SIZE = 5;
  const batches = chunkArray(imageParts, CLASS_BATCH_SIZE);

  const results = [];
  let globalBrandName = "";

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    const parts = [
      {
        text: prompts.PAGE_CLASSIFIER,
      }
    ];

    for (let i = 0; i < batch.length; i++) {
      const imgPath = batch[i];
      const pageNo = batchIndex * CLASS_BATCH_SIZE + i + 1;
      const buffer = await fs.readFile(imgPath);

      parts.push({ text: `PAGE_NUMBER: ${pageNo}` });
      parts.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: "image/png",
        }
      });
    }

    const jsonText = await generateJsonWithRetry({
      model: process.env.GEMINI_CLASSIFIER_MODEL,
      parts,
      maxAttempts: 2
    });

    console.log("jsonText from classifyPages", jsonText);

    if (!jsonText) continue;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      continue;
    }

    if(!globalBrandName && parsed?.brand_name) {
      globalBrandName = parsed.brand_name.trim();
    }

    const pages = parsed?.pages;
    if(Array.isArray(pages)) {
      for(const x of pages) {
        if(x?.page_number) results.push(x);
      }
    }
  }

  results.sort((a, b) => (a.page_number || 0) - (b.page_number || 0));

  return {classifications: results, brand_name: globalBrandName};

}

async function buildExtractionPlan(classifications) {

  const prompt = prompts.EXTRACTION_PLANNER;

  const parts = [{ text: prompt }, { text: JSON.stringify(classifications) }];

  const jsonText = await generateJsonWithRetry({
    model: process.env.GEMINI_PLANNER_MODEL,
    parts,
    maxAttempts: 2
  });

  console.log("jsonText from buildExtractionPlan", jsonText);

  if (!jsonText) {
    const allPages = classifications.map((c) => c.page_number);

    return {
      template_family: "FALLBACK_ALL_PAGES",
      skip_pages: [],
      extract: {
        FRONT_MATTER: [],
        INDEX_PAGE: [],
        UPHOLSTERY_LIST: [],
        MODULAR_UNIT_TABLE: [],
        COMPOSITION_TABLE: [],
        VARIANT_PRICE_TABLE: [],
        SIMPLE_TEXT_LIST: [],
        BLANK_PAGE: [],
        UNKNOWN: allPages,
      },
      notes: "Fallback plan used"
    };
  }

  return JSON.parse(jsonText);
}


function normalizeRow(row) {
  return {
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
  }
}

async function extractPageRowsGeneric(imgpath, pageNo) {
  const buffer = await fs.readFile(imgpath);

  const prompt = prompts.GENERIC_EXTRACTOR({ pageNo });

  const parts = [
    { text: prompt },
    { text: `PAGE_NUMBER: ${pageNo}` },
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "image/png",
      },
    }
  ];

  const jsonText = await generateJsonWithRetry({
    model: process.env.GEMINI_MODEL,
    parts,
    maxAttempts: 2
  });

  // console.log("jsonText from extractPageRowsGeneric", jsonText);

  if (!jsonText) return [];

  const strict = extractStrictJson(jsonText);
  if (!strict) return [];

  const parsed = JSON.parse(strict);
  if (!Array.isArray(parsed)) return [];

  return parsed.map(normalizeRow);
}


async function geminiExtractPDF(imagePaths) {

  const {classifications, brand_name} = await classifyPages(imagePaths);

  const plan = await buildExtractionPlan(classifications);

  const extractPages = new Set();

  for (const key of Object.keys(plan.extract || {})) {
    for (const p of plan.extract[key] || []) extractPages.add(p);
  }

  if (extractPages.size === 0) {
    for (let i = 1; i <= imagePaths.length; i++) extractPages.add(i);
  }

  const allRows = [];

  for (const pageNo of [...extractPages].sort((a, b) => a - b)) {
    const imgPath = imagePaths[pageNo - 1];

    if (!imgPath) continue;

    const rows = await extractPageRowsGeneric(imgPath, pageNo);

    const patchedRows = rows.map((row) => ({
      ...row,
      brand_name: row.brand_name || brand_name || "",
    }));

    allRows.push(...patchedRows);
  }

  return allRows;
}



module.exports = geminiExtractPDF;
