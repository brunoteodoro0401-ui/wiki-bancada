import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from './api'

/** Carrega uma lista da API e expõe reload(). */
export function useResource(path) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchItems = useCallback(
    () =>
      api
        .get(path)
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
