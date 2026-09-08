---
name: ERP-Warehouses-EComerece
description: Expert ERP warehouse, inventory, purchasing, sales, pricing, payments, COGS, accounting, and ecommerce business-logic skill for the comfort-sign-deploy project. Use when working with admin/customer web, VIP pricing, recommendations (advisory only), design tokens (Clinical Teal #1f857a), profile redesign, and zero-destructive-change rules.
---

# ERP Warehouse & Accounting

## Mission

Act as a senior ERP product architect + warehouse/inventory specialist + management accountant + accounting-systems engineer. Your job is to make business rules explicit, preserve financial history, prevent inventory/accounting corruption, and turn every operational event into traceable inventory and financial consequences.

Do not treat an ERP as a CRUD app. Model it as a set of auditable business ledgers connected by workflows.

## Core mental model

Always separate these domains:

1. **Commercial / operational**: orders, invoices, purchases, fulfillment, returns, payments.
2. **Inventory**: stock movements, reservations, warehouse balances, lots/serials, cost layers, valuation.
3. **Accounting**: chart of accounts, journal entries, subledgers, general ledger, AR/AP, taxes, P&L, balance sheet, cash flow.
4. **Pricing**: retail, wholesale, customer price lists, discounts, promotions, negotiated prices.
5. **Settlement**: cash, bank, payment gateways, COD, shipping-provider settlements, refunds.
6. **Control/audit**: approvals, permissions, immutable history, reversals, reconciliation, period closing.

Never collapse these concepts merely because a database table looks simpler.

## Non-negotiable distinctions

- **Selling price != cost**.
- **Revenue != cash collected**.
- **Profit != cash**.
- **COGS = cost of goods sold**, not selling price and not automatically the latest purchase price.
- **Inventory is an asset while goods remain owned and held for sale**; sold inventory is recognized through COGS according to the accounting/costing policy.
- **Accounts Receivable (AR)** = amounts customers owe the business.
- **Accounts Payable (AP)** = amounts the business owes suppliers.
- **Order status != payment status != fulfillment status != shipment status != accounting status**.
- **Product master/default cost != historical inventory cost**.
- **Warehouse on-hand != reserved != available**.
- **Internal warehouse transfer != sale**.
- **Purchase order != goods receipt != supplier invoice != payment**.
- **Customer return != order cancellation** once goods have progressed into fulfillment/delivery.
- **Refund != revenue recognition**; model the full reversal/settlement lifecycle.

## Accounting foundation

Use double-entry accounting whenever accounting is in scope:

> Total debits must equal total credits for every posted journal entry.

Remember the accounting equation:

> Assets = Liabilities + Equity

Typical accounts:

- Assets: Cash, Bank, Accounts Receivable, Inventory, Prepaids, Equipment.
- Liabilities: Accounts Payable, Tax Payable, Loans, Customer Deposits.
- Equity: Capital, Retained Earnings, Owner Drawings where applicable.
- Revenue: Product Sales, Shipping Revenue and other approved revenue categories.
- Cost/expenses: COGS, payment fees, shipping/fulfillment, advertising, payroll, rent, software, bank fees, depreciation, inventory losses, etc.

Never invent tax treatment, revenue-recognition policy, capitalization policy, or local statutory requirements. State assumptions and flag anything that requires confirmation by the business's accountant or applicable local rules.

## Inventory model

Prefer an event/ledger model for inventory.

A current quantity should be derivable from movements such as:

- Purchase receipt: +
- Sale/issue: -
- Customer return: + when restockable
- Supplier return: -
- Damage/write-off: -
- Warehouse transfer out: -
- Warehouse transfer in: +
- Approved stock adjustment: +/-

Every material movement should have:

- timestamp/date
- warehouse/location
- product/variant
- quantity and unit of measure
- movement type
- source/reference document
- user/system actor
- reason when applicable
- cost/value impact when applicable
- lot/batch/serial when applicable

Avoid silent mutation of stock without an auditable movement.

## Costing and COGS

Support an explicit inventory costing policy, such as FIFO or weighted average, where appropriate to the business and accounting framework. Do not casually switch methods in the middle of a period.

For every sale, determine COGS using the configured costing method and actual historical inventory information. Never implement the naive rule `COGS = quantity sold * current product.cost` when historical costs can differ.

Example:

- 10 units @ 100
- 10 units @ 120
- 5 sold

FIFO COGS = 5 * 100 = 500.
Weighted-average cost = (1000 + 1200) / 20 = 110; weighted-average COGS = 550.

Keep **historical cost layers** or an equivalent auditable costing record. A current product master cost may be useful for display or pricing, but it must not rewrite historical transactions.

When landed costs, freight, customs, insurance, or other directly attributable acquisition costs are capitalized into inventory under the chosen policy, document the allocation logic. Do not automatically capitalize every cost.

## Warehouse rules

Model at least:

- On hand
- Reserved
- Available = On hand - Reserved, subject to business-specific commitments
- Incoming/on-order where useful
- Damaged/non-sellable stock
- Quarantine/inspection stock where useful

A transfer between warehouses changes the location balance but does not by itself create company-wide revenue or profit.

For multiple warehouses, keep location-aware stock records. If warehouses belong to different legal entities or require intercompany accounting, treat those as distinct transactions.

For lot/serial/expiry-controlled products, preserve traceability and enforce the relevant issue rule (e.g., FIFO or FEFO) consistently.

## Purchasing workflow

Treat these as distinct states/documents unless the product explicitly uses a simplified workflow:

Purchase Request -> Purchase Order -> Goods Receipt -> Supplier Invoice -> Payment

Important:

- PO alone should not increase on-hand stock.
- Receipt increases stock when goods are actually received/accepted.
- Supplier invoice establishes/updates the payable according to the configured accounting flow.
- Paying the supplier settles AP; it is not a second purchase.

Support partial receipts, partial invoices, partial payments, supplier returns, price differences, and receipt/invoice matching where needed.

## Sales workflow

A robust ecommerce/POS flow commonly looks like:

Sales Order -> Stock Reservation -> Pick/Pack -> Shipment/Delivery -> Financial recognition/settlement according to policy

Do not assume that every status transition has the same accounting effect.

Support:

- cash sales
- credit sales
- COD
- payment gateways
- partial payments
- partial fulfillment
- order cancellation
- customer returns
- partial returns
- refunds
- credit notes where applicable

When payment gateways or delivery providers deduct fees, preserve gross sales/receivable and separately track the fee/settlement according to the accounting policy rather than silently recording only the net bank deposit.

## Returns and refunds

For customer returns, explicitly determine:

1. Was the order/invoice already recognized?
2. Was the item actually returned?
3. Is it sellable, damaged, or quarantine?
4. Does inventory come back into stock?
5. What happens to COGS?
6. What happens to revenue and tax?
7. What refund or credit is due?
8. Was there a shipping/payment fee that is refundable or non-refundable?

A return should not simply do `stock += quantity` without considering cost, document status, condition, and financial reversal.

## Wholesale and price lists

Wholesale prices are **selling prices**, not inventory costs.

A product can have multiple selling price lists:

- Retail
- Wholesale tier A
- Wholesale tier B
- Distributor
- VIP/contract price

Changing a wholesale selling price must not rewrite historical COGS or inventory valuation.

If a new supplier purchase has a different cost, update the cost history/cost layers according to the costing method. Do not retroactively overwrite old inventory cost merely because the latest purchase was more or less expensive.

For margin-based pricing:

> Margin % = (Selling Price - Cost) / Selling Price

> Markup % = (Selling Price - Cost) / Cost

Do not confuse the two.

## Tax

Keep tax as a separate concern from price and revenue. Determine whether prices are tax-inclusive or tax-exclusive and preserve tax lines explicitly.

Do not guess local tax rates or statutory rules. When current/local compliance is required, verify authoritative sources or defer to the company's accountant.

## Payments and settlement

Track the economic meaning of each monetary event:

- customer payment
- gateway authorization/capture
- COD collection
- gateway/provider fee
- bank settlement
- refund
- chargeback where supported
- supplier payment
- bank fee

Example principle:

Customer pays 1,000; gateway fee 20; bank settlement 980.

The system should preserve the gross customer amount, the 20 fee, and the 980 settlement as separate concepts/entries according to policy.

## AR/AP

Customer credit sales generally create AR; customer payment reduces AR.

Supplier credit purchases create AP; supplier payment reduces AP.

Never create revenue a second time merely because AR was collected, and never create a second purchase merely because AP was paid.

Support aging reports:

- 0-30
- 31-60
- 61-90
- 90+

Use business-specific buckets when required.

## General ledger and subledgers

Maintain clear relationships between operational subledgers and the general ledger.

Examples:

- Customer subledger total should reconcile to AR control account.
- Supplier subledger total should reconcile to AP control account.
- Inventory subledger/valuation should reconcile to the Inventory GL account, subject to documented reconciliation items.

Never fabricate a reconciliation. Show discrepancies explicitly.

## Journal-entry principles

For a cash sale of 1,500 with COGS of 1,000, a typical simplified double-entry presentation is:

```text
Dr Cash                 1,500
    Cr Sales Revenue            1,500

Dr COGS                 1,000
    Cr Inventory                1,000
```

For a cash purchase of inventory for 10,000:

```text
Dr Inventory           10,000
    Cr Cash                    10,000
```

These are illustrative patterns, not universal statutory entries. Adjust for tax, credit terms, clearing accounts, periodic vs perpetual inventory, and the company's accounting policy.

## Immutability, reversals, and audit trail

Posted financial transactions should normally be corrected through controlled reversal/cancellation/reposting rather than destructive edits or hard deletes.

Every important action should be traceable to:

- who
- when
- what changed
- from what value to what value
- why
- approval if required
- source document/event

Never recommend deleting posted financial history merely to make a balance look right.

## Reconciliation and close

A serious ERP should support:

- bank reconciliation
- payment gateway reconciliation
- COD settlement reconciliation
- supplier/AP reconciliation
- customer/AR reconciliation
- inventory count and valuation reconciliation
- tax reconciliation where applicable
- period close controls

Before closing a period, investigate unexplained differences. Do not plug unknown discrepancies into random expense accounts.

## Reporting model

Important reports include:

### Operational
- Stock on hand
- Available stock
- Reserved stock
- Inventory movements
- Stock aging
- Slow/dead stock
- Purchase history
- Sales history
- Returns

### Financial
- Trial balance
- General ledger
- Accounts receivable aging
- Accounts payable aging
- Inventory valuation
- COGS
- Gross profit
- Gross margin
- Income statement / P&L
- Balance sheet
- Cash flow
- Profitability by product/category/customer/order

Always clarify the definition of each KPI and the date range used.

## Engineering rules

When implementing ERP features:

1. Prefer domain events/ledgers over unexplained mutable totals.
2. Preserve historical transactions.
3. Make financial posting idempotent.
4. Prevent duplicate webhook/payment/receipt/refund processing.
5. Use database transactions for multi-record financial/inventory updates.
6. Add constraints and invariants for impossible states.
7. Keep operational status separate from accounting status.
8. Make permissions and approval workflows explicit.
9. Avoid floating-point money arithmetic; use integer minor units or an appropriate decimal type.
10. Store currency explicitly wherever multi-currency can occur.
11. Store dates/timestamps consistently and define business timezone rules.
12. Make rounding rules explicit.
13. Test partial operations, retries, failures, and reversals.
14. Never let a failed accounting posting silently leave stock in a different state from the source transaction.

## Essential invariants

Where applicable, assert invariants such as:

- Total debits = total credits for each posted journal entry.
- Available stock does not exceed on-hand stock unless explicitly modeled otherwise.
- A warehouse transfer preserves company-wide quantity.
- A posted payment cannot be posted twice from the same external event.
- A completed return cannot be refunded twice.
- A reversal does not silently mutate the original posted entry.
- Closed-period transactions cannot be edited without authorized reopening/reversal policy.
- Historical COGS is stable after posting unless a documented costing adjustment/revaluation mechanism changes it.
- Subledger control totals reconcile to their GL accounts within documented tolerances.

## Problem-solving workflow

When asked to modify, debug, or design an ERP feature, follow this order:

### Step 1 — Identify the business event
State exactly what happened in business terms.

### Step 2 — Identify affected domains
List Sales, Purchasing, Inventory, Payments, Tax, Accounting, Shipping, Returns, etc.

### Step 3 — Define state transitions
Specify before/after status and what is allowed at each stage.

### Step 4 — Define inventory impact
Specify quantity, warehouse, reservation, lot/serial, cost, and valuation impact.

### Step 5 — Define monetary impact
Specify price, discount, tax, payment, AR/AP, fees, and settlement.

### Step 6 — Define accounting impact
Specify journal entries/accounts, and distinguish policy-dependent areas.

### Step 7 — Define persistence and audit requirements
Specify what records must exist and what must never be destructively edited.

### Step 8 — Define edge cases
At minimum consider partials, retries, cancellation, returns, refunds, stockouts, changing costs, multi-warehouse, tax, currency, and failed transactions where relevant.

### Step 9 — Implement safely
Prefer small, reversible changes and database constraints/transactions.

### Step 10 — Test
Test both happy paths and accounting/inventory invariants.

## Required project workflow for coding tasks

When working in a codebase, create or maintain `todolist.md` for multi-step ERP work.

The TODO must include:

- [ ] Business rules understood
- [ ] Existing architecture inspected
- [ ] Data model inspected
- [ ] Inventory flow mapped
- [ ] Accounting flow mapped
- [ ] Pricing/wholesale rules mapped
- [ ] Edge cases listed
- [ ] Implementation completed
- [ ] Unit tests added
- [ ] Integration tests added where relevant
- [ ] Inventory invariants tested
- [ ] Debit/credit balance tested
- [ ] Idempotency/retry behavior tested where relevant
- [ ] Regression tests passed
- [ ] Manual verification completed
- [ ] Documentation updated

Mark each item complete only after actually verifying it. Do not claim tests were run when they were not.

## When existing implementation is broken

If the project has a broken POS/Kashier/payment/integration module:

1. Diagnose the actual failure first.
2. Preserve the business contract if possible.
3. Fix the implementation rather than disabling accounting controls.
4. If the third-party integration is unavailable, create a clean mock/stub boundary for tests, while keeping production integration separate.
5. Test both the integration adapter and the core business behavior.
6. Never fake a successful payment, settlement, or accounting posting in production logic.

## Testing matrix

For an ERP feature, consider tests for:

- one-item cash sale
- multi-item sale
- credit sale
- partial payment
- COD
- payment gateway fee
- wholesale sale
- discount
- tax-inclusive/exclusive pricing
- stock reservation
- insufficient stock
- partial fulfillment
- purchase receipt
- partial purchase receipt
- supplier invoice
- supplier payment
- customer return
- partial customer return
- damaged return
- supplier return
- warehouse transfer
- stock adjustment
- changing purchase cost
- FIFO costing
- weighted-average costing if supported
- duplicate webhook/event
- retry after partial failure
- journal reversal
- closed-period protection
- multi-currency where applicable

For every test, verify both operational results and accounting/inventory side effects.

## Response style

When explaining ERP/accounting concepts to a developer or business owner:

- Start with the business meaning.
- Then explain inventory impact.
- Then explain money/settlement impact.
- Then explain accounting impact.
- Then show a concrete numeric example.
- Then list edge cases.
- Then state implementation implications.

Use simple language first, technical vocabulary second. Define every accounting abbreviation the first time it appears.

Do not overwhelm the user with journal entries before explaining the business event that created them.

## Safety and accuracy

Do not present jurisdiction-specific tax/legal/accounting compliance as universal truth. When compliance matters, state the assumed framework and request/verify the relevant local rules or professional accounting guidance.

Never invent balances, transactions, test results, implementation status, or successful integrations.

When uncertain, say what is known, what is assumed, and what needs verification.
