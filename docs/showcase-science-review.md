# Science review of the evaluation showcase

A written review of the fourteen lessons shown in the library under **From the evaluation**: the `studio-breadth-v1` replies of November 1, 2026 (run date 2026-10-31 Pacific) kept unedited in `public/evaluation-lessons.mjs`. The [evaluation card](evaluation.md) states that the automated checks establish contract validity and computed numbers, never scientific validity. This page is the review of the science those checks cannot make, one row per lesson, so a reader can see what was checked and what was not.

**Who reviewed.** Claude Fable 5.1, an AI model, at the maintainer's request on November 1, 2026, reading each lesson's formula, units, default values, ranges, stated assumptions, claim and transfer case against standard textbook physics, chemistry, biology, pharmacology, finance and networking. This is a careful second opinion, not the human review that every showcase card asks for. The **Human science review required** label stays on the cards until a person has read this page, checked the rows they are competent to check, and countersigned below.

**What a pass means here.** The formula is the standard one for the stated simplification; units and conversions are right; the default values and slider ranges are physically sensible; the assumptions name the simplifications a careful teacher would name; the claim is either true under the model or a recognisable misconception the experiment can refute; the transfer answer (computed by code from the lesson's own formula, reproduced here by hand) is the value a correct solution gives. Nothing here measures whether a learner learns from the lesson.

## Summary

| Lesson (id) | Model | Formula checked | Claim | Transfer answer | Verdict |
|---|---|---|---|---|---|
| Projectile range and launch angle (`eval-projectile-wonder`) | Wonder | R = v₀² sin 2θ / g | True under the model (maximum at 45°) | 35.35 m | Pass |
| Radioactive decay and half-life (`eval-half-life-spark`) | Spark | N = N₀ (½)^(t/T) | True (¼ after two half-lives) | 20 g | Pass |
| Why bacterial growth levels off (`eval-logistic-growth-wonder`) | Wonder | N = K / (1 + ((K − N₀)/N₀) e^(−rt)) | Misconception to refute (constant increment) | 2617 cells | Pass |
| Why bacterial growth slows in a closed dish (`eval-logistic-growth-spark`) | Spark | same logistic solution, time in minutes | Misconception to refute (constant doubling) | 4667 cells | Pass, wording notes |
| Drug concentration after a single dose (`eval-drug-elimination-spark`) | Spark | C = (D/V) e^(−ln2 · t/t½) | Misconception to refute (constant drop per hour) | 7.94 mg/L | Pass |
| Does double the interest rate double the speed? (`eval-compound-interest-wonder`) | Wonder | B = P (1 + r)^t, annual compounding | Misconception to refute (doubling time halves exactly) | $8,354.50 | Pass |
| Why fast bandwidth can still feel slow (`eval-download-time-spark`) | Spark | T = 8S/B + n·L | Misconception to refute (bandwidth alone sets the time) | 2.7 s | Pass |
| Estimating a bone's age from carbon-14 (`eval-carbon-dating-wonder`) | Wonder | t = −(t½ / ln 2) ln f | True under the model (each halving adds one half-life) | 12,000 years | Pass, figure note |
| Doubling speed and braking distance (`eval-braking-distance-spark`) | Spark | d = v² / 2a | Misconception to refute (distance doubles) | 25 m | Pass |
| Capacitor voltage during RC charging (`eval-rc-charging-wonder`) | Wonder | V = Vs (1 − e^(−t/RC)), kΩ·μF → ms | Misconception to refute (equal rise per interval) | 8.26 V | Pass |
| How does an RC circuit charge? (`eval-rc-charging-spark`) | Spark | V = Vs (1 − e^(−t/RC)), kΩ·mF → s | Misconception to refute (equal rise per interval) | 4.42 V | Pass, wording notes |
| How a vaccine trains the immune system (`eval-vaccine-immunity-wonder`) | Wonder | Five-stage process | True (memory cells respond faster) | Choice 2 | Pass |
| How DNS turns domain names into IP addresses (`eval-dns-lookup-spark`) | Spark | Four-stage process | True (local cache first) | Choice 2 | Pass |
| How DNS turns a domain name into an IP address (`eval-dns-lookup-wonder`) | Wonder | Five-stage process | Misconception to refute (ask the website first) | Choice 1 | Pass, wording note |

No lesson states a wrong formula, a wrong unit conversion or a wrong fact. Three lessons carry wording notes already visible in the app as the AI judge's issues; one carries a note on a figure's convention. None of the notes changes a number a learner would compute.

## Lesson by lesson

### Projectile range and launch angle

- **Formula.** Range on level ground without drag is v₀² sin(2θ)/g; the lesson converts the degree axis to radians inside the sine, as it says. Correct.
- **Defaults and ranges.** v₀ 5–30 m/s (default 15), g 1–20 m/s² (default 9.8), angle 0–90°. The low end of g is unphysical for Earth but lets a learner see that the shape does not depend on g; harmless.
- **Assumptions.** Level ground, no air resistance, point mass, constant g: the four that matter. Good.
- **Claim.** "Greatest at 45°" is true under these assumptions and false with air drag or unequal heights, which the assumptions exclude explicitly.
- **Transfer.** v₀ = 20 m/s, g = 9.8, θ = 30°: 400 × sin 60° / 9.8 = 35.35 m.

### Radioactive decay and half-life

- **Formula.** N₀ (½)^(t/T) is the exact solution of first-order decay. Correct.
- **Defaults and ranges.** Half-life 1–20 s, amount 10–100 g: a generic short-lived sample in seconds is a reasonable teaching scale, and the axis (0–40 s) shows up to several half-lives.
- **Assumptions.** Continuous decay, no background, no production, no noise. Good.
- **Claim.** One quarter after two half-lives: true.
- **Transfer.** T = 8 s, N₀ = 80 g, t = 16 s: two half-lives, 20 g.

### Why bacterial growth levels off (Wonder)

- **Formula.** K / (1 + ((K − N₀)/N₀) e^(−rt)) is the closed-form logistic solution. Correct.
- **Defaults and ranges.** r 0.1–1 per hour (default 0.4), K 500–5000 cells, N₀ 10–100 cells, 24 h axis. A doubling time of about 1.7 h at the default is plausible for a slow-growing culture.
- **Assumptions.** Closed dish, constant r and K, continuous population; omits lag phase, toxins, evolution, discrete division, measurement error. Complete for the level.
- **Claim.** Constant increment per hour is the linear-growth misconception; the sigmoid refutes it.
- **Transfer.** r = 0.6, K = 3000, N₀ = 50, t = 10 h: 3000 / (1 + 59 e^(−6)) = 2617 cells.

### Why bacterial growth slows in a closed dish (Spark)

- **Formula.** Same logistic solution, with time in minutes. Correct.
- **Defaults and ranges.** r 0.001–0.02 per minute (default 0.01, a 69-minute doubling time), K 1000–10,000 cells, N₀ 10–1000 cells, 1000-minute axis. Plausible for a bacterial culture.
- **Assumptions.** Well-mixed dish, constant K, no migration; omits lag, death phase and stochastic effects. Good.
- **Claim.** Constant doubling is the exponential-growth misconception; refuted by the plateau.
- **Transfer.** K = 8000, N₀ = 200, r = 0.008, t = 500 min: 8000 / (1 + 39 e^(−4)) = 4667 cells.
- **Wording notes (the judge's, already shown in the app).** The introduction answers the claim before the experiment, and the input labels are lowercase while the lesson text is sentence case. Science unaffected.

### Drug concentration after a single dose

- **Formula.** C(t) = (D/V) e^(−ln2 · t/t½) is the one-compartment model for an intravenous bolus with first-order elimination; the constant 0.693147 is ln 2 to six places. Correct.
- **Defaults and ranges.** 500 mg into 40 L gives 12.5 mg/L at time zero with a 4-hour half-life, which is the kind of value a textbook example uses. Distribution volume 5–100 L spans drugs confined to plasma and drugs spread through body water.
- **Assumptions.** Instant mixing, one compartment, first-order elimination; omits absorption delay, distribution phases and changing metabolism. This matters: for a swallowed dose the curve rises first, and the assumptions say so.
- **Claim.** A constant drop per hour (zero-order elimination) is the misconception; the exponential refutes it. Ethanol is a well-known case where zero-order is closer to the truth, which a teacher may mention.
- **Transfer.** 600 mg, 30 L, t½ = 6 h, t = 8 h: 20 × e^(−0.924) = 7.94 mg/L.
- **Terminology.** "Distribution volume" is usually written "volume of distribution"; either is understood.

### Does double the interest rate double the speed?

- **Formula.** P (1 + r/100)^t with annual compounding. Correct, and the assumptions say annual.
- **Defaults and ranges.** $100–$10,000, 1–20% per year, 40-year axis. Sensible.
- **Claim.** Doubling time is ln 2 / ln(1 + r): 14.21 years at 5%, 7.27 years at 10%, a ratio of 1.95, not 2. The claim is false by a small margin, which is exactly what the rule of 72 hides and what the experiment shows. A good claim.
- **Transfer.** $2000 at 10% for 15 years: 2000 × 1.1^15 = $8,354.50.

### Why fast bandwidth can still feel slow

- **Formula.** Transfer time 8S/B plus n round trips of latency L. With S in MB, B in Mbit/s and L in ms the conversions (×8, ÷1000) are right. Correct. Whether MB means 10⁶ or 2²⁰ bytes changes the answer by 5%, within what the lesson needs.
- **Defaults and ranges.** 2 MB, 200 ms, 6 round trips, bandwidth 1–100 Mbit/s. Six round trips at 200 ms (DNS, TCP, TLS, request, dependent requests) is a fair picture of a first visit on a high-latency link.
- **Assumptions.** Steady bandwidth, no loss, no cache, no parallelism limits. Good; it omits TCP slow start, which would strengthen the lesson's point.
- **Claim.** Doubling bandwidth halving the total is false whenever latency time is non-zero; the second output (latency time) makes the floor visible.
- **Transfer.** 3 MB, 300 ms, 8 trips, 80 Mbit/s: 0.3 s + 2.4 s = 2.7 s.
- **Rendering note.** The round-trips input carries the unit "1" (dimensionless); a blank or "trips" would read better. Not a science issue.

### Estimating a bone's age from carbon-14

- **Formula.** t = −(t½ / ln 2) ln f, the inverse of exponential decay. Correct.
- **Figure note.** The default half-life 5730 years is the Cambridge value taught in most courses. The value recommended by the nuclear data evaluations (NUBASE2020) is 5700 ± 30 years, and radiocarbon laboratories still report conventional ages with the Libby half-life of 5568 years before calibration. The slider (3000–9000 years) covers all three, the assumptions name calibration curves as omitted, and the difference between 5730 and 5700 is 0.5% of any age. No change needed; a teacher may want to mention the convention.
- **Claim.** Each halving of the remaining fraction adds exactly one half-life: true under the model. A true claim is allowed; the lesson tests it by reading the curve at ½, ¼ and ⅛.
- **Transfer.** t½ = 6000 years, f = 0.25: two half-lives, 12,000 years.
- **Assumptions.** Constant half-life, fraction 1 at death, no exchange after death; omits calibration, reservoir effects, contamination and measurement uncertainty. Complete for the level.

### Doubling speed and braking distance

- **Formula.** d = v² / 2a for constant deceleration. Correct.
- **Defaults and ranges.** Deceleration 2–10 m/s² (default 5), speed 0–30 m/s. Dry-road emergency braking is around 7–8 m/s², wet roads less; the range is realistic.
- **Assumptions.** Constant deceleration, flat road, reaction distance and air resistance ignored, "instructional only". Good; the omitted reaction distance is the main reason real stopping distances are longer.
- **Claim.** Distance doubles with speed: false, it quadruples. The classic misconception.
- **Transfer.** 20 m/s at 8 m/s²: 400 / 16 = 25 m.

### Capacitor voltage during RC charging (Wonder)

- **Formula.** Vs (1 − e^(−t/τ)) with τ = R·C. With R in kΩ and C in μF the product is in milliseconds, so dividing by 1000 gives seconds, as the lesson does and says. Correct.
- **Defaults and ranges.** 5 kΩ × 50 μF = 0.25 s against a 3-second axis: the curve reaches its plateau on screen. Good.
- **Assumptions.** Ideal source and parts, uncharged start, no leakage. Good.
- **Claim.** Equal rise per equal interval is the linear misconception; the exponential refutes it.
- **Transfer.** 9 V, 2 kΩ, 100 μF (τ = 0.2 s), t = 0.5 s: 9 × (1 − e^(−2.5)) = 8.26 V.

### How does an RC circuit charge? (Spark)

- **Formula.** Same law; with R in kΩ and C in mF the product is already in seconds, as the assumptions say. Correct.
- **Defaults and ranges.** 4 kΩ × 1 mF = 4 s against a 30-second axis. A millifarad capacitor with a kiloohm resistor is an unusual but real combination (an electrolytic capacitor in a slow timer). Fine.
- **Claim and transfer.** Same misconception as the Wonder reply. 6 V, 2 kΩ, 1.5 mF (τ = 3 s), t = 4 s: 6 × (1 − e^(−4/3)) = 4.42 V.
- **Wording notes (the judge's, shown in the app).** The unit is spelled "kohm" in the inputs and "kOhm" in the assumptions, and one Chinese label differs from the English. Science unaffected.

### How a vaccine trains the immune system

- **Stages.** Antigen introduced (live-attenuated, inactivated, or instructions such as mRNA); antigen-presenting cells display fragments and activate other cells; helper T cells coordinate; B cells multiply and produce antibodies while some B and T cells become memory cells; a later encounter is met faster. This is the standard simplified sequence of an adaptive response, in the right order. Correct.
- **Assumptions.** Vaccine types and schedules differ, responses vary, protection not guaranteed, stage order is not elapsed time. These are the caveats a health educator would want.
- **Claim.** Memory cells respond faster on a later encounter: true (the secondary response is faster and larger).
- **Transfer.** Measles after vaccination: the memory-cell choice is right; the distractors (lifelong direct fighting, skin as the barrier) are clearly wrong.

### How DNS turns domain names into IP addresses (Spark)

- **Stages.** Local cache and hosts file; the configured recursive resolver; root, then top-level domain, then authoritative server; answer returned, cached, connection made. Correct and in order. The phrase "the computer asks the recursive resolver from the network" describes the stub resolver using the resolver the network configured, which is accurate.
- **Assumptions.** Simplified home path, cache may be empty, all servers reachable. Fine.
- **Claim.** The browser checks the local cache before contacting outside servers: true.
- **Transfer.** After a cache miss, ask the recursive resolver: correct.

### How DNS turns a domain name into an IP address (Wonder)

- **Stages.** The same path in five stages, with the root server's role stated precisely (it points to the top-level domain servers, it does not answer). Correct.
- **Assumptions.** First-time lookup; caches, multiple records, encrypted DNS and load balancing omitted. Good.
- **Claim.** Asking the website's server directly as the first step is the misconception (you cannot reach it without its address); the process refutes it.
- **Transfer.** The resolver knows the suffix but not the address, so the next step is the top-level domain server: correct. The judge's note that the choice wording is close to the stage title stands; it is a clarity point, not a science one.

## Cross-cutting observations

- **Claims.** Nine of the fourteen claims are deliberate misconceptions the experiment refutes; five (projectile, half-life, carbon-14, vaccine and the Spark DNS lesson) are true statements the experiment confirms. Both kinds are legitimate; a library that mixed them more evenly in each pair would stop learners from assuming every claim is false.
- **Figures.** Only two lessons name a figure from the world (the carbon-14 half-life and Earth's g); both are standard and stable. No lesson in the showcase depends on a current value, so none is marked dated.
- **Scope.** Every lesson is a single chapter at the simplest standard model of its topic, and every assumptions block names what the model leaves out. That honesty is what makes a pass possible: none of the lessons claims more than its model supports.

## Countersignature

| Row | Reviewer (human) | Date | Note |
|---|---|---|---|
| | | | |

When every row a human is willing to vouch for has been countersigned, the maintainer can decide whether the cards' label changes; this page does not change it.
