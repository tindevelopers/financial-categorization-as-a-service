import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
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

export class VercelAICategorizationService implements AICategorizationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private model: any;
  private userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>;

  constructor(userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>) {
    // Use Vercel AI Gateway
    this.model = gateway("openai/gpt-4o-mini");
    this.userMappings = userMappings;
  }

  async categorizeTransaction(transaction: Transaction): Promise<CategoryResult> {
    const results = await this.categorizeBatch([transaction]);
    return results[0];
  }

  async categorizeBatch(transactions: Transaction[]): Promise<CategoryResult[]> {
    try {
      const prompt = this.buildPrompt(transactions);

      const { object } = await generateObject({
        model: this.model,
        schema: categorizationSchema,
        prompt,
        temperature: 0.3,
      });

      const categorizations = object.categorizations || [];

      return categorizations.map((cat) => ({
        category: cat.category || "Uncategorized",
        subcategory: cat.subcategory,
        confidenceScore: cat.confidenceScore || 0.5,
        reasoning: cat.reasoning,
      }));
    } catch (error: unknown) {
      console.error("Vercel AI categorization error:", error);
      // Re-throw to let caller handle
      throw error;
    }
  }

  getConfidenceScore(result: CategoryResult): number {
    return result.confidenceScore;
  }

  getProviderName(): string {
    return "vercel_ai_gateway";
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
