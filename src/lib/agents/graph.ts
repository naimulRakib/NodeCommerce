import { StateGraph, END } from "@langchain/langgraph"
import { NodeCommerceState, NodeCommerceStateType } from "./state"
import { provaNode } from "./nodes/prova"
import { foresightNode } from "./nodes/foresight"
import { reorderNode } from "./nodes/reorder"

function shouldRunForesight(state: NodeCommerceStateType): string {
  if (Object.keys(state.stockSnapshot).length === 0) {
    return "skip_to_end"
  }
  return "run_foresight"
}

function shouldRunReorder(state: NodeCommerceStateType): string {
  const hasCritical = state.criticalAlerts.some(
    a => a.severity === "CRITICAL" || a.severity === "WARNING"
  )
  if (!hasCritical) {
    return "skip_reorder"
  }
  return "run_reorder"
}

export function buildForecastingGraph() {
  const graph = new StateGraph(NodeCommerceState)

  graph.addNode("prova", provaNode as any)
  graph.addNode("foresight", foresightNode as any)
  graph.addNode("reorder", reorderNode as any)

  graph.addEdge("__start__", "prova")

  graph.addConditionalEdges("prova", shouldRunForesight, {
    run_foresight: "foresight",
    skip_to_end: END
  })

  graph.addConditionalEdges("foresight", shouldRunReorder, {
    run_reorder: "reorder",
    skip_reorder: END
  })

  graph.addEdge("reorder", END)

  return graph.compile()
}
