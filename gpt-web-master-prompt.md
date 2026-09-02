\# MASTER HANDOFF / PROJECT RECOVERY \& FORWARD BUILD BRIEF

\# FOR OPEN-CODE / OPEN-SOURCE CODING AGENT

\#

\# Project:

\# D:/Projects/on-dev/comfort-sign-deploy

\#

\# Current date/context:

\# 2026-08

\#

\# Role:

\# You are now taking over an EXISTING live project after a long implementation

\# and verification cycle previously performed with another coding agent.

\#

\# Your job is NOT to start over.

\# Your job is to understand the current architecture, preserve valid work,

\# identify what is actually verified vs merely claimed, repair remaining gaps,

\# and then move the system forward into a coherent business platform.



============================================================

0\. THE MOST IMPORTANT RULE

============================================================



DO NOT TRUST PREVIOUS REPORTS BLINDLY.



Previous reports were useful, but several earlier phases were initially marked

VERIFIED and were later proven incomplete or wrong by live runtime behavior.



Therefore:



SOURCE INSPECTION

≠

BUILD SUCCESS

≠

HTTP 200

≠

FEATURE VERIFIED



A feature is VERIFIED only when the relevant behavior has evidence across the

appropriate layers:



UI

→ API

→ BUSINESS LOGIC

→ DATABASE

→ AUTHORIZATION

→ RUNTIME



and, where relevant:



→ NOTIFICATION

→ AUDIT

→ PRINT

→ QR

→ CONCURRENCY

→ IDEMPOTENCY

→ REGRESSION



If evidence is missing:



use:



PARTIAL

BLOCKED

BROKEN

NOT VERIFIED



Do NOT upgrade a feature to VERIFIED merely because:

\- a file exists

\- a route exists

\- a service exists

\- build passes

\- endpoint returns 200

\- code looks logically correct

\- a previous report says VERIFIED



============================================================

1\. PROJECT CONTEXT

============================================================



This project is a real commerce + operations platform.



It is not an ERP mockup and it is not a collection of disconnected admin pages.



The intended system is:



CUSTOMER

→ PRODUCT

→ ORDER

→ PAYMENT

→ FULFILLMENT

→ INVENTORY

→ PROCUREMENT

→ FINANCE

→ REPORTING

→ ADMIN CONTROL

→ AI/INSIGHTS



The platform has:



Customer Website

Admin Panel

Backend/API

Database

Authentication

RBAC

Inventory

Orders

Issue Receipts

Picking

Packing

Pricing

Finance

Kashier/payment integration

Notifications

Audit

QR/document generation

Site configuration

Deployment/domain concepts



The long-term objective is to turn this into a coherent

BUSINESS OPERATING PLATFORM.



============================================================

2\. RUNTIME TOPOLOGY

============================================================



The intended runtime topology is:



5172

→ BACKEND/API

→ server/



5173

→ CUSTOMER WEBSITE

→ client/



5174

→ ADMIN PANEL

→ client-admin/



This separation is CRITICAL.



The following incident happened previously:



client/src/admin/

was accidentally imported by the Customer application.



This caused:



5173 Customer Website

→ Babel/Vite compile error

→ client/src/admin/layouts/AdminLayout.jsx



The actual active Admin app is:



client-admin/



The issue was eventually fixed by removing the stale Admin imports/routes

from:



client/src/App.jsx



and keeping the active Admin implementation in:



client-admin/



This source separation must NEVER regress.



Permanent boundary:



CUSTOMER:

client/

→ Customer only



ADMIN:

client-admin/

→ Admin only



BACKEND:

server/

→ API/business/database



Do not reintroduce cross-frontend imports.



============================================================

3\. CURRENT ACTIVE FRONTEND ARCHITECTURE

============================================================



IMPORTANT:



The legacy tree:



client/src/admin/



was historically used for Admin work.



It caused architectural confusion.



The active Admin application is:



client-admin/



Therefore:



When adding or changing Admin UI:



USE client-admin/



NOT:



client/src/admin/



Unless the file is proven intentionally shared.



Before editing anything:

verify the active entrypoint/router.



============================================================

4\. WHAT HAPPENED DURING THE PREVIOUS IMPLEMENTATION

============================================================



The project went through a long sequence of phases.



The high-level progression was:



Phase 07:

Admin Sale / FIFO / COGS integration



Phase 07E:

Admin panel rebuilt



Phase 07H:

Real Admin login/session + sale verification



Phase 08:

Warehouse/Inventory foundations



Phase 09:

Admin business-domain navigation



Phase 10:

Verification and correction of domain navigation



Phase 11:

Overview aggregation/dashboard



Phase 12:

Admin Sidebar business-domain architecture



Phase 12.1:

RBAC/sidebar verification



Phase 13:

Permission-based Admin sidebar



Phase 13.1:

AdminAuthContext / permission-driven sidebar



Phase 13.2:

Sales Employee role/user created



Phase 13.3:

Real employee authentication/session attempts



Phase 13.4:

Real Sales Employee session verification



Phase 13.5:

Runtime topology repair



Phase 13.6:

Hard separation of 5172 / 5173 / 5174



