import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { AnalyticsSettings } from './AnalyticsSettings'
import { customRender } from '@/tests/lib/custom-render'

const consent = vi.hoisted(() => ({
  hasAccepted: true,
  categories: [],
  acceptAll: vi.fn(),
  denyAll: vi.fn(() => Promise.resolve()),
}))

vi.mock('common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('common')>()),
  useConsentState: () => consent,
}))

describe('AnalyticsSettings', () => {
  const reload = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  test('reloads the page once an opt-out is saved', async () => {
    const saved = Promise.withResolvers<void>()
    consent.denyAll.mockReturnValueOnce(saved.promise)
    customRender(<AnalyticsSettings />)

    fireEvent.click(screen.getByRole('switch'))

    expect(consent.denyAll).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()

    saved.resolve()
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  test('does not reload when opting in', () => {
    consent.hasAccepted = false
    customRender(<AnalyticsSettings />)

    fireEvent.click(screen.getByRole('switch'))

    expect(consent.acceptAll).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
    consent.hasAccepted = true
  })
})
