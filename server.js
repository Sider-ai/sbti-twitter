/**
 * Local dev server for testing SBTI Twitter analysis
 * Run: node server.js
 * Then open http://localhost:3456
 */
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import the analyze worker logic
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
  "evidence": ["最能体现人格的推文1","推文2","推文3"]
}`

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
}

const PORT = 3456

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // API endpoint
  if (req.url === '/api/analyze' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const { tweets, handle, lang } = JSON.parse(body)
        const LANG_NAMES = { 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese', en: 'English', ja: 'Japanese', ko: 'Korean', de: 'German', es: 'Spanish', fr: 'French', tr: 'Turkish' }
        const analysisLang = LANG_NAMES[lang] || 'Chinese'

        if (!tweets?.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No tweets provided' }))
          return
        }

        const tweetsText = tweets.map((t, i) => `${i + 1}. ${t}`).join('\n')
        const userPrompt = `Here are @${handle}'s recent ${tweets.length} tweets:\n\n${tweetsText}\n\nAnalyze this person's SBTI personality. Remember: reference their SPECIFIC tweets as evidence, mention which SBTI type they match (CTRL, SHIT, OJBK, BOSS, LOVE-R, DEAD, SEXY, FUCK, MONK, JOKE-R, etc.) and explain WHY their tweets reveal that type. Make it funny and shareable. Write the "analysis" field in ${analysisLang}.`

        console.log(`[API] Analyzing @${handle} (${tweets.length} tweets)...`)

        const llmResp = await fetch(LLM_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'MiniMax-M2.7',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
          }),
        })

        if (!llmResp.ok) {
          const errText = await llmResp.text()
          console.error(`[API] LLM error: ${llmResp.status}`, errText)
          throw new Error(`LLM API error: ${llmResp.status}`)
        }

        const llmData = await llmResp.json()
        const content = llmData.choices?.[0]?.message?.content || '{}'
        console.log(`[API] LLM response received`)

        // Try to extract JSON from response (handle markdown code blocks)
        let jsonStr = content
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) jsonStr = jsonMatch[1]

        let result
        try {
          result = JSON.parse(jsonStr.trim())
        } catch {
          console.error('[API] Failed to parse LLM JSON:', content)
          throw new Error('Failed to parse LLM response')
        }

        // Validate
        const validLevels = ['L', 'M', 'H']
        const dims = ['S1','S2','S3','E1','E2','E3','A1','A2','A3','Ac1','Ac2','Ac3','So1','So2','So3']
        for (const d of dims) {
          if (!result.dimensions?.[d] || !validLevels.includes(result.dimensions[d])) {
            result.dimensions = result.dimensions || {}
            result.dimensions[d] = 'M'
          }
        }

        console.log(`[API] Analysis complete: ${JSON.stringify(result.dimensions)}`)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      } catch (err) {
        console.error('[API] Error:', err.message)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // Static file serving
  let filePath = req.url.split('?')[0]
  if (filePath === '/') filePath = '/index.html'

  const fullPath = join(__dirname, filePath)
  if (!existsSync(fullPath)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const ext = extname(fullPath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  try {
    const data = readFileSync(fullPath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  } catch {
    res.writeHead(500)
    res.end('Server error')
  }
})

server.listen(PORT, () => {
  console.log(`\n  SBTI Twitter Analysis - Dev Server`)
  console.log(`  -----------------------------------`)
  console.log(`  http://localhost:${PORT}`)
  console.log(`  API: http://localhost:${PORT}/api/analyze`)
  console.log(`\n  Note: For extension bridge to work,`)
  console.log(`  the page needs to be on a *.sider.ai domain.`)
  console.log(`  For local testing, the fallback analysis will be used`)
  console.log(`  unless the extension is loaded in dev mode.\n`)
})
