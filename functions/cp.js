/**
 * Dynamic Twitter Card / OG meta tags for shared SBTI results
 * When Twitter/social crawlers visit /cp?a=...&t=TYPE&h=handle,
 * they get proper og:image, og:title, og:description meta tags.
 * Regular users get redirected to the main page with the same params.
 */

const TYPE_NAMES = {
  CTRL: "The Controller", "ATM-er": "The Money Giver", "Dior-s": "The Loser",
  BOSS: "The Leader", "THAN-K": "The Grateful", "OH-NO": "The Oh-No",
  GOGO: "The Doer", SEXY: "The Stunner", "LOVE-R": "The Hopeless Romantic",
  MUM: "The Mom", FAKE: "The Fake", OJBK: "The Whatever",
  MALO: "The Monke", "JOKE-R": "The Clown", "WOC!": "The WTF-er",
  "THIN-K": "The Thinker", SHIT: "The World-Hater", ZZZZ: "The Playing Dead",
  POOR: "The Poor One", MONK: "The Monk", IMSB: "The Fool",
  SOLO: "The Orphan", FUCK: "The F-er", DEAD: "The Dead One",
  IMFW: "The Waste", HHHH: "The LOL-er", DRUNK: "The Drunk"
}

const TYPE_IMAGES_MAP = {
  CTRL: "CTRL.png", "ATM-er": "ATM-er.png", "Dior-s": "Dior-s.jpg",
  BOSS: "BOSS.png", "THAN-K": "THAN-K.png", "OH-NO": "OH-NO.png",
  GOGO: "GOGO.png", SEXY: "SEXY.png", "LOVE-R": "LOVE-R.png",
  MUM: "MUM.png", FAKE: "FAKE.png", OJBK: "OJBK.png",
  MALO: "MALO.png", "JOKE-R": "JOKE-R.jpg", "WOC!": "WOC.png",
  "THIN-K": "THIN-K.png", SHIT: "SHIT.png", ZZZZ: "ZZZZ.png",
  POOR: "POOR.png", MONK: "MONK.png", IMSB: "IMSB.png",
  SOLO: "SOLO.png", FUCK: "FUCK.png", DEAD: "DEAD.png",
  IMFW: "IMFW.png", HHHH: "HHHH.png", DRUNK: "DRUNK.png"
}

const SOCIAL_CRAWLERS = [
  'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot',
  'discordbot', 'telegrambot', 'whatsapp', 'googlebot', 'bingbot'
]

export async function onRequest(context) {
  const url = new URL(context.request.url)
  const typeCode = url.searchParams.get('t') || ''
  const handle = url.searchParams.get('h') || ''
  const dna = url.searchParams.get('a') || ''

  const ua = (context.request.headers.get('user-agent') || '').toLowerCase()
  const isCrawler = SOCIAL_CRAWLERS.some(bot => ua.includes(bot))

  // For regular users, serve the main index.html with query params preserved
  if (!isCrawler) {
    // Rewrite to index.html but keep the query params
    const indexUrl = new URL('/', url.origin)
    indexUrl.search = url.search
    // Add cp=1 flag so the frontend knows this is a comparison link
    indexUrl.searchParams.set('cp', '1')
    const resp = await context.env.ASSETS.fetch(new Request(indexUrl.toString(), context.request))
    return new Response(resp.body, {
      status: resp.status,
      headers: resp.headers
    })
  }

  // For crawlers, return rich meta tags
  const typeName = TYPE_NAMES[typeCode] || typeCode
  const imageFile = TYPE_IMAGES_MAP[typeCode] || 'CTRL.png'
  const siteUrl = url.origin
  const imageUrl = `${siteUrl}/image/${imageFile}`
  const pageUrl = `${siteUrl}/cp?a=${dna}&t=${encodeURIComponent(typeCode)}&h=${encodeURIComponent(handle)}`

  const title = handle
    ? `@${handle} is ${typeCode} (${typeName}) | SBTI x Twitter`
    : `${typeCode} (${typeName}) | SBTI Personality Test`

  const description = handle
    ? `AI read @${handle}'s tweets and exposed their soul: ${typeCode} — ${typeName}. 15 dimensions, 27 types. What's YOUR SBTI type?`
    : `SBTI AI Personality Test — 20 tweets is all it takes to see through your soul. 15 dimensions, 27 types. Try it free.`

  // Use summary card (not large_image) since our type images are small
  // This gives a cleaner look with the square image on the left
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:image" content="${escapeAttr(imageUrl)}" />
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SBTI x Twitter — AI Personality Test" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(imageUrl)}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <a href="${escapeAttr(pageUrl)}">Take the test</a>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