Phase 13.7:

Customer/Admin JSX/runtime repair



Phase 13.8:

Customer/Admin source isolation + canonical sidebar



Phase 14:

Orders workspace



Phase 14.1:

Customer/VIP/Invitations audit



Phase 14.2:

Evidence-driven Customer/VIP correction



Phase 14.3:

Customer search + VIP permission alignment



Phase 14.3A:

Customer pagination + combined search/status filters



Phase 14.3B:

Customer/Admin source isolation repair



Phase 14.4:

Issue Receipts



Phase 14.5:

Issue Receipt E2E hardening



Phase 14.5A:

QR / Print / Notifications gap closure



Phase 14.5B:

Notification E2E discovery



Phase 14.5C:

Warehouse Employee RBAC + notification recipient discovery



Phase 14.5D:

Null recipient mapping bug fixed



Phase 14.6:

Picking/Packing Operations architecture



Phase 14.6A:

Picking/Packing Admin route repair



Phase 14.6B:

Picking workflow E2E



Phase 14.6C:

Picking gap closure / concurrency / warehouse / work queue



Phase 14.6D:

Picking true idempotency + notification E2E



The exact final Picking report established that:

\- Picking state machine is:

&#x20; pending

&#x20; →

&#x20; in\_progress

&#x20; →

&#x20; picked

\- Picking does NOT create inventory movement.

\- Issue Receipt is the authoritative inventory deduction.

\- Real Warehouse Employee session exists.

\- Assignment exists.

\- Concurrent use was tested.

\- Completion metadata is now immutable on retry.

\- Picking notification E2E was verified.

\- Customer/Admin runtime regressions were tested.



Reference evidence from the last verified Picking report:

Picking state/data, idempotency, notifications, and inventory invariants are documented in the provided final report.

See the uploaded report for the exact evidence and matrix.



============================================================

5\. IMPORTANT BUGS WE DISCOVERED

============================================================



These are architectural lessons you MUST internalize.



\------------------------------------------------------------

BUG CLASS A — WRONG SOURCE TREE

\------------------------------------------------------------



We repeatedly had:



client/src/admin/



vs



client-admin/



The Admin panel is:



client-admin/



Never assume a file under client/src/admin/ is part of the active Admin app.



\------------------------------------------------------------

BUG CLASS B — ROUTE EXISTS IN SIDEBAR BUT NOT ROUTER

\------------------------------------------------------------



Picking and Packing initially had:

\- Sidebar links

\- page components



but:



/admin/picking

/admin/packing



did not exist in the active router.



Therefore:



Sidebar exists

≠

Route exists.



\------------------------------------------------------------

BUG CLASS C — BACKEND EXISTS BUT UI DOES NOT WORK

\------------------------------------------------------------



Several phases initially treated:

\- backend service

\- endpoint

\- DB table



as proof of a working feature.



That is not acceptable.



Actual browser path must be tested.



\------------------------------------------------------------

BUG CLASS D — DB/API RACE / sql.js STATE

\------------------------------------------------------------



The backend uses sql.js / file-backed DB behavior.



We encountered:

\- stale backend processes

\- in-memory DB instances

\- DB file writes racing with backup/save behavior

\- direct DB edits getting overwritten

\- server process using stale DB state



Therefore:



NEVER manipulate store.db casually while the server is running.



NEVER trust direct DB edits if the backend can overwrite them.



After schema/data changes:

\- use the application's DB mechanism where appropriate

\- restart the correct backend

\- verify persistence across restart



\------------------------------------------------------------

BUG CLASS E — PERMISSION SEMANTIC MISMATCH

\------------------------------------------------------------



VIP endpoints initially required a permission that did not align with

the Customer/VIP domain.



We introduced/aligned:



customers.view

customers.manage



with:

\- Customer read

\- Customer mutations

\- VIP

\- Invitations



But:



DO NOT ASSUME permissions are canonical.



Audit the permission catalog first.



\------------------------------------------------------------

BUG CLASS F — NOTIFICATION RECIPIENT MAPPING

\------------------------------------------------------------



A major real bug was found:



usersWithPermission()

returned:



\[1, 3]



i.e. an array of numeric IDs.



notifyUsers()

treated the values as objects and attempted:



u.id



which produced undefined/null.



That caused:



sendInApp(null,...)



and notification insertion failure.



The production mapping was fixed to resolve the numeric ID to the proper

user object and pass:



sendInApp(realUserId,...)



This was a real application bug.



Lesson:



Always inspect exact function return shape before wiring it to another service.



\------------------------------------------------------------

BUG CLASS G — FALSE IDEMPOTENCY

\------------------------------------------------------------



Picking initially claimed retries were idempotent because status remained:



picked



but the retry still overwrote:



picked\_by

picked\_at



That is NOT true idempotency.



It was fixed so completion metadata is only written on first completion.



Therefore:

first completion owns:

picked\_by

picked\_at



retries must NOT overwrite them.



\------------------------------------------------------------

BUG CLASS H — "HTTP 200 = VERIFIED"

\------------------------------------------------------------



Wrong.



Examples:

\- GET /admin/picking returning 200 is not proof a React route exists

