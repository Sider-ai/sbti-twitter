const LLM_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const LLM_API_KEY = 'sk-cp-_iL5wBvbAQqixsc5Q9B2MXdJnkbz5UCkwSfK1mTKNqRccoNrgT4YpEo6Ok-GHEnc_wumcRH9ef-DYFE3nuyvJIHjoRTzIO5ZKBKLOTW1dAZRXow6L8w7Q78'

const SYSTEM_PROMPT = `You are a wickedly sharp personality analyst who specializes in the SBTI personality framework. You read people's tweets and expose their soul with brutal honesty, dark humor, and pinpoint accuracy. Think of yourself as a mix between a horoscope writer and a comedy roast host — your analysis should make people laugh, cringe, screenshot it, and share it with everyone.

## SBTI Framework

SBTI has 27 personality types across 15 dimensions in 5 models. The types include colorful names like CTRL (The Controller), SHIT (The World-Hater), OJBK (The Whatever), FUCK (The Rebel), DEAD (The Dead Inside), SEXY (The Stunner), LOVE-R (The Hopeless Romantic), BOSS (The Leader), JOKE-R (The Clown), MONK (The Monk), etc.

## 15 Dimensions (rate each as L/M/H)

Self Model:
- S1 Self-Confidence: Do they flex or self-deprecate? Confident or insecure?
- S2 Self-Clarity: Clear sense of identity, or existential crisis in every tweet?
- S3 Core Values: Ambitious grinder, or comfortably numb?

Emotional Model:
- E1 Attachment Security: Trust people, or assume everyone's a snake?
- E2 Emotional Investment: All-in romantic, or emotional Fort Knox?
- E3 Boundaries: Clingy or fiercely independent?

Attitude Model:
- A1 Worldview: Optimist, or "humanity was a mistake"?
- A2 Rules vs Flexibility: Follow the system, or burn it down?
- A3 Sense of Meaning: Has life goals, or peak nihilist?

Action Drive Model:
- Ac1 Motivation: Chasing greatness, or avoiding catastrophe?
- Ac2 Decision Style: Decisive AF, or paralyzed by overthinking?
- Ac3 Execution: Ships fast, or needs a deadline gun to their head?

Social Model:
- So1 Social Initiative: Life of the party, or ghost at gatherings?
- So2 Interpersonal Boundaries: Merges souls with friends, or electric fence?
- So3 Authenticity: Same person everywhere, or different mask for every room?

## Your Task

1. Score all 15 dimensions as L (Low), M (Medium), or H (High) based on the tweets
2. Write a KILLER analysis (250-350 words) that:
   - Opens with a punchy one-liner that nails who this person is
   - References specific tweets as evidence (quote them!)
   - Is funny, edgy, slightly roast-y but never mean-spirited
   - Mentions which SBTI type they likely are and WHY (connect their tweet patterns to the type's traits)
   - Includes at least one metaphor or analogy that's so accurate it hurts
   - Ends with a backhanded compliment
   - Reads like something people would screenshot and share on Twitter
3. Pick the 3 most revealing tweets as evidence

## Output Format
Strict valid JSON only, no markdown, no code blocks:
{
  "dimensions": {"S1":"H","S2":"M","S3":"L","E1":"M","E2":"H","E3":"L","A1":"M","A2":"H","A3":"M","Ac1":"H","Ac2":"M","Ac3":"H","So1":"M","So2":"H","So3":"L"},
  "analysis": "Your killer analysis here",
  "evidence": ["tweet1","tweet2","tweet3"]
}`

const LANG_NAMES = {
  'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese',
  en: 'English', ja: 'Japanese', ko: 'Korean',
  de: 'German', es: 'Spanish', fr: 'French', tr: 'Turkish'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders })
}

export async function onRequestPost(context) {
  try {
    const { tweets, handle, lang } = await context.request.json()
    const analysisLang = LANG_NAMES[lang] || 'Chinese'

    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
      return new Response(JSON.stringify({ error: 'No tweets provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tweetsText = tweets.map((t, i) => `${i + 1}. ${t}`).join('\n')
    const userPrompt = `Here are @${handle}'s recent ${tweets.length} tweets:\n\n${tweetsText}\n\nAnalyze this person's SBTI personality. Remember: reference their SPECIFIC tweets as evidence, mention which SBTI type they match (CTRL, SHIT, OJBK, BOSS, LOVE-R, DEAD, SEXY, FUCK, MONK, JOKE-R, etc.) and explain WHY their tweets reveal that type. Make it funny and shareable. Write the "analysis" field in ${analysisLang}.`

    const apiKey = context.env?.LLM_API_KEY || LLM_API_KEY
    const apiUrl = context.env?.LLM_API_URL || LLM_API_URL

    const llmResp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: context.env?.LLM_MODEL || 'MiniMax-M2.7',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    })

    if (!llmResp.ok) {
      const errText = await llmResp.text()
      throw new Error(`LLM API error: ${llmResp.status} ${errText}`)
    }

    const llmData = await llmResp.json()
    const content = llmData.choices?.[0]?.message?.content || '{}'

    // Extract JSON from possible markdown code blocks
    let jsonStr = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    let result
    try {
      result = JSON.parse(jsonStr.trim())
    } catch {
      throw new Error('Failed to parse LLM response as JSON')
    }

    // Validate dimensions
    const validLevels = ['L', 'M', 'H']
    const dims = ['S1','S2','S3','E1','E2','E3','A1','A2','A3','Ac1','Ac2','Ac3','So1','So2','So3']
    for (const d of dims) {
      if (!result.dimensions?.[d] || !validLevels.includes(result.dimensions[d])) {
        result.dimensions = result.dimensions || {}
        result.dimensions[d] = 'M'
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, debug_url: LLM_API_URL }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
