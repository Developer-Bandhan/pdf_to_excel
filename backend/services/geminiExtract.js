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
    system_code: row.system_code ?? "",

    DIA: row.DIA ?? "",
    length_cm: row.length_cm ?? "",
    breath_cm: row.breath_cm ?? "",
    height_cm: row.height_cm ?? "",
    seat_height_cm: row.seat_height_cm ?? "",

    finish_code: row.finish_code ?? "",
    finish_specification: row.finish_specification ?? "",

    currency: row.currency ?? "",
    price: row.price ?? "",

    other_material_comments: row.other_material_comments ?? "",
    special_feature: row.special_feature ?? "",

    additional_price_lowest: row.additional_price_lowest ?? "",
    additional_price_highest: row.additional_price_highest ?? "",

    cbm: row.cbm ?? "",
    product_weight_kg: row.product_weight_kg ?? "",

    remark: row.remark ?? "",
    initials: row.initials ?? "",
    date: row.date ?? "",
  };
}



async function extractPageRowsGeneric(pages, brand_name, product_name_context = "") {

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

  const productContext = product_name_context
    ? `
PRODUCT CONTEXT:
Previous page product_name = "${product_name_context}"
If a product title/header is visible on this page,
ALWAYS extract it even if similar to previous page.
Never suppress a visible title.
If no new title is visible and this is a continuation, return product_name="" (system will auto-fill).
DO NOT copy the previous product_name into output — return "" for continuation rows.
`
    : "";


  parts.push({
    text: prompts.GENERIC_EXTRACTOR + brandContext + productContext
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


async function extractWithPlan({
  imagePaths,
  plan,
  brand_name,
  classifications
}) {

  const extractPages = new Set();

  for (const [type, pages] of Object.entries(plan.extract || {})) {
    if (NON_EXTRACTABLE_TYPES.has(type)) continue;
    for (const p of pages || []) extractPages.add(p);
  }

  for (const p of plan.skip_pages || []) {
    extractPages.delete(p);
  }

  // fallback → extract all
  if (extractPages.size === 0) {
    for (let i = 1; i <= imagePaths.length; i++) {
      extractPages.add(i);
    }
  }

  const extractPageList = [...extractPages]
    .sort((a, b) => a - b)
    .map(pageNo => ({
      pageNo,
      imgPath: imagePaths[pageNo - 1]
    }))
    .filter(x => x.imgPath);


  // Build a map: pageNo -> product_name from classifier
  // This captures product names from SKIPPED pages (e.g. TECH_INFO_ONLY pages
  // that have a product title but no extractable data)
  const classificationProductNameMap = {};
  for (const c of (classifications || [])) {
    if (c?.page_number && c?.product_name) {
      classificationProductNameMap[c.page_number] = c.product_name.trim();
    }
  }

  const allRows = [];

  // PRODUCT STATE ENGINE
  let productState = {
    name: "",
    knownCodes: new Set(),
    lastExtractedPage: 0
  };

  for (const { pageNo, imgPath } of extractPageList) {

    // Check if any SKIPPED pages between last extracted page and this one
    // had a product_name detected by the classifier.
    // If so, treat that as a product boundary / new product name seed.
    for (let skippedPage = productState.lastExtractedPage + 1; skippedPage < pageNo; skippedPage++) {
      const skippedName = classificationProductNameMap[skippedPage];
      if (skippedName) {
        console.log(`[ProductState] Skipped page ${skippedPage} had product_name: "${skippedName}" — updating state.`);
        // A skipped page with a product name means a new product section started.
        // Reset codes (new product) but carry the name forward.
        productState = {
          name: skippedName,
          knownCodes: new Set(),
          lastExtractedPage: productState.lastExtractedPage
        };
      }
    }

    const classifierName = classificationProductNameMap[pageNo];

    if (
      classifierName &&
      classifierName !== productState.name
    ) {
      console.log(
        `[Boundary] New product from classifier on page ${pageNo}: ${classifierName}`
      );

      productState = {
        name: classifierName,
        knownCodes: new Set(),
        lastExtractedPage: productState.lastExtractedPage
      };
    }

    const rows = await extractPageRowsGeneric(
      [{ pageNo, imgPath }],
      brand_name,
      productState.name
    );

    productState.lastExtractedPage = pageNo;

    if (!rows.length) continue;

    // detect brand once
    if (!brand_name) {
      const detectedBrand = rows.find(r => r.brand_name);
      if (detectedBrand?.brand_name) {
        brand_name = detectedBrand.brand_name.trim();
        console.log("Brand auto-detected:", brand_name);
      }
    }

    const detectedNames = rows.map(r => r.product_name).filter(Boolean);

    const detectedCodes = rows.map(r => r.product_code).filter(Boolean);

    // PRODUCT BOUNDARY DETECTION
    // Rule 1: A genuinely NEW product name appeared on this page
    const hasNewName = detectedNames.length > 0 && productState.name && !detectedNames.includes(productState.name);

    // Rule 2: New unseen product codes appeared (possible new product)
    const hasNewCodes = detectedCodes.some(c => !productState.knownCodes.has(c)) && productState.knownCodes.size > 0;

    if (hasNewName) {
      // Definite new product — reset everything, new name will be picked up below
      productState = {
        name: "",
        knownCodes: new Set(),
        lastExtractedPage: pageNo
      };
    } else if (hasNewCodes && !detectedNames.length) {
      // New codes but NO new name visible → likely continuation of same product
      // (e.g. page 2 of same product with more variants)
      // Keep the existing product name, just reset codes so we track new ones
      productState = {
        name: productState.name,   // carry forward existing name
        knownCodes: new Set(),
        lastExtractedPage: pageNo
      };
    } else if (hasNewCodes && detectedNames.length) {
      // New codes AND a new name → definitely new product
      productState = {
        name: "",
        knownCodes: new Set(),
        lastExtractedPage: pageNo
      };
    }

    // Update state name: prefer newly detected name, else keep existing
    if (detectedNames.length) {
      productState.name = detectedNames[0].trim();
    }
    // If still no name, productState.name stays as whatever it was (carry-forward)

    detectedCodes.forEach(c =>
      productState.knownCodes.add(c)
    );

    // merge rows — always fill empty product_name with current state name
    allRows.push(
      ...rows.map(r => ({
        ...r,
        product_name: r.product_name ? r.product_name : (detectedNames.length === 0 ? productState.name : ""),
        brand_name: r.brand_name || brand_name || "",
        page_number: pageNo
      }))
    );
  }

  return allRows;
}





module.exports = {
  prepareExtractionContext,
  extractWithPlan,
  extractGeminiText
};