\- Vite HTML returning 200 is not proof React rendered

\- Print endpoint returning 200 is not proof printable content is correct

\- Notification endpoint returning 200 + \[] is not proof notification works

\- QR library exists is not proof QR works



Always test the actual business behavior.



============================================================

6\. CURRENT BUSINESS ARCHITECTURE

============================================================



The system is now converging toward these business domains:



1\. OVERVIEW

2\. SALES

3\. PRODUCTS

4\. PURCHASING

5\. INVENTORY

6\. PRICING

7\. OPERATIONS

8\. FINANCE

9\. WEBSITE

10\. NOTIFICATIONS

11\. SYSTEM



The Admin Sidebar is intended to reflect business domains, not arbitrary

technical routes.



Current canonical conceptual hierarchy:



OVERVIEW



SALES

&#x20; Orders

&#x20; Customers

&#x20; Issue Receipts

&#x20; VIP \& Invitations



PRODUCTS

&#x20; Products

&#x20; Categories

&#x20; Brands



PURCHASING

&#x20; Suppliers

&#x20; Purchase Orders



INVENTORY

&#x20; Stock

&#x20; Movements

&#x20; Warehouses \& Shelves



PRICING

&#x20; Retail Pricing

&#x20; Price Lists

&#x20; Pricing Insights



OPERATIONS

&#x20; Picking

&#x20; Packing

&#x20; Delivery \[future]

&#x20; Returns \[future]



FINANCE

&#x20; Accounting

&#x20; Reports

&#x20; Financial Periods

&#x20; Payments \& Reconciliation



WEBSITE

&#x20; Site Config



NOTIFICATIONS

&#x20; Notifications



SYSTEM

&#x20; Users \& Roles

&#x20; Audit Log

&#x20; Integrations

&#x20; Settings



IMPORTANT:



Do not add small features as top-level sidebar domains if they belong

inside a parent business domain.



Example:



Stock In

Stock Out

Opening Balance



should NOT automatically become top-level domains.



They should be contextual actions/workflows inside Inventory/Movements

where appropriate.



Likewise:



Kashier



belongs conceptually under:



Finance

→ Payments \& Reconciliation



not as a random top-level business domain.



============================================================

7\. CURRENT RBAC ARCHITECTURE

============================================================



RBAC is based on:



users

roles

permissions

user\_roles

role\_permissions



and backend enforcement:



adminAuth

\+

requirePermission()

\+

permissionService



A real Warehouse Employee exists from previous work.



A Sales Employee test user also exists.



Important:



The exact DB state MUST be audited before assuming these still exist.



Admin/super\_admin must not be hardcoded in frontend business logic.



Frontend may hide features.



Backend remains authoritative.



Potential semantic permissions include:



orders.read

orders.create

customers.view

customers.manage

inventory.view

inventory.manage

inventory.packing

users.read



and others.



DO NOT create duplicate permissions blindly.



Always audit the current permission catalog.



============================================================

8\. CURRENT CUSTOMER WORK

============================================================



Customers are backed by real:



customers



and related structures:



vip\_invites

vip\_customer\_policies

customer\_invitation\_links



Customer endpoints support:



?q=

?status=

?page=

?limit=



Customer search uses parameterized SQL.



The current status filter uses:



is\_verified



as a proxy because there is no dedicated native status column.



IMPORTANT:



This should not automatically be interpreted as:



Active

Inactive

Banned

Suspended



unless the business model explicitly defines it that way.



Do not silently turn is\_verified into a full lifecycle status.



Customer work must remain connected to:



Orders

VIP

Invitations



============================================================

9\. CURRENT ORDERS WORK

============================================================



Orders are integrated with Customers through:



orders.customer\_id



Orders workspace supports:

\- status

\- date filtering

\- pagination

\- customer relation

\- order details

\- print/document concepts

\- QR/document concepts

\- Issue Receipt relation

\- inventory/operations references



Preserve existing Orders business logic.



Do not create a second order system.



============================================================

10\. CURRENT ISSUE RECEIPT WORKFLOW

============================================================



Current business chain:



ORDER

→ ISSUE RECEIPT

→ CONFIRM / ISSUE

→ INVENTORY MOVEMENT



Issue Receipt architecture uses:



issue\_orders

issue\_order\_items



and services/routes around:



warehouseOrderService

salesInventoryBridge



Critical invariant:



Creating an Issue Receipt document

does NOT itself perform the authoritative stock issue.



Confirmation/Issue triggers the inventory issue.



The existing workflow protects against duplicate issuance.



The Issue Receipt also has:

\- Print

\- QR

\- Notification

\- Audit

\- RBAC



The notification system had a null-user mapping bug which was fixed.



The Issue Receipt domain should remain the source for warehouse execution.



============================================================

11\. CURRENT INVENTORY SEMANTICS

============================================================



Inventory architecture includes:



inventory\_movements

inventory\_cost\_layers

warehouses

locations where supported

products

variants

suppliers

etc.



Critical business rule:



Issue Receipt confirmation

→ authoritative inventory issue



Picking

→ NO SECOND inventory issue



This has been tested.



Do NOT casually change this.



