\# GPT WEB VISION

\## THE LONG-TERM VISION, IDENTITY, PRINCIPLES, EXPERIENCE, AND DESTINATION OF THE PLATFORM



Document Role:

This document defines the enduring vision of the project.



It is NOT:

\- a sprint plan

\- a coding task list

\- a phase report

\- a temporary architecture note

\- a list of current bugs

\- a framework-specific implementation guide



It is the long-term definition of what this project is, what it should become,

what kind of business it should enable, how the people using it should feel,

how its parts should relate, and what principles must survive every technical

rewrite, agent handoff, redesign, or implementation phase.



This document should remain valid regardless of:

\- frontend framework

\- backend framework

\- database engine

\- hosting provider

\- AI coding agent

\- deployment environment

\- company scale

\- exact module names

\- specific implementation details



============================================================

\# 1. WHAT THIS PROJECT REALLY IS

============================================================



This project is a digital operating platform for a real commerce business.



It is not merely:



\- an e-commerce website

\- an admin dashboard

\- an ERP

\- an inventory system

\- an accounting application

\- a CRM

\- a warehouse application

\- an AI assistant



It is the connected system that allows all of those business activities to

operate as ONE coherent organization.



The platform exists to connect:



Customers

Products

Orders

Payments

Warehouses

Inventory

Procurement

Fulfillment

Employees

Finance

Reporting

Communication

Automation

AI

Deployment

Business decisions



into one understandable operational reality.



The system should behave as though all business departments are participating

in one shared company, not as though independent software products happen to

share a database.



============================================================

\# 2. THE CENTRAL IDEA

============================================================



The central idea is:



ONE BUSINESS

→ ONE SOURCE OF TRUTH

→ ONE CONNECTED OPERATIONAL STORY



Everything important should be traceable.



A product should have a story.



A piece of inventory should have a story.



An order should have a story.



A customer should have a story.



A payment should have a story.



A warehouse action should have a story.



A refund should have a story.



A financial result should have a story.



A user action should have a story.



A business decision should have evidence.



The system must make those stories understandable.



============================================================

\# 3. THE PLATFORM MINDSET

============================================================



The project should not be thought of as "many pages."



It should be thought of as:



BUSINESS OBJECTS

\+

BUSINESS EVENTS

\+

BUSINESS WORKFLOWS

\+

PEOPLE

\+

AUTHORITY

\+

DATA

\+

DECISIONS



The UI is merely the window through which people interact with those things.



Therefore:



A beautiful screen with no real workflow is not success.



A functional API with no usable interface is not success.



A database table with no business meaning is not success.



A dashboard full of numbers nobody can trust is not success.



An AI answer with no evidence is not success.



============================================================

\# 4. THE EXPERIENCE WE WANT

============================================================



The platform should feel:



Calm.

Organized.

Professional.

Fast.

Predictable.

Trustworthy.

Dense enough for serious work.

Simple enough for daily use.

Powerful without becoming chaotic.



The user should feel:



"I know where I am."



"I know what matters."



"I know what I am allowed to do."



"I know what happened."



"I know what happens next."



"I can trust these numbers."



"I can see why this action is allowed or blocked."



"I can understand this workflow without being an accountant,

warehouse expert, developer, or software administrator."



============================================================

\# 5. THE PLATFORM SHOULD HAVE A MEMORY

============================================================



The platform should remember business history.



Not merely technical logs.



Business memory means:



Who created the order?

Who changed the order?

What was sold?

At what price?

Which customer bought it?

Which warehouse handled it?

When was inventory reserved?

Which cost was consumed?

Who picked it?

Who packed it?

Who delivered it?

Was it returned?

Was it refunded?

What happened financially?

Who approved unusual actions?

What changed afterward?



History must be preserved in a way that helps the business understand itself.



============================================================

\# 6. EVERYTHING SHOULD HAVE CONTEXT

============================================================



A user should never be trapped in an isolated screen.



From a:



Customer

→ Orders



Order

→ Customer

→ Payment

→ Issue Receipt

→ Fulfillment

→ Inventory

→ Financial result



Issue Receipt

→ Order

→ Warehouse

→ Picking

→ Packing

→ Delivery



Product

→ Category

→ Brand

→ Stock

→ Cost

→ Retail Price

→ VIP Price

→ Profitability



Supplier

