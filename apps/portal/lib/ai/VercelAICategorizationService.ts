import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { AICategorizationService, Transaction, CategoryResult } from "./AICategorizationService";

export class VercelAICategorizationService implements AICategorizationService {
  private model: any;
  private userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>;

  constructor(userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>) {
    // Use GPT-4 for better categorization accuracy
    this.model = openai("gpt-4o-mini"); // Using mini for cost efficiency, can upgrade to gpt-4o if needed
    this.userMappings = userMappings;
  }

  async categorizeTransaction(transaction: Transaction): Promise<CategoryResult> {
    const results = await this.categorizeBatch([transaction]);
    return results[0];
  }

  async categorizeBatch(transactions: Transaction[]): Promise<CategoryResult[]> {
    try {
      // Build prompt with user mappings and transaction context
      const prompt = this.buildPrompt(transactions);

      const { object } = await generateObject({
        model: this.model,
        schema: {
          type: "object",
          properties: {
            categorizations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    description: "The primary category for this transaction",
                  },
                  subcategory: {
                    type: "string",
                    description: "Optional subcategory",
                  },
                  confidenceScore: {
                    type: "number",
                    description: "Confidence score from 0.0 to 1.0",
                    minimum: 0,
                    maximum: 1,
                  },
                  reasoning: {
                    type: "string",
                    description: "Brief explanation of why this category was chosen",
                  },
                },
                required: ["category", "confidenceScore"],
              },
            },
          },
          required: ["categorizations"],
        },
        prompt,
        temperature: 0.3, // Lower temperature for more consistent categorization
      });

      const categorizations = (object as any).categorizations || [];

      return categorizations.map((cat: any, index: number) => ({
        category: cat.category || "Uncategorized",
        subcategory: cat.subcategory,
        confidenceScore: cat.confidenceScore || 0.5,
        reasoning: cat.reasoning,
      }));
    } catch (error: any) {
      console.error("Vercel AI categorization error:", error);
      // Fallback to basic categorization
      return transactions.map(() => ({
        category: "Uncategorized",
        confidenceScore: 0.3,
      }));
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
