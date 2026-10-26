/**
 * 学员问答服务（apps/kb-api，前缀 /v1）的浏览器客户端。
 *
 * 与管理端 `/admin/v1` 不同，这里不经过 axios 信封，也不会带管理端 JWT：
 * 学员侧用 X-API-Key 鉴权，响应是 SSE 事件流。
 */

export const KB_BASE = import.meta.env.VITE_KB_BASE || '/v1'
const KB_API_KEY = import.meta.env.VITE_KB_API_KEY || ''

export interface KbCitation {
  citation_id: string
  source: 'chunk' | 'question'
  chunk_id: string
  question_id: string
  book_id: string
  book_title: string
  subject: string
  stage: string
  question_type: string
  difficulty: string
  page_start: number
  page_end: number
  score: number
  quote: string
}

export interface KbRetrievalStats {
  dense: number
  sparse: number
  questions: number
  fused: number
  reranked: number
}

export interface KbHealth {
  status: string
  tenant: string
  chunks_alias: string
  chunks_alias_collection: string | null
  chunks: number
  questions_alias: string
  questions: number
  embedding_provider: string
  llm_configured: boolean
  mongo_ok: boolean
}

export interface KbHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface KbChatPayload {
  query: string
  messages?: KbHistoryMessage[]
  tenant_id?: string
  subject?: string
  stage?: string
  top_k?: number
}

export interface KbMetaEvent {
  request_id: string
  scene: string
  rewritten_query: string
  retrieval: KbRetrievalStats
  rerank_provider: string
}

export interface KbDoneEvent {
  request_id: string
  latency_ms: number
  model: string
  confidence: 'high' | 'medium' | 'low'
  retrieval: KbRetrievalStats
}

export interface KbErrorEvent {
  code: string
  message: string
  retryable: boolean
  request_id: string
}

export interface KbStreamHandlers {
  meta?: (data: KbMetaEvent) => void
  citation?: (data: KbCitation) => void
  delta?: (data: { delta: string }) => void
  done?: (data: KbDoneEvent) => void
  error?: (data: KbErrorEvent) => void
}

function headers(): Record<string, string> {
  const result: Record<string, string> = { 'Content-Type': 'application/json' }
  if (KB_API_KEY) result['X-API-Key'] = KB_API_KEY
  return result
}

export async function fetchKbHealth(): Promise<KbHealth> {
  const response = await fetch(`${KB_BASE}/health`, { headers: headers() })
  if (!response.ok) throw new Error(`知识库服务返回 HTTP ${response.status}`)
  return (await response.json()) as KbHealth
}

/**
 * 调用 `/v1/chat/stream`，按 SSE 事件名分发给 handlers。
 * 返回的 Promise 在流结束（或连接中断）时 resolve；网络/HTTP 错误会 reject。
 */
export async function streamKbChat(
  payload: KbChatPayload,
  handlers: KbStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${KB_BASE}/chat/stream`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
    signal
  })

  if (!response.ok) {
    let message = `请求失败（HTTP ${response.status}）`
    try {
      const body = (await response.json()) as { message?: string }
      if (body?.message) message = body.message
    } catch {
      /* 非 JSON 错误体，保留状态码信息 */
    }
    throw new Error(message)
  }
  if (!response.body) throw new Error('当前浏览器不支持流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      dispatch(buffer.slice(0, boundary), handlers)
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
    }
  }
  if (buffer.trim()) dispatch(buffer, handlers)
}

function dispatch(raw: string, handlers: KbStreamHandlers): void {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return
  let data: unknown
  try {
    data = JSON.parse(dataLines.join('\n'))
  } catch {
    return
  }
  switch (event) {
    case 'meta':
      handlers.meta?.(data as KbMetaEvent)
      break
    case 'citation':
      handlers.citation?.(data as KbCitation)
      break
    case 'delta':
      handlers.delta?.(data as { delta: string })
      break
    case 'done':
      handlers.done?.(data as KbDoneEvent)
      break
    case 'error':
      handlers.error?.(data as KbErrorEvent)
      break
    default:
      break
  }
}
