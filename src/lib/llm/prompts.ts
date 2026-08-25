const SYSTEM = 'Sei un assistente che analizza conversazioni di gruppi Telegram. Rispondi in italiano, in markdown, conciso e concreto. Cita i nomi degli autori quando rilevante.'

export function buildDigestPrompt(args: { groupTitle: string; formatted: string; profile: string }) {
  const profilePart = args.profile
    ? `\nSegnala in una sezione a parte le cose rilevanti per questo profilo: ${args.profile}`
    : ''
  return {
    system: SYSTEM,
    user: `Riassumi la conversazione del gruppo "${args.groupTitle}". Evidenzia: thread principali, decisioni, link e risorse condivise.${profilePart}\n\nMessaggi:\n${args.formatted}`,
  }
}

export function buildQuestionPrompt(args: { formatted: string; question: string; profile: string; truncated: boolean }) {
  const profilePart = args.profile ? `\nProfilo di chi chiede: ${args.profile}` : ''
  const truncPart = args.truncated
    ? '\nNota: i messaggi più vecchi del periodo sono stati troncati per limiti di contesto; dillo nella risposta.'
    : ''
  return {
    system: SYSTEM,
    user: `Rispondi alla domanda basandoti solo sui messaggi qui sotto.${profilePart}${truncPart}\n\nDomanda: ${args.question}\n\nMessaggi:\n${args.formatted}`,
  }
}
