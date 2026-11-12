import { fireEvent, screen, waitFor } from '@testing-library/react'
import { HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { AnalyticsSettings } from './AnalyticsSettings'
import { customRender } from '@/tests/lib/custom-render'
import { addAPIMock } from '@/tests/lib/msw'

const consent = vi.hoisted(() => ({
  hasAccepted: true,
  categories: [],
  acceptAll: vi.fn(),
  denyAll: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('common')>()),
  useConsentState: () => consent,
}))

vi.mock('@/lib/constants', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  IS_PLATFORM: true,
}))

const mockReset = (response: () => Promise<Response>) => {
  const onReset = vi.fn()
  addAPIMock({
    method: 'post',
    path: '/platform/telemetry/reset',
    response: async () => {
      onReset()
      return response()
    },
  })
  return onReset
}

describe('AnalyticsSettings', () => {
  const reload = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    consent.hasAccepted = true
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

  test('reloads once the opt-out is saved and the telemetry reset settles', async () => {
    const reset = Promise.withResolvers<Response>()
    const onReset = mockReset(() => reset.promise)
    customRender(<AnalyticsSettings />)

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => expect(onReset).toHaveBeenCalledOnce())
    expect(consent.denyAll).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()

    reset.resolve(HttpResponse.json({}, { status: 500 }))
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  })

  test('reloads without waiting longer than the cap for a hanging reset', async () => {
    mockReset(() => new Promise<Response>(() => {}))
    customRender(<AnalyticsSettings />)

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => expect(reload).toHaveBeenCalledOnce(), { timeout: 5000 })
  })

  test('does not reload when the opt-out fails to save', async () => {
    mockReset(async () => HttpResponse.json({}))
    consent.denyAll.mockResolvedValueOnce(false)
    customRender(<AnalyticsSettings />)

    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => expect(consent.denyAll).toHaveBeenCalledOnce())
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(reload).not.toHaveBeenCalled()
  })

  test('does not reload when opting in', () => {
    consent.hasAccepted = false
    customRender(<AnalyticsSettings />)

    fireEvent.click(screen.getByRole('switch'))

    expect(consent.acceptAll).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
  })
})