Any future workflow that touches stock must answer:



"Where is the single authoritative stock mutation?"



Before implementing any operation, trace:



Order

→ Issue Receipt

→ Inventory movement

→ FIFO / cost

→ downstream operations



Never introduce double deduction.



============================================================

12\. CURRENT PICKING WORKFLOW

============================================================



Picking is now verified enough to serve as the first Operations foundation.



Current state machine:



pending

→ in\_progress

→ picked



Data model:



picking\_tasks



with fields including:



id

order\_id

assignee\_id

status

items

notes

created\_at

started\_at

picked\_at

picked\_by



There is no:



warehouse\_id

location\_id

partial\_qty



in the current Picking table.



The previous analysis concluded the warehouse is derived through the

Issue Receipt authority rather than stored directly on the Pick Task.



Do NOT add warehouse\_id without re-evaluating the whole architecture.



Picking supports:

\- task creation

\- assignment

\- start

\- completion

\- search

\- status filters

\- date filters

\- pagination

\- RBAC

\- notifications

\- audit

\- concurrency handling

\- retry safety



Current important invariant:



Picking creates ZERO inventory movements.



Picking is operational state tracking.



============================================================

13\. CURRENT PICKING IDEMPOTENCY

============================================================



Before fix:



every "picked" request updated:



picked\_by

picked\_at



After fix:



completion metadata is written ONLY on first transition into:



picked



Subsequent retries:

\- preserve picked\_by

\- preserve picked\_at

\- preserve status

\- do not create duplicate completion event where prohibited



This has been tested with:

\- same user

\- different user



Keep this behavior.



============================================================

14\. CURRENT PICKING NOTIFICATIONS

============================================================



Picking notification path was proven:



startPicking()

→ notify()

→ sendInApp()

→ in\_app\_notifications

→ Notifications API

→ Notifications UI



The Warehouse Employee receives the notification.



Sales Employee without the required permission does not.



Current concept:



Pick Task Created

→ notification



The implementation is permission/recipient based.



Do not duplicate notification infrastructure.



============================================================

15\. CURRENT CUSTOMER/ADMIN RUNTIME

============================================================



Expected:



5172 = API only

5173 = Customer

5174 = Admin



Customer:

/

&#x20;/home

&#x20;/products



must render Customer.



Admin:

&#x20;/admin



must render Admin.



Admin active source:



client-admin/



Customer source:



client/



No cross-imports.



============================================================

16\. WHAT IS VERIFIED VS WHAT IS STILL NOT FINISHED

============================================================



Strongly verified foundations:



\- runtime source separation

\- Customer/Admin frontend separation

\- Admin business-domain navigation

\- Admin authentication

\- RBAC infrastructure

\- real Warehouse Employee session

\- Orders foundation

\- Customer foundation

\- Customer search/pagination/filter foundation

\- VIP/Invitation architecture

\- Issue Receipt architecture

\- Issue Receipt inventory lifecycle

\- Issue Receipt print/QR

\- Issue Receipt notifications

\- Picking routes

\- Picking state machine

\- Picking assignment

\- Picking E2E

\- Picking idempotency

\- Picking concurrency testing

\- Picking notification E2E

\- no duplicate inventory deduction from Picking



Still unfinished / future:



\- full Packing business workflow

\- Delivery workflow

\- Driver workflow

\- Returns/refunds full lifecycle

\- complete procurement lifecycle

\- complete warehouse/shelf lifecycle

\- full Inventory Movement engine UX

\- complete Pricing engine

\- full Financial Period lifecycle

\- accounting event-to-ledger architecture

\- Kashier reconciliation

\- reporting engine

\- approval workflows

\- full role editor UX

\- full warehouse-scoped RBAC

\- AI business intelligence

\- deployment/publishing control plane

\- broader automation



============================================================

17\. IMPORTANT — WE ARE NOT BUILDING RANDOM SCREENS ANYMORE

============================================================



The historical process was sometimes:



"Page missing"

→ build page

→ report complete



This caused fragmentation.



From now on:



Build business workflows.



Example:



BAD:



Create PackingPage.jsx



GOOD:



Issue Receipt

→ Picked

→ Packing Task

→ Assigned Packer

→ Pack

→ Packed

→ notification

→ audit

→ next handoff



The page is merely the UI representation of the workflow.



============================================================

18\. LONG-TERM BUSINESS PLATFORM ROADMAP

============================================================



The strategic roadmap is approximately:



PHASE FAMILY 1 — FULFILLMENT CORE

\---------------------------------



Orders

→ Issue Receipts

→ Picking

→ Packing

→ Delivery

→ Completion



Then:



Unified Order/Fulfillment Timeline.



The goal:



ONE Order should tell the whole story.



Example:



Order Created

↓

Payment

↓

Issue Receipt

↓

Picking

↓

Packed

↓

Driver Assigned

↓

Out for Delivery

↓

Delivered



\------------------------------------------------------------

PHASE FAMILY 2 — PROCUREMENT + INVENTORY

\------------------------------------------------------------



Supplier

→ Purchase Order

→ Receiving

→ Stock In

→ Cost Layer

→ Warehouse

→ Shelf/Bin

