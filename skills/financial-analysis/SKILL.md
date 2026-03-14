---
name: financial-analysis
description: Institutional-grade financial modeling and analysis. Build DCF valuations, comparable company analyses (comps), LBO models, 3-statement financials, competitive landscape maps, and model audits. Produces professional Excel workbooks using openpyxl. Trigger on requests like "build a DCF", "run comps on [company]", "LBO model", "3-statement model", "competitive analysis", "audit my model", "check this model", or any financial modeling/valuation task.
allowed-tools: Bash, WebSearch, WebFetch
---

# Financial Analysis Skill

You build institutional-quality financial models and analyses. All models are delivered as Excel workbooks (.xlsx) built with openpyxl via Python.

## Data Sources

Use in priority order:
1. **Yahoo Finance via yfinance** (free, fast) — preferred for market data, financials, and price history:
```python
import yfinance as yf
ticker = yf.Ticker("AAPL")
info = ticker.info                  # market cap, P/E, sector, description
financials = ticker.financials      # annual IS (revenue, EBIT, net income)
balance_sheet = ticker.balance_sheet
cashflow = ticker.cashflow
quarterly = ticker.quarterly_financials
hist = ticker.history(period="5y") # OHLCV price history
recommendations = ticker.recommendations
```
Install if missing: `pip install yfinance --quiet`

2. **SEC EDGAR** (free) — for full 10-K/10-Q filings and historical data: `https://efts.sec.gov/LATEST/search-index?q=%22{ticker}%22&forms=10-K`
3. **Web search** — for analyst estimates, recent news, qualitative context
4. **User-provided files** — always check first; use template structure if provided

## Color Coding (all models)

- **Blue text**: hardcoded inputs
- **Black text**: formulas and calculations
- **Green text / purple text**: cross-sheet links
- **Thick borders**: major section boundaries
- **Cell comments**: every hardcoded input must cite its source

## Validation Before Delivery

Always run this recalculation check after building any model:
```bash
python3 -c "
import openpyxl
wb = openpyxl.load_workbook('model.xlsx')
print('Sheets:', wb.sheetnames)
print('Model loaded OK')
"
```

---

## DCF Valuation (`/dcf`)

**Trigger**: "DCF", "discounted cash flow", "valuation model", "intrinsic value"

### Workflow
1. Identify company → fetch 3 years historical financials from SEC/web
2. Run comps analysis to anchor terminal exit multiple and benchmark margins/growth
3. Build DCF model (Excel, 2 sheets)
4. Cross-check implied multiples vs peer group
5. Deliver model + written summary

### Excel Structure

**Sheet 1 — DCF**
- Header: Company, date, analyst
- Historical section: 3 years actuals (Revenue, EBITDA, EBIT, Net Income, FCF)
- Projection section: 5-year forecast (Bear / Base / Bull scenarios, case selector cell: 1/2/3)
- FCF build: EBIT → NOPAT → + D&A → − CapEx → − ΔNWC
- Terminal value: Exit multiple method AND Gordon Growth method
- Discount section: PV of FCF + PV of TV = Enterprise Value
- Equity bridge: EV − Net Debt = Equity Value → per-share price
- **3 sensitivity tables** (25 cells each, all full DCF formulas — never approximations):
  - WACC vs Terminal Growth Rate
  - Revenue Growth vs EBIT Margin
  - Beta vs Risk-Free Rate

**Sheet 2 — WACC**
- Risk-free rate (10-yr Treasury), equity risk premium, beta (levered/unlevered)
- Cost of equity (CAPM), cost of debt (after-tax), capital structure weights
- Blended WACC

### Critical Rules
- Terminal value must be 50–70% of enterprise value (flag if outside this range)
- Tax rate: 21–28% (US); flag outliers
- Terminal growth rate must be below WACC
- Sensitivity cells must recalculate the full DCF — never use Excel Data Tables or linear approximations
- All 75 sensitivity cells populated before delivery
- Revenue formulas reference a consolidation column (not raw scenario cells directly)

---

## Comparable Company Analysis (`/comps`)

**Trigger**: "comps", "comparable companies", "peer group", "trading multiples", "benchmarking"

### Workflow
1. Identify company → clarify analysis purpose (M&A, IPO, investment thesis)
2. Select 4–6 peers with similar business model, scale, and geography
3. Fetch LTM financials for each peer (keep periods consistent)
4. Build Excel comps table
5. Add statistical summary row

