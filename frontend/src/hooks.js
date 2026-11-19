import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from './api'

const IS_TEST = import.meta.env?.MODE === 'test'

function getWithRetry(path, attemptsLeft) {
  return api.get(path).catch((err) => {
    const status = err?.response?.status
    const retryable = !err?.response || status >= 500
    if (!retryable || attemptsLeft <= 1) throw err
    return new Promise((resolve) => setTimeout(resolve, 1500)).then(() =>
      getWithRetry(path, attemptsLeft - 1),
    )
  })
}

/** Carrega uma lista da API com retry automático (útil quando o servidor está acordando) e expõe reload(). */
export function useResource(path) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchItems = useCallback(
    () =>
      getWithRetry(path, IS_TEST ? 1 : 3)
        .then((res) => {
          setItems(res.data)
          setError(null)
        })
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setLoading(false)),
    [path],
  )

  const reload = useCallback(() => {
    setLoading(true)
    return fetchItems()
  }, [fetchItems])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return { items, loading, error, reload }
}
