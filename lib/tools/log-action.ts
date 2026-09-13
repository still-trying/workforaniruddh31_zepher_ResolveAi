import { createServerSupabaseClient } from '@/lib/supabase/client';

export type ActionStatus = 'success' | 'blocked' | 'error';

export interface LogActionParams {
  case_id: string;
  step: number;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: ActionStatus;
}

export async function logAction(params: LogActionParams): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('agent_actions').insert({
    case_id: params.case_id,
    step: params.step,
    tool: params.tool,
    input: params.input,
    output: params.output,
    status: params.status,
  });

  if (error) {
    console.error('[logAction] Failed to write agent_action:', error.message);
  }
}
