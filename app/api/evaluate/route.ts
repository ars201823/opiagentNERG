import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { answer, sampleAnswer, question } = await request.json();

  const prompt = `Evaluate this student's answer. Be flexible and understanding.

Question: ${question}
Sample correct answer: ${sampleAnswer}
Student's answer: ${answer}

Rate the answer as CORRECT, PARTIALLY_CORRECT, or INCORRECT.
Provide clear feedback that explains what's good about the answer and what could be improved.

Respond in JSON format:
{
  "rating": "CORRECT|PARTIALLY_CORRECT|INCORRECT",
  "feedback": "Detailed feedback here (2-3 sentences)"
}`;

  try {
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

    return NextResponse.json({
      rating: parsed.rating,
      feedback: parsed.feedback,
      points: parsed.rating === "CORRECT" ? 5 : parsed.rating === "PARTIALLY_CORRECT" ? 3 : 0
    });
  } catch (error) {
    // Fallback response
    return NextResponse.json({
      rating: "PARTIALLY_CORRECT",
      feedback: "Vastus on hea algus! Mõned detailid võiksid olla täpsemad või põhjalikumad. Proovi lisada rohkem seletusi.",
      points: 3
    });
  }
}