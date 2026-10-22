import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('./api', () => {
  const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }
  return {
    default: api,
    TOKEN_KEY: 'bancada_token',
    errorMessage: (err) => err.response?.data?.detail ?? 'erro',
  }
})

import api from './api'
import { AuthProvider } from './auth'
import AuthModal from './components/AuthModal'
import ArticleCard from './components/ArticleCard'
import { DeviceCard } from './views/DevicesView'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ArticleCard', () => {
  const article = { id: 1, target_device: 'iPhone 11', category: 'Procedimento', ai_context_text: 'Texto da dica', tags: 'a, b' }

  it('mostra aparelho, categoria, texto e tags', () => {
    render(<ArticleCard article={article} />)
    expect(screen.getByText('iPhone 11')).toBeTruthy()
    expect(screen.getByText('Procedimento')).toBeTruthy()
    expect(screen.getByText('Texto da dica')).toBeTruthy()
    expect(screen.getByText('#a')).toBeTruthy()
  })

  it('só mostra Editar/Excluir quando os handlers existem (admin)', () => {
    const { rerender } = render(<ArticleCard article={article} />)
    expect(screen.queryByText('Editar')).toBeNull()
    rerender(<ArticleCard article={article} onEdit={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('Editar')).toBeTruthy()
    expect(screen.getByText('Excluir')).toBeTruthy()
  })
})

describe('DeviceCard', () => {
  it('alerta de flex e método de abertura', () => {
    render(<DeviceCard device={{ id: 1, marca: 'Apple', modelo: 'iPhone 11', opening_method: 'Frontal', has_flex_cable: true }} />)
    expect(screen.getByText('Abertura Frontal')).toBeTruthy()
    expect(screen.getByRole('note').textContent).toMatch(/cabo flex/i)
  })

  it('sem alerta quando não há flex e abertura não informada', () => {
    render(<DeviceCard device={{ id: 2, marca: 'X', modelo: 'Y', opening_method: null, has_flex_cable: false }} />)
    expect(screen.getByText('Abertura não informada')).toBeTruthy()
    expect(screen.queryByRole('note')).toBeNull()
  })
})

describe('AuthModal', () => {
  function setup() {
    const onClose = vi.fn()
    // sem token salvo, o AuthProvider não chama /auth/me
    render(<AuthProvider><AuthModal onClose={onClose} /></AuthProvider>)
    return onClose
  }

  it('faz login, guarda o token e fecha', async () => {
    api.post.mockResolvedValue({ data: { access_token: 'tok123', user: { id: 1, nome: 'Ana', role: 'tecnico' } } })
    const onClose = setup()
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'senha1234')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'ana@example.com', senha: 'senha1234' })
    expect(localStorage.getItem('bancada_token')).toBe('tok123')
  })

  it('mostra o erro da API e não fecha quando o login falha', async () => {
    api.post.mockRejectedValue({ response: { data: { detail: 'E-mail ou senha inválidos' } } })
    const onClose = setup()
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('E-mail ou senha inválidos')
    expect(onClose).not.toHaveBeenCalled()
    expect(localStorage.getItem('bancada_token')).toBeNull()
  })

  it('alterna para cadastro e mostra o campo Nome', async () => {
    setup()
    expect(screen.queryByLabelText('Nome')).toBeNull()
    await userEvent.click(screen.getByText('Não tem conta? Cadastre-se'))
    expect(screen.getByLabelText('Nome')).toBeTruthy()
  })
})
