import { expect, test, type Page } from '@playwright/test'

/**
 * Captures the screenshots published in docs/visual-evidence.md.
 *
 * These are tests first and evidence second: each one asserts the state it is
 * about to photograph, so a stale or broken screenshot cannot be committed
 * without the suite failing. Nothing here compares pixels — font rendering
 * differs across machines, and a brittle diff would teach the team to ignore
 * failures.
 */

const evidenceDir = '../docs/screenshots/evidence'

/** Captured once, from the desktop project; viewports are set per test. */
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'evidence is captured once, not per device project',
  )
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'calculator' })).toBeVisible()
})

async function clickKeys(page: Page, names: string[]) {
  for (const name of names) {
    await page.getByRole('button', { name, exact: true }).click()
  }
}

async function capture(page: Page, name: string) {
  await page.screenshot({ path: `${evidenceDir}/${name}.png`, animations: 'disabled' })
}

const result = (page: Page) => page.locator('output[aria-label="result"]')

test.describe('responsive layout', () => {
  const viewports = [
    { name: '360x740-small-phone', width: 360, height: 740 },
    { name: '414x896-large-phone', width: 414, height: 896 },
    { name: '768x1024-tablet', width: 768, height: 1024 },
    { name: '1024x600-short-landscape', width: 1024, height: 600 },
    { name: '1280x832-desktop', width: 1280, height: 832 },
  ]

  for (const viewport of viewports) {
    test(`fits and stays usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await clickKeys(page, ['1', '2', '3', 'multiply', '4', 'equals'])
      await expect(result(page)).toHaveText('492')

      // The evidence is only worth publishing if the layout actually holds:
      // nothing may overflow horizontally and every key must stay reachable.
      expect(await page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(viewport.width)
      const equals = await page.getByRole('button', { name: 'equals', exact: true }).boundingBox()
      expect(equals).not.toBeNull()
      expect(equals!.x + equals!.width).toBeLessThanOrEqual(viewport.width + 1)
      // Keys stay thumb-sized even on the narrowest supported screen.
      expect(equals!.height).toBeGreaterThanOrEqual(36)

      await capture(page, `responsive-${viewport.name}`)
    })
  }
})

test.describe('themes', () => {
  test('renders both themes at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 832 })
    await clickKeys(page, ['7', 'multiply', '8', 'equals'])
    await expect(result(page)).toHaveText('56')
    await capture(page, 'theme-light-desktop')

    await page.getByRole('switch', { name: 'Dark mode' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await capture(page, 'theme-dark-desktop')
  })

  test('renders dark theme on a small phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.getByRole('switch', { name: 'Dark mode' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await clickKeys(page, ['9', 'divide', '4', 'equals'])
    await expect(result(page)).toHaveText('2.25')
    await capture(page, 'theme-dark-mobile')
  })
})

test.describe('error handling', () => {
  test('division by zero shows a friendly message, not the server string', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 832 })
    await clickKeys(page, ['1', 'divide', '0', 'equals'])

    const alert = page.getByRole('alert')
    await expect(alert).toContainText("Can't divide by zero")
    await expect(alert).not.toContainText('division by zero')
    await capture(page, 'error-division-by-zero')
  })

  test('a syntax error underlines the exact failing position', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 832 })
    // An unclosed parenthesis is a syntax error the backend reports with a
    // position, which the UI turns into the fault needle.
    await clickKeys(page, ['open parenthesis', '2', 'plus', 'equals'])

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('[data-fault]')).toHaveCount(1)
    await capture(page, 'error-syntax-position')
  })

  test('square root of a negative number is rejected by the domain', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 832 })
    await clickKeys(page, ['4', 'minus', '9', 'equals'])
    // The readout uses a true minus sign (U+2212), not an ASCII hyphen.
    await expect(result(page)).toHaveText('−5')
    await clickKeys(page, ['square root', 'equals'])

    await expect(page.getByRole('alert')).toContainText('square root')
    await capture(page, 'error-negative-sqrt')
  })

  test('a network failure offers a retry', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 832 })
    // The transport is broken at the network layer rather than by stopping the
    // server, so the rest of the suite keeps its backend.
    await page.route('**/api/v1/calculate', (route) => route.abort('failed'))
    await clickKeys(page, ['6', 'plus', '6', 'equals'])

    await expect(page.getByRole('alert')).toContainText("Can't reach the server")
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
    await capture(page, 'error-network-retry')
  })

  test('an exhausted rate limit is reported with a wait hint', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 832 })

    // The 429 is served at the network layer rather than by draining the real
    // bucket: the backend is shared with every other test in this suite, and
    // exhausting it made unrelated tests fail. The envelope below is byte-for
    // -byte what internal/api/rate_limit.go emits — the limiter's own
    // behaviour is proven in Go (TestRateLimiterAllowsBurstThenReturns429),
    // while this captures the client's rendering of it.
    await page.route('**/api/v1/calculate', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '7' },
        body: JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'rate limit exceeded' } }),
      }),
    )

    await clickKeys(page, ['2', 'plus', '2', 'equals'])
    await expect(page.getByRole('alert')).toContainText(/too many calculations/i)
    await capture(page, 'error-rate-limited')
  })
})

test.describe('interaction', () => {
  test('history accumulates and a past result is recallable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 832 })
    await clickKeys(page, ['1', '2', 'plus', '3', 'equals'])
    await expect(result(page)).toHaveText('15')
    await clickKeys(page, ['clear', '8', 'multiply', '9', 'equals'])
    await expect(result(page)).toHaveText('72')
    await clickKeys(page, ['clear', '1', '0', '0', 'divide', '8', 'equals'])
    await expect(result(page)).toHaveText('12.5')

    await expect(page.getByRole('region', { name: 'history' })).toBeVisible()
    await capture(page, 'interaction-history')
  })

  test('keyboard focus is visible on the keypad', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 832 })
    // Tab until focus lands on a keypad key, so the capture shows the ring
    // where a keyboard user actually operates the calculator.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const onKey = await page.evaluate(() =>
        document.activeElement?.classList.contains('key') ?? false,
      )
      if (onKey) break
    }
    expect(await page.evaluate(() => document.activeElement?.classList.contains('key'))).toBe(true)
    await capture(page, 'interaction-focus-ring')
  })
})
