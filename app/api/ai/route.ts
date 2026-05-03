import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

type InputTask = {
  subject: string;
  task: string;
  deadline: number;
  grade: number;
};

function extractJsonArray(text: string): string {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("JSON array not found in model response");
  }

  return cleaned.slice(start, end + 1);
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "app", "abi", "data.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const inputTasks: InputTask[] = JSON.parse(raw);

    const prompt = `
Sa oled ÕpiAgent, õppimise abiline.

TÄHTIS:
- Vasta ainult kehtiva JSON-massiivina
- Ära lisa ühtegi seletust, pealkirja ega lisateksti
- Kasuta KÕIKI sisestatud ülesandeid täpselt üks kord
- Ära jäta ühtegi ülesannet välja
- Sorteeri prioriteedi järgi:
  1) väiksem deadline enne
  2) madalam hinne enne
- Ära piira ennast 3 ülesandega
- Ülesanded võivad olla kas "KT" või "koduülesanne"
- Aja hindamine:
  - KT: 30–45 min
  - koduülesanne: 15–25 min

SISENDANDMED:
${JSON.stringify(inputTasks)}

TAGASTA AINULT SELLISE KUJUGA JSON:
[
  {
    "subject": "Matemaatika",
    "task": "Lahenda võrrandid",
    "type": "KT",
    "time": 40
  },
  {
    "subject": "Bioloogia",
    "task": "Õpi fotosüntees",
    "type": "koduülesanne",
    "time": 20
  }
]
`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Sa pead vastama ainult kehtiva JSON-massiivina. Mitte ühtegi muud teksti.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("OpenAI error:", data);
      return NextResponse.json(
        { error: "OpenAI päring ebaõnnestus." },
        { status: 500 }
      );
    }

    const text = data.choices?.[0]?.message?.content ?? "[]";
    const jsonText = extractJsonArray(text);
    const parsed = JSON.parse(jsonText);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "AI plaani laadimine ebaõnnestus." },
      { status: 500 }
    );
  }
}