import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import type { AICategorizationService, Transaction, CategoryResult } from "./AICategorizationService";

export interface AIInstructions {
  systemPrompt?: string;
  categoryRules?: string;
  exceptionRules?: string;
  formatPreferences?: string;
}

export class VercelAICategorizationService implements AICategorizationService {
  private model: any;
  private userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>;
  private aiInstructions?: AIInstructions;
  private companyProfileId?: string;

  constructor(
    userMappings?: Array<{ pattern: string; category: string; subcategory?: string }>,
    aiInstructions?: AIInstructions,
    companyProfileId?: string
  ) {
    // Use Vercel AI Gateway for unified access to multiple AI providers
    // Requires AI_GATEWAY_API_KEY environment variable (or OIDC when deployed on Vercel)
    // See: https://vercel.com/docs/ai-gateway
    this.model = gateway("openai/gpt-4o-mini"); // Using mini for cost efficiency, can upgrade to gpt-4o if needed
    this.userMappings = userMappings;
    this.aiInstructions = aiInstructions;
    this.companyProfileId = companyProfileId;
  }

  /**
   * Load AI categorization instructions from database
   * Merges user and company-level instructions (company overrides user)
   */
  static async loadCategorizationInstructions(
    supabase: any,
    userId: string,
    companyProfileId?: string
  ): Promise<AIInstructions> {
    try {
      // Try to call the database function, fallback to manual query if function doesn't exist
      let data: any[] = [];
      let error: any = null;

      try {
        const result = await supabase.rpc('get_merged_ai_instructions', {
          p_user_id: userId,
          p_company_profile_id: companyProfileId || null,
        });
        data = result.data || [];
        error = result.error;
      } catch (rpcError) {
        // Function might not exist yet, fallback to manual queries
        console.warn('RPC function not available, using manual queries:', rpcError);
        
        // Get user instructions
        const { data: userInst } = await supabase
          .from("ai_categorization_instructions")
          .select("*")
          .eq("user_id", userId)
          .is("company_profile_id", null)
          .eq("is_active", true)
          .order("priority", { ascending: false });

        // Get company instructions if provided
        let companyInst: any[] = [];
        if (companyProfileId) {
          const { data: compInst } = await supabase
            .from("ai_categorization_instructions")
            .select("*")
            .eq("company_profile_id", companyProfileId)
            .is("user_id", null)
            .eq("is_active", true)
            .order("priority", { ascending: false });
          companyInst = compInst || [];
        }

        // Merge: company instructions first (higher priority), then user
        data = [
          ...companyInst.map((inst: any) => ({ ...inst, source: 'company' })),
          ...(userInst || []).map((inst: any) => ({ ...inst, source: 'user' })),
        ];
      }

      if (error && !data.length) {
        console.error('Error loading AI instructions:', error);
        return {};
      }

      // Group instructions by type
      const instructions: AIInstructions = {};

      if (data && Array.isArray(data)) {
        for (const row of data) {
          const { instruction_type, instructions: instructionText, source } = row;

          // Company instructions override user instructions
          if (source === 'company' || !instructions[instruction_type as keyof AIInstructions]) {
            switch (instruction_type) {
              case 'system_prompt':
                instructions.systemPrompt = instructionText;
                break;
              case 'category_rules':
                instructions.categoryRules = instructionText;
                break;
              case 'exception_rules':
                instructions.exceptionRules = instructionText;
                break;
              case 'format_preferences':
                instructions.formatPreferences = instructionText;
                break;
            }
          }
        }
      }

      return instructions;
    } catch (error) {
      console.error('Error loading AI instructions:', error);
      return {};
    }
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
        schema: z.object({
          categorizations: z.array(
            z.object({
              category: z.string().describe("The primary category for this transaction"),
              subcategory: z.string().nullable().optional().describe("Optional subcategory (can be null if not applicable)"),
              confidenceScore: z.number().min(0).max(1).describe("Confidence score from 0.0 to 1.0"),
              reasoning: z.string().describe("Brief explanation of why this category was chosen"),
            })
          ),
        }),
        prompt,
        temperature: 0.3, // Lower temperature for more consistent categorization
      });

      const categorizations = (object as any).categorizations || [];


      return categorizations.map((cat: any, index: number) => ({
        category: cat.category || "Uncategorized",
        subcategory: cat.subcategory || undefined, // Convert null to undefined for consistency
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
      "Business Services",
      "Financial Services",
      "Uncategorized",
    ];

    // Start with system prompt (custom or default)
    let prompt = this.aiInstructions?.systemPrompt || 
      `You are a financial categorization assistant. Categorize the following transactions into appropriate categories for financial statement generation and accounting purposes.

Common categories: ${commonCategories.join(", ")}

`;

    // Add category rules if available
    if (this.aiInstructions?.categoryRules) {
      prompt += `\nCategory Rules:\n${this.aiInstructions.categoryRules}\n`;
    }

    // Add exception rules if available
    if (this.aiInstructions?.exceptionRules) {
      prompt += `\nException Rules:\n${this.aiInstructions.exceptionRules}\n`;
    }

    // Add format preferences if available
    if (this.aiInstructions?.formatPreferences) {
      prompt += `\nFormat Preferences:\n${this.aiInstructions.formatPreferences}\n`;
    }

    // Add user mappings if available
    if (this.userMappings && this.userMappings.length > 0) {
      prompt += `\nUser-specific category mappings:\n`;
      for (const mapping of this.userMappings) {
        prompt += `- "${mapping.pattern}" → ${mapping.category}`;
        if (mapping.subcategory) {
          prompt += ` / ${mapping.subcategory}`;
        }
        prompt += `\n`;
      }
      prompt += `\n`;
    }

    // Add financial statement context if company profile is set
    if (this.companyProfileId) {
      prompt += `\nNote: These transactions are for financial statement generation and may be exported to XERO or filed with HMRC. Ensure proper categorization for tax and accounting compliance.\n\n`;
    }

    // Detect if transactions are from invoices
    const hasInvoiceIndicators = transactions.some(tx => 
      tx.original_description?.includes("Invoice #") || 
      tx.original_description?.includes(" - ") ||
      tx.original_description?.match(/\b(amazon|screwfix|office|supplies|equipment|printer|software)\b/i)
    );
    
    if (hasInvoiceIndicators) {
      prompt += `\nINVOICE TRANSACTION GUIDANCE:
These transactions appear to be from invoices. Pay special attention to:
- Vendor names (e.g., "Amazon" → Shopping or Office Supplies depending on item)
- Product descriptions in transaction descriptions (e.g., "HP OfficeJet Pro printer" → Office Supplies / Equipment)
- Invoice numbers help identify the source document
- Common invoice vendors and their typical categories:
  * Amazon → Shopping (general items) or Office Supplies (if office/equipment mentioned)
  * Screwfix, Toolstation → Office Supplies / Tools & Equipment
  * Software vendors → Software & Subscriptions
  * Office supply stores → Office Supplies

Examples:
- "Amazon EU S.à r.l. - HP OfficeJet Pro printer - Invoice #203-7525121" → Office Supplies / Equipment
- "Amazon - Wireless Mouse - Invoice #123" → Office Supplies / Computer Accessories
- "Screwfix - Vapour Barrier Membrane - Invoice #LD-2024-1000105683" → Office Supplies / Building Materials
- "Microsoft - Office 365 Subscription - Invoice #MS-12345" → Software & Subscriptions / Productivity Software

\n`;
    }

    prompt += `Transactions to categorize:\n\n`;
    transactions.forEach((tx, index) => {
      const txAny = tx as any;
      let txLine = `${index + 1}. ${tx.original_description} - $${tx.amount.toFixed(2)} (${tx.date})`;
      
      // Add transaction type if available
      if (txAny.transaction_type) {
        txLine += ` [Type: ${txAny.transaction_type}]`;
      }
      
      // Add debit/credit indicator
      if (txAny.is_debit !== undefined) {
        txLine += ` [${txAny.is_debit ? 'Debit' : 'Credit'}]`;
      }
      
      // Add reference number if available
      if (txAny.reference_number) {
        txLine += ` [Ref: ${txAny.reference_number}]`;
      }
      
      // Add invoice number if present in description (extract it)
      const invoiceMatch = tx.original_description?.match(/Invoice\s*#([A-Z0-9\-]+)/i);
      if (invoiceMatch) {
        txLine += ` [Invoice: ${invoiceMatch[1]}]`;
      }
      
      txLine += `\n`;
      prompt += txLine;
    });

    prompt += `\nFor each transaction, provide:
- category: The most appropriate category from the list above
- subcategory: Optional, more specific classification (use null if no subcategory applies, especially for "Uncategorized")
- confidenceScore: Your confidence (0.0 to 1.0) that this category is correct
- reasoning: Brief explanation of your categorization decision

Consider the transaction description (especially vendor names and product descriptions), amount, transaction type (debit/credit/interest/fee), and any patterns. For invoice transactions, pay special attention to product descriptions and vendor names. Use user mappings when applicable.`;

    return prompt;
  }
}
