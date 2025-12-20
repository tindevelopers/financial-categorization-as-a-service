import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { AICategorizationService, Transaction, CategoryResult } from "./AICategorizationService";

// Define the schema using Zod
const categorizationSchema = z.object({
  categorizations: z.array(z.object({
    category: z.string().describe("The primary category for this transaction"),
    subcategory: z.string().optional().describe("Optional subcategory"),
    confidenceScore: z.number().min(0).max(1).describe("Confidence score from 0.0 to 1.0"),
    reasoning: z.string().optional().describe("Brief explanation of why this category was chosen"),
  })),
});

// Clean environment variable (remove \n and trim)
function cleanEnvVar(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\\n/g, "").replace(/\n/g, "").trim();
}

export class VercelAICategorizationService implements AICategorizationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any;
  private userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>;

  constructor(userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>) {
    // Get and clean the API key
    const apiKey = cleanEnvVar(process.env.OPENAI_API_KEY);
    
    console.log("[VercelAI] Initializing OpenAI provider");
    console.log("[VercelAI] API Key present:", !!apiKey);
    console.log("[VercelAI] API Key length:", apiKey?.length || 0);
    console.log("[VercelAI] API Key prefix:", apiKey?.substring(0, 10) || "N/A");
    
    if (!apiKey) {
      console.error("[VercelAI] ERROR: OPENAI_API_KEY is not set!");
      throw new Error("OPENAI_API_KEY is not configured");
    }
    
    // Create OpenAI provider with explicit API key
    const openai = createOpenAI({
      apiKey: apiKey,
    });
    
    // Use gpt-4o-mini for cost efficiency
    this.model = openai("gpt-4o-mini");
    this.userMappings = userMappings;
    
    console.log("[VercelAI] Model initialized successfully");
  }

  async categorizeTransaction(transaction: Transaction): Promise<CategoryResult> {
    const results = await this.categorizeBatch([transaction]);
    return results[0];
  }

  async categorizeBatch(transactions: Transaction[]): Promise<CategoryResult[]> {
    console.log("[VercelAI] categorizeBatch called with", transactions.length, "transactions");
    
    try {
      // Build prompt with user mappings and transaction context
      const prompt = this.buildPrompt(transactions);
      console.log("[VercelAI] Prompt built, length:", prompt.length);
      console.log("[VercelAI] Sample prompt (first 200 chars):", prompt.substring(0, 200));

      console.log("[VercelAI] Calling generateObject...");
      const startTime = Date.now();
      
      const { object } = await generateObject({
        model: this.model,
        schema: categorizationSchema,
        prompt,
        temperature: 0.3,
      });
      
      const duration = Date.now() - startTime;
      console.log("[VercelAI] generateObject returned in", duration, "ms");
      
      const categorizations = object.categorizations || [];
      console.log("[VercelAI] Categorizations count:", categorizations.length);

      if (categorizations.length > 0) {
        console.log("[VercelAI] First categorization:", JSON.stringify(categorizations[0]));
      }

      return categorizations.map((cat) => ({
        category: cat.category || "Uncategorized",
        subcategory: cat.subcategory,
        confidenceScore: cat.confidenceScore || 0.5,
        reasoning: cat.reasoning,
      }));
    } catch (error: unknown) {
      console.error("[VercelAI] ERROR in categorizeBatch:", error);
      if (error instanceof Error) {
        console.error("[VercelAI] Error name:", error.name);
        console.error("[VercelAI] Error message:", error.message);
        console.error("[VercelAI] Error stack:", error.stack);
      }
      // Re-throw the error so it's not silently swallowed
      throw error;
    }
  }

  getConfidenceScore(result: CategoryResult): number {
    return result.confidenceScore;
  }

  getProviderName(): string {
    return "openai";
  }

  private buildPrompt(transactions: Transaction[]): string {
    const commonCategories = [
      "Food & Dining",
      "Transportation",
      "Shopping",
      "Utilities",
      "Office Supplies",
      "Software & Subscriptions",
      "Travel",
      "Entertainment",
      "Healthcare",
      "Education",
      "Business Services",
      "Financial Services",
      "Uncategorized",
    ];

    let prompt = `You are a financial categorization assistant. Categorize the following transactions into appropriate categories.

Common categories: ${commonCategories.join(", ")}

`;

    // Add user mappings if available
    if (this.userMappings && this.userMappings.length > 0) {
      prompt += `User-specific category mappings:\n`;
      for (const mapping of this.userMappings) {
        prompt += `- "${mapping.pattern}" → ${mapping.category}`;
        if (mapping.subcategory) {
          prompt += ` / ${mapping.subcategory}`;
        }
        prompt += `\n`;
      }
      prompt += `\n`;
    }

    prompt += `Transactions to categorize:\n\n`;
    transactions.forEach((tx, index) => {
      prompt += `${index + 1}. ${tx.original_description} - $${tx.amount.toFixed(2)} (${tx.date})\n`;
    });

    prompt += `\nFor each transaction, provide:
- category: The most appropriate category from the list above
- subcategory: Optional, more specific classification
- confidenceScore: Your confidence (0.0 to 1.0) that this category is correct
- reasoning: Brief explanation of your categorization decision

Consider the transaction description, amount, and any patterns. Use user mappings when applicable.`;

    return prompt;
  }
}
