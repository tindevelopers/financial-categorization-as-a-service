/**
 * Test script to verify AI Gateway connection
 * Run with: npx tsx scripts/test-ai-gateway.ts
 */

import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
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

// Clean environment variable (remove \n and trim) - same as production code
function cleanEnvVar(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\\n/g, "").replace(/\n/g, "").trim();
}

async function testAIGateway() {
  console.log("=== AI Gateway Test (OpenAI Direct) ===\n");
  
  // Check environment variables
  console.log("Environment Variables:");
  const apiKey = cleanEnvVar(process.env.OPENAI_API_KEY);
  
  console.log("- OPENAI_API_KEY:", apiKey ? `${apiKey.substring(0, 15)}...` : "NOT SET");
  console.log("- API Key length:", apiKey?.length || 0);
  console.log("");

  if (!apiKey) {
    console.error("ERROR: OPENAI_API_KEY is not set!");
    return false;
  }

  // Test transactions
  const testTransactions = [
    { description: "STRIPE", amount: 274.61, date: "2025-07-31" },
    { description: "Convertible Loan", amount: 500.00, date: "2025-07-31" },
    { description: "AMAZON WEB SERVICES", amount: 150.00, date: "2025-07-30" },
  ];

  const prompt = `You are a financial categorization assistant. Categorize the following transactions.

Common categories: Food & Dining, Transportation, Shopping, Utilities, Office Supplies, Software & Subscriptions, Travel, Entertainment, Healthcare, Education, Business Services, Financial Services, Uncategorized

Transactions to categorize:
${testTransactions.map((tx, i) => `${i + 1}. ${tx.description} - $${tx.amount.toFixed(2)} (${tx.date})`).join("\n")}

For each transaction, provide category, subcategory (optional), confidenceScore (0-1), and reasoning.`;

  console.log("Test Prompt:\n", prompt.substring(0, 200) + "...\n");

  try {
    console.log("Creating OpenAI provider with explicit API key...");
    const openai = createOpenAI({
      apiKey: apiKey,
      compatibility: "strict",
    });
    
    const model = openai("gpt-4o-mini");
    console.log("Model created:", model);
    
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
      console.log(`   Subcategory: ${cat.subcategory || "N/A"}`);
      console.log(`   Confidence: ${(cat.confidenceScore * 100).toFixed(0)}%`);
      console.log(`   Reasoning: ${cat.reasoning || "N/A"}`);
      console.log("");
    });

    return true;
  } catch (error: unknown) {
    console.log("\n=== ERROR ===");
    console.error("Error type:", typeof error);
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
testAIGateway().then((success) => {
  console.log("\n=== Test Complete ===");
  console.log("Result:", success ? "PASSED" : "FAILED");
  process.exit(success ? 0 : 1);
});
