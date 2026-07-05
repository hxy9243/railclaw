const PROVIDERS = {
  'openai-codex': ['OPENAI_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  telegram: ['TELEGRAM_BOT_TOKEN'],
  discord: ['DISCORD_TOKEN'],
  slack: ['SLACK_BOT_TOKEN'],
};

export function providerInstructions(providerNames = Object.keys(PROVIDERS)) {
  const lines = [];
  for (const name of providerNames) {
    const vars = PROVIDERS[name];
    if (!vars) throw new Error(`unknown provider: ${name}`);
    lines.push(`# ${name}`);
    for (const variable of vars) {
      lines.push(`railway variable set ${variable}=<secret>`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

export function listProviders() {
  return Object.keys(PROVIDERS);
}
