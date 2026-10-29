export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="13" fill="currentColor" />
        <path
          d="M16 14h17M16 14v20h14c5 0 7-3 7-7s-3-7-7-7H22m4-4-4 4 4 4"
          fill="none"
          stroke="#f6f5ef"
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="brand-name">
        ExplainBack<span className="brand-chinese">讲给我听</span>
      </span>
    </span>
  );
}
