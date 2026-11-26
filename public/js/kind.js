// Classify a Shopify product from productType, tags, title and handle.
// Order is specific-first so new pieces still pick up a sensible layout.
const RULES = [
  { kind: 'slide', display: 'plinth', family: 'footwear', label: 'Footwear', re: /\b(slides?|sandals?|slippers?|flip[\s-]?flops?|mules?)\b/ },
  { kind: 'sneaker', display: 'plinth', family: 'footwear', label: 'Footwear', re: /\b(sneakers?|trainers?|kicks|shoes?|boots?|loafers?)\b/ },
  { kind: 'beanie', display: 'plinth', family: 'headwear', label: 'Headwear', re: /\b(beanies?|toques?|knit[\s-]?hats?)\b/ },
  { kind: 'hat', display: 'plinth', family: 'headwear', label: 'Headwear', re: /\b(hats?|caps?|snapbacks?|dad[\s-]?caps?|buckets?|headwear|visors?)\b/ },
  { kind: 'bag', display: 'stand', family: 'bag', label: 'Bags', re: /\b(bags?|totes?|backpacks?|duffels?|duffles?|crossbodys?|purses?|wallets?|pouches?|slings?)\b/ },
  { kind: 'ring', display: 'pedestal', family: 'jewelry', label: 'Jewellery', re: /\b(rings?)\b/ },
  { kind: 'chain', display: 'pedestal', family: 'jewelry', label: 'Jewellery', re: /\b(chains?|necklaces?|pendants?|jewelry|jewellery|bracelets?)\b/ },
  { kind: 'sock', display: 'flat', family: 'soft', label: 'Socks', re: /\b(socks?)\b/ },
  { kind: 'glove', display: 'flat', family: 'soft', label: 'Gloves', re: /\b(gloves?|mittens?)\b/ },
  { kind: 'mask', display: 'plinth', family: 'soft', label: 'Masks', re: /\b(masks?|balaclavas?|face[\s-]?covers?)\b/ },
  { kind: 'shorts', display: 'flat', family: 'bottoms', label: 'Bottoms', re: /\b(shorts?|jorts?|short[\s-]?pants?|panel[\s-]?shorts?)\b/ },
  { kind: 'pants', display: 'flat', family: 'bottoms', label: 'Bottoms', re: /\b(joggers?|pants?|trousers?|sweatpants?|bottoms?|cargos?|jeans?)\b/ },
  { kind: 'hoodie', display: 'hang', family: 'apparel', label: 'Tops', re: /\b(hoodies?|hooded|zip[\s-]?hoods?|sweatshirts?)\b/ },
  { kind: 'jacket', display: 'hang', family: 'apparel', label: 'Outerwear', re: /\b(jackets?|coats?|windbreakers?|bombers?|parkas?|vests?|gilets?)\b/ },
  { kind: 'tee', display: 'hang', family: 'apparel', label: 'Tops', re: /\b(tees?|t[\s-]?shirts?|tshirts?|crop(?:ped)?(?:\s+tees?)?|tops?|crewnecks?|tanks?)\b/ },
  { kind: 'shirt', display: 'hang', family: 'apparel', label: 'Tops', re: /\b(shirts?|long[\s-]?sleeves?|button[\s-]?downs?|flannels?|jerseys?)\b/ },
  { kind: 'accessory', display: 'pedestal', family: 'accessory', label: 'Accessories', re: /\b(accessories|accessory|belts?|keychains?|pins?|patches?|footwear)\b/ },
];

export const KINDS = RULES.map((r) => r.kind).concat('default');

