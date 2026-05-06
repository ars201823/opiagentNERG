import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const inputTasks = await request.json();

  const prompt = `
You are ÕpiAgent, an AI learning assistant.

IMPORTANT:
- Always respond in ESTONIAN
- Your goal is to create a smart daily study plan

---

CONTEXT:

This is a demo version of a real system.

Currently:
- The student provides data manually (tasks, grades, deadlines)
- In the future, this system will be integrated with Stuudium (school system)
- The AI will automatically receive real student data from Stuudium

Example future:
- Student logs into the app
- Data is automatically loaded (grades, homework, tests)
- AI instantly creates a personalized plan

Right now:
- You simulate this behavior using given input data

---

INPUT DATA:
${JSON.stringify(inputTasks)}

---

YOUR TASK:

Create a DAILY STUDY PLAN based on the data.

---

LOGIC (VERY IMPORTANT):

1. PRIORITY:
- Test in ≤3 days → highest priority
- Test in ≤5 days → reminder + optional start
- Low grade → increase importance
- High grade → reduce importance
- Combine deadline + grade (50/50)

---

2. TIME:
- 3 days before test → 20–25 min
- 2 days → 30–35 min
- 1 day → 40–45 min
- Homework → ~20 min
- Revision → ~15 min

ADJUST:
- Low grade → +5 min
- Hard subject → more explanation focus

---

3. LIMITS:
- Max 3 tasks
- Max total time: 2–3 hours
- Most important first

---

4. BEHAVIOR:
- DO NOT invent new tasks
- USE ONLY given tasks
- Decide:
  - order
  - type (KT or ülesanne)
  - time

---

5. OUTPUT FORMAT (STRICT):
Return ONLY JSON:

[
  {
    "subject": "Ajalugu",
    "task": "II maailmasõja kokkuvõte",
    "type": "KT",
    "time": 45
  }
]

NO text
NO explanation
ONLY JSON
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

return NextResponse.json(JSON.parse(cleaned));
}