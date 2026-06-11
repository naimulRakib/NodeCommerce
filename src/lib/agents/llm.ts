import { ChatGroq } from "@langchain/groq"
import { GROQ_API_KEY } from "@/lib/env"

export const forecastingLLM = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.1,
  maxTokens: 2048,
  streaming: false,
  apiKey: GROQ_API_KEY || "dummy-key-for-build"
})

export const chatLLM = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.3,
  maxTokens: 1024,
  streaming: true,
  apiKey: GROQ_API_KEY || "dummy-key-for-build"
})

export const analysisLLM = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.0,
  maxTokens: 4096,
  streaming: false,
  apiKey: GROQ_API_KEY || "dummy-key-for-build"
})