export function productKind(p = {}) {
  // Admin override (Shopify tag eos-kind:<kind>) wins over detection.
  const forced = p.kind || ((p.tags || []).find((t) => /^eos-kind:/i.test(t)) || '').slice(9).toLowerCase();
  if (forced) {
    const r = RULES.find((x) => x.kind === forced);
    if (r) return { kind: r.kind, display: r.display, family: r.family, label: r.label };
    if (forced === 'default') return { kind: 'default', display: 'plinth', family: 'other', label: 'The piece' };
  }
  // Product type is the strongest signal; then title + handle; tags last.
  const norm = (a) => a.filter(Boolean).join(' ').toLowerCase().replace(/[_/]+/g, ' ');
  const tiers = [norm([p.type, p.productType]), norm([p.title, p.handle]), norm(p.tags || [])];
  for (const hay of tiers) {
    if (!hay) continue;
    for (const rule of RULES) {
      if (rule.re.test(hay)) return { kind: rule.kind, display: rule.display, family: rule.family, label: rule.label };
    }
  }
  return { kind: 'default', display: 'plinth', family: 'other', label: 'The piece' };
}

// Per-kind product page. layout drives the page structure, guide picks the size guide,
// focus is the category-specific panel. Copy stays factual: nothing invented about a piece.
const PAGES = {
  slide: { layout: 'footwear', guide: 'footwear', hint: 'Drag to turn', focusTitle: 'Sizing', focusCopy: 'Slides are listed in EU sizes. Take your usual shoe size. If you are between two sizes, take the larger one.' },
  sneaker: { layout: 'footwear', guide: 'footwear', hint: 'Drag to turn', focusTitle: 'Sizing', focusCopy: 'Listed in EU sizes. Take your usual shoe size, and use the conversion chart if you shop in UK or US sizes.' },
  hat: { layout: 'headwear', guide: 'headwear', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'Measure around your head just above the ears and compare with the fit guide. Message us if you want advice before ordering.' },
  beanie: { layout: 'headwear', guide: 'headwear', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'A close, soft fit with stretch. Fold the cuff once for a shorter crown.' },
  bag: { layout: 'bag', guide: 'details', hint: 'Drag to turn', focusTitle: 'Details', focusCopy: 'Capacity, closures and hardware are listed in the description. Ask us for exact measurements before you order.' },
  chain: { layout: 'jewelry', guide: 'jewelry', hint: 'Drag to turn', focusTitle: 'Care', focusCopy: 'Keep it dry, store it away from light and other metals, and wipe it with a soft cloth after wearing.' },
  ring: { layout: 'jewelry', guide: 'ring', hint: 'Drag to turn', focusTitle: 'Ring size', focusCopy: 'Measure the inside diameter of a ring that fits you and compare it with the ring size chart.' },
  pants: { layout: 'bottoms', guide: 'bottoms', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'Measure your waist where you wear your trousers and compare with the size guide. Message us if you want advice on the fit.' },
  shorts: { layout: 'bottoms', guide: 'bottoms', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'Measure your waist where you wear your shorts and compare with the size guide. Message us if you want advice on the fit.' },
  hoodie: { layout: 'apparel', guide: 'tops', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'Lay a hoodie you like flat and compare its chest and length with the size guide.' },
  jacket: { layout: 'apparel', guide: 'tops', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'Leave room for a layer underneath. Compare a jacket you own with the size guide.' },
  shirt: { layout: 'apparel', guide: 'tops', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'Compare chest and length with a shirt you own using the size guide.' },
  tee: { layout: 'apparel', guide: 'tops', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'Lay a tee you like flat and compare its chest and length with the size guide.' },
  sock: { layout: 'soft', guide: 'footwear', hint: 'Drag to turn', focusTitle: 'Sizing', focusCopy: 'Choose by your shoe size.' },
  glove: { layout: 'soft', guide: 'details', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'Measure around your palm below the knuckles. Message us and we will match you to a size.' },
  mask: { layout: 'soft', guide: 'details', hint: 'Drag to turn', focusTitle: 'Fit', focusCopy: 'One size, with stretch. Message us if you want measurements before you order.' },
  accessory: { layout: 'accessory', guide: 'details', hint: 'Drag to turn', focusTitle: 'Details', focusCopy: 'Materials and finish are in the description. Ask us if you need anything more.' },
  default: { layout: 'accessory', guide: 'details', hint: 'Drag to turn', focusTitle: 'Details', focusCopy: 'Everything we know about this piece is in the description. Ask us if you need anything more.' },
};

export function kindPage(kind) {
  return PAGES[kind] || PAGES.default;
}