→ Purchase Orders

→ Receiving

→ Inventory

→ Cost layers



Employee

→ Role

→ Permissions

→ Scope

→ Actions

→ Audit trail



The system should make these relationships navigable.



============================================================

\# 7. THE PLATFORM IS A GRAPH, NOT A STACK OF SCREENS

============================================================



A useful mental model is:



&#x20;                   CUSTOMER

&#x20;                      │

&#x20;                      ▼

&#x20;                   ORDER

&#x20;                 /   │   \\

&#x20;                /    │    \\

&#x20;           PAYMENT   │   ISSUE RECEIPT

&#x20;                     │          │

&#x20;                     │          ▼

&#x20;                     │       WAREHOUSE

&#x20;                     │          │

&#x20;                     │       PICKING

&#x20;                     │          │

&#x20;                     │       PACKING

&#x20;                     │          │

&#x20;                     │       DELIVERY

&#x20;                     │

&#x20;                     ▼

&#x20;                 INVENTORY

&#x20;                     │

&#x20;                COST / FIFO

&#x20;                     │

&#x20;                     ▼

&#x20;                  FINANCE



Above and around the whole graph:



IDENTITY

RBAC

AUDIT

NOTIFICATIONS

APPROVALS

REPORTING

AI

DEPLOYMENT

SETTINGS



The platform becomes powerful when these relationships are real,

understandable, and trustworthy.



============================================================

\# 8. THE BUSINESS SHOULD FLOW NATURALLY

============================================================



The system should mirror the natural life of a transaction.



A product enters the business.



It is purchased or otherwise acquired.



It receives a cost.



It lives in a warehouse.



A customer wants it.



An order is created.



Payment is processed.



The warehouse is instructed.



The goods are prepared.



The customer receives them.



Money is reconciled.



Inventory changes.



Profit becomes measurable.



If something goes wrong:



the business knows where,

when,

why,

who,

and what to do next.



The software should follow that natural chain.



============================================================

\# 9. SALES IS NOT THE END OF THE ORDER

============================================================



An order is not complete merely because a checkout succeeded.



A real order travels through the business.



Therefore the long-term product should let a user understand:



Commercial state

\+

Financial state

\+

Operational state

\+

Inventory state



as related but distinct dimensions.



For example:



An order can be paid but not fulfilled.



It can be fulfilled but not delivered.



It can be delivered but later returned.



It can be returned financially but still require inventory inspection.



Those distinctions matter.



The platform must not collapse them into one vague status.



============================================================

\# 10. INVENTORY IS A LEDGER OF REALITY

============================================================



Inventory should never feel like an arbitrary number.



Every meaningful quantity should have a reason.



The system should eventually answer:



Where did this quantity come from?



At what cost?



Where is it?



How much remains?



What was reserved?



What was issued?



What was transferred?



What was adjusted?



What consumed it?



Why did the quantity change?



Which transaction caused the change?



This is why inventory movements and costing are foundational.



============================================================

\# 11. COST IS HISTORICAL, NOT A DECORATION

============================================================



Cost should reflect actual business history.



When inventory is consumed, the system should understand the cost basis used.



This makes:



COGS

Profit

Margins

Pricing

Reporting



meaningful.



The project should avoid pretending that profitability is correct merely

because a "profit" number can be displayed.



============================================================

\# 12. PRICING SHOULD BECOME DECISION SUPPORT

============================================================



Pricing should eventually answer:



What does this item cost us?



What do we sell it for?



What margin does that produce?



What would a VIP customer pay?



How does the current cost affect the recommended price?



What happens if the cost changes?



Which products are healthy?



Which products are becoming dangerous?



Pricing should become a decision system rather than a collection of input

boxes.



============================================================

\# 13. FINANCE SHOULD EXPLAIN THE BUSINESS

============================================================



Finance should not be an isolated accounting corner.



It should explain:



Revenue

COGS

Profit

Payments

Refunds

Fees

Purchases

Inventory value

Periods

Reconciliation

Adjustments



A financial number should have a traceable origin.



The business should be able to move:



Dashboard

→ Report

→ Transaction

→ Business event



without losing context.



============================================================

\# 14. OPERATIONS SHOULD REPRESENT HUMAN WORK

============================================================



Warehouse and delivery workflows are performed by people.



Therefore the platform should respect human work.



