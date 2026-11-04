export function calculateBmi(heightCm, weightKg) {
  if (heightCm === '' || weightKg === '' || heightCm == null || weightKg == null) return null
  const height = Number(heightCm)
  const weight = Number(weightKg)
  if (!Number.isFinite(height) || !Number.isFinite(weight) || height <= 0 || weight <= 0) return null
  const bmi = weight / ((height / 100) ** 2)
  return Number.isFinite(bmi) ? bmi : null
}

export function formatBmi(bmi) {
  return bmi === null || !Number.isFinite(bmi) ? '—' : bmi.toFixed(2)
}
