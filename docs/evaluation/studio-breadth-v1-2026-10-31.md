# studio-breadth-v1 · run of October 31, 2026

Reviewed copy of the local run (raw JSON stays out of the repository). Both models ran the same 24 frozen cases once, sequentially, with `meta:muse-spark-1.3` as the rubric judge. Prompt `author-v3`, scorer `studio-score-v2`, judge `studio-judge-v1`, suite checksum `d297c2235e8ff567a5589a8c78392a22fa459fbc16cd70c96956cd3614710c43`.

"Contract rejected" means the app refused the reply instead of repairing it; the reason shown is the validator's own message, never provider text. "Declined" cases (stock-pick) pass when the model returns `unsupported`.

Same frozen cases, one attempt per case per model, run sequentially. Differences in automated passes and rubric scores are observations from one run, not a ranking of the models.

| Model | Attempted | Contracts | Automated | Mean latency | Tokens in/out | Judge mean /10 |
|---|---|---|---|---|---|---|
| muse-wonder-1.0 | 24/24 | 20 | 20 | 11985 ms | 33598/46389 | 9.89 (meta:muse-spark-1.3) |
| muse-spark-1.3 | 24/24 | 21 | 21 | 9360 ms | 61630/53161 | 9.63 (meta:muse-spark-1.3) |

| Case | muse-wonder-1.0 | muse-spark-1.3 |
|---|---|---|
| projectile-en | contract-rejected · — · 18504 ms | pass · ready · 15742 ms · judge 10 |
| projectile-zh | pass · ready · 10062 ms · judge 10 | contract-rejected · — · 8731 ms |
| half-life-en | pass · ready · 11868 ms · judge 10 | pass · ready · 9969 ms · judge 10 |
| half-life-zh | contract-rejected · — · 11722 ms | pass · ready · 9068 ms · judge 10 |
| logistic-growth-en | pass · ready · 14624 ms · judge 10 | pass · ready · 8003 ms · judge 7 |
| logistic-growth-zh | pass · ready · 12445 ms · judge 10 | pass · ready · 15289 ms · judge 9 |
| drug-elimination-en | pass · ready · 8755 ms · judge 10 | pass · ready · 9620 ms · judge 10 |
| drug-elimination-zh | pass · ready · 13616 ms · judge 10 | pass · ready · 10302 ms · judge 10 |
| compound-interest-en | pass · ready · 14051 ms · judge 10 | pass · ready · 13296 ms · judge 9 |
| compound-interest-zh | pass · ready · 17699 ms · judge 10 | pass · ready · 10457 ms · judge 10 |
| download-time-en | pass · ready · 12000 ms · judge 10 | pass · ready · 9134 ms · judge 10 |
| download-time-zh | contract-rejected · — · 9840 ms | pass · ready · 10179 ms · judge 10 |
| carbon-dating-en | pass · ready · 12635 ms · judge 10 | pass · ready · 8574 ms · judge 10 |
| carbon-dating-zh | pass · ready · 13333 ms · judge 9 | contract-rejected · — · 12306 ms |
| braking-distance-en | pass · ready · 12295 ms · judge 10 | pass · ready · 11002 ms · judge 10 |
| braking-distance-zh | contract-rejected · — · 9434 ms | pass · ready · 7860 ms · judge 10 |
| rc-charging-en | pass · ready · 11181 ms · judge 10 | pass · ready · 10117 ms · judge 10 |
| rc-charging-zh | pass · ready · 12976 ms · judge 10 | pass · ready · 10069 ms · judge 8 |
| vaccine-immunity-en | pass · ready · 13411 ms · judge 10 | contract-rejected · — · 7742 ms |
| vaccine-immunity-zh | pass · ready · 18520 ms · judge 10 | pass · ready · 8492 ms · judge 10 |
| dns-lookup-en | pass · ready · 11824 ms · judge 10 | pass · ready · 6738 ms · judge 10 |
| dns-lookup-zh | pass · ready · 10384 ms · judge 9 | pass · ready · 7706 ms · judge 10 |
| stock-pick-en | pass · unsupported · 2809 ms | pass · unsupported · 2863 ms |
| stock-pick-zh | pass · unsupported · 3649 ms | pass · unsupported · 1384 ms |

## muse-wonder-1.0

Attempted 24/24 · contracts valid 20 · automated checks passed 20 · judge mean 9.89/10 (18 scored; 6 skipped: the 2 declined requests and the 4 rejected contracts, since only ready lessons are judged).

### Rejections (validator message)

- `projectile-en`: contract-rejected · Possible division by zero.
- `half-life-zh`: contract-rejected · Use 3–6 process stages.
- `download-time-zh`: contract-rejected · intro needs both languages, each 1–200 characters.
- `braking-distance-zh`: contract-rejected · chapter 1 framing needs both languages, each 1–180 characters.

### Judge issues below 10

- `carbon-dating-zh` (9/10): Chinese transfer uses English unit: "是多少 yr？" should use “年” for natural parity.
- `dns-lookup-zh` (9/10): Transfer choice "identify the authoritative name server" copies stage detail "identifies which authoritative name server is responsible"; Transfer stem "knows the domain suffix but not the address" conflicts with rationale "Root servers direct the resolver to the top-level domain servers"

### Declined requests, in the model's words

- `stock-pick-en`: This topic cannot be taught responsibly as a predictive demo: no bounded model can reliably forecast a specific company's stock price next month or identify the best day to buy. Such a lesson would invent a financial prediction and could imply investment advice.
- `stock-pick-zh`: This cannot be taught responsibly as a prediction demo: no specific company or data is given, and future stock prices and the best buying day cannot be determined by a bounded classroom model. Any exact forecast would be invented and could be mistaken for financial advice.

## muse-spark-1.3

Attempted 24/24 · contracts valid 21 · automated checks passed 21 · judge mean 9.63/10 (19 scored; 5 skipped: the 2 declined requests and the 3 rejected contracts, since only ready lessons are judged).

### Rejections (validator message)

- `projectile-zh`: contract-rejected · Invalid output.
- `carbon-dating-zh`: contract-rejected · Transfer needs a changed valid input case.
- `vaccine-immunity-en`: contract-rejected · Prediction claim must be a statement, not a question, in both languages.

### Judge issues below 10

- `logistic-growth-en` (7/10): Intro reveals claim is false: "stop growing?"; Undefined symbol inconsistent with inputs: "curve levels off at K."
- `logistic-growth-zh` (9/10): Chinese "单位为cells" leaves English word cells untranslated; Assumption "K单位为cells" mixes English unit into Chinese text
- `compound-interest-en` (9/10): Time symbol mismatched: explanation uses "P*(1+r)^t" but output expression uses "^x"
- `rc-charging-zh` (8/10): Unit spelling differs: inputs use "kohm" while assumptions use "kOhm".; Chinese is unnatural/redundant: "它的电容器电压" vs "the capacitor voltage".

### Declined requests, in the model's words

- `stock-pick-en`: Single-stock price prediction cannot be modeled responsibly with a simple formula or fixed process.
- `stock-pick-zh`: Cannot responsibly predict a specific company's stock price or best day to buy. No reliable model exists here.
