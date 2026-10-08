/** Descrição curta e legível do navegador/sistema, sem expor o user-agent completo. */
export function descreverAparelho(userAgent?: string | null): string {
  if (!userAgent) return "aparelho não identificado";
  const ua = userAgent;
  const navegador = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "navegador";
  const sistema = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "sistema desconhecido";
  return `${navegador} no ${sistema}`;
}