### Excel Structure

**Header block**: Company name, analysis date, purpose, data sources

**Operating Metrics section** (choose 5 relevant to industry):
- Revenue, YoY Growth, Gross Margin, EBITDA, EBITDA Margin, EBIT Margin
- Industry-specific: Rule of 40 (SaaS), Same-store sales (retail), Net Revenue Retention, GPV/take rate (payments)

**Valuation Multiples section**:
- Market Cap, Net Debt, Enterprise Value
- EV/Revenue (LTM + NTM), EV/EBITDA (LTM + NTM), P/E (LTM + NTM)
- All multiples as formulas referencing operating metric cells — never hardcoded

**Statistical summary** (required for every metric):
- Max, 75th percentile, Median, 25th percentile, Min

### Rules
- All hardcoded inputs have cell comments with source citation
- Hyperlinks to SEC filings where available
- Sanity check: Gross Margin > EBITDA Margin > Net Margin (flag violations)
- Limit to 5 operating + 5 valuation metrics ("5-10 Rule") unless user requests more
- Data periods must be consistent (all LTM, or all same fiscal year)

---

## LBO Model (`/lbo`)

**Trigger**: "LBO", "leveraged buyout", "private equity model", "PE returns", "IRR analysis"

### Workflow
1. If user provides a template file — use its structure exactly
2. If no template — ask about preferences before defaulting to standard structure
3. Build model section by section, validating as you go
4. Run returns analysis

### Excel Structure

**Sources & Uses**: Purchase price, entry EV/EBITDA, equity check, fees
**Debt Schedule**: Revolver, TLA, TLB, Senior Notes; amortization, PIK, cash sweep
**Income Statement**: Revenue → EBITDA → EBIT → EBT → Net Income (5-year projection)
**Balance Sheet**: Assets = Liabilities + Equity (must balance — validate every year)
**Cash Flow Statement**: ties to IS and BS
**Returns**: Exit at year 3/4/5, EV/EBITDA exit multiple range, equity proceeds, IRR, MoM

### Color Coding
- Blue: hardcoded inputs
- Black: formulas
- Purple: same-tab links
- Green: cross-sheet links

### Critical Rules
- Every calculation must be a dynamic formula — never hardcode computed values
- Interest circularity: use beginning-of-period balances (not ending)
- Debt paydown priority: revolver → TLA → TLB → Senior Notes
- Balance sheet must balance for every projection year — validate before delivery
- Sign conventions must be consistent throughout (pick one and enforce it)

---

## 3-Statement Model (`/3-statements`)

**Trigger**: "3-statement model", "integrated financial model", "income statement balance sheet cash flow", "financial model template"

### Workflow
1. Check for user-provided template first — if exists, use its exact structure
2. Map all tabs before filling any formulas (identify input vs formula cells)
3. Fill section by section: IS → BS → CF → supporting schedules
4. Validate: BS balance, CF tie-out, retained earnings roll

### Tab Structure
- **IS / P&L**: Revenue → Gross Profit → EBITDA → EBIT → EBT → Net Income
- **BS**: Assets = Liabilities + Equity (current + non-current)
- **CF**: Operating (indirect) → Investing → Financing → Net Change in Cash
- **WC**: Working capital schedule (AR, Inventory, AP days)
- **DA**: Depreciation & amortization schedule
- **Debt**: Debt schedule with drawdowns and repayments

### Scenario Support
- Base, Upside, Downside cases
- Upside = strongest financials / best credit profile
- Case selector drives all three statements

### Validation Checklist (run before delivery)
- [ ] BS balances every period (Assets = L + E, tolerance: $0)
- [ ] Ending cash on CF matches BS cash
- [ ] Retained earnings: prior RE + Net Income − Dividends = current RE
- [ ] Debt schedule ties to BS long-term debt
- [ ] Revenue formulas reference input cells, not hardcoded
- [ ] No #REF!, #DIV/0!, or #VALUE! errors

---

## Competitive Analysis (`/competitive-analysis`)

**Trigger**: "competitive analysis", "competitive landscape", "market map", "competitor overview", "industry analysis"

### Workflow
1. Identify company/industry and analysis purpose
2. Research market size, growth rate, key trends
3. Map competitors by segment/business model
4. Build metrics comparison table
5. Assess competitive positioning and moats

