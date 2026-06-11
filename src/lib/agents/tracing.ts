import { Client } from "langsmith"
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain"

export function createTracingCallbacks(runName: string) {
  if (process.env.LANGCHAIN_TRACING_V2 !== "true") {
    return []
  }

  const tracer = new LangChainTracer({
    projectName: process.env.LANGCHAIN_PROJECT || "nodecommerce-bangladesh",
    client: new Client({
      apiKey: process.env.LANGCHAIN_API_KEY
    })
  })

  return [tracer]
}

export function getTracingConfig(runName: string) {
  return {
    runName,
    callbacks: createTracingCallbacks(runName),
    metadata: {
      project: "nodecommerce-bangladesh",
      version: "3.0",
      environment: process.env.NODE_ENV
    }
  }
}
