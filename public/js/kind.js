// Classify a Shopify product from productType, tags, title and handle.
// Order is specific-first so new pieces still pick up a sensible layout.
const RULES = [
  { kind: 'slide', display: 'shelf', family: 'footwear', re: /\b(slides?|sandals?|slippers?|flip[\s-]?flops?|mules?)\b/ },
  { kind: 'sneaker', display: 'shelf', family: 'footwear', re: /\b(sneakers?|trainers?|kicks|footwear|shoes?|boots?|loafers?)\b/ },
  { kind: 'beanie', display: 'shelf', family: 'headwear', re: /\b(beanies?|toques?|knit[\s-]?hats?)\b/ },
  { kind: 'hat', display: 'shelf', family: 'headwear', re: /\b(hats?|caps?|snapbacks?|dad[\s-]?caps?|buckets?|headwear|visors?)\b/ },
  { kind: 'bag', display: 'strap', family: 'bag', re: /\b(bags?|totes?|backpacks?|duffels?|duffles?|crossbodys?|purses?|wallets?|pouches?|slings?)\b/ },
  { kind: 'ring', display: 'shelf', family: 'jewelry', re: /\b(rings?)\b/ },
  { kind: 'chain', display: 'shelf', family: 'jewelry', re: /\b(chains?|necklaces?|pendants?|jewelry|jewellery|bracelets?)\b/ },
  { kind: 'sock', display: 'shelf', family: 'soft', re: /\b(socks?)\b/ },
  { kind: 'glove', display: 'shelf', family: 'soft', re: /\b(gloves?|mittens?)\b/ },
  { kind: 'mask', display: 'shelf', family: 'soft', re: /\b(masks?|balaclavas?|face[\s-]?covers?)\b/ },
  { kind: 'shorts', display: 'hang', family: 'bottoms', re: /\b(shorts?|short[\s-]?pants?|panel[\s-]?shorts?)\b/ },
  { kind: 'pants', display: 'hang', family: 'bottoms', re: /\b(joggers?|pants?|trousers?|sweatpants?|bottoms?|cargos?)\b/ },
  { kind: 'hoodie', display: 'hang', family: 'apparel', re: /\b(hoodies?|hooded|zip[\s-]?hoods?)\b/ },
  { kind: 'jacket', display: 'hang', family: 'apparel', re: /\b(jackets?|coats?|windbreakers?|bombers?|parkas?|vests?|gilets?)\b/ },
  { kind: 'shirt', display: 'hang', family: 'apparel', re: /\b(shirts?|long[\s-]?sleeves?|button[\s-]?downs?|flannels?)\b/ },
  { kind: 'tee', display: 'hang', family: 'apparel', re: /\b(tees?|t[\s-]?shirts?|tshirts?|crop(?:ped)?(?:\s+tees?)?|tops?|crewnecks?)\b/ },
  { kind: 'accessory', display: 'shelf', family: 'accessory', re: /\b(accessories|accessory|belts?|keychains?|pins?|patches?)\b/ },
];

export function productKind(p = {}) {
  const hay = [p.type, p.productType, ...(p.tags || []), p.title, p.handle]
    .filter(Boolean).join(' ').toLowerCase().replace(/[_/]+/g, ' ');
  for (const rule of RULES) {
    if (rule.re.test(hay)) return { kind: rule.kind, display: rule.display, family: rule.family };
  }
  return { kind: 'default', display: 'hang', family: 'apparel' };
}

