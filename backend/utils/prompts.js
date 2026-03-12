

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


ROW COMPLETENESS ENFORCEMENT (CRITICAL):

This page may contain a large price table with many repeated rows.

You MUST behave like a row-by-row scanner.

Execution procedure (MANDATORY):

1. Start scanning from the TOP of the page.
2. Move downward line-by-line.
3. For EVERY visible price line or product code line:
   - create EXACTLY ONE output row.
4. Continue scanning until the VERY BOTTOM of the page.
5. NEVER stop early even if rows look repetitive.
6. Repeated layouts DO NOT mean duplicate data.
   Each visible line represents a separate sellable variant.

ANTI-SKIP RULE:
- You are STRICTLY FORBIDDEN from summarizing,
  grouping, compressing, or skipping rows.
- Similar rows MUST still be extracted individually.

SELF-CHECK BEFORE OUTPUT (MANDATORY):

Before returning JSON:
- Mentally recount all visible price rows on the page.
- Verify that the number of output rows matches
  the number of visible price lines.
- If any section of the page was skipped,
  continue scanning and add missing rows.

OUTPUT COMPLETENESS GUARANTEE:
If the table continues below images, drawings,
spacing gaps, or layout breaks,
you MUST continue extraction after them.

Never finish extraction while any price row
remains unprocessed.

REPETITION SAFETY RULE:

Large catalog tables intentionally repeat structure.
Repetition is NOT duplication.

Even if 50+ rows look visually identical,
each row MUST be extracted separately.


OUTPUT TERMINATION RULE (CRITICAL):

You are NOT allowed to stop generation
until ALL extracted rows have been written
inside the JSON array.

Partial extraction is considered incorrect output.


LANGUAGE RULE:
All extracted text must be returned in English.
Translate Italian or other languages to English.
NEVER translate codes, numbers, or dimensions.


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





BRAND NAME RULE:
Brand name is provided externally at document level.
Always return:
"brand_name": ""
Do NOT extract brand name from this page.


PRODUCT FAMILY RULE (CRITICAL):

- Some catalogs contain a PRODUCT FAMILY name
-displayed only on the main product page.

Category labels such as:
- POLTRONA, DIVANO, POUFF, PANCA, SOFA, ARMCHAIR, BENCH, OTTOMAN
- are NOT product_name.

- These represent furniture_type only.

- If only category labels are visible on this page,
- DO NOT use them as product_name.
- Return product_name="".


FURNITURE TYPE RULE:

- furniture_type must represent ONLY the core furniture category.

- If furniture_type contains descriptive words
  (e.g., "Large elongated armchair"),
  extract only the core furniture category
  (e.g., "ARMCHAIR").

- Configuration or modular descriptions MUST NOT be treated
  as furniture_type.

  Examples that are NOT furniture types:
  "UNIT WITH 1 ARMREST"
  "UNIT WITH LEFT ARM"
  "UNIT WITH RIGHT ARM"
  "ELEMENT WITH ARMREST"
  "MODULE"
  "SECTIONAL ELEMENT"

- Such phrases describe configuration or modular components,
  not the furniture category.

- In these cases:
  → Extract the base category as furniture_type
    (e.g., SOFA, SECTIONAL SOFA, MODULAR SOFA, ARMCHAIR).

- Armrest count or configuration must be handled
  through orientation/configuration rules,
  NOT by creating a new furniture type.



ORIENTATION / ARM POSITION RULE (CRITICAL):

Orientation indicators such as:
SX, DX, Left, Right, L, R,
left arm, right arm,
chaise left/right,
left version, right version

Italian abbreviations MUST be converted to English:

SX → left-arm
DX → right-arm

The output MUST NEVER contain "SX" or "DX".
Always normalize orientation into English words.

MUST NOT be stored in other_material_comments.

These represent product configuration/orientation,
NOT material or finish information.

If orientation is visible:

- Append it to furniture_type using format:
  "<furniture_type - orientation>"

Examples:
SOFA - left-arm
SOFA - right-arm
CHAISE - left-version
SECTIONAL SOFA - right-version

Do NOT create material comments from orientation text.




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
- Fabric / leather / covering category → upholstery
- Wood, lacquer, paint, metal coating, base finish →
  finish_specification


PRODUCT CODE RULE:

