import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function StatusDistributionChart({ normal, needsFollowUp }: {
  normal: number
  needsFollowUp: number
}) {
  const data = [
    { label: 'Normal', count: normal, color: '#0284c7' },
    { label: 'Needs follow-up', count: needsFollowUp, color: '#d97706' },
  ]

  return (
    <div
      className="mt-5 h-64"
      role="img"
      aria-label={`Checkup status distribution: ${normal} Normal records and ${needsFollowUp} Needs follow-up records`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 36, bottom: 4, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" width={132} tickLine={false} axisLine={false} />
          <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} records`, 'Count']} />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={40}>
            {data.map((item) => <Cell key={item.label} fill={item.color} />)}
            <LabelList dataKey="count" position="right" fill="#0c4a6e" fontSize={13} fontWeight={700} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
