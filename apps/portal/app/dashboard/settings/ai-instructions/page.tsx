"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"

interface AIInstruction {
  id?: string
  instruction_type: 'system_prompt' | 'category_rules' | 'exception_rules' | 'format_preferences'
  instructions: string
  priority: number
  is_active: boolean
  company_profile_id?: string
}

export default function AIInstructionsPage() {
  const [userInstructions, setUserInstructions] = useState<AIInstruction[]>([])
  const [companyInstructions, setCompanyInstructions] = useState<AIInstruction[]>([])
  const [companyProfiles, setCompanyProfiles] = useState<Array<{ id: string; company_name: string }>>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Load user instructions
      const { data: userInst } = await supabase
        .from("ai_categorization_instructions")
        .select("*")
        .eq("user_id", user.id)
        .is("company_profile_id", null)
        .order("priority", { ascending: false })

      setUserInstructions(userInst || [])

      // Load company profiles
      const { data: companies } = await supabase
        .from("company_profiles")
        .select("id, company_name")
        .eq("user_id", user.id)

      setCompanyProfiles(companies || [])

      if (companies && companies.length > 0) {
        setSelectedCompanyId(companies[0].id)
        loadCompanyInstructions(companies[0].id)
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadCompanyInstructions = async (companyId: string) => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: companyInst } = await supabase
        .from("ai_categorization_instructions")
        .select("*")
        .eq("company_profile_id", companyId)
        .is("user_id", null)
        .order("priority", { ascending: false })

      setCompanyInstructions(companyInst || [])
    } catch (error) {
      console.error("Error loading company instructions:", error)
    }
  }

  const saveInstruction = async (instruction: AIInstruction, isCompany: boolean) => {
    setSaving(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const instructionData: any = {
        instruction_type: instruction.instruction_type,
        instructions: instruction.instructions,
        priority: instruction.priority,
        is_active: instruction.is_active,
      }

      if (isCompany && selectedCompanyId) {
        instructionData.company_profile_id = selectedCompanyId
      } else {
        instructionData.user_id = user.id
      }

      if (instruction.id) {
        await supabase
          .from("ai_categorization_instructions")
          .update(instructionData)
          .eq("id", instruction.id)
      } else {
        await supabase
          .from("ai_categorization_instructions")
          .insert(instructionData)
      }

      await loadData()
      if (isCompany && selectedCompanyId) {
        await loadCompanyInstructions(selectedCompanyId)
      }
    } catch (error) {
      console.error("Error saving instruction:", error)
      alert("Failed to save instruction")
    } finally {
      setSaving(false)
    }
  }

  const deleteInstruction = async (id: string) => {
    if (!confirm("Are you sure you want to delete this instruction?")) return

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      await supabase
        .from("ai_categorization_instructions")
        .delete()
        .eq("id", id)

      await loadData()
      if (selectedCompanyId) {
        await loadCompanyInstructions(selectedCompanyId)
      }
    } catch (error) {
      console.error("Error deleting instruction:", error)
      alert("Failed to delete instruction")
    }
  }

  const InstructionEditor = ({ 
    instruction, 
    isCompany 
  }: { 
    instruction?: AIInstruction
    isCompany: boolean 
  }) => {
    const [localInstruction, setLocalInstruction] = useState<AIInstruction>(
      instruction || {
        instruction_type: 'system_prompt',
        instructions: '',
        priority: isCompany ? 10 : 0,
        is_active: true,
      }
    )

    return (
      <div className="border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Instruction Type</label>
            <select
              value={localInstruction.instruction_type}
              onChange={(e) => setLocalInstruction({
                ...localInstruction,
                instruction_type: e.target.value as AIInstruction['instruction_type']
              })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="system_prompt">System Prompt</option>
              <option value="category_rules">Category Rules</option>
              <option value="exception_rules">Exception Rules</option>
              <option value="format_preferences">Format Preferences</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <input
              type="number"
              value={localInstruction.priority}
              onChange={(e) => setLocalInstruction({
                ...localInstruction,
                priority: parseInt(e.target.value) || 0
              })}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Instructions</label>
          <textarea
            value={localInstruction.instructions}
            onChange={(e) => setLocalInstruction({
              ...localInstruction,
              instructions: e.target.value
            })}
            rows={8}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter your AI instructions here..."
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={localInstruction.is_active}
              onChange={(e) => setLocalInstruction({
                ...localInstruction,
                is_active: e.target.checked
              })}
            />
            <span>Active</span>
          </label>
          <button
            onClick={() => saveInstruction(localInstruction, isCompany)}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {instruction?.id ? 'Update' : 'Save'} Instruction
          </button>
          {instruction?.id && (
            <button
              onClick={() => deleteInstruction(instruction.id!)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AI Categorization Instructions</h1>
      <p className="text-gray-600 mb-8">
        Configure how the AI categorizes your transactions. Company-level instructions override user-level instructions.
      </p>

      {/* User Instructions */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">User-Level Instructions</h2>
        <div className="space-y-4">
          {userInstructions.map((inst) => (
            <InstructionEditor key={inst.id} instruction={inst} isCompany={false} />
          ))}
          <InstructionEditor isCompany={false} />
        </div>
      </section>

      {/* Company Instructions */}
      {companyProfiles.length > 0 && (
        <section>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Company</label>
            <select
              value={selectedCompanyId || ''}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value)
                loadCompanyInstructions(e.target.value)
              }}
              className="border rounded px-3 py-2"
            >
              {companyProfiles.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </div>
          <h2 className="text-2xl font-semibold mb-4">Company-Level Instructions</h2>
          <p className="text-sm text-gray-600 mb-4">
            Company instructions have higher priority and override user instructions.
          </p>
          <div className="space-y-4">
            {companyInstructions.map((inst) => (
              <InstructionEditor key={inst.id} instruction={inst} isCompany={true} />
            ))}
            <InstructionEditor isCompany={true} />
          </div>
        </section>
      )}
    </div>
  )
}

