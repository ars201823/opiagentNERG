import { NextResponse } from "next/server";

export async function GET() {
  const inputTasks = [
  { subject: "Matemaatika", task: "Lahenda 10 võrrandit", deadline: 5, grade: 4 },
  { subject: "Ajalugu", task: "II maailmasõja kokkuvõte", deadline: 2, grade: 3 },
  { subject: "Keemia", task: "Õpi perioodilisustabel", deadline: 4, grade: 5 }
];
  const prompt = `
Sul on õpilase andmed:
${JSON.stringify(inputTasks)}

TEE päevaplaan AINULT nende andmete põhjal.

ÄRA mõtle uusi ülesandeid välja.

Reeglid:
- KT lähedal (≤3 päeva) = esimene
- madal hinne = rohkem aega
- max 3 ülesannet
- kasuta olemasolevaid subject ja task väärtusi

VASTA ainult JSON-ina:
[
  { "subject": "...", "task": "...", "type": "KT või ülesanne", "time": 45 }
]
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();

  return NextResponse.json({
    text: data.choices[0].message.content,
  });
}