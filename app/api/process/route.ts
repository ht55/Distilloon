import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

export async function POST(req: NextRequest) {
const { url, apiKey } = await req.json()

if (!apiKey) {
  return NextResponse.json({ error: 'Gemini API key is required' }, { status: 400 })
}

  // Step 1: Video IDを抽出
  const videoId = extractVideoId(url)
  if (!videoId) {
    return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })
  }

  // Step 2: YouTube Data API - get capitions
  let transcript = ''
  try {
    transcript = await getTranscript(videoId)
    console.log('TRANSCRIPT LENGTH:', transcript.length) //デバッグ
    console.log('TRANSCRIPT PREVIEW:', transcript.slice(0, 200)) //デバッグ
  } catch (e: any) {
    console.log('TRANSCRIPT ERROR:', e.message) //デバッグ
    return NextResponse.json({
      error: 'Could not fetch transcript. YouTube may have changed their format. In production, OAuth 2.0 would be used for reliable access.'
    }, { status: 400 })
  }

  // Step 3: Gemini API - streaming summary
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a summarization AI for YouTube videos. Given a transcript, extract the most meaningful and relevant keywords that best represent the VIDEO'S MAIN TOPIC, not minor details.

            Rules for keywords:
            - Focus on the main subject, people, events, and outcomes
            - Avoid overly specific details like breed names unless central to the story
            - Choose keywords a viewer would use to search for this video
            - Keep each keyword short (1-3 words max)
            - Return exactly 8 keywords

            Also write a concise summary in 3-5 sentences.

            Respond ONLY with valid JSON in this exact format, no other text:
            {"keywords": ["word1", "word2", ...], "summary": "..."}

            Transcript:
            ${transcript.slice(0, 8000)}`
          }]
        }],
        generationConfig: { maxOutputTokens: 3000 }
      })
    }
  )

  if (!geminiRes.ok) {
    return NextResponse.json({ error: 'Gemini API error' }, { status: 500 })
  }

  // Streaming response 
  const chunks = await geminiRes.json()
  let raw = ''
  for (const chunk of chunks) {
    raw += chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  // JSON: トランスクリプトから意味のある単語を抽出
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being',
    'have','has','had','do','does','did','will','would','could','should','may','might',
    'shall','can','need','dare','ought','used','that','this','these','those','their',
    'there','they','them','then','than','when','what','which','who','whom','whose',
    'where','why','how','all','both','each','few','more','most','other','some','such',
    'into','onto','from','with','about','against','between','through','during','before',
    'after','above','below','upon','and','but','or','nor','for','yet','so','if','in',
    'on','at','to','of','by','as','it','its','not','no','yes','just','also','very',
    'said','says','say','told','tell','got','get','came','come','went','go','made','make',
    'know','knew','think','thought','see','saw','look','looked','want','wanted','like'])

  const meaningfulWords = transcript
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z]/g, '').toLowerCase())
    .filter(w => w.length > 4 && !stopWords.has(w))
    .reduce((acc: string[], w) => {
      if (!acc.includes(w)) acc.push(w)
      return acc
    }, [])
    .slice(0, 80)

  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    let fixedJson = clean
    if (!clean.endsWith('}')) {
      const lastQuote = clean.lastIndexOf('"')
      fixedJson = clean.slice(0, lastQuote) + '..." }'
    }

    let parsed
    try {
      parsed = JSON.parse(fixedJson)
    } catch {
      const keywordMatch = raw.match(/"keywords":\s*(\[[\s\S]*?\])/)
      const summaryMatch = raw.match(/"summary":\s*"([\s\S]*?)"/)
      parsed = {
        keywords: keywordMatch ? JSON.parse(keywordMatch[1]) : [],
        summary: summaryMatch ? summaryMatch[1] : '',
      }
    }

    return NextResponse.json({
      transcript: transcript.slice(0, 500),
      keywords: parsed.keywords || [],
      summary: parsed.summary || '',
      words: meaningfulWords,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

async function getTranscript(videoId: string): Promise<string> {
  const transcript = await YoutubeTranscript.fetchTranscript(videoId)
  const text = transcript
    .map(item => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text
}