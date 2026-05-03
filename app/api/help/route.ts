import { NextResponse } from "next/server";

// Content moderation helper
function checkContentForBannedTopics(text: string): boolean {
  const bannedTopics = [
    'vägivalts', 'vägivald', 'löö', 'tapa', 'surma', 'marustus',
    'alkohol', 'joob', 'viina', 'õlu', 'purju',
    'narkoot', 'narko', 'uimasti',
    'sigarett', 'tupak', 'tubakas', 'nikotiin',
    'relv', 'revolver', 'pürss', 'nuga', 'granaat', 'pomm',
    'porno', 'porn', 'seksi', 'seks', 'pornograafia',
    'vihkus', 'rass', 'rassism', 'rassistlik',
    'terrorism', 'terroristlik',
    'kuritegu', 'röövimine', 'vargus', 'petsus',
    'lapseporno', 'child porn',
    'solvang', 'sõim', 'insulting',
    'jumal', 'jumala', 'usk', 'ateism',
    'sõda', 'sõjas', 'lahingu', 'invasioon'
  ];

  const lowerText = text.toLowerCase();
  return bannedTopics.some(topic => lowerText.includes(topic));
}

export async function POST(request: Request) {
  const { subject, task, grade, deadline, isTest } = await request.json();


  const prompt = `
You are ÕpiAgent, an AI learning assistant for Estonian students.

TASK: Create educational help content for a student who needs assistance with an assignment.

INPUT DATA:
- Subject: ${subject}
- Task: ${task}
- Current grade in subject: ${grade}/5
- Days until deadline: ${deadline}
- Is this a test preparation: ${isTest ? 'Yes' : 'No'}

REQUIREMENTS:

1. SUMMARY (KONSPEKT):
- Write a clear, beginner-friendly explanation
- Use simple Estonian language
- Explain concepts as if student sees this for the first time
- Keep it concise but comprehensive
- Use bullet points or numbered lists where appropriate

2. CONCLUSION OFFER (KOKKUVÕTE):
- At the end of summary, offer: "Kirjuta oma kokkuvõte siia teemale (valikuline):"
- Include a text area for student input

3. REVIEW QUESTIONS (KORDAMISKÜSIMUSED):
- Create exactly 2-3 questions (no more)
- Questions should test understanding of the key concepts
- Make them thought-provoking but not too difficult

4. TEST (TEST):
- Create a test with exactly 10 open-ended questions
- Each question should require the student to explain their understanding
- Questions should be progressive: start with basic concepts, move to more complex applications
- Include some multiple-choice review questions (2-3) mixed in
- For open-ended questions, provide sample answers that describe KEY ASPECTS to look for, not the exact answer
- Sample answers should focus on evaluation criteria, not reveal the correct answer
- Questions must be specifically about this topic
- Make questions engaging and thought-provoking
- Questions should guide students to think deeper, not just recall facts

5. TIME CALCULATION:
- Calculate recommended study time based on:
  - Grade: lower grade = more time (+5-10 min)
  - Deadline: closer deadline = more time
  - Test vs homework: tests get more time
- Return time in minutes

OUTPUT FORMAT (JSON only):

{
  "summary": "Clear explanation text...",
  "conclusionPrompt": "Kirjuta oma kokkuvõte...",
  "reviewQuestions": [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ],
  "test": [
    {
      "question": "Explain in your own words: What is the main concept here?",
      "type": "open-ended",
      "sampleAnswer": "A good answer should include... (this is for AI evaluation)",
      "points": 5
    },
    {
      "question": "Multiple choice: What is the correct answer?",
      "type": "multiple-choice",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correct": "A",
      "explanation": "Why this is correct...",
      "points": 3
    }
  ],
  "recommendedTime": 25
}

IMPORTANT:
- Respond in ESTONIAN language
- Make content educational and encouraging
- Adapt difficulty based on grade (lower grade = simpler explanations)
- Return ONLY JSON, no additional text
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  const text = data.choices[0].message.content;
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  return NextResponse.json(parsed);
}