import { buildForecastingGraph } from "./src/lib/agents/graph";

async function test() {
  const graph = buildForecastingGraph();
  console.log("Graph built successfully!");
}

test().catch(console.error);
