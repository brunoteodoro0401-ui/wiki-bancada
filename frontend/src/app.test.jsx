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
import UsersModal from './components/UsersModal'
import ArticleCard from './components/ArticleCard'
import { DeviceCard } from './views/DevicesView'
import ChecklistView from './views/ChecklistView'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
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

describe('UsersModal', () => {
  it('lista usuários e permite promover técnico a admin', async () => {
    api.get.mockResolvedValue({
      data: [
        { id: 1, nome: 'Bruno Admin', email: 'bruno@example.com', role: 'admin' },
        { id: 2, nome: 'Carlos Tech', email: 'carlos@example.com', role: 'tecnico' },
      ],
    })
    api.put.mockResolvedValue({
      data: { id: 2, nome: 'Carlos Tech', email: 'carlos@example.com', role: 'admin' },
    })

    const onClose = vi.fn()
    render(
      <AuthProvider>
        <UsersModal onClose={onClose} />
      </AuthProvider>,
    )

    expect(await screen.findByText('Carlos Tech')).toBeTruthy()
    const promoteBtn = screen.getByRole('button', { name: 'Tornar admin' })
    await userEvent.click(promoteBtn)
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/users/2/role', { role: 'admin' }),
    )
  })
})

describe('ChecklistView', () => {
  it('permite marcar defeito, salvar no histórico e enviar diagnóstico para a IA', async () => {
    api.get.mockResolvedValue({
      data: [{ id: 1, marca: 'Apple', modelo: 'iPhone 13 Pro', opening_method: 'Frontal', has_flex_cable: true }],
    })
    const onAskAI = vi.fn()
    render(<ChecklistView onAskAI={onAskAI} />)

    await userEvent.type(screen.getByLabelText('Aparelho / Modelo'), 'Apple iPhone 13 Pro')
    expect(await screen.findByText(/Alerta de Bancada/i)).toBeTruthy()

    const biometriaGroup = screen.getByRole('group', { name: 'Biometria (Digital) / Face ID' })
    const defeitoBtn = biometriaGroup.querySelectorAll('button')[1]
    await userEvent.click(defeitoBtn)

    await userEvent.click(screen.getByRole('button', { name: /Salvar no Histórico Local/i }))
    expect(screen.getByText(/1 item\(ns\) com defeito/i)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /Diagnosticar \(1 defeito\) na IA/i }))
    expect(onAskAI).toHaveBeenCalledTimes(1)
    expect(onAskAI.mock.calls[0][0]).toMatch(/Biometria \(Digital\) \/ Face ID/i)
  })
})
