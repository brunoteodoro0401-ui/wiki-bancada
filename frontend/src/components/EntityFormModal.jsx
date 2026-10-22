import { useState } from 'react'
import Modal from './Modal'
import { errorMessage } from '../api'

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
export const primaryBtn =
  'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
export const ghostBtn =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50'

/**
 * Formulário genérico em modal.
 * fields: [{ name, label, type: 'text'|'textarea'|'select'|'checkbox', options?, required? }]
 * onSubmit(values) deve retornar uma Promise; erros são exibidos no modal.
 */
export default function EntityFormModal({ title, fields, initial, onSubmit, onClose }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? (f.type === 'checkbox' ? false : '')])),
  )
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit(values)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((f) => {
          const id = `field-${f.name}`
          if (f.type === 'checkbox') {
            return (
              <label key={f.name} htmlFor={id} className="flex items-center gap-2 text-sm text-slate-700">
                <input id={id} type="checkbox" checked={values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
                {f.label}
              </label>
            )
          }
          return (
            <div key={f.name}>
              <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea id={id} rows={4} required={f.required} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} className={inputClass} />
              ) : f.type === 'select' ? (
                <select id={id} required={f.required} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} className={inputClass}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input id={id} type="text" required={f.required} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} className={inputClass} />
              )}
            </div>
          )
        })}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancelar</button>
          <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  )
}
