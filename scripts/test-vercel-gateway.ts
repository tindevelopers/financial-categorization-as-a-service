/**
 * Test script to verify Vercel AI Gateway connection
 * Run with: npx tsx scripts/test-vercel-gateway.ts
 */

import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const testSchema = z.object({
  categorizations: z.array(z.object({
    category: z.string(),
    subcategory: z.string().optional(),
    confidenceScore: z.number(),
    reasoning: z.string().optional(),
  })),
});

async function testVercelGateway() {
  console.log("=== Vercel AI Gateway Test ===\n");
  
  // Check environment variables
  console.log("Environment Variables:");
  const aiGatewayKey = process.env.AI_GATEWAY_API_KEY;
  const vercelAiGatewayKey = process.env.VERCEL_AI_GATEWAY_API_KEY;
  
  console.log("- AI_GATEWAY_API_KEY set:", !!aiGatewayKey);
  console.log("- AI_GATEWAY_API_KEY length:", aiGatewayKey?.length || 0);
  console.log("- AI_GATEWAY_API_KEY has \\n:", aiGatewayKey?.includes('\\n'));
  console.log("- AI_GATEWAY_API_KEY has newline:", aiGatewayKey?.includes('\n'));
  console.log("- VERCEL_AI_GATEWAY_API_KEY set:", !!vercelAiGatewayKey);
  console.log("- VERCEL_AI_GATEWAY_API_KEY length:", vercelAiGatewayKey?.length || 0);
  console.log("");

  // Test transactions
  const testTransactions = [
    { description: "STRIPE", amount: 274.61, date: "2025-07-31" },
    { description: "Convertible Loan", amount: 500.00, date: "2025-07-31" },
  ];

  const prompt = `You are a financial categorization assistant. Categorize the following transactions.

Common categories: Food & Dining, Transportation, Shopping, Utilities, Software & Subscriptions, Business Services, Financial Services, Uncategorized

Transactions to categorize:
${testTransactions.map((tx, i) => `${i + 1}. ${tx.description} - $${tx.amount.toFixed(2)} (${tx.date})`).join("\n")}

For each transaction, provide category, subcategory (optional), confidenceScore (0-1), and reasoning.`;

  console.log("Test Prompt (first 150 chars):", prompt.substring(0, 150) + "...\n");

  try {
    console.log("Creating Vercel AI Gateway model (openai/gpt-4o-mini)...");
    const model = gateway("openai/gpt-4o-mini");
    
    console.log("Model created:", typeof model);
    console.log("Model details:", JSON.stringify({
      modelId: model.modelId,
      specificationVersion: model.specificationVersion,
    }, null, 2));
    
    console.log("\nCalling generateObject...");
    const startTime = Date.now();
    
    const { object } = await generateObject({
      model,
      schema: testSchema,
      prompt,
      temperature: 0.3,
    });
    
    const duration = Date.now() - startTime;

    console.log("\n=== SUCCESS ===");
    console.log(`Response received in ${duration}ms`);
    console.log("\nCategorizations:");
    object.categorizations.forEach((cat, i) => {
      console.log(`${i + 1}. ${testTransactions[i].description}`);
      console.log(`   Category: ${cat.category}`);
      console.log(`   Confidence: ${(cat.confidenceScore * 100).toFixed(0)}%`);
    });

    return true;
  } catch (error: unknown) {
    console.log("\n=== ERROR ===");
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else {
      console.error("Error:", error);
    }
    
    return false;
  }
}

// Run the test
testVercelGateway().then((success) => {
  console.log("\n=== Test Complete ===");
  console.log("Result:", success ? "PASSED" : "FAILED");
  process.exit(success ? 0 : 1);
});
