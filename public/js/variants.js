// Option/variant state shared by the product page and the quick view.
export const isSize = (n) => /^size$/i.test(n || '');
export const isColour = (n) => /^colou?r$/i.test(n || '');

export function selection(p, { colour = null, size = null } = {}) {
  const options = p.options || [];
  const sizeOpt = options.find((o) => isSize(o.name)) || null;
  const colourOpt = options.find((o) => isColour(o.name)) || null;
  const preorder = Boolean(p.drop && p.drop.preorder);
  const firstAvail = p.variants.find((v) => v.available) || p.variants[0];
  const sel = {};
  options.forEach((o) => { sel[o.name] = (firstAvail && firstAvail.options[o.name]) || o.values[0]; });
  if (colourOpt && colour && colourOpt.values.includes(colour)) sel[colourOpt.name] = colour;
  if (sizeOpt) sel[sizeOpt.name] = size && sizeOpt.values.includes(size) ? size : (sizeOpt.values.length === 1 ? sizeOpt.values[0] : null);
  const variant = () => (options.length ? (options.every((o) => sel[o.name]) ? p.variants.find((v) => options.every((o) => v.options[o.name] === sel[o.name])) || null : null) : p.variants[0]);
  const canBuy = (name, value) => p.variants.some((v) => v.options[name] === value
    && options.every((o) => o.name === name || (!isSize(name) && isSize(o.name)) || !sel[o.name] || v.options[o.name] === sel[o.name])
    && (v.available || preorder));
  return { options, sizeOpt, colourOpt, sel, preorder, variant, canBuy, colour: () => (colourOpt ? sel[colourOpt.name] : null), size: () => (sizeOpt ? sel[sizeOpt.name] : null) };
}