A task should tell an employee:



What is required?



Why?



For whom?



Where?



How much?



What has already happened?



What is expected next?



What is blocking me?



Who is responsible?



Employees should not have to reverse engineer the business process from a

technical database view.



============================================================

\# 15. EMPLOYEE EXPERIENCE

============================================================



An employee should see a workspace relevant to their role.



Not a smaller Admin page.



A proper employee experience means:



\- relevant work

\- clear priorities

\- clear permissions

\- clear ownership

\- minimal noise

\- contextual actions

\- helpful notifications

\- obvious next steps



A warehouse employee should think:



"These are my tasks."



A cashier/sales employee should think:



"These are my orders and customers."



An accountant should think:



"These are the financial items requiring attention."



A manager should think:



"This is what needs my decision."



============================================================

\# 16. ADMIN EXPERIENCE

============================================================



Admin is not merely a user with more buttons.



Admin is the control layer of the organization.



Admin should eventually understand:



What is happening?



What is blocked?



What is abnormal?



What requires approval?



What is financially important?



What operational risk exists?



Who is responsible?



What changed?



What needs attention now?



============================================================

\# 17. THE DASHBOARD SHOULD BECOME A CONTROL CENTER

============================================================



The Overview should evolve beyond decorative KPI cards.



It should eventually become:



THE ORGANIZATION'S CONTROL CENTER.



It should answer:



How is the business doing?



What changed?



What is urgent?



What is abnormal?



What is waiting?



What is profitable?



What is at risk?



What requires a decision?



What can be acted upon immediately?



And it should let the user jump directly into the relevant workflow.



============================================================

\# 18. "MY WORK" IS A FIRST-CLASS CONCEPT

============================================================



The system should eventually understand:



My tasks.

My approvals.

My orders.

My warehouse work.

My notifications.

My exceptions.

My follow-ups.



The system should reduce cognitive load by showing each person what matters

to them.



============================================================

\# 19. NOTIFICATIONS SHOULD BECOME ACTIONS

============================================================



A notification should not merely say:



"Something happened."



It should ideally communicate:



WHAT happened.

WHY it matters.

WHO should act.

HOW urgent it is.

WHAT can be done next.



A useful notification behaves almost like a doorway into a workflow.



============================================================

\# 20. APPROVALS SHOULD REPRESENT AUTHORITY

============================================================



In a serious business system, not every employee should be able to perform

every action.



The future system should understand:



Who can view?



Who can create?



Who can modify?



Who can approve?



Who can override?



Up to what value?



In which warehouse?



In which area?



For which business object?



Authority should be explicit.



============================================================

\# 21. ROLES SHOULD MODEL RESPONSIBILITY

============================================================



Roles should eventually describe real responsibilities.



Examples:



Sales

Warehouse

Warehouse Manager

Procurement

Accountant

Operations

Driver

Website Manager

Finance Manager

Administrator



But roles should never become arbitrary labels.



A role should have:



Permissions

Scope

Responsibilities

Approval authority

Operational boundaries



============================================================

\# 22. SCOPES MATTER AS MUCH AS PERMISSIONS

============================================================



A user may be allowed to perform an action but only within a specific scope.



Examples:



Warehouse A

Warehouse B



or:



specific branches

specific teams

specific customers

specific financial limits



Long-term RBAC should support:



WHO

\+

WHAT

\+

WHERE

\+

HOW MUCH



============================================================

\# 23. SECURITY SHOULD FEEL INVISIBLE

============================================================



Good security does not make every action painful.



The user should simply see:



what they are allowed to do.



But the system must enforce those boundaries at the backend.



The platform should never depend on frontend hiding as security.



============================================================

\# 24. AUDITABILITY IS PART OF TRUST

============================================================



For important actions, the platform should eventually answer:



WHO

WHAT

WHEN

WHERE

BEFORE

AFTER

WHY



Audit history should be understandable to business users,

not merely useful to developers.



============================================================

\# 25. REPORTS SHOULD BE AN ENGINE, NOT A DUMP

============================================================



Reporting should eventually let the business ask questions.



By:



date

period

warehouse

product

category

brand

customer

employee

order

payment

supplier

financial dimension



A report should be:



derived from trusted data

repeatable

traceable

filterable

exportable

printable

understandable



============================================================

