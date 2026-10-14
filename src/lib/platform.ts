/** Integración con el visor de artefactos de claude.ai (si la app corre ahí) */

type Use = (name: string) => Promise<unknown>
const claudeUse = (): Use | undefined => {
  const c = (window as unknown as { claude?: { use?: Use } }).claude
  return typeof c?.use === 'function' ? c.use.bind(c) : undefined
}

/** true cuando la app está abierta como artefacto de Claude */
export const inArtifact = () => !!claudeUse()

/** Pide una capacidad del visor; null si no está disponible */
export async function capability<T>(name: string): Promise<T | null> {
  const use = claudeUse()
  if (!use) return null
  try {
    return ((await use(name)) as T) ?? null
  } catch {
    return null
  }
}
