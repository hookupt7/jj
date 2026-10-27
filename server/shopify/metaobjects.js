'use strict';
const { gql, checkUserErrors } = require('./client');

// Definitions this site owns. Created on first use (metaobject_definitions scope).
const DEFINITIONS = {
  eos_site_settings: {
    name: 'EOS site settings',
    fieldDefinitions: [{ name: 'Data', key: 'data', type: 'json' }],
  },
  eos_activity: {
    name: 'EOS admin activity',
    displayNameKey: 'action',
    fieldDefinitions: [
      { name: 'Action', key: 'action', type: 'single_line_text_field' },
      { name: 'Detail', key: 'detail', type: 'multi_line_text_field' },
      { name: 'At', key: 'at', type: 'date_time' },
      { name: 'IP', key: 'ip', type: 'single_line_text_field' },
    ],
  },
};

const ensured = new Map();
async function ensureDefinition(type) {
  if (ensured.get(type)) return ensured.get(type);
  const p = (async () => {
    const d = await gql(`query($t:String!){ metaobjectDefinitionByType(type:$t){ id } }`, { t: type });
    if (d.metaobjectDefinitionByType) return d.metaobjectDefinitionByType.id;
    const def = DEFINITIONS[type];
    const r = await gql(`mutation($d:MetaobjectDefinitionCreateInput!){
      metaobjectDefinitionCreate(definition:$d){ metaobjectDefinition{ id } userErrors{ field message code } } }`,
    { d: { type, name: def.name, fieldDefinitions: def.fieldDefinitions, ...(def.displayNameKey ? { displayNameKey: def.displayNameKey } : {}) } });
    const payload = r.metaobjectDefinitionCreate;
    // A concurrent request may have created it first.
    if (payload.userErrors.some((e) => e.code === 'TAKEN')) {
      const again = await gql(`query($t:String!){ metaobjectDefinitionByType(type:$t){ id } }`, { t: type });
      return again.metaobjectDefinitionByType.id;
    }
    checkUserErrors(payload, 'Metaobject definition');
    return payload.metaobjectDefinition.id;
  })();
  ensured.set(type, p);
  p.catch(() => ensured.delete(type));
  return p;
}

async function readJson(type, handle) {
  const d = await gql(`query($h:MetaobjectHandleInput!){ metaobjectByHandle(handle:$h){ id field(key:"data"){ value } } }`,
    { h: { type, handle } });
  const mo = d.metaobjectByHandle;
  if (!mo || !mo.field || !mo.field.value) return null;
  try { return JSON.parse(mo.field.value); } catch (_) { return null; }
}

async function writeJson(type, handle, value) {
  await ensureDefinition(type);
  const r = await gql(`mutation($h:MetaobjectHandleInput!,$m:MetaobjectUpsertInput!){
    metaobjectUpsert(handle:$h, metaobject:$m){ metaobject{ id } userErrors{ field message code } } }`,
  { h: { type, handle }, m: { fields: [{ key: 'data', value: JSON.stringify(value) }] } });
  checkUserErrors(r.metaobjectUpsert, 'Settings');
  return r.metaobjectUpsert.metaobject.id;
}

async function create(type, fields) {
  await ensureDefinition(type);
  const r = await gql(`mutation($m:MetaobjectCreateInput!){ metaobjectCreate(metaobject:$m){ metaobject{ id } userErrors{ field message } } }`,
    { m: { type, fields: Object.entries(fields).map(([key, value]) => ({ key, value: String(value) })) } });
  checkUserErrors(r.metaobjectCreate, 'Metaobject');
  return r.metaobjectCreate.metaobject.id;
}

async function list(type, first = 100, after = null) {
  const d = await gql(`query($t:String!,$n:Int!,$a:String){ metaobjects(type:$t, first:$n, after:$a, sortKey:"updated_at", reverse:true){
    nodes{ id updatedAt fields{ key value } } pageInfo{ hasNextPage endCursor } } }`, { t: type, n: first, a: after });
  return d.metaobjects;
}

module.exports = { ensureDefinition, readJson, writeJson, create, list };
