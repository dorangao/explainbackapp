import { useState } from "react";
import { t, experimentName, claimScopeName } from "./physicsCopy";
import type { EvidenceRecord } from "./types";
import type { View } from "./view";

export function ClaimConfirmation({ view }: { view: View }) {
  const { s, c, lang } = view;
  const copy = t(lang),
    zh = lang === "zh",
    session = s.session,
    mode = session?.workflow === "claim-testing",
    claim = mode ? session?.claim : null,
    locked = s.busy || s.sessionInterrupted || c.autoActive();
  const names: Record<string, string> = zh
    ? {
        proposed: "模型提出解读",
        confirm: "学习者确认 · 本地操作",
        revise: "学习者要求修改 · 本地操作",
      }
    : {
        proposed: "Model proposed an interpretation",
        confirm: "Learner confirmed · local action",
        revise: "Learner requested revision · local action",
      };
  const confirmNote = claim?.confirmed
    ? claim.confirmationSource === "scripted-demo"
      ? zh
        ? "演示脚本自动确认了预设解读；这不是学习者的确认。说法是否成立由证据另行检验。"
        : "The demo script confirmed the preset interpretation automatically; this is not a learner confirmation. Evidence checks whether the claim holds."
      : zh
        ? "学习者已确认这段解读。数学结果与说法是否成立将在证据中另行核验。"
        : "The learner confirmed this interpretation. Whether the claim holds is checked separately in the evidence."
    : copy["confirm-note"];
  return (
    <section
      id="claim-confirmation"
      className="claim-confirmation"
      hidden={!claim}
      aria-labelledby="claim-heading"
    >
      <h3 id="claim-heading">
        {claim?.confirmed
          ? zh
            ? "已确认的说法"
            : "Confirmed claim"
          : copy["claim-heading"]}
      </h3>
      <blockquote id="claim-quote">{claim?.quote ?? ""}</blockquote>
      <p id="claim-interpretation">{claim?.interpretation ?? ""}</p>
      <p id="claim-scope" className="fine">
        {claim
          ? `${zh ? "范围" : "Scope"}: ${claimScopeName(claim.scope, lang)} · ${zh ? "待检验的实验" : "Proposed experiment"}: ${experimentName(claim.experimentId, lang)}`
          : ""}
      </p>
      <div
        className="claim-buttons"
        id="claim-buttons"
        hidden={session?.phase !== "confirm"}
      >
        <button
          type="button"
          id="confirm-claim"
          disabled={locked}
          onClick={() => void c.decideClaim("confirm")}
        >
          {copy["confirm-claim"]}
        </button>
        <button
          type="button"
          id="revise-claim"
          className="example"
          disabled={locked}
          onClick={() => void c.decideClaim("revise")}
        >
          {copy["revise-claim"]}
        </button>
      </div>
      <p id="confirm-note" className="fine">
        {confirmNote}
      </p>
      <details>
        <summary id="claim-decisions-label">
          {zh ? "说法的决定记录" : "Claim decisions"}
        </summary>
        <ol id="claim-decisions">
          {claim &&
            (session?.claimEvents ?? []).map((event, i) => (
              <li key={i}>
                {`${event.source === "scripted-demo" ? (zh ? "演示脚本确认 · 本地操作" : "Demo script confirmed · local action") : names[event.action]}: ${event.interpretation}`}
              </li>
            ))}
        </ol>
      </details>
    </section>
  );
}

function Record({
  record,
  index,
  view,
}: {
  record: EvidenceRecord;
  index: number;
  view: View;
}) {
  const { s, c, lang } = view;
  const zh = lang === "zh";
  const [pending, setPending] = useState(false);
  return (
    <article className="evidence-record">
      <h3>{`${index + 1}. ${experimentName(record.experimentId, lang)}`}</h3>
      <p className="fine">{record.formulaId}</p>
      <p>{record.conclusion[lang]}</p>
      <p>{record.proof[lang]}</p>
      <p className="fine">{record.limitations[lang]}</p>
      <details>
        <summary>{zh ? "查看执行记录" : "Inspect execution record"}</summary>
        <pre>{JSON.stringify(record, null, 2)}</pre>
      </details>
      <button
        type="button"
        className="example"
        disabled={s.busy || pending}
        onClick={() => void c.replay(record, setPending)}
      >
        {zh ? "重放核验 · 0 次模型请求" : "Replay check · 0 model requests"}
      </button>
    </article>
  );
}

export function EvidenceWorkbench({ view }: { view: View }) {
  const { s, lang } = view;
  const copy = t(lang),
    session = s.session,
    records =
      session?.workflow === "claim-testing"
        ? (session.evidenceRecords ?? [])
        : [];
  return (
    <details
      id="evidence-workbench"
      hidden={!records.length}
      aria-labelledby="evidence-heading"
    >
      <summary id="evidence-heading">{copy["evidence-heading"]}</summary>
      <p id="evidence-note" className="fine">
        {copy["evidence-note"]}
      </p>
      <div id="evidence-records">
        {records.map((record, i) => (
          <Record key={record.id} record={record} index={i} view={view} />
        ))}
      </div>
      <p id="replay-status" role="status" aria-live="polite">
        {s.replayStatus}
      </p>
    </details>
  );
}

export function TransferReport({ view }: { view: View }) {
  const { s, lang } = view;
  const copy = t(lang),
    zh = lang === "zh",
    session = s.session,
    mode = session?.workflow === "claim-testing",
    shown = Boolean(
      mode && ["transfer", "complete"].includes(session?.phase ?? ""),
    ),
    report = mode ? session?.report : undefined;
  const outcomes: Record<string, string> = zh
    ? {
        insufficient: "尚无充分证据：迁移尝试未完成。",
        independent: "独立迁移：本题未使用额外辅导。",
        assisted: "辅助迁移：本题使用了额外辅导。",
      }
    : {
        insufficient: "Insufficient evidence: transfer is not complete.",
        independent:
          "Independent transfer: no additional coaching on this problem.",
        assisted:
          "Assisted transfer: additional coaching was used on this problem.",
      };
  return (
    <section
      id="transfer-report"
      hidden={!shown}
      aria-labelledby="report-heading"
    >
      <h2 id="report-heading">{copy["report-heading"]}</h2>
      <p id="report-outcome">
        {report
          ? session?.demoUsed && report.outcome !== "insufficient"
            ? zh
              ? "脚本 / 开发演示完成：数值和推理已检查，不计独立迁移。"
              : "Scripted / developer demo complete: values and reasoning checked; not independent transfer."
            : outcomes[report.outcome]
          : ""}
      </p>
      <p id="report-checked">
        {report?.checkedAnswer
          ? `${zh ? "代码核验的数值" : "Values checked by code"}: ${(session?.answerFields ?? []).map((f) => `${f.label[lang]} ${report.checkedAnswer![f.key]}`).join("; ")}`
          : ""}
      </p>
      <p id="report-judgment">
        {report?.reasoningAssessment
          ? zh
            ? "所选模型判断推理得到支持；这不是代码对理解程度的证明。"
            : "The selected model assessed the reasoning as supported; code does not verify understanding."
          : ""}
      </p>
      <p id="report-revision">
        {report?.revision
          ? `${zh ? "依据证据作出的解释" : "Evidence-based revision"}: ${report.revision}`
          : ""}
      </p>
      <p id="report-refs" className="fine">
        {report?.evidenceIds
          ? `${zh ? "引用证据" : "Evidence references"}: ${report.evidenceIds.join(", ")}`
          : ""}
      </p>
      <p id="report-limit" className="fine">
        {report?.limitation?.[lang] || ""}
      </p>
    </section>
  );
}
