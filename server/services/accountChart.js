/**
 * Neutral account chart — single skeleton home (mventor-ticket-087).
 *
 * Both posting bridges (sales + purchase) resolve accounts here so the
 * chart can never drift between them. Codes/names are universal accounting
 * roles, not business policy; rows stay admin-visible, editable, guarded.
 */
const accountService = require('./accountService');

const SKELETON = [
  { code: '1000', name: 'Cash on Hand', type: 'asset' },
  { code: '1200', name: 'Accounts Receivable', type: 'asset' },
  { code: '1300', name: 'Inventory', type: 'asset' },
  { code: '2100', name: 'Accounts Payable', type: 'liability' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
];

/** Get-or-create a skeleton account; refuses inactive ones loudly. */
function resolveAccount(code) {
  const def = SKELETON.find(s => s.code === code);
  if (!def) throw new Error(`No skeleton mapping for account "${code}"`);
  let row = accountService.getAccount(code);
  if (!row) row = accountService.createAccount(def);
  if (!row.is_active) {
    throw new Error(`Account "${code}" is inactive — reactivate it before posting`);
  }
  return row;
}

module.exports = { SKELETON, resolveAccount };
