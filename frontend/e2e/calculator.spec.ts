import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function clickKeys(page: Page, names: string[]) {
  for (const name of names) {
    await page.getByRole('button', { name, exact: true }).click()
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'calculator' })).toBeVisible()
})

test('calculates through the real backend and repeats equals', async ({ page }) => {
  await clickKeys(page, ['5', 'plus', '2', 'equals'])
  const result = page.locator('output[aria-label="result"]')
  await expect(result).toHaveText('7')

  await page.getByRole('button', { name: 'equals', exact: true }).click()
  await expect(result).toHaveText('9')
})

test('normalizes operator and decimal input from the keyboard', async ({ page }) => {
  await page.keyboard.type('5+*2', { delay: 30 })
  await page.keyboard.press('Enter')
  const result = page.locator('output[aria-label="result"]')
  await expect(result).toHaveText('10')

  await page.getByRole('button', { name: 'clear' }).click()
  await page.keyboard.type('00.5.2', { delay: 30 })
  await expect(result).toHaveText('0.52')
})

test('shows a friendly domain error without leaking the server message', async ({ page }) => {
  await clickKeys(page, ['1', 'divide', '0', 'equals'])

  await expect(page.getByRole('alert')).toContainText("Can't divide by zero")
  await expect(page.getByRole('alert')).not.toContainText('division by zero')
})

test('keeps the header and calculator inside the viewport', async ({ page }) => {
  const viewport = page.viewportSize()
  if (!viewport) {
    throw new Error('project has no viewport')
  }

  for (const locator of [page.locator('.app-header'), page.getByRole('main', { name: 'calculator' })]) {
    const box = await locator.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
})

test('has no automatically detectable WCAG A/AA violations', async ({ page }) => {
  const lightResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(lightResults.violations).toEqual([])

  await page.getByRole('switch', { name: 'Dark mode' }).click()
  const darkResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(darkResults.violations).toEqual([])
})
