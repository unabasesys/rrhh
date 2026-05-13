/**
 * useCustomFetch — versión standalone sin auth
 * Al integrar con Unabase OS se conectará al sistema de auth central
 */
export async function useCustomFetch(method, url, params = {}, body = {}) {
  let fullURL = `/api${url}`
  const queryString = Object.entries(params)
    .map(([key, value]) => Array.isArray(value)
      ? value.map(v => `${key}=${encodeURIComponent(v)}`).join('&')
      : `${key}=${encodeURIComponent(value)}`)
    .join('&')
  if (Object.keys(params).length > 0) fullURL += `?${queryString}`

  const fetchOptions = { method, headers: { 'Content-Type': 'application/json' } }
  if (['post', 'put', 'delete'].includes(method.toLowerCase())) {
    fetchOptions.body = body instanceof FormData ? body : JSON.stringify(body)
  }
  try {
    return await $fetch(fullURL, fetchOptions)
  } catch (error) {
    console.error('Fetch error:', error)
    throw error
  }
}

export async function useCustomFetchUrl(method, url, body = {}) {
  return useCustomFetch(method, url, {}, body)
}