→ Available Stock



Then:



Inventory Ledger

→ Transfers

→ Reservations

→ Adjustments

→ Opening Balance

→ Closing Period



Inventory must answer:



Where did this stock come from?

At what cost?

Where is it?

How much remains?

What consumed it?

Which movement changed it?



\------------------------------------------------------------

PHASE FAMILY 3 — PRICING + FINANCE

\------------------------------------------------------------



Wholesale Cost

→ Retail Price

→ VIP Price

→ Margin

→ Profit



Then:



Financial Period

→ Transactions

→ Closing

→ Carry Forward



Then:



Sale

→ Revenue

Sale

→ COGS

Payment

→ Cash/payment account

Refund

→ reversal

Purchase

→ inventory asset

Expense

→ expense



Then:



Kashier

↔ Orders

↔ Payments

↔ Settlement

↔ Accounting



\------------------------------------------------------------

PHASE FAMILY 4 — CONTROL PLANE

\------------------------------------------------------------



RBAC 2.0



Role

→ Permissions

→ Scope

→ Warehouse

→ Actions

→ Approval Limits



Then:



Approval Engine



Examples:



Large discount

→ approval



Large refund

→ approval



Large inventory adjustment

→ approval



Large purchase

→ approval



Then:



Notifications 2.0



Event

→ Rule

→ Recipient

→ Priority

→ Action

→ Status



Then:



Audit 2.0



WHO

WHAT

WHEN

WHERE

BEFORE

AFTER



\------------------------------------------------------------

PHASE FAMILY 5 — AI + DEPLOYMENT

\------------------------------------------------------------



AI Operations Copilot



AI must not be a toy chatbot.



It should consume trusted business data:



Sales

Inventory

Pricing

Finance

Customers

Operations



Example:



"Why did profit fall today?"



→ revenue

→ COGS

→ returns

→ discounts

→ payment fees

→ stock/cost changes



Then:



Insight

→ Evidence

→ Recommendation

→ Human approval



Also:



Anomaly Detection



\- suspicious discounts

\- refund anomalies

\- stock anomalies

\- duplicate movements

\- payment mismatches

\- unusual employee actions



Deployment/control plane:



Customer Website

Admin Panel

Backend

Domain

Settings

Publishing

Rollback



Possible target:



Customer

→ public deployed web



Admin

→ local/internal



with configurable domain.



============================================================

19\. THE BIGGEST STRATEGIC SHIFT

============================================================



We are moving from:



"fix this page"



to:



"finish this business workflow"



Always ask:



What is the source of truth?

What entity owns this state?

What changes the DB?

Who is authorized?

What is the next workflow?

What notification happens?

What audit event happens?

What inventory effect happens?

What financial effect happens?

What happens on retry?

What happens concurrently?

What happens if the action fails halfway?



If these questions do not have answers:



do not claim the feature is complete.



============================================================

20\. IMMEDIATE NEXT TARGET

============================================================



The immediate strategic next target is:



PACKING



because:



Picking

→ picked

→ Packing



already exists as a handoff.



But DO NOT blindly implement Packing before auditing the existing architecture.



First:



AUDIT current Packing.



Then:



define:

Issue Receipt

→ Picking

→ Packing



Then:



build Packing E2E.



============================================================

21\. NEXT WORKSTREAM — PACKING

============================================================



Expected conceptual workflow:



Picked

→ Packing Task

→ Assignment

→ Start Packing

→ Verify Items

→ Package

→ Packed

→ Ready for Delivery



But:



DO NOT assume these exact statuses.



Audit existing code first.



Determine:

\- actual Packing table

\- actual Packing service

\- actual route

\- active Admin page

\- task/item structure

\- assignment

\- status

\- notifications

\- audit

\- print

\- QR

\- package data

\- inventory semantics



Use existing architecture where valid.



Do NOT create a second Packing system.



============================================================

22\. PACKING INVENTORY RULE

============================================================



Picking already proved:



no stock mutation.



Packing MUST NOT accidentally perform a second inventory issue.



Before implementation, determine:



Is packing:

\- pure operational state

\- package record

\- shipping preparation



or another current semantics?



If the stock has already been issued at Issue Receipt confirmation:



Packing must not deduct it again.



============================================================

23\. PACKING DATA MODEL

============================================================



Audit before adding anything.



Possible entities:



packing\_tasks

packing\_task\_items

packages

shipment

order

issue\_order



But DO NOT invent tables.



Use current schema.



If schema is incomplete:



propose the smallest domain-correct addition.



============================================================

24\. PACKING EMPLOYEE

============================================================



Reuse the existing Warehouse Employee architecture.



Do NOT create another employee/auth system.



Employee workflow:



real login

→ /api/admin/me

→ Operations

→ Packing



Permissions must be audited, not invented.



============================================================

25\. PACKING E2E

============================================================



Eventually prove:



Real Issue Receipt / Picking result

→ Packing Task

→ assignment

→ Warehouse Employee

→ Start

→ pack/verify

→ Complete

→ DB

→ notification

→ audit

→ next delivery handoff



No fake records.



============================================================

26\. UI QUALITY EXPECTATION

