

const PROMPTS = {

  PAGE_CLASSIFIER: `
You are a PAGE CLASSIFIER for furniture/lighting PDF catalogs.
For each page image, return JSON array.

Classes:
- FRONT_MATTER
- INDEX_PAGE
- CODE_IMAGE_ONLY
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
- If page has only product drawings/images with codes/dimensions and NO prices/categories -> CODE_IMAGE_ONLY.
- CODE_IMAGE_ONLY pages must have has_extractable_data=false.
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
    "CODE_IMAGE_ONLY": [],
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
- DO NOT extract INDEX_PAGE, FRONT_MATTER, BLANK_PAGE, UPHOLSTERY_LIST.
- UNKNOWN pages must be added to skip_pages (do not extract).
- DO NOT extract CODE_IMAGE_ONLY (skip_pages).

Return ONLY JSON.
  `.trim(),



  GENERIC_EXTRACTOR: `
You are extracting structured product data from ONE PDF page image.

CRITICAL RULES:
- Extract ONLY what is clearly visible on THIS page.
- DO NOT guess, infer, calculate, or merge across pages.
- Missing values -> empty string.
- ONE product variant = ONE row.
- Extract data strictly page-wise.
- NEVER merge data across pages.
- Must extract each product details don't skip any product variant.

PRODUCT CODE RULES:
- if product code is visible, extract it.
- if product code is not available, product_code=""

PRODUCT NAME RULES:
- If product name contains multiple languages separated by "/", keep ONLY the ENGLISH name.
  Example: "Poltrona / Armchair" → "Armchair"

- If product name contains dimensions or numbers, REMOVE the size part and keep ONLY the name.
  Example: "Sofa - 168 cm" → "Sofa"

- REMOVE units (cm, mm, m, inch, ", ') ONLY when they appear with numbers.

- If product name is already clean (no numbers, no dimensions, no language variants),
  KEEP it unchanged.


ROW SPLIT RULES:
- Never merge multiple product codes in one row.
- If codes appear as "A/B", "A,B", "A or B", or Left/Right (sx/dx), output separate rows (one row per product code).
- Left & Right versions must be 2 rows; variant should mention Left/Right if visible.
- If same code has multiple categories/grades/prices, create multiple rows (one per category/price).

Numeric rules:
- length_cm, breath_cm, height_cm, seat_height_cm -> numeric-only strings.

PRICE RULES:
- currency: USD/EURO/INR/GBP
- if currency is not visible, currency=""
- price: string; digits + optional single decimal point only (no symbols/spaces)
- If the visible price contains a decimal point ".", MUST keep it in output (do not remove ".")
- if the price showing with decimal point ".", show it as it is. (5.794)


FORBIDDEN FIELDS (must ALWAYS be empty string):
- design
- system_code
- remark
- initials
- date
Never generate or infer these fields even if you can guess.


Return STRICT JSON array ONLY:
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
Return ONLY JSON.
  `.trim(),
};

module.exports = PROMPTS;
