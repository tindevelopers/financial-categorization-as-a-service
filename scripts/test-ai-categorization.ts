import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(__dirname, "../.env.local") });

async function testAICategorization() {
  console.log("=== AI Categorization Test ===\n");

  // Check env vars
  console.log("Environment Check:");
  console.log("  USE_AI_CATEGORIZATION:", process.env.USE_AI_CATEGORIZATION);
  console.log("  OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
  console.log("  AI_GATEWAY_API_KEY exists:", !!process.env.AI_GATEWAY_API_KEY);
  console.log("  VERCEL_AI_GATEWAY_API_KEY exists:", !!process.env.VERCEL_AI_GATEWAY_API_KEY);
  console.log();

  // Import the AI service
  const { AICategorizationFactory } = await import("../src/lib/ai/AICategorizationFactory");

  const testTransactions = [
    { original_description: "UBER TRIP", amount: 25.50, date: "2025-07-15" },
    { original_description: "WHOLE FOODS MARKET", amount: 156.78, date: "2025-07-14" },
    { original_description: "NETFLIX SUBSCRIPTION", amount: 15.99, date: "2025-07-13" },
    { original_description: "SHELL GAS STATION", amount: 45.00, date: "2025-07-12" },
    { original_description: "AMAZON MARKETPLACE", amount: 89.99, date: "2025-07-11" },
  ];

  console.log("Test Transactions:");
  testTransactions.forEach((tx, i) => {
    console.log(`  ${i + 1}. ${tx.original_description} - $${tx.amount}`);
  });
  console.log();

  try {
    const provider = AICategorizationFactory.getDefaultProvider();
    console.log("Provider:", provider);

    const aiService = AICategorizationFactory.create(provider);
    console.log("AI Service created successfully");
    console.log();

    console.log("Calling AI categorization...");
    const startTime = Date.now();
    const results = await aiService.categorizeBatch(testTransactions);
    const duration = Date.now() - startTime;

    console.log(`\nResults (${duration}ms):`);
    results.forEach((result, i) => {
      console.log(`  ${i + 1}. ${testTransactions[i].original_description}`);
      console.log(`     Category: ${result.category}`);
      console.log(`     Subcategory: ${result.subcategory || "N/A"}`);
      console.log(`     Confidence: ${(result.confidenceScore * 100).toFixed(0)}%`);
      if (result.reasoning) {
        console.log(`     Reasoning: ${result.reasoning}`);
      }
      console.log();
    });

    console.log("✅ AI Categorization test PASSED!");
  } catch (error) {
    console.error("\n❌ AI Categorization test FAILED:");
    console.error(error);
    process.exit(1);
  }
}

testAICategorization();