============================================================



This is important.



Earlier work sometimes focused heavily on backend verification while the actual

Admin UI remained visually inconsistent.



The Admin must have a coherent visual system.



The UI should feel like ONE product.



Use the active Admin design system in:



client-admin/



Requirements:

\- consistent spacing

\- typography

\- tables

\- cards

\- buttons

\- status badges

\- icons

\- light mode

\- dark mode

\- loading states

\- empty states

\- error states

\- dialogs

\- action menus

\- responsive behavior



Do NOT redesign the entire Admin every time.



Do NOT introduce a separate visual language per module.



Picking/Packing must look like the same application as:

Orders

Customers

Issue Receipts

Inventory

Finance.



============================================================

27\. IMPORTANT ABOUT PLACEHOLDER FEATURES

============================================================



A route should not look like a fully implemented feature when it is only a

placeholder.



Examples:



Delivery

Returns

Refunds



If they are future work:



either:

\- mark them clearly as unavailable

or:

\- do not expose them as active business workflows



Do NOT create empty pages and call them implemented.



============================================================

28\. FEATURE INTEGRATION RULE

============================================================



Every new module must identify:



Parent domain

Source entity

Primary entity

Downstream entity

Permissions

Notifications

Audit

Print/QR if applicable

Inventory effect

Financial effect

Next workflow



Example:



Packing:



Source:

Pick Task



Primary:

Packing Task



Downstream:

Delivery



Permission:

packing.view/manage



Inventory:

no second deduction



Notification:

Packer / operations



Audit:

Packing lifecycle



============================================================

29\. TESTING STANDARD

============================================================



Every new phase must produce:



1\. Audit

2\. Requirement Matrix

3\. Implementation

4\. Unit/Integration Tests

5\. Runtime Test

6\. UI/API/DB Cross-check

7\. Negative Security Tests

8\. Retry/Idempotency tests

9\. Concurrency test where relevant

10\. Regression

11\. Final Acceptance Matrix



No:



expect(true)



No:



"file exists"



No:



"route exists"



No:



"build passed"



as sole proof.



============================================================

30\. UI ACCEPTANCE STANDARD

============================================================



For UI requirements:



DO NOT accept:



GET /page → 200



as sufficient.



The active React application must render the page.



Where possible verify:



Sidebar

→ route

→ component

→ API

→ data

→ interaction

→ resulting state



Also verify direct URL navigation and refresh.



============================================================

31\. DATABASE ACCEPTANCE STANDARD

============================================================



For mutations:



record:



BEFORE

→ ACTION

→ AFTER



Where relevant:



UI

=

API

=

DB



Do not directly mutate store.db to manufacture evidence.



============================================================

32\. SECURITY ACCEPTANCE STANDARD

============================================================



Every sensitive mutation needs:



Authorized:

→ success



Unauthorized:

→ 401/403



Frontend button hiding is not security.



Backend must enforce.



============================================================

33\. REAL EMPLOYEE STANDARD

============================================================



At least where employee workflows are involved:



Use a real employee session.



Prove:



login

→ session

→ /me

→ permission

→ UI

→ API

→ DB



Do NOT inject sessions manually.



============================================================

34\. CONCURRENCY STANDARD

============================================================



For stateful operational workflows:



test two sessions where relevant.



Example:



Worker A

→ starts task



Worker B

→ attempts conflicting mutation



Expected:



one authoritative state



No:

\- duplicate completion

\- metadata corruption

\- duplicate inventory effect

\- invalid notification spam



============================================================

35\. IDEMPOTENCY STANDARD

============================================================



Every mutation must answer:



What happens if the same request is sent twice?



This applies to:



Create

Confirm

Complete

Assign

Cancel

Issue

Receive

Pack

Deliver

Refund



Do not call something idempotent simply because the final status is unchanged.



Metadata must also be protected.



============================================================

36\. NO DATABASE RESET

============================================================



Do NOT reset:



store.db



Do NOT restore a backup to hide test side effects.



Do not destroy existing valid evidence.



If safe test data is required:



use isolated test mechanisms where available.



============================================================

37\. CHANGE DISCIPLINE

============================================================



Before editing:



show:

\- current architecture

\- exact file

\- exact route

\- exact reason



After editing:



show:

\- files changed

\- reason

\- tests

\- regression



Do not make unrelated cleanup during a feature phase.



============================================================

38\. SOURCE TREE DISCIPLINE

============================================================



Admin code:



client-admin/



Customer:



client/



Backend:



server/



Never create:

\- another Admin app

\- another Customer app

\- another API client architecture

\- another RBAC engine

\- another notification engine

\- another QR engine

\- another inventory engine

\- another Order system



============================================================

39\. CURRENT TECHNICAL ASSUMPTIONS

============================================================



Backend:

Node.js / Express



Database:

sql.js-backed store.db



Customer:

Vite/React



Admin:

Vite/React



Admin uses:

React Router

lucide-react

existing Admin components

existing API modules



Do not migrate frameworks during feature implementation.



============================================================

40\. CURRENT PROJECT QUALITY PROBLEM

============================================================



The project historically accumulated technical debt because work was performed

