import type { AICategorizationService } from "./AICategorizationService";
import { VercelAICategorizationService } from "./VercelAICategorizationService";

export type AIProvider = "vercel_ai_gateway" | "abacus_ai";

export class AICategorizationFactory {
  static create(
    provider: AIProvider,
    userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>
  ): AICategorizationService {
    switch (provider) {
      case "vercel_ai_gateway":
        return new VercelAICategorizationService(userMappings);
      // case "abacus_ai":
      //   return new AbacusAICategorizationService(userMappings);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Get default provider (can be configured via env var)
   */
  static getDefaultProvider(): AIProvider {
    return (process.env.AI_CATEGORIZATION_PROVIDER as AIProvider) || "vercel_ai_gateway";
  }
}
