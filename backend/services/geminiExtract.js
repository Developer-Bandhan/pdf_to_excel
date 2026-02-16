require("dotenv").config();
const fs = require("fs-extra");
const { GoogleGenAI } = require("@google/genai");
const prompts = require("../utils/prompts.js");
const { trackTokens, getTokenUsage, resetTokenUsage } = require("../utils/tokenTracker.js");
const { sendEvent } = require("../utils/progress");


const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});


const CLASS_BATCH_SIZE = 5;
const EXTRACT_BATCH_SIZE = 1;

const NON_EXTRACTABLE_TYPES = new Set([
  "FRONT_MATTER",
  "INDEX_PAGE",
  "UPHOLSTERY_LIST",
  "CODE_IMAGE_ONLY",
  "BLANK_PAGE",
  "UNKNOWN"
]);

const MANUAL_SKIP_PAGES = new Set();

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


async function generateJsonWithRetry({ model, parts, maxAttempts = 3 }) {
  let last = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
      });

      trackTokens(model, res.usageMetadata);
      sendEvent("token_update", getTokenUsage());
      sendEvent("model_call", { model, usage: res.usageMetadata });

      const text = extractGeminiText(res);
      sendEvent("thoughts", { model, text: `Raw response received (Attempt ${attempt})...` });

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
    } catch (err) {
      console.error(`Gemini Call Error (Attempt ${attempt}/${maxAttempts}): ${err.message}`);

      if (attempt === maxAttempts) {
        sendEvent("log", `Max attempts reached. Failed to get response from Gemini.`);
        return null;
      }

      const waitTime = 2000 * attempt;
      sendEvent("log", `Network issue? Retrying in ${waitTime / 1000}s...`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  return null;
}

async function classifyPages(imageParts) {

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
      maxAttempts: 3
    });

    console.log("jsonText from classifyPages", jsonText);
    sendEvent("log", `Classified batch ${batchIndex + 1}/${batches.length}`);

    if (!jsonText) continue;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      continue;
    }

    if (!globalBrandName && parsed?.brand_name) {
      globalBrandName = parsed.brand_name.trim();
    }

    const pages = parsed?.pages;
    if (Array.isArray(pages)) {
      for (const x of pages) {
        if (x?.page_number) results.push(x);
      }
    }
  }

  results.sort((a, b) => (a.page_number || 0) - (b.page_number || 0));

  return { classifications: results, brand_name: globalBrandName };

}

