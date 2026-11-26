'use strict';
// DEMO CATALOG — used only when Shopify credentials are not configured.
// Garment photos come from the earlier EOS one-pager (sa / enemyof).
// They are product shots of clothes, never people. Replace with live
// Shopify products as soon as the store is connected.
const SIZES = ['S', 'M', 'L', 'XL', '2XL'];

function variants(handle, price) {
  return SIZES.map((size) => ({
    id: `gid://eos/DemoVariant/${handle}-${size}`,
    title: size,
    price,
    compareAt: null,
    available: true,
    stock: null,
    options: { Size: size },
  }));
}

function product({ handle, title, price, image, description, colour, createdAt }) {
  const src = `/img/demo/${image}`;
  const img = { src, alt: title, w: 900, h: 700 };
  return {
    id: handle,
    gid: `gid://eos/DemoProduct/${handle}`,
    handle,
    title,
    descriptionHtml: `<p>${description}</p>`,
    excerpt: description.slice(0, 220),
    type: 'Tee',
    tags: ['drop-001'],
    createdAt,
    price,
    maxPrice: price,
    compareAt: null,
    onSale: false,
    available: true,
    totalStock: null,
    images: [img],
    options: [{ name: 'Size', values: SIZES }],
    sizes: SIZES,
    colours: [colour],
    variants: variants(handle, price),
    collections: ['drop-001'],
    seo: { title, description },
    drop: { preorder: false, dropAt: null },
    demo: true,
  };
}

const ITEMS = [
  product({
    handle: 'some-love-be-cursed',
    title: 'Some Love Be Cursed Tee',
    price: 50000,
    image: 'some-love-be-cursed.webp',
    colour: 'Washed grey',
    createdAt: '2026-10-26T20:00:00.000Z',
    description: 'Washed grey oversized tee with a black collar and a frayed raw hem. A horned figure with a shadow behind it, IT’S US across the chest, some love be cursed in red script, and sigils on both sleeves. Sewn by hand and made to order.',
  }),
  product({
    handle: 'kill-or-be-killed',
    title: 'Kill or Be Killed Tee',
    price: 35000,
    image: 'kill-or-be-killed.webp',
    colour: 'White',
    createdAt: '2026-10-26T19:00:00.000Z',
    description: 'White ringer tee with red trim and a raw hem. A spiked, faceless figure on the front with KILL OR BE KILLED lettered beside it. Sewn by hand and made to order.',
  }),
];

function products() {
  return ITEMS.map((p) => ({ ...p, images: p.images.map((i) => ({ ...i })), variants: p.variants.map((v) => ({ ...v, options: { ...v.options } })) }));
}

function collections() {
  return [{
    id: 'drop-001',
    gid: 'gid://eos/DemoCollection/drop-001',
    handle: 'drop-001',
    title: 'Drop 001',
    descriptionHtml: '<p>The opening drop. Limited pieces, sewn by hand.</p>',
    excerpt: 'The opening drop. Limited pieces, sewn by hand.',
    image: ITEMS[0].images[0],
    count: ITEMS.length,
    seo: { title: 'Drop 001', description: 'The first cut.' },
  }];
}

module.exports = { products, collections };
