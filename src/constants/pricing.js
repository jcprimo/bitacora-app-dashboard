// ─── constants/pricing.js — Token & Cost Estimation ─────────────
// Rough heuristics shown in the Create view sidebar before the user
// clicks "AI Generate". These are estimates, not exact — actual usage
// is captured from the Anthropic API response (see useAnthropicUsage).
//
// Pricing is based on Claude Sonnet 4 (claude-sonnet-4-20250514):
//   Input:  $3.00 per million tokens
//   Output: $15.00 per million tokens

// Estimate token counts for display before generation
export function estimateTokens(inputText) {
  // ~1 token per 4 chars for English text (rough heuristic)
  const inputTokens = Math.ceil((inputText?.length || 0) / 4);
  const systemTokens = 250;  // CONTEXT + agent prompt
  const outputTokens = 450;  // structured JSON response
  return { input: systemTokens + inputTokens, output: outputTokens, total: systemTokens + inputTokens + outputTokens };
}

// Convert estimated tokens to USD cost
export function estimateCost(tokens) {
  // Claude Sonnet 4 pricing: $3/MTok input, $15/MTok output
  const inputCost = (tokens.input / 1_000_000) * 3;
  const outputCost = (tokens.output / 1_000_000) * 15;
  return inputCost + outputCost;
}
