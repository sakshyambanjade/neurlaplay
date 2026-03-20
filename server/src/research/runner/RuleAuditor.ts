import type { RuleAudit } from '../types.js';

export function createRuleAuditState(base: RuleAudit): RuleAudit {
  return { ...base };
}

export function updateRuleAudit(state: RuleAudit, patch: Partial<RuleAudit>): RuleAudit {
  return {
    ...state,
    ...patch,
    bindingComponentHits: {
      ...state.bindingComponentHits,
      ...patch.bindingComponentHits
    },
    invalidMoveFailureModes: {
      ...state.invalidMoveFailureModes,
      ...patch.invalidMoveFailureModes
    }
  };
}

export function finalizeRuleAudit(state: RuleAudit): RuleAudit {
  return state;
}
