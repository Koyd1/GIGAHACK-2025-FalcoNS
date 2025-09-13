export const fmtMDL = (v: number | string | null | undefined) => {
  const n = Number(v || 0)
  return `${n.toFixed(2)} MDL`
}

export const cls = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