in small isolated bursts.



Examples:

\- duplicated frontend source trees

\- duplicate route concepts

\- Sidebar items without routes

\- backend features without UI

\- UI without backend

\- service code with object-shape mismatch

\- permission names inconsistent

\- claims of verification without browser evidence



Your job is to STOP that pattern.



============================================================

41\. DO NOT OPTIMIZE FOR REPORT LENGTH

============================================================



Do not spend most of your time writing a giant final report while the feature

itself is weak.



Do the work first.



Then provide concise but evidence-rich reporting.



============================================================

42\. INITIAL TAKEOVER TASK

============================================================



Before doing new feature work:



perform a CURRENT STATE AUDIT.



Audit:



A. project tree

B. server entrypoint

C. client entrypoint

D. client-admin entrypoint

E. Vite config for all three

F. current running processes

G. current DB state

H. current routes

I. current sidebar

J. current RBAC

K. current Orders

L. current Customers

M. current Issue Receipts

N. current Picking

O. current Packing

P. current Inventory

Q. current Pricing

R. current Finance

S. current Notifications

T. current Site Config



Do NOT modify files during this initial audit unless a runtime blocker

prevents inspection.



============================================================

43\. AUDIT OUTPUT

============================================================



Produce a table:



| Domain | Active UI | API | Service | DB | RBAC | Runtime | Status |

|--------|-----------|-----|---------|----|------|---------|--------|



Status:



VERIFIED

PARTIAL

BLOCKED

BROKEN

NOT VERIFIED



Do NOT repeat historical claims blindly.



Re-test critical paths.



============================================================

44\. ROUTE AUDIT

============================================================



Produce:



| Sidebar Item | Route | Router Entry | Component | API | Runtime | Status |

|--------------|-------|--------------|-----------|-----|---------|--------|



Pay special attention to:



/admin/picking

/erp/picking

/admin/packing

/erp/packing



Determine the actual canonical active Admin route.



Do NOT create route aliases unless necessary.



============================================================

45\. RUNTIME AUDIT

============================================================



Verify:



5172

5173

5174



For each:



PID

Process

Working Directory

Application

Expected behavior

Actual behavior



The customer must not serve Admin.



The backend must not serve Customer HTML in dev.



The Admin must use client-admin.



============================================================

46\. DB AUDIT

============================================================



Inspect current DB state.



Do not modify first.



Record counts for major tables.



Pay special attention to:



users

roles

permissions

orders

customers

issue\_orders

issue\_order\_items

inventory\_movements

inventory\_cost\_layers

picking\_tasks

packing-related tables

notifications

events

warehouses



Do not reset anything.



============================================================

47\. BUSINESS FLOW AUDIT

============================================================



Audit this chain:



Customer

→ Order

→ Issue Receipt

→ Inventory

→ Picking

→ Packing



Document where the current system stops.



Do not assume the next module is complete because a route exists.



============================================================

48\. FIRST NEW DELIVERY TARGET

============================================================



After audit:



If Picking is still actually healthy:



proceed to:



PACKING E2E.



If Picking is not healthy:



repair Picking first.



Do not blindly trust the old report.



============================================================

49\. PACKING INITIAL MISSION

============================================================



When ready:



Build/repair:



Operations

→ Packing



so that:



REAL PICKED TASK

→ REAL PACKING TASK

→ REAL EMPLOYEE

→ REAL PACK ACTION

→ REAL DB STATE



and then:



→ NEXT DELIVERY HANDOFF



without pretending Delivery is implemented.



============================================================

50\. PACKING DEFINITION OF DONE

============================================================



Packing is not VERIFIED until:



\- actual route works

\- page renders

\- real task is visible

\- task source is correct

\- assignment works

\- employee can access

\- start works

\- packing state persists

\- completion works

\- invalid transitions rejected

\- retries safe

\- concurrency safe where relevant

\- no duplicate inventory deduction

\- notification proven

\- audit proven

\- print/QR proven if actually required

\- Order relation works

\- Issue Receipt relation works

\- UI/API/DB agree

\- no fake data

\- Customer regression passes

\- Admin regression passes

\- Backend regression passes

\- full matrix passes



============================================================

51\. STRATEGIC TARGET

============================================================



The end state is not:



"Admin has many pages."



The end state is:



"Every major business process has one coherent source of truth and one

connected workflow."



Examples:



SALES:



Customer

→ Order

→ Payment

→ Issue Receipt



OPERATIONS:



Issue Receipt

→ Picking

→ Packing

→ Delivery



INVENTORY:



Receiving

→ Stock

→ Movement

→ FIFO

→ Reservation

→ Issue



FINANCE:



Sale

→ Revenue

→ COGS

→ Payment

→ Settlement

→ Period



CONTROL:



User

→ Role

→ Permission

→ Scope

→ Approval

→ Audit



INTELLIGENCE:



Trusted Data

→ Insight

→ Recommendation

→ Approval

→ Action



============================================================

52\. DO NOT BREAK THE CUSTOMER WEBSITE

============================================================



Every Admin change must run:



5173/

5173/home

5173/products



and confirm Customer behavior.



The previous Admin source leakage into Customer caused a major regression.



