import { EndpointType } from './llm';

export function detectEndpointType(url: string): EndpointType {
  const normalized = url.toLowerCase();

  if (normalized.includes('api.openai.com')) return 'openai';
  if (normalized.includes('api.groq.com')) return 'groq';
  if (normalized.includes('api.anthropic.com')) return 'anthropic';
  if (normalized.includes('together.ai') || normalized.includes('together.xyz')) return 'openai';
  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) return 'custom';

  return 'custom';
}