\# 26. PRINTING IS A BUSINESS CAPABILITY

============================================================



Business systems often live in the physical world.



Documents should therefore be first-class.



Possible examples:



Orders

Invoices

Issue Receipts

Packing documents

Warehouse documents

Reports

Customer documents

QR-based documents



Printed output should be trustworthy and aligned with the digital record.



============================================================

\# 27. QR SHOULD CONNECT THE PHYSICAL AND DIGITAL WORLDS

============================================================



QR is not simply a decoration.



The long-term idea is:



PHYSICAL DOCUMENT

↔

DIGITAL RECORD



A QR should lead to something meaningful:



safe customer-facing document

or

authorized internal workflow



depending on context.



The system must understand deployment/domain configuration.



============================================================

\# 28. THE CUSTOMER WEBSITE MUST FEEL RELATED TO THE ADMIN

============================================================



Customer and Admin are different experiences.



They should NOT look identical.



Customer:

\- emotional

\- simple

\- commercial

\- fast

\- attractive



Admin:

\- operational

\- analytical

\- structured

\- dense

\- precise



But both should clearly belong to the same product family.



============================================================

\# 29. DESIGN LANGUAGE

============================================================



The interface should develop a stable visual language.



Principles:



Hierarchy over decoration.



Consistency over novelty.



Context over clutter.



Actions should look like actions.



Navigation should reflect business structure.



Tables should be readable.



Cards should communicate meaning.



Icons should have a consistent visual language.



No random icons.



No emoji-based UI for serious business functions.



Light and dark themes should feel intentional.



Responsive behavior should be considered for real usage.



The product should avoid "every page designed by a different person" syndrome.



============================================================

\# 30. INFORMATION ARCHITECTURE

============================================================



The navigation should follow how the business thinks.



Major domains should remain recognizable:



Overview

Sales

Products

Purchasing

Inventory

Pricing

Operations

Finance

Website

Notifications

System



Small functions should live inside their appropriate domain.



Avoid promoting every minor feature to a navigation destination.



Avoid duplicate concepts under multiple sections unless there is a clear

business reason.



============================================================

\# 31. THE PLATFORM SHOULD GROW WITHOUT BECOMING CHAOTIC

============================================================



A good architecture must support future expansion.



New features should answer:



Which domain owns me?



What is my source entity?



What entities do I create?



What is my state?



Who can use me?



What notification do I create?



What audit events do I create?



What financial effect do I create?



What inventory effect do I create?



What workflow comes before me?



What workflow comes after me?



============================================================

\# 32. THE SYSTEM SHOULD ALWAYS KNOW "WHAT HAPPENS NEXT"

============================================================



A mature system is not just descriptive.



It is procedural.



Examples:



Order paid

→ Issue Receipt



Issue Receipt issued

→ Warehouse work



Picking complete

→ Packing



Packing complete

→ Delivery



Delivery complete

→ Financial completion



Exception detected

→ Human attention



Approval requested

→ Authorized decision



The user should rarely hit a dead end.



============================================================

\# 33. EXCEPTIONS ARE FIRST-CLASS BUSINESS OBJECTS

============================================================



Real businesses fail in interesting ways.



The system should eventually handle:



Out of stock

Wrong item

Damaged item

Payment mismatch

Failed delivery

Duplicate request

Customer dispute

Return

Refund

Inventory discrepancy

Pricing anomaly

Employee conflict

Approval rejection



The platform should represent exceptions deliberately.



Not hide them.



Not crash.



Not silently ignore them.



============================================================

\# 34. AUTOMATION SHOULD REMOVE REPETITION

============================================================



Once workflows are trustworthy, automation should handle predictable work.



Examples:



Low stock alert

Pending approval alert

Unusual refund detection

Payment reconciliation assistance

Operational reminders

Customer communication

Scheduled reporting



Automation should support human decision-making, not create uncontrolled

side effects.



============================================================

\# 35. AI COMES AFTER TRUSTED DATA

============================================================



AI is a long-term layer.



It should not compensate for bad fundamentals.



The correct sequence is:



Trusted Data

→ Reliable Business Logic

→ Observable Workflows

→ Reporting

→ Insights

→ AI



Not:



Broken Data

→ AI

→ confident nonsense



============================================================

\# 36. AI SHOULD BE AN OPERATIONS COPILOT

============================================================