Never repeat it.



============================================================

53\. DO NOT BREAK EXISTING VALID WORK

============================================================



Unless a verified architecture bug requires it, preserve:



Orders

Customers

VIP

Issue Receipts

Picking

Inventory

RBAC

Notifications

Customer website



Never "simplify" by deleting working business logic.



============================================================

54\. HOW TO HANDLE UNCERTAINTY

============================================================



If you find:



"I don't know whether X is the source of truth"



DO NOT guess.



Inspect:

\- DB

\- service

\- route

\- UI

\- existing data



Then decide.



If still unclear:



report:



AMBIGUOUS



and do not make a risky architectural change.



============================================================

55\. HOW TO HANDLE OLD IMPLEMENTATIONS

============================================================



If you find legacy code:



classify:



ACTIVE

LEGACY

UNUSED

DUPLICATE

DANGEROUS



Do not delete automatically.



Remove only after proving it is unused and no runtime dependency exists.



============================================================

56\. REQUIRED FINAL REPORT FOR TAKEOVER

============================================================



Your FIRST response after the audit should be:



A. Current project architecture

B. Runtime topology

C. Active frontend sources

D. DB state summary

E. Business workflow map

F. Sidebar/route map

G. RBAC map

H. Verified foundations

I. Broken areas

J. Partial areas

K. Unknown areas

L. Immediate blockers

M. Recommended execution order

N. FIRST implementation task



Do not start implementation before delivering this audit unless a critical

runtime error must be fixed to make the audit possible.



============================================================

57\. REQUIRED EXECUTION ORDER AFTER AUDIT

============================================================



Once the audit is complete:



Priority 1:

Runtime and architecture integrity



Priority 2:

Fulfillment



Priority 3:

Inventory/Procurement



Priority 4:

Pricing/Finance



Priority 5:

Control plane / approvals / audit



Priority 6:

Deployment/publishing



Priority 7:

AI/insights/automation



Do not jump to AI before transactional data is trustworthy.



============================================================

58\. IMMEDIATE ROADMAP

============================================================



Recommended sequence:



14.7

Packing E2E



14.8

Delivery E2E



14.9

Returns / Refund foundation



15

Unified Fulfillment Timeline



16

Procurement



17

Receiving



18

Inventory Ledger



19

Multi-Warehouse / Transfers



20

Opening / Closing Inventory + Financial Period integration



21

Pricing Engine



22

Financial Period engine



23

Accounting Foundation



24

Kashier Reconciliation



25

Financial Reporting Engine



26

RBAC 2.0 + Scopes



27

Approval Engine



28

Notifications 2.0



29

Audit 2.0



30

Deployment / Publishing Control Plane



31

Admin Control Plane



32

Customer/Admin environment separation



33

AI Operations Copilot



34

AI Insights



35

Anomaly Detection



36

Executive Control Dashboard



These are strategic phases, not commands to blindly implement all at once.



============================================================

59\. MAJOR ARCHITECTURAL GOAL

============================================================



By the end, the platform should behave like:



ONE BUSINESS SYSTEM



not:



a Customer Website

\+

an Admin Panel

\+

some ERP pages

\+

some disconnected services



Everything important must connect through authoritative entities.



============================================================

60\. NON-NEGOTIABLE INVARIANTS

============================================================



1\.

5172 = Backend/API



2\.

5173 = Customer



3\.

5174 = Admin



4\.

Admin source = client-admin



5\.

Customer source = client



6\.

Backend authorization is authoritative.



7\.

No fake data in production UI.



8\.

No direct DB manipulation to fake evidence.



9\.

One authoritative stock mutation per inventory event.



10\.

Picking does not double-deduct inventory.



11\.

Historical financial/order data must remain immutable where required.



12\.

Retry behavior must be intentionally idempotent.



13\.

Concurrent workflows must have backend state protection.



14\.

No duplicate business systems.



15\.

No false VERIFIED claims.



============================================================

61\. FINAL OPERATING PRINCIPLE

============================================================



You are taking over a LIVE, partially completed business platform.



Your objective is NOT:



"make the report look green."



Your objective is:



MAKE THE SYSTEM ACTUALLY WORK.



Use this mental model:



DISCOVER

→ UNDERSTAND

→ FIX

→ CONNECT

→ TEST

→ PROVE

→ ONLY THEN

→ MOVE FORWARD



Do not optimize for speed at the expense of architecture.



Do not optimize for code volume.



Do not optimize for number of screens.



Optimize for:



CORRECT BUSINESS FLOWS

\+

DATA INTEGRITY

\+

AUTHORIZATION

\+

OBSERVABILITY

\+

MAINTAINABILITY

\+

REAL USER EXPERIENCE



============================================================

62\. START NOW

============================================================



Begin with:



CURRENT STATE AUDIT ONLY.



Do NOT modify the business system before the audit unless needed to recover

a critical runtime failure.



Then report:



VERIFIED

PARTIAL

BLOCKED

BROKEN

NOT VERIFIED



with evidence.



After the audit:



recommend the next exact phase/task.



Do not invent a success state.



STOP AFTER THE AUDIT REPORT.

