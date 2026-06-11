"use client"
import styles from "./MetricCard.module.css" // Reuse some base card styles
import { useLanguage } from "@/contexts/LanguageContext"

interface AgentStatusCardProps {
  agentName: string
  agentNameBn: string
  lastRun: string
  status: "active" | "idle" | "error"
  statsLabel: string
  statsValue: string | number
}

export function AgentStatusCard({
  agentName,
  agentNameBn,
  lastRun,
  status,
  statsLabel,
  statsValue
}: AgentStatusCardProps) {
  const { t } = useLanguage()
  
  const statusColors = {
    active: "var(--nc-success)",
    idle: "var(--nc-warning)",
    error: "var(--nc-danger)"
  }

  return (
    <div className={styles.metricCard} style={{ "--card-accent": statusColors[status] } as React.CSSProperties}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardLabel}>
          {t(agentNameBn, agentName)}
        </h3>
        <div style={{
          width: 12, height: 12, borderRadius: "50%", background: statusColors[status],
          boxShadow: status === "active" || status === "error" ? `0 0 8px ${statusColors[status]}` : "none",
          animation: status === "active" ? "pulse 2s infinite" : "none"
        }} />
      </div>
      <div className={styles.cardValue} style={{ fontSize: 24 }}>
        {statsValue}
      </div>
      <div className={styles.cardFooter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span className={styles.subtext}>{statsLabel}</span>
        <span className={styles.subtext} style={{ fontSize: 11 }}>
          {t("শেষ রান: ", "Last Run: ")} {lastRun}
        </span>
      </div>
    </div>
  )
}