const PAGES = {
  slide: {
    layout: 'footwear', viewer: 'tilt-multi', hint: 'Drag to turn',
    focusTitle: 'Sole & size',
    focusCopy: 'A closer look at the sole and the last. Check the size guide before you order — we confirm fit on WhatsApp.',
    sizeCta: 'Size guide',
  },
  sneaker: {
    layout: 'footwear', viewer: 'tilt-multi', hint: 'Drag to turn',
    focusTitle: 'Sole & size',
    focusCopy: 'Built to be seen from every angle. Check the size guide before you order — we confirm fit on WhatsApp.',
    sizeCta: 'Size guide',
  },
  hat: {
    layout: 'headwear', viewer: 'spin', hint: 'Drag to spin',
    focusTitle: 'Fit',
    focusCopy: 'How it sits, how it holds. If you are between sizes, message us on WhatsApp and we will advise.',
    sizeCta: 'Fit guide',
  },
  beanie: {
    layout: 'headwear', viewer: 'spin', hint: 'Drag to spin',
    focusTitle: 'Fit',
    focusCopy: 'Soft structure, close to the head. If you want a tighter or looser feel, ask us on WhatsApp.',
    sizeCta: 'Fit guide',
  },
  bag: {
    layout: 'bag', viewer: 'strap', hint: 'Drag to turn',
    focusTitle: 'Capacity & details',
    focusCopy: 'What it holds, how it hangs, how it is finished. Read the details below, and ask if you need the exact measurements.',
    sizeCta: 'Details',
  },
  chain: {
    layout: 'jewelry', viewer: 'macro', hint: 'Drag for the detail',
    focusTitle: 'The piece',
    focusCopy: 'A closer look at the work. Keep it dry, store it dark, and wipe it with a soft cloth.',
    sizeCta: 'Size',
  },
  ring: {
    layout: 'jewelry', viewer: 'macro', hint: 'Drag for the detail',
    focusTitle: 'The piece',
    focusCopy: 'Seen up close. Confirm your size before you order — we can help on WhatsApp if you are unsure.',
    sizeCta: 'Size guide',
  },
  pants: {
    layout: 'bottoms', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fit & size',
    focusCopy: 'Cut, rise and length. Use the size guide, and write to us on WhatsApp if you want advice on the fit.',
    sizeCta: 'Size guide',
  },
  shorts: {
    layout: 'bottoms', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fit & size',
    focusCopy: 'Cut and length. Use the size guide, and write to us on WhatsApp if you want advice on the fit.',
    sizeCta: 'Size guide',
  },
  hoodie: {
    layout: 'apparel', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fabric & fit',
    focusCopy: 'How it is cut and how it falls. Check the size guide before you order.',
    sizeCta: 'Size guide',
  },
  jacket: {
    layout: 'apparel', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fabric & fit',
    focusCopy: 'Structure, layering and finish. Check the size guide before you order.',
    sizeCta: 'Size guide',
  },
  shirt: {
    layout: 'apparel', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fabric & fit',
    focusCopy: 'Sleeve, body and cloth. Check the size guide before you order.',
    sizeCta: 'Size guide',
  },
  tee: {
    layout: 'apparel', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fabric & fit',
    focusCopy: 'How it is cut and how it wears. Check the size guide before you order.',
    sizeCta: 'Size guide',
  },
  sock: {
    layout: 'soft', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fit',
    focusCopy: 'Choose your usual size. Ask us on WhatsApp if you want a note on the fit.',
    sizeCta: 'Size guide',
  },
  glove: {
    layout: 'soft', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fit',
    focusCopy: 'A close fit is the point. Check the size guide, or ask us on WhatsApp.',
    sizeCta: 'Size guide',
  },
  mask: {
    layout: 'soft', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'Fit',
    focusCopy: 'How it covers and how it holds. If you are unsure of the size, message us.',
    sizeCta: 'Fit guide',
  },
  accessory: {
    layout: 'accessory', viewer: 'macro', hint: 'Drag for the detail',
    focusTitle: 'The piece',
    focusCopy: 'Materials and finish are in the details below. Ask us on WhatsApp if you need anything more.',
    sizeCta: 'Details',
  },
  default: {
    layout: 'apparel', viewer: 'tilt', hint: 'Drag to turn',
    focusTitle: 'The piece',
    focusCopy: 'Details are below. Check the size guide if this piece is sized, or ask us on WhatsApp.',
    sizeCta: 'Size guide',
  },
};

export function kindPage(kind) {
  return PAGES[kind] || PAGES.default;
}
