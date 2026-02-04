

const PROMPTS = {

  PAGE_CLASSIFIER: `
You are a PAGE CLASSIFIER for furniture/lighting PDF catalogs.
For each page image, return JSON array.

Classes:
- FRONT_MATTER
- INDEX_PAGE
- TECH_INFO_ONLY
- UPHOLSTERY_LIST
- VARIANT_PRICE_TABLE
- MODULAR_UNIT_TABLE
- COMPOSITION_TABLE
- SIMPLE_TEXT_LIST
- BLANK_PAGE
- UNKNOWN

Rules:
- if cover page contains a clear catalog brand name, set brand_name, Otherwise brand_name="".
- if page is a table of contents / index / elenco / indice, if it contains many product/model names with page numbers -> INDEX_PAGE.
- If page has product codes + price table -> MODULAR_UNIT_TABLE or VARIANT_PRICE_TABLE or COMPOSITION_TABLE.
- If page lists fabrics/leathers categories -> UPHOLSTERY_LIST.
- If page is code/description/price list text-like -> SIMPLE_TEXT_LIST.
- If cover/index/terms/contact -> FRONT_MATTER.
- if page is a blank page -> BLANK_PAGE.
- If not sure -> UNKNOWN.

Return format:
{
  "brand_name": "",
  "pages": [
  { "page_number": 1, "class": "", "has_extractable_data": true/false, "confidence": 0.0 }
 ]
}


Return ONLY JSON.
  `.trim(),


  EXTRACTION_PLANNER: `
You are building a JSON Extraction Plan for a PDF catalog from page classifications.

Input: array of {page_number, class, has_extractable_data, confidence}.

Return ONLY JSON object.

Output format:
{
  "template_family": "AUTO",
  "skip_pages": [],
  "extract": {
    "FRONT_MATTER": [],
    "INDEX_PAGE": [],
    "UPHOLSTERY_LIST": [],
    "MODULAR_UNIT_TABLE": [],
    "COMPOSITION_TABLE": [],
    "VARIANT_PRICE_TABLE": [],
    "SIMPLE_TEXT_LIST": [],
    "BLANK_PAGE": [],
    "UNKNOWN": []
  },
  "notes": ""
}

Rules:
- Put pages with has_extractable_data=false into skip_pages.
- DO NOT extract INDEX_PAGE, FRONT_MATTER, BLANK_PAGE.
- UNKNOWN pages must be added to skip_pages (do not extract).

Return ONLY JSON.
  `.trim(),



  GENERIC_EXTRACTOR: ({ pageNo }) => `
You are extracting structured product data from ONE PDF page image.

CRITICAL RULES:
- Extract ONLY what is clearly visible on THIS page.
- DO NOT guess, infer, calculate, or merge across pages.
- Missing values -> empty string.
- ONE product variant = ONE row.

FORBIDDEN FIELDS (must ALWAYS be empty string):
- design
- system_code
- remark
- initials
- date
Never generate or infer these fields even if you can guess.


Numeric rules:
- length_cm, breath_cm, height_cm, seat_height_cm -> numeric-only strings.

PRICE RULES:
- currency: USD/EURO/INR/GBP/UNKNOWN
- price: string; digits + optional single decimal point only (no symbols/spaces), keep "." decimals, remove commas


Return STRICT JSON array ONLY:
[
  {
    "brand_name": "",
    "product_name": "",
    "furniture_type": "",
    "design": "",
    "product_code": "",
    "variant": "",
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
Return ONLY JSON.
  `.trim(),
};

module.exports = PROMPTS;
