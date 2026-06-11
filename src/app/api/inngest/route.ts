import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { runIntelligencePipeline } from "@/inngest/functions";

// Create an API that serves zero-config background jobs
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [runIntelligencePipeline],
});
