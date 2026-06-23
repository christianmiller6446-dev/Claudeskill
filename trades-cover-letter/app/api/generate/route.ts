import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { trade, experience, skills, jobTitle, companyName, yourName } = await req.json()

  if (!trade || !experience || !yourName) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const prompt = `Write a professional, confident cover letter for a skilled trades worker with these details:
- Name: ${yourName}
- Trade: ${trade}
- Experience Level: ${experience}
- Key Skills / Certifications: ${skills || 'not specified'}
- Applying for: ${jobTitle || trade + ' position'}
- Company: ${companyName || 'the company'}

Write in a direct, no-nonsense tone that sounds like a real tradesperson — confident, hardworking, and reliable. Avoid corporate buzzwords. Keep it to 3 short paragraphs. Use a proper letter format with date, greeting, body, and sign-off. Sign off with the applicant's name.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const letter = (message.content[0] as { type: string; text: string }).text
    return NextResponse.json({ letter })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to generate letter. Please try again.' }, { status: 500 })
  }
}