The long-term AI assistant should understand the business context.



Examples of useful questions:



Why did profit drop?



Which products are becoming less profitable?



What inventory is at risk?



Which orders are blocked?



Which warehouse is under pressure?



What caused today's unusual refund pattern?



Which customers are becoming high-value?



Which purchase costs changed?



What should the manager investigate?



AI answers should reference actual business evidence.



============================================================

\# 37. AI SHOULD EXPLAIN, NOT JUST PREDICT

============================================================



A useful system should say:



WHAT

happened



WHY

it happened



EVIDENCE

supporting the conclusion



POSSIBLE ACTION

to consider



EXPECTED EFFECT

of the action



HUMAN APPROVAL

when needed



This is far more valuable than generic AI suggestions.



============================================================

\# 38. AI MUST RESPECT AUTHORITY

============================================================



AI should inherit the user's permissions and scope.



An employee should not be able to ask AI to reveal information that the

employee is forbidden to access directly.



AI should never become a security bypass.



============================================================

\# 39. DEPLOYMENT SHOULD BECOME A PRODUCT CAPABILITY

============================================================



The platform should eventually understand its own environment.



The customer website may be public.



The Admin environment may be private/local/internal.



Domains should be configurable.



Publishing should be deliberate.



A deployment should have an understandable lifecycle:



Draft

→ Preview

→ Publish

→ Verify

→ Rollback



The exact technology is implementation detail.



The business concept is long-term.



============================================================

\# 40. WEBSITE CONFIGURATION SHOULD BE BUSINESS-OWNED

============================================================



A business owner should eventually be able to control important customer-site

experiences without requiring code changes.



Examples:



Branding

Domain

Homepage

Banners

Featured products

SEO

Policies

Content

Catalog visibility

Commercial settings



This should be safe, previewable, and auditable.



============================================================

\# 41. THE PLATFORM SHOULD BE OBSERVABLE

============================================================



The future system should allow operators to understand:



health

errors

work queues

failed workflows

payment issues

inventory anomalies

integration status

background jobs



The platform should fail visibly and explainably.



============================================================

\# 42. INTEGRATIONS SHOULD BE FIRST-CLASS

============================================================



External systems should not become mysterious black boxes.



Examples:



Payment provider

Email

Google/authentication

QR engine

Shipping

Analytics

AI provider

Deployment provider



Every integration should have:



status

configuration

ownership

failure visibility

safe retry behavior



============================================================

\# 43. THE SYSTEM SHOULD PRESERVE BUSINESS TRUTH DURING FAILURE

============================================================



Failures are inevitable.



The question is:



Does the platform leave the business in a trustworthy state?



Important operations should not create:



half-an-order

half-a-refund

half-an-inventory-movement

half-a-payment

half-a-packing-task



Transactional integrity is part of the product's identity.



============================================================

\# 44. RETRIES SHOULD BE SAFE

============================================================



Users click twice.



Browsers retry.



Networks retry.



Workers refresh.



Integrations resend.



The system should know when a request represents:



the same business action



rather than:



a new action.



Idempotency should be designed deliberately.



============================================================

\# 45. CONCURRENT USERS ARE NORMAL

============================================================



The platform must assume several people can act at once.



Two warehouse employees.



Sales + warehouse.



Accountant + manager.



Admin + employee.



A correct system should protect shared state from conflicting actions.



============================================================

\# 46. PERFORMANCE MATTERS TO BUSINESS

============================================================



Performance is not only technical.



A slow workflow causes:



\- worker frustration

\- mistakes

\- duplicated clicks

\- abandoned actions

\- operational delays



Critical business workflows should therefore remain responsive and predictable.



============================================================

\# 47. DATA SHOULD BE EXPORTABLE AND PORTABLE

============================================================



The platform should respect business ownership of its data.



Important business information should be exportable where appropriate.



Examples:



CSV

Printable reports

Documents

Business records

Operational history

Financial information



============================================================

\# 48. THE SYSTEM SHOULD SUPPORT GROWTH

============================================================



A business may grow from:



one warehouse

to multiple warehouses.



one employee

to many employees.



one category

to thousands of products.



small order volume

to serious transactional volume.



The product should evolve without becoming structurally confused.



============================================================

\# 49. THE SYSTEM SHOULD WORK FOR DIFFERENT PEOPLE DIFFERENTLY

