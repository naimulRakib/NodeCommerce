import { Client } from "langsmith"
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain"
import { LANGCHAIN_TRACING_V2, LANGCHAIN_PROJECT, LANGCHAIN_API_KEY, IS_PRODUCTION } from "@/lib/env"

export function createTracingCallbacks(runName: string) {
  if (!LANGCHAIN_TRACING_V2) {
    return []
  }

  const tracer = new LangChainTracer({
    projectName: LANGCHAIN_PROJECT,
    client: new Client({
      apiKey: LANGCHAIN_API_KEY || undefined
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
      environment: IS_PRODUCTION ? "production" : "development"
    }
  }
}
