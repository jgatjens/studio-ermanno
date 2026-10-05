import { describe, expect, it } from 'vitest'
import { validateDeploymentEnvironment } from '../deployment/config'

const production = {
  DEPLOYMENT_ENV: 'production',
  VITE_API_BASE_URL: 'https://business-api.onrender.com',
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
}

describe('production build configuration', () => {
  it('accepts public origins and the publishable Auth key', () => {
    expect(() => validateDeploymentEnvironment(production)).not.toThrow()
  })
  it('preserves local development builds', () => {
    expect(() => validateDeploymentEnvironment({ DEPLOYMENT_ENV: 'development' })).not.toThrow()
  })
  it.each([
    '',
    'http://localhost:8000',
    'https://localhost',
    'https://api.test/path',
    'https://user:password@api.test',
    'https://api.test?secret=value',
  ])('rejects invalid production API configuration: %s', (value) => {
    expect(() =>
      validateDeploymentEnvironment({ ...production, VITE_API_BASE_URL: value }),
    ).toThrow()
  })
  it('rejects missing Auth configuration and privileged keys', () => {
    expect(() => validateDeploymentEnvironment({ ...production, VITE_SUPABASE_URL: '' })).toThrow()
    expect(() =>
      validateDeploymentEnvironment({ ...production, VITE_SUPABASE_ANON_KEY: 'sb_secret_private' }),
    ).toThrow()
    expect(() =>
      validateDeploymentEnvironment({ ...production, VITE_OTHER_KEY: 'sb_secret_private' }),
    ).toThrow()
  })
})