============================================================



There should eventually be distinct perspectives:



Customer

Sales Employee

Warehouse Worker

Warehouse Manager

Procurement

Accountant

Operations Manager

Driver

Website Manager

Business Owner

Administrator



The underlying truth is shared.



The experience is role-aware.



============================================================

\# 50. HUMAN CLARITY IS A PRODUCT FEATURE

============================================================



The platform should favor language users can understand.



Avoid unnecessary technical terminology.



Instead of:



"Mutation succeeded"



say:



"Stock transfer completed."



Instead of:



"Foreign key violation"



say:



"This product cannot be removed because it is used by an existing order."



The system should be technically precise and humanly understandable.



============================================================

\# 51. THE PLATFORM SHOULD HELP USERS MAKE FEWER MISTAKES

============================================================



Good UX prevents errors.



Examples:



Show consequences.



Ask for confirmation where necessary.



Protect destructive actions.



Show current state.



Disable impossible actions.



Explain why actions are unavailable.



Preserve entered information when safe.



Provide useful validation.



Do not create mysterious buttons.



============================================================

\# 52. BUSINESS STATES SHOULD BE EXPLICIT

============================================================



State machines should represent real transitions.



Users should not be able to make nonsensical transitions.



The system should understand:



what state something is in



what transitions are allowed



who can perform them



what happens as a result



============================================================

\# 53. THERE SHOULD BE ONE SOURCE OF TRUTH PER BUSINESS CONCEPT

============================================================



Avoid duplicates.



One order concept.



One customer concept.



One inventory ledger.



One notification system.



One audit trail.



One permission engine.



One QR mechanism.



One pricing authority.



One business identity.



Multiple views are fine.



Multiple competing sources of truth are dangerous.



============================================================

\# 54. ARCHITECTURE SHOULD BE INVISIBLE TO THE USER

============================================================



The user should not care:



which database table stores a task

which service creates a notification

which framework renders a dashboard

which queue delivers a job



The implementation should support the business rather than becoming the

business experience.



============================================================

\# 55. THE PROJECT SHOULD REMAIN REBUILDABLE

============================================================



Any individual implementation should be replaceable.



A future team should be able to:



replace a frontend

replace a backend

replace AI providers

replace deployment

migrate databases



without losing the conceptual business model.



This document protects the business vision from technical churn.



============================================================

\# 56. SUCCESS IS NOT MEASURED IN FEATURES

============================================================



The platform is not better because it has:



more pages

more buttons

more dashboards

more charts

more AI

more settings



The platform is better when:



the business can operate more clearly,

more safely,

more quickly,

and with greater confidence.



============================================================

\# 57. QUALITY OF THE PRODUCT

============================================================



A mature version of this project should feel:



COHERENT

TRUSTWORTHY

CONNECTED

EXPLAINABLE

AUDITABLE

ROLE-AWARE

OPERATIONAL

SCALABLE

INTELLIGENT

CALM



============================================================

\# 58. THE NORTH STAR

============================================================



The ultimate North Star is:



A business owner should be able to open the platform and understand the

business.



An employee should be able to open the platform and understand their work.



An accountant should be able to explain the numbers.



A warehouse worker should be able to execute the workflow.



A manager should be able to identify problems.



A customer should have a clean buying experience.



And the system should connect all of those truths without forcing humans

to manually reconcile separate worlds.



============================================================

\# 59. LONG-TERM DESTINATION

============================================================



The destination is a platform where:



Customer

\+

Commerce

\+

Warehouse

\+

Operations

\+

Inventory

\+

Procurement

\+

Pricing

\+

Finance

\+

People

\+

Security

\+

Reporting

\+

Automation

\+

AI

\+

Deployment



behave as one coherent business organism.



Not one application with many menus.



A connected operating system for the business.



============================================================

\# 60. FINAL PRINCIPLE

============================================================



When future decisions conflict, prefer the option that produces:



more business clarity

more trustworthy data

clearer responsibility

safer workflows

better traceability

less duplication

less cognitive load

better long-term extensibility



over the option that merely:



looks faster

adds more screens

sounds more impressive

produces a green report

or adds more code.



The purpose of technology here is not to impress.



The purpose is to make the business easier to understand,

easier to operate,

harder to break,

and easier to grow.



END OF VISION

