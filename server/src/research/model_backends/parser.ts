import type { ModelSelectionResult, SelectionFailureMode } from '../types/move.js';

export function parseIndexOnly(
  output: string,
  legalMoveCount: number
): Pick<ModelSelectionResult, 'selectedIndex' | 'valid' | 'failureMode'> {
  const trimmed = output.trim();
  if (!trimmed) {
    return { selectedIndex: null, valid: false, failureMode: 'empty' };
  }

  const match = trimmed.match(/^\d+$/);
  if (!match) {
    return { selectedIndex: null, valid: false, failureMode: 'non_integer' };
  }

  const selectedIndex = Number(trimmed);
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= legalMoveCount) {
    return { selectedIndex: null, valid: false, failureMode: 'out_of_range' };
  }

  return { selectedIndex, valid: true, failureMode: 'none' };
}

export function mapFailureToDetail(failureMode: SelectionFailureMode): string {
  switch (failureMode) {
    case 'none':
      return 'Selection parsed successfully.';
    case 'empty':
      return 'The model returned an empty response.';
    case 'non_integer':
      return 'The model returned text that was not a single integer.';
    case 'out_of_range':
      return 'The selected index was outside the legal move list.';
    case 'network_error':
      return 'Provider request failed at the network layer.';
    case 'timeout':
      return 'Provider request timed out.';
    case 'provider_error':
      return 'Provider returned a non-success status.';
    case 'invalid_output':
      return 'Provider returned malformed output.';
    case 'rate_limited':
      return 'Provider rejected the request due to rate limiting.';
  }
}
