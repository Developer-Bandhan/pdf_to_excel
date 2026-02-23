

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
- if page is a table of contents / index / elenco / indice, if it contains many product names with page numbers -> INDEX_PAGE.
- If page has product codes + price table -> MODULAR_UNIT_TABLE or VARIANT_PRICE_TABLE or COMPOSITION_TABLE.
- If page has only product drawings/images with codes/dimensions and NO prices/categories -> CODE_IMAGE_ONLY.
- CODE_IMAGE_ONLY pages must have has_extractable_data=false.
- Pages containing numeric finish codes + color/material names but NO prices and NO product models -> UPHOLSTERY_LIST.
- If page lists fabrics/leathers categories -> UPHOLSTERY_LIST.
- if page don't have any product code, description and price, if only have page number and product name it is not SIMPLE_TEXT_LIST (it is UPHOLSTERY_LIST).
- If page is code/description/ product price list text-like -> SIMPLE_TEXT_LIST. 
- If cover/index/terms/contact -> FRONT_MATTER.
- if page is a blank page -> BLANK_PAGE.
- If not sure -> UNKNOWN.

PRODUCT NAME DETECTION (CRITICAL - applies to ALL page types):
- Even if a page is classified as TECH_INFO_ONLY, CODE_IMAGE_ONLY, or any other non-extractable type,
  you MUST still detect and return the product_name if a clear product title/model name is visible.
- product_name: the dominant product model/collection name visible on the page (e.g. "OSLO", "ALBA", "AM002").
- Do NOT use furniture category words (SOFA, ARMCHAIR, POLTRONA) as product_name.
- If no clear product name is visible, product_name="".

Also detect layout signals:

- has_large_product_title:
  true if a dominant large product heading exists.

- has_hero_product_image:
  true if a large main product photo dominates the page.

first_product_code_appearance:
  true ONLY if product codes appear together with a clearly new product section
  or a visually separated product block on THIS page.
  Do NOT assume continuation from other pages.


Return format:

