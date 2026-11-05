import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Checkup } from './managementApi'
import { dateText } from './managementApi'

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export default function ParentHealthTrends({ checkups }: { checkups: Checkup[] }) {
  const chronological = [...checkups].sort((left, right) => left.checkup_date.localeCompare(right.checkup_date))
  const heightData = chronological.filter(item => item.height_cm !== null).map(item => ({
    date: dateText(item.checkup_date), session: item.title, value: item.height_cm as number,
  }))
  const weightData = chronological.filter(item => item.weight_kg !== null).map(item => ({
    date: dateText(item.checkup_date), session: item.title, value: item.weight_kg as number,
  }))

  return <div className="mt-4 grid gap-4 lg:grid-cols-2">
    {heightData.length >= 2 && <figure role="img" aria-label={`Recorded height by checkup date, in centimeters. ${heightData.map(point => `${point.date}: ${formatNumber(point.value)} centimeters`).join('; ')}`} className="min-w-0 rounded-card border border-border bg-surface p-4">
      <figcaption className="font-semibold">Height <span className="font-normal text-muted">(cm)</span></figcaption>
      <div className="mt-3 h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={heightData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8e3ed" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis width={44} tick={{ fontSize: 11 }} unit=" cm" />
            <Tooltip formatter={(value) => [`${formatNumber(Number(value))} cm`, 'Height']} labelFormatter={(_, payload) => payload?.[0]?.payload?.session ?? ''} />
            <Line type="monotone" dataKey="value" name="Height" stroke="#0F766E" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>}
    {weightData.length >= 2 && <figure role="img" aria-label={`Recorded weight by checkup date, in kilograms. ${weightData.map(point => `${point.date}: ${formatNumber(point.value)} kilograms`).join('; ')}`} className="min-w-0 rounded-card border border-border bg-surface p-4">
      <figcaption className="font-semibold">Weight <span className="font-normal text-muted">(kg)</span></figcaption>
      <div className="mt-3 h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weightData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8e3ed" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis width={44} tick={{ fontSize: 11 }} unit=" kg" />
            <Tooltip formatter={(value) => [`${formatNumber(Number(value))} kg`, 'Weight']} labelFormatter={(_, payload) => payload?.[0]?.payload?.session ?? ''} />
            <Line type="monotone" dataKey="value" name="Weight" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>}
    {heightData.length < 2 && weightData.length < 2 && <p className="text-sm text-muted">More saved measurements are needed to show a trend chart.</p>}
  </div>
}