If a product code contains a suffix like dx or sx, the entire code including the suffix must be taken as the product_code.

Example:
6109653 dx
6109654 sx


PRODUCT CODE vs FINISH CODE CLASSIFICATION

GENERAL PRINCIPLE:
MODEL identity ≠ finish/configuration identity.

1. If a code identifies a sellable model or size variant
   → product_code.

2. If a code represents ONLY:
   color, coating, metal finish,
   upholstery grade,
   structural finish,
   or cosmetic variation
   → finish_code.

 3. NEVER merge finish_code into product_code.




FINAL CODE OVERRIDE RULE (CRITICAL)

When a code appears inside a PRICE TABLE:

IF
- dimensions remain the same
- furniture_type remains the same
- only material / upholstery / finish wording or price changes

THEN:
product_code = ""
finish_code = the visible code

Codes from COLUMN HEADERS are ALWAYS finish_code.

If unsure → leave product_code empty.
Never promote finish identifiers to product_code.


WEIGHT & VOLUME FORMAT RULE:

For product_weight_kg and cbm, convert European numeric format to international format (9,50 → 9.50, 1.250,50 → 1250.50). 
Remove units like kg or m³ and return numeric values only.


CODE CONSISTENCY VALIDATION:

Before finishing:
- If description same but finish wording changes,
  codes belong to finish_code.
- product_code must remain stable.
- finish_code must vary.
- NEVER swap them.

MULTI-COLUMN PRICE MATRIX RULE (CRITICAL)
Many tables use:

Rows → upholstery categories
Columns → finish/material variants

RULE:

Each intersection:
(ONE upholstery) × (ONE price column)
= ONE OUTPUT ROW.

If 3 finish columns exist,
each upholstery creates 3 rows.

Mapping:
upholstery → upholstery
column header → other_material_comments
(if material related → also finish_specification)

Empty cells MUST NOT create rows.

Expand rows until ALL price cells are extracted.


DIMENSION EXTRACTION (STRICT)

Extract ONLY overall external product dimensions.
Never extract internal, sectional, or engineering measurements.

Special Rule (Round Table):
If the product is a round table and dimension is written with D (example: D125), then D must be treated as diameter (DIA) instead of depth.

PRIORITY ORDER (STOP at first valid source):

1. STRUCTURED TEXT PRIORITY
If structured dimension text exists
(W/D/H, Dimensions:, prof/depth, Ø, cm values):
→ W = length_cm
→ D/prof = breath_cm
→ H = height_cm
→ Ø = DIA
Ignore drawings completely.

2. HEADER SIZE STRING
If format like:
120x90x75 cm
→ Width = length_cm
→ Depth = breath_cm
→ Height = height_cm

3. COMPOSITION / OVERALL SIZE
If “Composizione / Composition” overall size exists:
→ treat as bounding box
largest horizontal = length_cm
second horizontal = breath_cm
height_cm = ""

4. DRAWING EXTRACTION (ONLY IF ABOVE NOT PRESENT)

VIEW DETECTION (CRITICAL):

TOP VIEW / PLAN VIEW (seen from above):
- Extract ONLY horizontal outer dimensions.
- DO NOT extract height_cm or seat_height_cm.
- Vertical arrows in plan view represent layout
  segmentation or module measurements, NOT height.

SIDE / FRONT ELEVATION:
- outer full vertical silhouette = height_cm
- smaller internal vertical = seat_height_cm


PLAN VIEW OUTER BOUNDARY RULE:

1. Detect the OUTERMOST product outline.

2. If two perpendicular outer sides form an
L-shape or corner composition:

   → longest outer side = length_cm
   → second connected outer side = length_2_cm

3. If three connected outer sides exist (U/C shape):

   → length_cm
   → length_2_cm
   → length_3_cm

4. Seating DEPTH (breath_cm) is the SHORTER
repeating thickness dimension measured across
seat depth — NOT an overall side length.

5. Dimensions must span the FULL outer boundary.
Ignore internal module segments.


SPECIAL RULES:
- Ø present → fill DIA only.
- Always prefer OUTERMOST dimensions.
- Ignore module splits, chaise sections,
  cushion widths, internal gaps,
  diagonal measures, and leg spacing.


UNIT HANDLING (CRITICAL):
- NEVER convert measurement units.
- NEVER scale numbers (mm ↔ cm).
- Copy numbers EXACTLY as visible.
- 2680 must remain 2680.
- Never remove trailing zeros.