{
  "brand_name": "",
  "product_family_title": "",
  "pages": [
  {
    "page_number": 1,
    "class": "",
    "product_name": "",
    "has_extractable_data": true,
    "confidence": 0.0,
    "has_large_product_title": true/false,
    "has_hero_product_image": true/false,
    "first_product_code_appearance": true/false
  }
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

Return ONLY JSON.4
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


LANGUAGE RULE:
All extracted text must be returned in English.
If any text is in Italian or another language, translate it to English (do not change codes, numbers, or dimensions).


CONTEXT AWARENESS RULE:
A previous product_name may be provided as context from the previous page.

Rules:
1. If a CLEARLY NEW product title/model name is visible on THIS page (different from context),
   extract it as product_name for those rows.
2. If this page is a continuation (no new title visible), return product_name="" for all rows.
   (The system will auto-fill the previous product_name.)
3. If BOTH a continuation section AND a new product section exist on this page:
   - Rows belonging to the continuation: product_name=""
   - Rows belonging to the new product: product_name=<new name>
4. NEVER copy the context product_name into the output — always return "" for continuation rows.
   The system handles backfilling automatically.


FURNITURE TYPE RULE:
- If furniture_type contains descriptive words (e.g., "Large elongated armchair"), extract only the core furniture category (e.g., "ARMCHAIR").


BRAND NAME RULE:
Brand name is provided externally at document level.
Always return:
"brand_name": ""
Do NOT extract brand name from this page.


PRODUCT FAMILY RULE (CRITICAL):

- Some catalogs contain a PRODUCT FAMILY name
-displayed only on the main product page.

Category labels such as:
- POLTRONA, DIVANO, POUFF, PANCA, SOFA, ARMCHAIR, BENCH
- are NOT product_name.

- These represent furniture_type only.

- If only category labels are visible on this page,
- DO NOT use them as product_name.
- Return product_name="".

CATEGORY VS PRODUCT TITLE DISAMBIGUATION (STRICT):

- Words describing furniture type or category
- must NEVER be treated as product_name.

- Examples of category words:
POLTRONA, DIVANO, POUFF, PANCA, SOFA,
ARMCHAIR, BENCH, CHAIR, OTTOMAN.

These must be extracted as furniture_type ONLY.

If such words appear near product codes,
they are NOT product titles.
In this case return product_name="".

UPHOLSTERY / MATERIAL RULE:
- If upholstery, leather, fabric, wood finish, lacquer,
- veneer, or material finish is visible,
- extract it into "finish_specification".

NEVER create or output any field named "upholstery".



PRODUCT CODE RULES:
- if product code is visible, extract it.
- if product code is not available, product_code=""


FINISH CODE RULES:
- Finish code must NEVER be merged with product_code.
- If a code clearly refers to finish/material,
- extract it ONLY into "finish_code".
- if product code is not available, then product_code=""



DIA RULE:
- Extract only if a circular diameter value explicitly labeled as "D" or "DIA" or "Ø" is visible.
- Otherwise return "".



PRODUCT NAME EXTRACTION RULES (STRICT):

1. Extract product_name exactly as written only if a clear unique model/collection title is visible.
2. Keep numbers and dimensions if they are part of the product name.
3. Ignore generic section/category titles.
4. If format is NAME | CATEGORY → extract only NAME.
5. Keep numbers appearing before or after the name unchanged.
6. Remove any finish/material specification from product_name.
7. If no clear product title is visible → product_name=""


ROW SPLIT RULES:
- Never merge multiple product codes in one row.
- If codes appear as "A/B", "A,B", "A or B", or Left/Right (sx/dx), output separate rows (one row per product code).
- Left & Right versions must be 2 rows; variant should mention Left/Right if visible.
- If same code has multiple categories/grades/prices, create multiple rows (one per category/price).

Numeric rules:
- length_cm, breath_cm, height_cm, seat_height_cm -> numeric-only strings.




PRICE RULES:3
- currency: USD / EURO / INR / GBP
- if currency is not visible, currency=""

- price must be returned as a string using Indian number format.

EURO FORMAT CONVERSION RULE:
European price format uses:
"." as thousand separator
"," as decimal separator

Convert it to Indian/International format:
"," as thousand separator
"." as decimal separator

Examples:
12.234,00  ->  12,234.00
5.794      ->  5,794
1.250,50   ->  1,250.50

- Remove currency symbols and spaces.
- Keep digits, thousand separators, and a single decimal point only.


SPECIAL FEATURE RULE:

Extract "special_feature" ONLY if a real product functionality
or design feature is clearly described.

Valid examples:
extendable mechanism, reclining system, storage function,
rotating base, adjustable height, folding system, modular system.

DO NOT extract:
availability, stock status, production status, delivery notes,
commercial labels or catalog notes.

Examples to IGNORE:
"In Stock", "Made by Order", "Available", "New Product",
"Price List", "Update", "Quick Ship", "On Request".

If no real functional feature is visible,
return special_feature="".




FULL PAGE COVERAGE RULE (CRITICAL):

You MUST scan the ENTIRE page from top to bottom
and extract ALL product rows visible on the page.

Do NOT stop after extracting a few products.

Many pages contain multiple separated product blocks.
You must continue scanning until the bottom of the page.

Before finishing:
- verify that every visible product code,
  price row, or dimension block has been extracted.
- if multiple product sections exist, extract rows from ALL sections.

Never skip products because of layout changes,
images, spacing, or section breaks.





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
    "DIA":"",
    "length_cm": "",
    "breath_cm": "",
    "height_cm": "",
    "seat_height_cm": "",
    "finish_code":"",
    "finish_specification": "",
    "currency": "",
    "price": "",
    "other_material_comments": "",
    "special_feature": "",
    "additional_price_lowest": "",
    "additional_price_highest": "",
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


// - If product name contains multiple languages separated by "/", keep ONLY the ENGLISH name.
//   Example: "Poltrona / Armchair" → "Armchair"



// PRODUCT NAME RULES:
// - If a clear product title or collection name is visible as a heading near the product block,
//   extract that as product_name.

// - Never use description as product name.

// - If product name contains dimensions or numbers, REMOVE the size part and keep ONLY the name.
//   Example: "Sofa - 168 cm" → "Sofa"

// - REMOVE units (cm, mm, m, inch, ", ') ONLY when they appear with numbers.

// - If product name is already clean (no numbers, no dimensions, no language variants),
//   KEEP it unchanged.


// BRAND NAME RULES:
// - if brand name is visible, extract it.
// - if brand name is not available, brand_name=""



// {
//   "brand_name": "",
//   "pages": [
//   { "page_number": 1, "class": "", "has_extractable_data": true/false, "confidence": 0.0 }
//  ]
// }