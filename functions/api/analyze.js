const LLM_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2'
const LLM_API_KEY = 'sk-cp-_iL5wBvbAQqixsc5Q9B2MXdJnkbz5UCkwSfK1mTKNqRccoNrgT4YpEo6Ok-GHEnc_wumcRH9ef-DYFE3nuyvJIHjoRTzIO5ZKBKLOTW1dAZRXow6L8w7Q78'

const SYSTEM_PROMPT = `你是一位毒舌但精准的人格分析师。根据用户提供的推文，分析此人在SBTI框架15个维度上的表现。

## 维度说明
【自我模型】
- S1 自尊自信：推文中是否表现出自信？还是自嘲/自贬？
- S2 自我清晰度：是否有明确的自我认知？还是迷茫困惑？
- S3 核心价值：是追求成长进步？还是佛系安逸？

【情感模型】
- E1 依恋安全感：是否信任他人？还是猜疑焦虑？
- E2 情感投入度：感情上是全身心投入还是保持距离？
- E3 边界与依赖：是渴望亲密还是强调独立空间？

【态度模型】
- A1 世界观倾向：乐观信人？还是愤世嫉俗？
- A2 规则与灵活度：守规矩？还是叛逆自由？
- A3 人生意义感：有目标有方向？还是虚无摆烂？

【行动驱力模型】
- Ac1 动机导向：追求成果？还是回避风险？
- Ac2 决策风格：果断拍板？还是犹豫不决？
- Ac3 执行模式：立即行动？还是拖延到死线？

【社交模型】
- So1 社交主动性：主动社交？还是被动内向？
- So2 人际边界感：喜欢亲近融合？还是保持距离？
- So3 表达与真实度：直接真实？还是场景切换、善于伪装？

## 评分说明
L = 该维度表现偏低
M = 该维度表现中等
H = 该维度表现偏高

## 输出要求
严格输出合法JSON，不要输出其他内容：
{
  "dimensions": {"S1":"H","S2":"M","S3":"L","E1":"M","E2":"H","E3":"L","A1":"M","A2":"H","A3":"M","Ac1":"H","Ac2":"M","Ac3":"H","So1":"M","So2":"H","So3":"L"},
  "analysis": "一段200字左右的个性化分析，要有趣、毒舌但不冒犯，要引用具体推文内容作为证据",
  "evidence": ["最能体现人格的推文1","推文2","推文3"]
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
    const userPrompt = `以下是 @${handle} 的最近 ${tweets.length} 条推文：\n\n${tweetsText}\n\n请分析此人的SBTI人格。Write the "analysis" field in ${analysisLang}.`

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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