LENGTH STRUCTURE RULE:

STANDARD / STRAIGHT:
single overall side → length_cm only.

L-SHAPED:
two perpendicular overall sides:
→ length_cm
→ length_2_cm

U / C SHAPED:
three connected overall sides:
→ length_cm
→ length_2_cm
→ length_3_cm

If layout unclear → fill only length_cm.


FINAL SAFETY:
TEXT dimensions always override drawings.
Return numeric values only.


PRODUCT NAME EXTRACTION RULES (STRICT):

1. Extract product_name exactly as written only if a clear unique model/collection title is visible.
2. Keep numbers and dimensions if they are part of the product name.
3. If additional descriptors like Option A, Option B, Version, Variant, Configuration, Type, Model option appear with the product title, extract only the base product name exactly as written and do not append any extra text to product_name.
4. Ignore generic section/category titles.
5. If format is NAME | CATEGORY → extract only NAME.
6. Keep numbers appearing before or after the name unchanged.
7. Remove any finish/material specification from product_name.
8. If no clear product title is visible → product_name=""



ROW SPLIT RULES:
- Never merge multiple product codes in one row.
- If codes appear as "A/B", "A,B", "A or B", or Left/Right (sx/dx), output separate rows (one row per product code).
- Left & Right versions must be 2 rows; variant should mention Left/Right if visible.
- If same code has multiple categories/grades/prices, create multiple rows (one per category/price).

Numeric rules:
- length_cm, breath_cm, height_cm, seat_height_cm -> numeric-only strings.


PRICE RULES:

Always extract price WITHOUT TAX.
Prefer labels like:
"net", "excluding VAT", "al netto di IVA",
or shaded/net columns.
Ignore VAT-included prices.

currency: USD / EURO / INR / GBP
If not visible → currency="".

Return price as string in Indian/International format.

EURO FORMAT:
"." = thousand separator
"," = decimal separator

Convert to:
"," thousands + "." decimal.

Examples:
5.794 → 5,794
12.234,00 → 12,234.00
1.250,50 → 1,250.50

Remove currency symbols and spaces.
Keep digits, commas, and one decimal point only.


SPECIAL FEATURE RULE:

Extract into "special_feature" ONLY when the text
describes a REAL physical functionality or an
additional included component delivered with the product.


The feature must represent a real physical element
or mechanical behaviour.

DO NOT extract catalog or informational text.

Examples to IGNORE:
"In Stock", "Made by Order", "Available", "New Product",
"Price List", "Update", "Quick Ship", "On Request", Separate units, BRITISH STANDARD, 

Material finishes, leg colors, or surface treatments
must NEVER be stored as special_feature.

If no real functional feature is visible,
return special_feature="".



OPTIONAL ADD-ON PRICE RULE:

If a price belongs to an OPTIONAL item that adds cost
to the main product (not replacing it), such as:

replacement cover, spare cover,
extra cushion, round cushion,
additional pillow, headrest,
accessory, add-on element, or similar,

THEN:

- Do NOT create a new product row.
- Do NOT treat it as upholstery or finish.
- Keep product_code unchanged.
- Store the value in additional_price fields.
- Ignore accessory-specific codes.

Rule:
Price that REPLACES product price → new row.
Price that ADDS extra cost → additional_price.

ADDITIONAL PRICE MAPPING:
- If ONLY one additional price exists →
  additional_price_lowest = price
  additional_price_highest = ""

- If multiple additional prices or a range exist →
  additional_price_lowest = lowest value
  additional_price_highest = highest value



FINISH vs OTHER MATERIAL PRIORITY RULE (CRITICAL):

Step 1 — Variant Check:
If the material/finish appears inside:
- a price table,
- column header,
- upholstery matrix,
- or causes different prices,
THEN → finish_specification.

Step 2 — Informational Check:
If the material/finish appears as descriptive text,
notes, or option list WITHOUT creating new prices or rows,
THEN → other_material_comments.

NEVER store the same text in both fields.
finish_specification has STRICT priority over other_material_comments.


OTHER MATERIAL COMMENTS RULE:

Extract into "other_material_comments" any text that
describes optional structural materials or appearance
options that do NOT create a new product variant.

