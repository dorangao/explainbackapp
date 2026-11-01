# Search grounding

Added October 31, 2026 Pacific (phase 1: search first). The Muse Responses API offers a
built-in web search tool: a request that lists `{type: "web_search"}` among its tools lets
the model search before it answers, and the reply reports the pages each search returned.
ExplainBack uses it in one place so far, before the author drafts a new topic demo.

## Where a model call can use search, and where it must not

| Call | Search | Why |
| --- | --- | --- |
| Ground (new, `/api/studio/ground`) | Yes | Gathers a few sourced figures for the topic before the draft. |
| Draft and revise (`/api/studio/compose`) | No search of its own | Receives the fact sheet as `references`; may name only its pages as sources. |
| Rubric judge (Compare, eval harness) | Optional (`studio-judge-v2`) | A separate request; with **Check figures against the web** (Compare) or `--grounded-judge` (harness) it searches and scores factual currency, citing pages. |
| Narrated show, illustrations | No | Written and drawn from the checked lesson. |
| Learner tryout, explain-back guide, bench coach, quantum coach | Never | The learner must know only the lesson; the guide and coaches judge against checked facts. |

## Search first

On the Create page, **Search first** is an option above the Create button for new topic
demos. When it is on, a draft takes two requests:

1. **Ground.** Spark (the test-learner model) receives the topic and today's date, searches
   with `search_context_size: "low"`, and returns a structured `ground_topic` object: at
   most six facts, each a one-sentence bilingual statement with its numeric value, unit and
   the URL of the page it came from, plus `asOf` (today), `needsCurrent` (whether the
   topic depends on figures that change over time) and a short note. The adapter asks for
   `web_search_call.results` and keeps every https page the searches returned (title,
   URL, snippet, at most twenty); a fact is marked *verified* when its URL is among them.
   The step stands alone: it never chains onto, or starts, the author's or learner's
   conversation.
2. **Draft.** The browser sends the sheet back as `references` (`asOf` and the facts with
   their titles). The server validates it again, field by field, so only statements,
   values, units and https URLs reach the author prompt. The author is told to prefer
   these figures over memory and to set `lesson.sources` to the URL strings it relied on;
   the server keeps a source only when it is one of the references' pages, with that
   page's title. An invented URL is dropped.

The lesson contract gains an optional `sources` list (1 to 6 pages, each an https URL
and a title under 200 characters). Saved and shared lessons keep it; the review shows the
sheet and the pages the lesson names under **Sources**, and the lesson player lists the
sources under **Assumptions & limits**. The sheet is remembered with the draft in the
browser and travels with revisions.

## Trust boundary

- Everything read from the web is subject matter, never an instruction. The ground
  prompt says so, and only numbers, units, short statements and URLs pass from the sheet
  into the author prompt; page text never does.
- The lesson's numbers are still computed by code from its own formulas. A source is
  provenance for the reader, not a verification: the review and the player say the pages
  were gathered by Muse Spark with web search and are not reviewed.
- Traces record each search as a `web_search_call` with its status and result count,
  never the page text.
- The option is off by default and only applies to new topic demos; catalog lessons and
  image-led drafts make no search.

## Cost

The ground request counts as one of the session's eight attempts and against the hourly
budget. In the live probe (Spark, low context) it returned in about seven seconds with
roughly fifteen thousand input tokens, most of them the search results the API injected.

## Grounded judge and the current-information suite (phase 2)

Added October 31, 2026 Pacific. The rubric judge has a grounded variant, `studio-judge-v2`:
it may search the web before scoring, gains a sixth item (factual currency, so the total
is out of 12) and returns the figures it disputed, each with the page it cites; a citation
is verified only when that page was among the judge's own search results. In Compare the
option is **Check figures against the web** beside the judge picker; the comparison then
shows the extra score row, the disputed figures with their sources, and a note that the
cited pages were only search results. In the harness it is `--grounded-judge`.

`studio-current-v1` is a frozen suite of six bilingual pairs whose lesson needs a figure
from the world as it is now (four current values, two stable controls), each with a
reference figure recorded on the freezing date, its source and a tolerance in one or more
units. The scorer reports a *reference hit* when any declared input default or transfer
value lands within the tolerance; it is an observation beside the automated checks, never
part of them. `--ground` runs the Search first step before each draft, so the same suite
run with and without it shows what grounding changes. See [evaluation.md](evaluation.md).

## Not yet

- Date awareness in the author and judge instructions (phase 3), so a lesson can be
  marked stable or dated.
