import { Card } from '@/components/ui';
import type { leadsModel } from './model';
import css from './Leads.module.css';
export function LeadSummary({ model }: { model: ReturnType<typeof leadsModel> }) {
 return <><div className={css.summary}>{[['לידים בסינון',model.total],['למעקב היום ובאיחור',model.due],['נסגרה עבודה',model.won]].map(([label,count])=><Card key={label}><div className={css.metric}><span>{label}</span><strong>{count}</strong></div></Card>)}</div></>;
}
