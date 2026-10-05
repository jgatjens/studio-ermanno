export function validateDeploymentEnvironment(env: Record<string, string | undefined>) {
  if (env.DEPLOYMENT_ENV !== 'production') return
  for (const key of ['VITE_API_BASE_URL', 'VITE_SUPABASE_URL']) {
    let url: URL
    try {
      url = new URL(env[key] ?? '')
    } catch {
      throw new Error(`${key} must be configured for deployment`)
    }
    if (
      url.protocol !== 'https:' ||
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      throw new Error(`${key} must be a public HTTPS origin`)
    }
  }
  const key = env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!key.startsWith('sb_publishable_'))
    throw new Error('Production VITE_SUPABASE_ANON_KEY must be a Supabase publishable key')
  if (
    Object.entries(env).some(
      ([name, value]) => name.startsWith('VITE_') && value?.startsWith('sb_secret_'),
    )
  ) {
    throw new Error('Privileged Supabase credentials must not be exposed to the frontend')
  }
}