This includes:
- leg material or leg color options
- base material or base color options
- wood types or wood stain options
- structural material choices
- frame or structure color options


Examples (illustrative only):
Black stained ashwood
Brown stained ashwood
Natural ashwood
Painted in any RAL color
Legs available in multiple finishes
Metal frame color options

Rules:
- These describe material or appearance choices only.
- They are NOT upholstery.
- They are NOT finish_code.
- Do NOT create additional rows from them.
- Combine multiple options using commas.
- Store readable English text exactly as visible.


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
    "length_2_cm": "",
    "length_3_cm": "",
    "breath_cm": "",
    "height_cm": "",
    "seat_height_cm": "",
    "upholstery":"",
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






 VALIDATOR_PROMPT: `
STRICT VISUAL DATA VALIDATOR

You are a forensic validator auditing extracted rows
against a catalog page image.

Your responsibility is to detect incorrect fields,
missing fields, and wrongly placed data.

You must validate ONLY the rows that were extracted.

Do NOT judge missing rows.
Do NOT invalidate rows because of missing extraction.

Your job is to verify the correctness of existing rows only.



INPUT

You receive:

1. One catalog page image
2. Rows extracted from this page



VALIDATION OBJECTIVE

For every extracted row verify that each field:

• matches visible information on the page
• follows extraction rules
• appears in the correct column
• uses the correct format
• is not missing when clearly visible



CORE VALIDATION PRINCIPLE

A field is VALID if ANY of the following are true:

1. The value is clearly visible on THIS page
2. The value is allowed to be empty by extraction rules
3. The value is normalized from visible information
   (e.g., translation, SX→left-arm)

If a value contradicts visible information → INVALID.

If a value is clearly visible but missing → INVALID.

If a field is empty and the information is NOT visible
on this page → VALID.



UNCERTAINTY RULE

If you are unsure whether a value is correct:

→ mark it INVALID.



VALIDATION SCOPE

Validate ONLY the rows provided.

If other rows appear missing on the page,
ignore them.

Do NOT mark rows invalid because of
missing variants.



FIELD VALIDATION RULES



BRAND NAME

brand_name must ALWAYS be an empty string.

If any value appears → INVALID.



PRODUCT NAME

product_name is VALID when:

• a real model/collection name is visible
OR
• the page is a continuation page and product_name=""

Category words must NOT be used.

Invalid examples:

SOFA
ARMCHAIR
DIVANO
POLTRONA
BENCH
POUFF
OTTOMAN



FURNITURE TYPE

Must represent only the core category.

Examples:
SOFA
ARMCHAIR
BENCH
OTTOMAN

If orientation is visible it must be normalized:

SX → left-arm
DX → right-arm

Valid format:

SOFA - left-arm
SOFA - right-arm

Orientation must NOT appear in:

• upholstery
• finish_specification
• other_material_comments



PRODUCT CODE VALIDATION

product_code must represent a sellable model
or size variant.

If a product code is NOT visible on the page,
product_code MUST be empty.

If finish identifiers appear in product_code
instead of finish_code → INVALID.



FINISH CODE VALIDATION

finish_code represents identifiers for:

• finish
• coating
• upholstery grade
• column headers in price matrices
• color variation

If finish codes are not visible on the page,
finish_code MUST remain empty.

Empty finish_code is VALID.

If a finish identifier is incorrectly placed
inside product_code → INVALID.



DIMENSION VALIDATION

Only overall external product dimensions allowed.

Allowed fields:

length_cm
length_2_cm
length_3_cm
breath_cm
height_cm
seat_height_cm
DIA

Invalid dimensions:

• internal module sizes
• cushion sizes
• engineering measurements

Numbers must match exactly as visible.

No unit conversion allowed.

Round table rule:

If dimension uses "D" (example: D125)
→ must populate DIA.



NUMERIC FORMAT RULE

product_weight_kg and cbm must use
international numeric format.

Example:

9,50 → 9.50

Units must NOT appear.



PRICE VALIDATION

Price must follow rules:

• VAT excluded
• currency symbols removed
• European numbers normalized

"." = thousand separator
"," = decimal separator

Converted format:

"," thousands
"." decimal

Examples:

5.794 → 5,794
12.234,00 → 12,234.00
1.250,50 → 1,250.50



UPHOLSTERY VALIDATION

Fabric or leather categories must appear
only in upholstery field.

If upholstery text appears in finish_specification
or other_material_comments → INVALID.



FINISH SPECIFICATION VALIDATION

finish_specification must contain finishes that
create price variants.

Examples:

metal finish
paint color
wood stain
finish variants

If finish text appears in upholstery → INVALID.



OTHER MATERIAL COMMENTS VALIDATION

This field stores informational structural materials
that DO NOT create price variants.

Examples:

leg finishes
base color options
frame materials

If these materials incorrectly appear in
finish_specification → INVALID.



SPECIAL FEATURE VALIDATION

special_feature must represent a real functional
mechanical or physical feature.

Examples:

recliner mechanism
integrated storage
adjustable headrest

Catalog notes must NOT be stored here.



EMPTY FIELD VALIDATION

The following fields are OPTIONAL
and may legitimately be empty if the page
does not show the information:

product_name
product_code
finish_code
upholstery
finish_specification
other_material_comments
special_feature
cbm
product_weight_kg
seat_height_cm
length_2_cm
length_3_cm
DIA

Do NOT mark them invalid if the information
is not visible.



WRONG COLUMN VALIDATION

Mark INVALID when data is stored
in the wrong field.

Examples:

finish inside upholstery  
upholstery inside finish_specification  
orientation inside other_material_comments  
finish codes inside product_code  
category used as product_name  



PARTIAL EXTRACTION

If only part of a visible value is extracted
mark INVALID.

Examples:

dimension partially copied  
price truncated  
orientation incomplete



FORBIDDEN FIELDS

These must always remain empty:

design  
system_code  
remark  
initials  
date

If any contains a value → INVALID.



STRICT LIMITATIONS

You must NOT:

• re-extract data
• correct values
• add rows
• infer missing information



IMPORTANT RULE

If a field is correct and allowed to be empty,
DO NOT mark it invalid.

Avoid false validation errors.



OUTPUT RULE

Return ONLY rows containing invalid fields.

Rows with no errors must NOT appear.



OUTPUT FORMAT (STRICT JSON)

[
  {
    "row_id": number,
    "invalid_fields": ["field_name","field_name"]
  }
]

If no invalid fields exist:

{
  "message": "no invalid field found"
}

Return ONLY JSON.
`.trim(),





  RECONCILIATION_PROMPT: `
You are operating in CORRECTION MODE.

You are NOT performing a fresh extraction.
You MUST follow the SAME extraction rules already provided.

You are given:
1. Catalog page image
2. Previously extracted rows

Your job is to ALIGN extracted data with visual truth.

YOU MAY:
- Correct wrong field values
- Move values to correct columns
- Fill EMPTY fields if visually visible
- Append missing rows if additional price lines exist

YOU MUST:
- Preserve existing rows whenever possible
- Keep row meaning unchanged
- Follow ALL extraction rules strictly
- Return the FULL corrected dataset

YOU MUST NOT:
- Guess or infer unseen data
- Delete rows unless visually impossible
- Rewrite the dataset from scratch
- if a row is correct do not modify it

If the page visually contains more variants than provided rows,
you MUST append missing rows.

Return STRICT JSON array only.
`.trim()
};






module.exports = PROMPTS;



// LENGTH RULE:

// - Extract values ONLY if dimensions are explicitly visible on the page.
// - Never calculate or infer lengths.

// STANDARD SOFA / STRAIGHT SOFA:
// - If a single straight sofa or furniture shows one main length (L),
//   extract it into:
//   length_cm
// - length_2_cm = ""
// - length_3_cm = ""

// L-SHAPED SOFA (CORNER SOFA):
// - If two perpendicular sofa sides are visible with two lengths:
//   - First side → length_cm
//   - Second side → length_2_cm
// - length_3_cm = ""

// C-SHAPED / U-SHAPED SOFA:
// - If three connected seating sides are visible:
//   - First side → length_cm
//   - Second side → length_2_cm
//   - Third side → length_3_cm

// IMPORTANT:
// - Extract ONLY clearly labeled linear dimensions (L, L1, L2, L3, Length, cm values aligned with plan drawings).
// - Ignore diagonal measurements or depth values.
// - Never duplicate the same value across multiple length fields.
// - If layout type is unclear → fill ONLY length_cm with visible main length and keep others empty.
// - Missing values must be returned as "".