async function buildExtractionPlan(classifications) {

  const prompt = prompts.EXTRACTION_PLANNER;

  const parts = [{ text: prompt }, { text: JSON.stringify(classifications) }];

  const jsonText = await generateJsonWithRetry({
    model: process.env.GEMINI_PLANNER_MODEL,
    parts,
    maxAttempts: 3
  });

  console.log("jsonText from buildExtractionPlan", jsonText);
  sendEvent("log", "Extraction plan built.");


  if (!jsonText) {
    const allPages = classifications.map((c) => c.page_number);

    return {
      template_family: "FALLBACK_SKIP_ALL",
      skip_pages: allPages,
      extract: {
        FRONT_MATTER: [],
        INDEX_PAGE: [],
        CODE_IMAGE_ONLY: [],
        TECH_INFO_ONLY: [],
        UPHOLSTERY_LIST: [],
        MODULAR_UNIT_TABLE: [],
        COMPOSITION_TABLE: [],
        VARIANT_PRICE_TABLE: [],
        SIMPLE_TEXT_LIST: [],
        BLANK_PAGE: [],
        UNKNOWN: [],
      },
      notes: "Fallback triggered: Page classification or extraction planning failed. To ensure data accuracy, all pages were skipped because no page could be confidently identified as containing extractable product rows."
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
    // variant: row.variant ?? "",
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



async function extractPageRowsGeneric(pages, brand_name) {

  const parts = [];

  // parts.push({
  //   text: prompts.GENERIC_EXTRACTOR
  // });

  const brandContext = brand_name
    ? `
DOCUMENT CONTEXT:
Catalog Brand: ${brand_name}
This brand applies to all products.
Do NOT detect brand again.
Always return "brand_name": "".
`
    : `
DOCUMENT CONTEXT:
Brand name is empty.
If a clear catalog brand logo or company name is visible,
extract brand_name ONCE from this page.
Otherwise return "".
`;

  parts.push({
    text: prompts.GENERIC_EXTRACTOR + brandContext
  });


  for (const { imgPath, pageNo } of pages) {
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
    model: process.env.GEMINI_MODEL,
    parts,
    maxAttempts: 3
  });

  // console.log("jsonText from extractPageRowsGeneric", jsonText);

  if (!jsonText) return [];

  const strict = extractStrictJson(jsonText);

  console.log("RAW STRICT JSON:\n", strict);

  if (!strict) return [];


  let parsed;
  try {
    parsed = JSON.parse(strict);
  } catch {
    return [];
  }

  // unwrap array safely from any object
  if (!Array.isArray(parsed)) {
    const arr = Object.values(parsed).find(v => Array.isArray(v));
    if (Array.isArray(arr)) {
      parsed = arr;
    } else {
      return [];
    }
  }

  return parsed.map(normalizeRow);
}

async function prepareExtractionContext(imagePaths) {
  const { classifications, brand_name } = await classifyPages(imagePaths);
  const plan = await buildExtractionPlan(classifications);

  return { classifications, brand_name, plan };
}


async function extractWithPlan({ imagePaths, plan, brand_name }) {

  const extractPages = new Set();

  for (const [type, pages] of Object.entries(plan.extract || {})) {
    if (NON_EXTRACTABLE_TYPES.has(type)) continue;
    for (const p of pages || []) extractPages.add(p);
  }

  for (const p of plan.skip_pages || []) {
    extractPages.delete(p);
  }

  if (extractPages.size === 0) {
    for (let i = 1; i <= imagePaths.length; i++) extractPages.add(i);
  }

  const extractPageList = [...extractPages]
    .sort((a, b) => a - b)
    .map(pageNo => ({
      pageNo,
      imgPath: imagePaths[pageNo - 1]
    }))
    .filter(x => x.imgPath);

  const batches = chunkArray(extractPageList, EXTRACT_BATCH_SIZE);
  const allRows = [];

  for (const batch of batches) {
    const rows = await extractPageRowsGeneric(batch, brand_name);

    if (!brand_name) {
      const detected = rows.find(r => r.brand_name);
      if (detected?.brand_name) {
        brand_name = detected.brand_name.trim();
        console.log("Brand auto-detected:", brand_name);
      }
    }

    allRows.push(
      ...rows.map(row => ({
        ...row,
        brand_name: row.brand_name || brand_name || "",
        page_number: batch[0]?.pageNo ?? null
      }))
    );
  }

  return allRows;
}



// async function geminiExtractPDF(imagePaths) {

//   resetTokenUsage();

//   const { classifications, brand_name } = await classifyPages(imagePaths);

//   const plan = await buildExtractionPlan(classifications);

//   const extractPages = new Set();

//   // for (const key of Object.keys(plan.extract || {})) {
//   //   for (const p of plan.extract[key] || []) extractPages.add(p);
//   // }

//   for (const [type, pages] of Object.entries(plan.extract || {})) {
//     if (NON_EXTRACTABLE_TYPES.has(type)) continue;

//     for (const p of pages || []) {
//       if (MANUAL_SKIP_PAGES.has(p)) continue;
//       extractPages.add(p);
//     }
//   }

//   for (const p of plan.skip_pages || []) {
//     extractPages.delete(p);
//   }

//   if (extractPages.size === 0) {
//     for (let i = 1; i <= imagePaths.length; i++) extractPages.add(i);
//   }

//   const allRows = [];

//   const extractPageList = [...extractPages]
//     .sort((a, b) => a - b)
//     .map((pageNo) => ({
//       pageNo,
//       imgPath: imagePaths[pageNo - 1],
//     }))
//     .filter((x) => x.imgPath);

//   const batches = chunkArray(extractPageList, EXTRACT_BATCH_SIZE);

//   for (const batch of batches) {
//     sendEvent("log", `Extracting data from batch... (${batch.length} pages)`);
//     const rows = await extractPageRowsGeneric(batch);

//     const patchedRows = rows.map((row) => ({
//       ...row,
//       brand_name: row.brand_name || brand_name || "",
//       page_number: batch[0]?.pageNo ?? null
//     }));

//     allRows.push(...patchedRows);
//   }


//   return {
//     rows: allRows,
//     token_usage: getTokenUsage()
//   };
// }


module.exports = {
  prepareExtractionContext,
  extractWithPlan,
  extractGeminiText
};
