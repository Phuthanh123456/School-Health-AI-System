import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateBmi, formatBmi } from '../src/checkupMath.js'

test('converts centimeters to meters and calculates BMI', () => {
  assert.ok(Math.abs(calculateBmi(160, 64) - 25) < 1e-12)
  assert.ok(Math.abs(calculateBmi(170, 65) - (65 / (1.7 * 1.7))) < 1e-12)
})

test('formats BMI to two decimals without rounding the calculation first', () => {
  assert.equal(formatBmi(calculateBmi(170, 65)), '22.49')
  assert.equal(formatBmi(22.495), '22.50')
})

test('handles missing, zero, negative, and non-finite measurements', () => {
  for (const [height, weight] of [['', 65], [170, ''], [0, 65], [170, 0], [-1, 65], [170, -2], [Infinity, 50]]) {
    assert.equal(calculateBmi(height, weight), null)
  }
  assert.equal(formatBmi(null), '—')
})
