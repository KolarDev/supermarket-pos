# Navigation Guide

A walkthrough of the Retail POS & Inventory prototype — every screen, every control in the
top bar, and the actions worth demonstrating.

The prototype is **frontend only**. There is no server, no database and no network call
anywhere in the app: everything you do is held in React state and mirrored into
`localStorage` so a page refresh does not lose the session.

---

## Contents

- [Running the prototype](#running-the-prototype)
- [How navigation works](#how-navigation-works)
- [The top navigation bar](#the-top-navigation-bar)
  - [Screen tabs](#screen-tabs)
  - [Active role selector](#active-role-selector)
  - [Offline mode](#offline-mode)
  - [Data reset](#data-reset)
- [Running the till on a phone](#running-the-till-on-a-phone)
- [Dashboard](#dashboard)
- [POS Register](#pos-register)
- [Products](#products)
- [Inventory](#inventory)
- [Printing on 80mm thermal stock](#printing-on-80mm-thermal-stock)
- [The seeded demo data](#the-seeded-demo-data)
- [What is real and what is simulated](#what-is-real-and-what-is-simulated)
- [Keyboard and pointer shortcuts](#keyboard-and-pointer-shortcuts)
- [Where the session is stored](#where-the-session-is-stored)

---

## Running the prototype

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # type-check and produce dist/
npm run preview      # serve the production build
```

Four screens share one store, so a sale rung up on the register moves the dashboard's
figures, the ledger and the catalogue at the same time. That is the point of the demo — it
is worth opening the Dashboard in one tab and the register in another.

---

## How navigation works

The four screens are switched with **tab state, not URL routes**. Clicking a tab in the top
bar swaps which screen is mounted; the address bar does not change and the browser's back
button does not move between screens.

| Screen | Navbar tab | Name used in this guide |
| --- | --- | --- |
| Dashboard | **Dashboard** | `/dashboard` |
| POS Register | **POS Register** | `/pos` |
| Products | **Products** | `/products` |
| Inventory | **Inventory** | `/inventory` |

Each screen fades in on switch, and the whole app is wrapped in a single shared
`StoreProvider`, so nothing is lost when you move between them. If this prototype grows a
second consumer of its state — a customer display, a second till — the tab state is the one
thing that would be swapped for a router, and every screen is already self-contained enough
to sit behind one.

The shell is **viewport-locked**: the top bar never scrolls away and each screen owns its own
scrolling. That is what keeps a screen's action button — the till's **Complete Sale**, a
catalogue row's **Adjust Stock** — reachable at the bottom of a phone without hunting for it.

---

## The top navigation bar

The bar is persistent: it stays pinned to the top of every screen.

| Control | Where | What it does |
| --- | --- | --- |
| Store mark and name | Far left | Branding — `SUPERMARKET POS` |
| Signed-in operator | Under the store name | Shows the current role's operator, e.g. `Ngozi Okafor · Cashier` |
| Screen tabs | Centre left | Switches between Dashboard, POS Register, Products and Inventory |
| Role selector | Right | Switches between **Cashier** and **Manager** |
| Online / Offline switch | Right | Simulates the till losing its connection |
| Reset | Far right | Restores the seeded demo data |

Above the bar, when the app is offline, a thin amber banner is pinned to the very top of the
viewport so it is visible on every screen:

> ⚡ Running in Local Offline Mode. Sales will sync when connection is restored.

Below `md` (768px) the layout changes — see
[Running the till on a phone](#running-the-till-on-a-phone).

### Screen tabs

Four tabs, each with an icon:

- **Dashboard** — the executive summary: today's takings, the week's trend, top sellers and
  the most recent receipts.
- **POS Register** — the till itself: scan, build a cart, take payment, print a receipt.
- **Products** — the catalogue: every SKU, its price, its stock level, plus **Add Product**.
- **Inventory** — the reorder list and the full stock movement audit trail.

The active tab is shown as a white pill and is marked with `aria-current="page"` for screen
readers.

### Active role selector

Two pills, **Cashier** and **Manager**. The role is not cosmetic — it decides the operator
name stamped on the things you create:

| Role | Operator | Named on |
| --- | --- | --- |
| Cashier | Ngozi Okafor | Receipts, stock movements |
| Manager | Emeka Balogun | Receipts, stock movements |

The name under the store mark updates with the selection, and every new movement row in the
Inventory ledger is attributed to the role that was active when it was written. Switching
role is a good 5-second demo of "the audit trail knows who did it":

1. Note the operator name under `SUPERMARKET POS`.
2. Switch to **Manager**.
3. Adjust any product's stock from Products or Inventory.
4. Open **Inventory** and find the row — the **User** column reads `Emeka Balogun`.

### Offline mode

A single toggle that flips the till between two states:

| State | The switch reads | Banner |
| --- | --- | --- |
| Online | ● **Online**, green | none |
| Offline | ⚡ **Offline Mode**, amber | Amber bar pinned to the top of every screen |

**To simulate a lost connection:** click **Online**. The switch turns amber, the banner
appears at the top of the viewport, and the till keeps working exactly as before — which is
the claim being demonstrated: an offline till does not stop selling. Click **Offline Mode**
to come back online and the banner clears.

> **Presenting this honestly:** the toggle simulates the *condition*, and the app responds
> by showing the indicator and the banner. It does not build a sync queue, because there is
> no backend for a queue to drain into. If someone asks "where do the queued sales go?",
> the answer is "that's the integration point — the client-side half is here, the
> server-side reconcile is out of scope for the prototype."

### Data reset

**Reset** (far right) restores the seeded catalogue, ledger, sales history and receipt
counter, and returns the role to Cashier and the connection to Online.

It asks for confirmation first, because it discards every sale rung up in the current
session. Use it between demos:

> Restore the seeded demo data? Sales rung up in this session will be lost.

This control exists because the seeded sales are dated **relative to the day they were
seeded** (see [The seeded demo data](#the-seeded-demo-data)). A browser that has been
holding this session for a week will show a stale dashboard; Reset puts correct-dated data
back.

---

## Running the till on a phone

The whole app is usable on a handset or a handheld terminal — worth showing, because the
person who actually rings up sales is standing up, holding one.

### The navigation drawer

Below `md` (768px) the four screen tabs and the demo toolbar move off the bar and into a
**side drawer**:

1. Tap the **hamburger** at the top left. The drawer slides in from the left over a dimmed
   backdrop.
2. Tap any screen. The drawer closes itself and the screen behind it has already changed.
3. Or dismiss it without navigating: tap the backdrop, tap **✕**, or press **Escape**.

While the drawer is closed it is taken out of the tab order and the accessibility tree
entirely, so a keyboard or screen reader cannot land on a control that is not on screen. Focus
returns to the hamburger when it closes and moves into the drawer when it opens.

### The till on a small screen

The two-column till (product grid | cart) does not fit a phone, so it becomes a **two-tab
switch**: **Products** and **Cart**, with a live item count on the cart tab. Only one is on
screen at a time, so neither is squeezed.

Once the cart has something in it, a **review bar** is pinned to the bottom of the Products
tab showing the item count and the running total — *N items · ₦X · Review & pay*. Tapping it
switches to the Cart tab. The **Complete Sale** button sits at the bottom of the Cart tab, so
after taking payment the cashier never scrolls to find it.

### Touch targets

Every control meant to be tapped is at least **44×44px** — the steppers, the quick-tender
chips, the tab switch, the drawer rows, the toolbar buttons. The quantity steppers on a cart
line are joined into one bordered group rather than sitting as two separate buttons, so a
thumb cannot land in the gap between them and miss.

### The tables

Dashboard, Products and Inventory each shed their least important columns on a narrow screen
and fold those facts into the row that remains, rather than forcing a sideways scroll:

| Screen | Dropped below `lg` | Folded into |
| --- | --- | --- |
| Dashboard | Date & Time, Cashier | under the receipt number |
| Products | Category, Status | a chip row under the product name |
| Inventory | Timestamp, Reason, User | under the product name and the type badge |

The stock status badge becomes a coloured dot on the narrowest screens, where the word will
not fit — the full label is still there for screen readers. `overflow-x-auto` remains as the
backstop for the very narrowest handsets.

---

## Dashboard

The manager's view of the store. Every figure is derived from the same `sales` history the
register writes to, so nothing here is separately mocked.

**What to look at:**

1. **Today's Sales** — takings for today, formatted in Naira, with the transaction count.
2. **Total Transactions** — today's sale count, with the average basket value underneath.
3. **Inventory Valuation** — the whole catalogue valued at retail:
   `Σ (stock × sellingPrice)`.
4. **Stock Alerts** — how many lines need attention, split into *out of stock* and *low*.
   Click anywhere on this card to jump straight to Inventory.

**Sales Overview** — a seven-day column chart. Today's bar is navy; the rest are muted.
Hover any bar for the exact figure and sale count. The heading shows the period total.

**Top Sellers** — the five best lines of the last seven days by units sold, ranked, with
each bar drawn relative to the best seller. Ties are broken by revenue.

**Recent Transactions** — the last five completed sales. Columns: Receipt, Date & Time,
Cashier, Payment, Total, and **View Receipt**. The **Payment** badge reads `CASH`, `CARD`,
`TRANSFER`, or `SPLIT` for a bill settled across more than one method. Clicking **View
Receipt** reopens the original 80mm thermal receipt for that sale, from which you can print
it again.

---

## POS Register

The till. The layout is a product grid on the left and the current sale on the right.

### Scanning a barcode

The scan field at the top left holds keyboard focus as soon as the screen opens on a desktop
— a barcode scanner gun is just a keyboard that types the digits and presses Enter, so the
field has to already be focused when the trigger is pulled. On a touch device it does not
grab focus, because popping the on-screen keyboard over the product grid is the opposite of
helpful.

1. Type or scan a code into the **Scan barcode or type SKU** field.
2. Press **Enter**.

The lookup accepts any of three identifiers, case-insensitively:

- the **barcode** (`6151100248916`)
- the **shelf SKU** (`BEV-COKE-50`)
- the internal **product id** (`PRD-001`)

A successful scan adds one unit, clears the field and shows a green confirmation. A failed
one explains itself in a red toast — *no product matches*, *has been discontinued*, *is out
of stock*, or *only N in stock — cart already holds N*. The field is re-focused either way,
so the next scan needs no click.

Typing a **partial** code is also useful: the scan field doubles as a filter, narrowing the
product grid underneath as you type so you can confirm the right item before pressing Enter.

**To add by pointing instead of scanning:** click any product card. Cards show the price,
category and stock badge, are disabled when the line is out of stock, and display an
*N in cart* counter once they are in the basket. The category pills above the grid filter 
the visible products; **All** clears the filter.

### Ringing up a sale

1. Add items by scanning or clicking. The cart panel on the right builds up the sale.
2. Adjust quantities with the **−** / **+** steppers, or remove a line with **✕**.
   Steppers cannot exceed the live shelf count, so a sale can't oversell the stock.
3. Check the totals. **VAT is 7.5% and is added on top** of the shelf price:

   | Line | Amount |
   | --- | --- |
   | Subtotal | shelf prices |
   | VAT (7.5%) | 7.5% of subtotal |
   | **Total** | subtotal + VAT |

4. Take payment — see below.

### Adjusting a cart line

Each line carries its own controls:

| Control | Does |
| --- | --- |
| **−** | One unit fewer. At the last unit it removes the line, and says so in a toast — a customer changing their mind is not a mistake worth a dialog box. |
| **+** | One unit more, disabled once the cart holds everything on the shelf. |
| **quantity box** | Type a number directly — for a wholesale order this is one keystroke against twelve taps. Commits on **Enter** or when you click away. |
| **✕** | Removes the line outright. |

The **+** and **−** buttons and the box are joined into one bordered group, so the three read
as one control and a thumb cannot slip between them.

The quantity box holds what you are typing rather than pushing every keystroke straight at the
cart. Typing `120` would otherwise be clamped at `1`, then `12`, on the way past — so the box
keeps a draft and commits the finished number, then shows whatever the store actually
accepted. It can never drift from the truth.

### Taking payment

A bill can be **split across cash, card and transfer at the same time** — routine at a
Nigerian till, where a customer might put ₦4,000 down in notes and settle the balance on a
card.

There are three tender fields, one per method. Fill in any combination:

1. Type into **Cash**, **Card** and/or **Transfer**. Each is a live field — the panel
   recalculates as you type.
2. Watch **Total paid** above the fields: `₦4,000.00 of ₦10,000.00`, over a progress bar that
   fills as the bill is covered.
3. Watch the line underneath, which always says exactly where the sale stands:

   | Situation | The panel reads |
   | --- | --- |
   | Anything still outstanding | **Remaining balance due** ₦X (red) |
   | Paid in full, change owed | **Change due** ₦X (green) |
   | Paid to the kobo | ✓ **Exact amount tendered.** (green) |
   | Change larger than the cash put down | the rule that blocks it, in red — see below |

**Quick cash tools:** four chips — **₦1,000**, **₦5,000**, **₦10,000**, **₦20,000** — drop a
note straight into the **Cash** field. Two taps settles most cash sales.

**Strict submit guard:** **Complete Sale · ₦…** stays disabled until the tenders cover the
grand total. It also stays disabled while the cart is empty.

> **Why change can only come out of the cash.** Paying a ₦10,000 bill with ₦20,000 on a card
> would leave ₦10,000 "change" the panel could not honestly offer — a card terminal cannot
> hand back notes, and a transfer certainly cannot. The guard refuses that combination and
> says so. It is the kind of rule that looks pedantic until you work out how much a drawer
> loses over a week without it.

**What completing does, all at once:**

- writes the sale to the history (which moves the Dashboard's KPIs, chart and top sellers)
- decrements the stock of every line sold
- writes one **SALE** movement per line into the audit ledger, reasoned
  `Sold on receipt REC-10023`
- advances the receipt counter
- clears the cart and resets the tender fields
- opens the receipt

The sale records **every tender taken**, not just a summary: the receipt prints the split, and
the Dashboard badge reads `SPLIT` so nobody reads a part-cash sale as a full drawer.

### Printing a receipt

**To reprint an older receipt:** open **Dashboard** → find the row in *Recent Transactions*
→ **View Receipt**.

**To print:** click **Print Receipt** in the receipt dialog. Only the receipt reaches paper
— see [Printing on 80mm thermal stock](#printing-on-80mm-thermal-stock).

**To close:** click **Close / New Sale** or press **Escape**. Either way focus returns to the
scan field, ready for the next customer.

The receipt itself carries the store header and address, the receipt number, date, cashier
and role, every line with its quantity and line total, the subtotal / VAT / total block, the
payment, an item count, and a barcode drawn from the receipt number — the same receipt always
prints the same barcode, so a reprint is visually identical to the original.

A split sale prints its tenders itemised, so the customer can check the arithmetic:

```
Payment                       SPLIT
  CASH                    ₦5,000.00
  TRANSFER                ₦7,900.00
```

A single-tender sale just names the method — `Payment  CARD` — and a cash sale adds
**Received** and **Change** lines underneath.

---

## Products

The catalogue. Four metrics across the top: **Total SKUs**, **Inventory Value** (valued at
retail), **Low Stock** and **Out of Stock**. The alert counts are scoped to active lines — a
discontinued product sitting at zero is not something anyone needs to reorder.

### Searching and filtering

- The **search box** matches product name, SKU or barcode.
- The **category dropdown** narrows to one aisle.
- The two combine, and the heading shows `N of M products`.

The table lists Product (name, SKU, barcode), Category, Price, Stock Level with its badge,
Status (Active / Inactive) and an **Adjust Stock** action per row. On a phone the Category and
Status columns fold under the product name — see
[the tables](#the-tables).

### Adding a product

1. Click **Add Product** in the top right of the Products screen. A dialog opens.
2. Fill in the form:

   | Field | Notes |
   | --- | --- |
   | **Product name** | As it should read on the shelf label and the receipt |
   | **Shelf SKU** | Upper-cased automatically — the catalogue convention |
   | **Category** | One of the eight aisles |
   | **Barcode** | Digits only, 8–14 of them |
   | **Cost price (₦)** | What the store paid |
   | **Selling price (₦)** | What the customer pays, before VAT |
   | **Opening stock (units)** | The count on hand right now |
   | **Reorder level (units)** | At or below this the line is flagged for reorder |

3. If the item has no scannable code of its own — loose goods, a repack, an own-brand
   line — click **Generate** next to the barcode field. It allocates the next free in-store
   barcode beginning `200`, continuing the series already in the catalogue.
4. Watch the **margin** readout as you type the two prices: it shows the margin per unit in
   Naira and as a percentage. If the cost is above the selling price it turns red and warns
   that the line would sell at a loss.
5. Click **Add Product**. It stays disabled until the name, SKU, a scannable barcode and
   both prices are filled in.

**What happens on save:**

- The line is appended to the catalogue with the next free `PRD-0nn` id.
- If **opening stock is above zero**, an **Opening Stock** movement is written to the ledger
  — so the stock you claim on day one is on the record, not silently assumed. A line
  created at zero writes nothing.
- Any active search or category filter is cleared and the new row is highlighted with a
  **New** badge, so the save is visibly confirmed rather than appearing to have failed.

**Codes must be unique**, and the form will refuse a barcode or SKU that is already in use,
naming the product that holds it. This matters more than it looks: the register resolves a
scan to the first match, so two lines sharing a barcode would quietly ring up the wrong
product.

### Adjusting stock

**Adjust Stock** on any catalogue row — and on any reorder card in Inventory — opens the
adjustment dialog. Pick what happened:

| Type | Meaning |
| --- | --- |
| **Purchase** | Stock received. Adds. |
| **Damage** | Written off — breakage, expiry, theft. Removes. |
| **Correction** | An audit fix, in whichever direction you pick. |

Enter the quantity and a **reason**. The reason is required: it is the sentence an auditor
reads six months later. The dialog previews the resulting stock level before you commit,
and refuses an adjustment that would take the line below zero rather than clamping it
silently — a write-off of 50 units against 3 on the shelf should be an error, not a
quiet −3.

---

## Inventory

Two sections: what needs reordering, and the full movement history.

### Needs Attention

Every active line at or below its reorder level, worst first. Two pills in the header count
them: **N out of stock** and **N low**. Each card shows the product, its category, its stock
against its minimum, a status badge, how many units are needed to get back to the minimum,
and an **Adjust Stock** button.

Clicking the **Stock Alerts** KPI on the Dashboard lands you here.

### Reading the stock movement log

The audit trail, newest first. Every change to stock is a row here — sales included, written
automatically as each sale completes.

| Column | What it tells you |
| --- | --- |
| **Timestamp** | `YYYY-MM-DD HH:MM:SS`, so the column sorts and lines up |
| **Product** | The product name as it was at the time |
| **Type** | Colour-coded badge — see below |
| **Qty** | Signed: green for stock in, red for stock out |
| **Reason** | The note the operator typed, or the receipt a sale came from |
| **User** | The operator responsible |

Below `lg` the Timestamp, Reason and User columns fold under the product name so three columns
survive on a phone instead of six.

The five movement types, and how to read them at a glance:

| Badge | Type | Means | Sign |
| --- | --- | --- | --- |
| Grey | **Opening Stock** | The count a line started with | + |
| Red | **Sale** | Sold on a receipt | − |
| Green | **Purchase** | Received from a supplier | + |
| Amber | **Damage** | Written off | − |
| Indigo | **Adjustment** | A correction after a physical count | +/− |

Sales and damage both reduce stock but mean very different things to an auditor, so they are
never collapsed into one badge.

**To investigate one product:** type its name into the search box. The search covers the
product name and the reason text, so searching `REC-10023` pulls up every line of that
receipt. The type dropdown narrows to a single movement type — useful for a "show me only
write-offs this week" conversation.

> The seeded ledger covers a recent window of trade rather than the store's whole life, so
> it is **not** expected to reconcile to zero against the current shelf counts. That is what
> a real till looks like when it loads a window of movements instead of every row since
> opening.

---

## Printing on 80mm thermal stock

The receipt is built for an 80mm roll. Print isolation is handled globally: everything in
the app is hidden for print and only the receipt block is re-shown, so the same clean
output comes out whether the receipt was opened from the register, the dashboard or
anywhere else.

Because the print rules take the page for the receipt, **the browser's own print settings
still apply and are worth checking the first time**:

| Setting | Value |
| --- | --- |
| Paper size | **80mm** roll (or the closest custom size your driver offers) |
| Margins | **None** / Default |
| Scale | **100%** — do not "fit to page" |
| Headers and footers | **Off** |
| Background graphics | On, if you want the receipt's rules and rules to render |

If the printer is a real thermal unit, its own driver usually sets the roll width, and the
receipt will paginate to fit. If you print to PDF instead, you will get one page whose
height is the receipt's height.

---

## The seeded demo data

The app boots with a plausible mid-sized Nigerian supermarket already trading, so no screen
is ever empty:

| Seeded | Detail |
| --- | --- |
| **Catalogue** | 18 SKUs across eight aisles — beverages, staples, dairy, snacks, personal care, home care, baby, farm |
| **Stock levels** | Deliberately mixed so every badge state renders immediately: in stock, low, and out |
| **Trade history** | 23 completed sales spread over the last seven days, with today's takings the peak |
| **Audit ledger** | 48 movements, covering all five movement types |
| **Receipt counter** | The next sale you ring up is `REC-10023` |

Barcodes are structurally valid EAN-13 codes with correct GS1 check digits, and the loose
goods use the `2` prefix reserved for in-store labels.

**Receipt `REC-10019` is deliberately a split sale** — 48 units on a wholesale order, settled
₦5,000 cash and ₦7,900 by transfer. It is the one seeded receipt that shows the tender
breakdown on the thermal print and the `SPLIT` badge on the Dashboard, so the feature is
visible before anyone rings one up. Every seeded sale is checked at import: a tender table
that does not cover its own bill throws rather than seeding a receipt that cannot be
reconciled.

**Two things worth knowing before you demo:**

1. **Timestamps are relative to the day the app first loaded**, not fixed dates. This is
   deliberate — the dashboard's headline figure is *today's* takings, and hard-coded dates
   would read ₦0.00 for every demo after the one they were written for. The trade-off is
   that the seed freezes into `localStorage` on first load, so a browser holding an old
   session shows old dates. **Press Reset between demos.**
2. **A few products are deliberately at or below their reorder level**, and one is
   discontinued, so the alert states are visible without setting anything up.

---

## What is real and what is simulated

Worth knowing before someone asks, so the demo holds up:

| Real | Simulated |
| --- | --- |
| Every figure is computed from live state — a sale moves the dashboard, the ledger and the stock counts together | The **offline mode** toggle (no sync queue exists — there is no backend) |
| VAT, change, margins, stock arithmetic and barcode check digits are computed correctly | The **operators** — two seeded names, not a login |
| Split-tender arithmetic, including the rule that change can only come out of the cash portion | **Payment** — cash, card and transfer are recorded, never processed |
| The audit ledger is written by the same code paths that move stock, so it cannot drift from the receipts | **Persistence** — `localStorage`, not a database |
| Print isolation is real: only the receipt reaches paper | |

---

## Keyboard and pointer shortcuts

| Key / action | Where | Does |
| --- | --- | --- |
| **Enter** | Scan field | Looks up the code and adds it to the cart |
| **Enter** | Cart quantity box | Commits the typed quantity |
| **Escape** | Any open dialog | Closes it |
| **Escape** | Mobile drawer | Closes it |
| Any typing | POS Register | Filters the product grid |
| Click a product card | POS Register | Adds one unit |
| Click a quick-tender chip | POS Register | Drops that note into the Cash field |
| Click the **Stock Alerts** card | Dashboard | Jumps to Inventory |
| Click **View Receipt** | Dashboard | Reopens that sale's thermal receipt |

Focus is always visible (a navy outline) rather than relying on hover, because a till is
driven from the keyboard.

---

## Where the session is stored

Everything lives under a single `localStorage` key:

```
supermarket-pos.state.v3
```

It holds the catalogue, the cart, the movement ledger, the sales history, the receipt
counter, the selected role and the connection state. It is written after every change and
read once on boot.

The version in the key is not decoration. A sale used to record a single payment method; it
now records a **list of tenders**. A browser holding the older payload would render receipts
with no payment lines on them, so the key was bumped and the stale session is retired rather
than half-read.

- **To start completely fresh:** press **Reset** in the navbar, or clear that key in your
  browser's dev tools and reload.
- **If the dashboard looks stale or empty:** you are holding a session from an earlier build
  or an earlier day. Press **Reset**.
- **If boot ever fails** — corrupt JSON, or storage blocked in a private window — the app
  falls back to the seed data and keeps working in memory, rather than refusing to open the
  till.
