import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { answer, sampleAnswer, question } = await request.json();

  const prompt = `You are an Estonian language learning tutor. Evaluate this student's answer carefully.

Question: ${question}
Sample correct answer: ${sampleAnswer}
Student's answer: ${answer}

Rate the answer as CORRECT, PARTIALLY_CORRECT, or INCORRECT.
Provide guiding feedback that helps the student think deeper WITHOUT revealing the complete answer.

IMPORTANT RULES:
1. NEVER say "You forgot X" or "The answer should include Y"
2. NEVER reveal what the correct answer is
3. Instead, guide them with reflective questions like:
   - "Mõtle, kas..." (Think, whether...)
   - "Kuidas seostub see..." (How does this relate to...)
   - "Mis on oluline aspekt, mida võiksid kaaluda?" (What is an important aspect to consider?)
   - "Kellele või millele võiksid tähelepanu pöörata?" (Who or what should you focus on?)
4. If answer is wrong, rephrase the original question slightly to guide them better
5. Keep feedback short (1-2 sentences maximum)
6. Be encouraging but honest

Respond in ESTONIAN in JSON format:
{
  "rating": "CORRECT|PARTIALLY_CORRECT|INCORRECT",
  "feedback": "Guiding feedback here (1-2 sentences, in Estonian, NO hints about the answer)"
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
    // Fallback response in Estonian, guiding
    return NextResponse.json({
      rating: "PARTIALLY_CORRECT",
      feedback: "Hea katsetus! Mõtle, mis on selle küsimuse juures kõige oluline? Milliseid aspekte peaks arvestama?",
      points: 3
    });
  }
}