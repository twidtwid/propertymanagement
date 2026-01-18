/**
 * Shared AI client - uses local Gemma API when LOCAL_AI_URL is set,
 * otherwise falls back to Anthropic Haiku (for production).
 */

import Anthropic from "@anthropic-ai/sdk"

const LOCAL_AI_URL = process.env.LOCAL_AI_URL // e.g., http://192.168.68.81:8000
const LOCAL_AI_MODEL = process.env.LOCAL_AI_MODEL || "mlx-community/gemma-3-12b-it-4bit"

const anthropic = new Anthropic()

export interface AIMessageContent {
  type: "text" | "image"
  text?: string
  source?: {
    type: "base64"
    media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"
    data: string
  }
}

export interface AIMessage {
  role: "system" | "user" | "assistant"
  content: string | AIMessageContent[]
}

interface AIResponse {
  content: string
  inputTokens?: number
  outputTokens?: number
}

/**
 * Check if messages contain images.
 */
function hasImages(messages: AIMessage[]): boolean {
  return messages.some(m =>
    Array.isArray(m.content) && m.content.some(c => c.type === "image")
  )
}

/**
 * Send a chat completion request to either local Gemma or Anthropic Haiku.
 * Falls back to Anthropic for image processing (vision) since local API may not support it.
 */
export async function chatCompletion(
  messages: AIMessage[],
  options: {
    maxTokens?: number
    temperature?: number
    timeout?: number
  } = {}
): Promise<AIResponse> {
  const { maxTokens = 500, temperature = 0.7, timeout = 30000 } = options

  // Use Anthropic for images (vision) - local API may not support it
  if (hasImages(messages)) {
    return callAnthropic(messages, { maxTokens, temperature, timeout })
  }

  // Use local API if configured for text-only requests
  if (LOCAL_AI_URL) {
    return callLocalAPI(messages, { maxTokens, temperature, timeout })
  }

  // Fall back to Anthropic Haiku
  return callAnthropic(messages, { maxTokens, temperature, timeout })
}

/**
 * Convert message content to string for local API.
 */
function contentToString(content: string | AIMessageContent[]): string {
  if (typeof content === "string") return content
  return content
    .filter(c => c.type === "text")
    .map(c => c.text || "")
    .join("\n")
}

/**
 * Call local OpenAI-compatible API (Gemma).
 */
async function callLocalAPI(
  messages: AIMessage[],
  options: { maxTokens: number; temperature: number; timeout: number }
): Promise<AIResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeout)

  try {
    const response = await fetch(`${LOCAL_AI_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LOCAL_AI_MODEL,
        messages: messages.map(m => ({
          role: m.role,
          content: contentToString(m.content)
        })),
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Local AI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ""

    console.log(`[AI:local] tokens: ${data.usage?.prompt_tokens || "?"} in, ${data.usage?.completion_tokens || "?"} out`)

    return {
      content,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    }
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === "AbortError") {
      throw new Error("Local AI API timeout")
    }
    throw error
  }
}

/**
 * Convert our message format to Anthropic format.
 */
function toAnthropicContent(content: string | AIMessageContent[]): Anthropic.ContentBlockParam[] | string {
  if (typeof content === "string") return content
  return content.map(c => {
    if (c.type === "text") {
      return { type: "text" as const, text: c.text || "" }
    }
    if (c.type === "image" && c.source) {
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: c.source.media_type,
          data: c.source.data,
        }
      }
    }
    return { type: "text" as const, text: "" }
  })
}

/**
 * Call Anthropic Haiku API.
 */
async function callAnthropic(
  messages: AIMessage[],
  options: { maxTokens: number; temperature: number; timeout: number }
): Promise<AIResponse> {
  // Separate system message from user/assistant messages
  const systemMessage = messages.find(m => m.role === "system")
  const chatMessages = messages.filter(m => m.role !== "system")

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: options.maxTokens,
    system: systemMessage ? contentToString(systemMessage.content) : undefined,
    messages: chatMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: toAnthropicContent(m.content),
    })),
  })

  const textBlock = response.content.find(c => c.type === "text")
  const content = textBlock?.type === "text" ? textBlock.text : ""

  console.log(`[AI:anthropic] tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`)

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

/**
 * Helper to extract JSON from AI response (handles markdown code blocks).
 */
export function extractJSON<T>(text: string): T | null {
  try {
    // Try to find JSON in code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1].trim())
    }

    // Try to find raw JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error("Failed to parse JSON from AI response:", error)
  }
  return null
}
