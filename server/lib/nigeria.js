'use strict';
// 36 states + FCT with ISO 3166-2:NG subdivision codes (Shopify province codes).
const STATES = [
  ['AB', 'Abia'], ['FC', 'Federal Capital Territory (Abuja)'], ['AD', 'Adamawa'], ['AK', 'Akwa Ibom'], ['AN', 'Anambra'],
  ['BA', 'Bauchi'], ['BY', 'Bayelsa'], ['BE', 'Benue'], ['BO', 'Borno'], ['CR', 'Cross River'],
  ['DE', 'Delta'], ['EB', 'Ebonyi'], ['ED', 'Edo'], ['EK', 'Ekiti'], ['EN', 'Enugu'],
  ['GO', 'Gombe'], ['IM', 'Imo'], ['JI', 'Jigawa'], ['KD', 'Kaduna'], ['KN', 'Kano'],
  ['KT', 'Katsina'], ['KE', 'Kebbi'], ['KO', 'Kogi'], ['KW', 'Kwara'], ['LA', 'Lagos'],
  ['NA', 'Nasarawa'], ['NI', 'Niger'], ['OG', 'Ogun'], ['ON', 'Ondo'], ['OS', 'Osun'],
  ['OY', 'Oyo'], ['PL', 'Plateau'], ['RI', 'Rivers'], ['SO', 'Sokoto'], ['TA', 'Taraba'],
  ['YO', 'Yobe'], ['ZA', 'Zamfara'],
].map(([code, name]) => ({ code, name }));

const SOUTH_WEST = new Set(['OG', 'OY', 'OS', 'ON', 'EK']);
const zoneFor = (code) => (code === 'LA' ? 'lagos' : SOUTH_WEST.has(code) ? 'southWest' : 'other');
const ZONE_LABELS = { lagos: 'Lagos', southWest: 'South West', other: 'Other states' };
const byCode = (code) => STATES.find((s) => s.code === code);

module.exports = { STATES, zoneFor, ZONE_LABELS, byCode };