### Output Structure (PowerPoint or written report)

**Slide / Section 1 — Market Overview**
- TAM, SAM, growth rate with source citations
- 3–5 industry KPIs (e.g., ARR/NRR for SaaS, GPV/take rate for payments)
- Key macro/regulatory trends

**Slide 2 — Competitive Map**
- 2×2 positioning matrix (choose axes based on key differentiators)
- Tier groupings (direct competitors, adjacent, potential entrants)

**Slide 3 — Competitor Deep Dives** (table format)
- Revenue, growth, margins, headcount, funding/market cap
- Qualitative: product focus, go-to-market, key wins

**Slide 4 — Comparative Analysis**
- Side-by-side rating table with actual metric values (not subjective scores alone)

**Slide 5 — Moat Assessment**
- Network effects, switching costs, scale advantages, intangible assets
- Rate target company vs each competitor

### Rules
- Slide titles state the insight ("Scale leaders pulling away"), not just the topic
- All competitor data cited with source and date
- Include all competitors specified — never drop any from the list
- Charts must be actual embedded objects (not tables styled as charts)

---

## Model Audit (`/check-model`)

**Trigger**: "check model", "audit model", "debug model", "model won't balance", "something's off", "QA model", "model review"

### Seven-Step Audit Workflow

**Step 1 — Accept & Map**
- Accept the Excel file, identify model type (DCF / LBO / merger / 3-statement / comps / custom)
- List all tabs, identify input vs formula cells, note color-coding conventions

**Step 2 — Structural Check**
- Input/calculation separation
- Hidden tabs or named ranges
- Hardcoded values in formula cells
- Formula consistency across rows/columns

**Step 3 — Integrity Validation**
- BS: Assets = L + E every period
- CF: ending cash ties to BS
- IS: retained earnings roll is correct
- Circular reference detection

**Step 4 — Logic Checks**
- Growth rates and margins within reasonable industry ranges
- Terminal value: 50–70% of EV (DCF)
- Edge cases: zero revenue year, negative EBITDA handling

**Step 5 — Model-Type-Specific Bugs**
- DCF: terminal growth < WACC; sensitivity tables are full formulas
- LBO: interest circularity using beginning balances; debt priority order
- Merger: purchase price allocation, goodwill, deferred tax
- 3-statement: retained earnings tie; NWC change sign convention

**Step 6 — Audit Report**

Deliver a table with three severity levels:
| Severity | Issue | Location | Recommendation |
|----------|-------|----------|----------------|
| CRITICAL | Balance sheet doesn't balance | BS!D15 | Check equity plug formula |
| WARNING | Terminal value > 75% of EV | DCF!E40 | Review terminal growth assumption |
| INFO | Missing cell comment on tax rate | DCF!B8 | Add source citation |

**Step 7 — Deliverables**
- Issue log (severity-sorted)
- Annotated model with comments on problem cells
- Summary: overall model quality assessment

### Rules
- Balance sheet balance is always the first priority check
- Never modify the model without explicit user approval
- Hardcoded overrides are the most common error source — flag all of them
- Sign convention mistakes are extremely common — verify consistency throughout

---

## Excel Generation (Python / openpyxl)

All models are built programmatically. Standard boilerplate:

```python
import openpyxl
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()

# Color constants
BLUE = "0070C0"    # hardcoded inputs
BLACK = "000000"   # formulas
GREEN = "00B050"   # cross-sheet links

def input_cell(ws, row, col, value, comment=None):
    """Write a blue hardcoded input cell."""
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = Font(color=BLUE, bold=False)
    if comment:
        from openpyxl.comments import Comment
        cell.comment = Comment(comment, "Model")
    return cell

def formula_cell(ws, row, col, formula):
    """Write a black formula cell."""
    cell = ws.cell(row=row, column=col, value=formula)
    cell.font = Font(color=BLACK)
    return cell

def section_header(ws, row, col, text, width=8):
    """Bold section header with thick bottom border."""
    cell = ws.cell(row=row, column=col, value=text)
    cell.font = Font(bold=True)
    thick = Side(style='thick')
    cell.border = Border(bottom=thick)
    return cell

wb.save("model.xlsx")
print("Model saved to model.xlsx")
```

Save models to `/workspace/group/` so they persist across sessions. Inform the user of the file path when done.
