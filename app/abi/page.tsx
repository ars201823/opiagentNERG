"use client";
export const dynamic = "force-dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Suspense } from "react";

interface HelpContent {
  summary: string;
  conclusionPrompt: string;
  reviewQuestions: string[];
  test: Array<{
    question: string;
    type: "open-ended" | "multiple-choice";
    options?: string[];
    correct?: string;
    explanation?: string;
    sampleAnswer?: string;
    points: number;
  }>;
  recommendedTime: number;
}

interface TestResult {
  questionIndex: number;
  answer: string;
  correct: boolean;
  timeSpent: number;
  type: "open-ended" | "multiple-choice";
  points: number;
  feedback?: string;
}

function AbiContent() {
  const params = useSearchParams();
  const subject = params.get("subject");
  const task = params.get("task");
  const grade = params.get("grade");
  const deadline = params.get("deadline");
  const isTest = params.get("isTest") === "true";

  const [helpContent, setHelpContent] = useState<HelpContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [conclusion, setConclusion] = useState("");
  const [showTest, setShowTest] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [helpTimeout, setHelpTimeout] = useState<NodeJS.Timeout | null>(null);
  const [testCompleted, setTestCompleted] = useState(false);
  const [finalFeedback, setFinalFeedback] = useState<string>("");
  const [currentAnswer, setCurrentAnswer] = useState("");

  useEffect(() => {
    if (subject && task && grade && deadline) {
      loadHelp();
    }
  }, [subject, task, grade, deadline, isTest]);

  const loadHelp = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/help", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subject,
          task,
          grade: parseInt(grade!),
          deadline: parseInt(deadline!),
          isTest
        })
      });
      const data = await res.json();
      setHelpContent(data);
    } catch (error) {
      console.error("Error loading help:", error);
    }
    setLoading(false);
  };

  const startTest = () => {
    setShowTest(true);
    setCurrentQuestion(0);
    setAnswers(new Array(helpContent!.test.length).fill(""));
    setTestResults([]);
    setQuestionStartTime(Date.now());
    setShowHelp(false);
    setTestCompleted(false);
    setFinalFeedback("");
    setCurrentAnswer("");
    if (helpTimeout) clearTimeout(helpTimeout);
  };

  const evaluateOpenEndedAnswer = async (answer: string, sampleAnswer: string, question: string) => {
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          answer,
          sampleAnswer,
          question
        })
      });

      const evaluation = await res.json();

      return {
        correct: evaluation.rating === "CORRECT",
        partiallyCorrect: evaluation.rating === "PARTIALLY_CORRECT",
        incorrect: evaluation.rating === "INCORRECT",
        feedback: evaluation.feedback,
        points: evaluation.points || 0
      };
    } catch (error) {
      const similarity = answer.length > 10 ? "PARTIALLY_CORRECT" : "INCORRECT";
      return {
        correct: false,
        partiallyCorrect: similarity === "PARTIALLY_CORRECT",
        incorrect: similarity === "INCORRECT",
        feedback: similarity === "PARTIALLY_CORRECT" ? 
          "Vastus on hea algus, kuid võiks olla täpsem ja põhjalikum." : 
          "Vastus ei vasta õigele vastusele. Vaata näpunäiteid ja proovi uuesti.",
        points: similarity === "PARTIALLY_CORRECT" ? 3 : 0
      };
    }
  };

  const answerQuestion = async (answer: string) => {
    const timeSpent = Date.now() - questionStartTime;
    const question = helpContent!.test[currentQuestion];
    let isCorrect = false;
    let points = 0;
    let feedback = "";

    if (question.type === "multiple-choice") {
      isCorrect = answer === question.correct;
      points = isCorrect ? question.points : 0;
      feedback = isCorrect ? "✅ Õige!" : `❌ Vale. Õige vastus on: ${question.correct}. ${question.explanation}`;
    } else {
      const evaluation = await evaluateOpenEndedAnswer(answer, question.sampleAnswer || "", question.question);
      isCorrect = evaluation.correct;
      points = evaluation.points;
      
      if (evaluation.correct) {
        feedback = "✅ Õige! Vastus on täielikult õige.";
      } else if (evaluation.partiallyCorrect) {
        feedback = `⚠️ Osaliselt õige - ${evaluation.feedback}`;
      } else {
        feedback = `❌ Vale - ${evaluation.feedback}`;
      }
    }

    const result: TestResult = {
      questionIndex: currentQuestion,
      answer: answer,
      correct: isCorrect,
      timeSpent,
      type: question.type,
      points: points,
      feedback
    };

    setTestResults([...testResults, result]);
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);

    if (!isCorrect) {
      const timeout = setTimeout(() => {
        setShowHelp(true);
      }, 5000);
      setHelpTimeout(timeout);
    } else {
      setShowHelp(false);
      if (helpTimeout) clearTimeout(helpTimeout);
    }

    if (currentQuestion < helpContent!.test.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1);
        setQuestionStartTime(Date.now());
        setShowHelp(false);
        setCurrentAnswer("");
        if (helpTimeout) clearTimeout(helpTimeout);
      }, isCorrect ? 2000 : 4000);
    } else {
      setTimeout(() => {
        setTestCompleted(true);
        generateFinalFeedback();
      }, isCorrect ? 2000 : 4000);
    }
  };

  const acceptHelp = () => {
    setShowHelp(false);
    if (helpTimeout) clearTimeout(helpTimeout);
  };

  const generateFinalFeedback = async () => {
    const totalPoints = testResults.reduce((sum, result) => sum + result.points, 0);
    const maxPoints = helpContent!.test.reduce((sum, question) => sum + question.points, 0);
    const percentage = Math.round((totalPoints / maxPoints) * 100);

    const correctCount = testResults.filter(r => r.correct).length;
    const incorrectCount = testResults.length - correctCount;

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const reviewTopics: string[] = [];

    testResults.forEach((result, index) => {
      const question = helpContent!.test[index];
      if (result.correct) {
        strengths.push(`Küsimus ${index + 1}: ${question.question.substring(0, 50)}...`);
      } else {
        weaknesses.push(`Küsimus ${index + 1}: ${question.question.substring(0, 50)}...`);
        reviewTopics.push(question.question);
      }
    });

    const feedback = `
## Testi tulemused

**Punktid:** ${totalPoints}/${maxPoints} (${percentage}%)

### Mis õnnestus hästi:
${strengths.length > 0 ? strengths.map(s => `✅ ${s}`).join('\n') : 'Proovi järgmine kord rohkem pingutada!'}

### Mida võiks üle vaadata:
${weaknesses.length > 0 ? weaknesses.map(w => `❌ ${w}`).join('\n') : 'Suurepärane töö! Kõik küsimused olid õiged.'}

### Soovitused edasiseks:
${reviewTopics.length > 0 ?
  `Vaata üle järgmised teemad:\n${reviewTopics.map(t => `• ${t}`).join('\n')}` :
  'Sa oled valmis! Kõik teemad on hästi omandatud.'}

### Üldine tagasiside:
${percentage >= 80 ? 'Väga hea töö! Sa oled seda teemat hästi omandanud.' :
 percentage >= 60 ? 'Hea algus! Mõned teemad vajavad veel harjutamist.' :
 'Ära heida meelt! Proovi veel kord ja keskendu raskematele teemadele.'}

**Kui vajad lisabi, kliki "Vajad abi?" nuppu!**
    `.trim();

    setFinalFeedback(feedback);
  };

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        <h1>Laen abi...</h1>
      </main>
    );
  }

  if (!helpContent) {
    return (
      <main style={{ padding: 20 }}>
        <h1>Viga abi laadimisel</h1>
        <Link href="/">
          <button>Tagasi</button>
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: 20, backgroundColor: "#F0F8F0", minHeight: "100vh", color: "#000" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", backgroundColor: "white", padding: 30, borderRadius: 15, boxShadow: "0 6px 25px rgba(0,0,0,0.1)", color: "#000" }}>
        <h1 style={{ fontSize: 32, color: "#000", textAlign: "center", marginBottom: 10 }}>📘 Ettevalmistus: {subject}</h1>
        <p style={{ textAlign: "center", color: "#000", marginBottom: 5 }}><strong>Ülesanne:</strong> {task}</p>
        <p style={{ textAlign: "center", color: "#000", marginBottom: 30 }}><strong>Soovitatud aeg:</strong> {helpContent.recommendedTime} minutit</p>

        <div style={{ marginBottom: 40, backgroundColor: "#F0F8F0", padding: 25, borderRadius: 12, border: "2px solid #40E0D0" }}>
          <h2 style={{ fontSize: 26, color: "#000", marginBottom: 20, textAlign: "center" }}>📝 Konspekt</h2>
          <div style={{
            padding: 25,
            backgroundColor: "#FAFFFD",
            borderRadius: 10,
            border: "2px solid #40E0D0",
            lineHeight: 1.7,
            fontSize: 16,
            color: "#000"
          }}>
            {helpContent.summary.split('\n').map((line, i) => (
              <p key={i} style={{ marginBottom: 15 }}>{line}</p>
            ))}
          </div>
        </div>

<div style={{ marginBottom: 40, backgroundColor: "#F0F8F0", padding: 25, borderRadius: 12, border: "2px solid #40E0D0" }}>
          <h2 style={{ fontSize: 24, color: "#000", marginBottom: 20 }}>✍️ {helpContent.conclusionPrompt}</h2>
          <textarea
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            placeholder="Kirjuta siia oma mõtted ja kokkuvõte..."
            style={{
              width: "100%",
              minHeight: 120,
              padding: 20,
              borderRadius: 10,
              border: "2px solid #40E0D0",
              fontSize: 16,
              lineHeight: 1.6,
              backgroundColor: "#FAFFFD",
              color: "#000",
              resize: "vertical"
            }}
          />
        </div>

        <div style={{ marginBottom: 40, backgroundColor: "#F0F8F0", padding: 25, borderRadius: 12, border: "2px solid #40E0D0" }}>
          <h2 style={{ fontSize: 24, color: "#000", marginBottom: 20 }}>❓ Kordamisküsimused (valikuline)</h2>
          {helpContent.reviewQuestions.map((question, i) => (
            <div key={i} style={{ marginBottom: 20, padding: 20, backgroundColor: "#FAFFFD", borderRadius: 10, border: "2px solid #40E0D0" }}>
              <p style={{ fontWeight: "bold", color: "#000", marginBottom: 10 }}><strong>{i + 1}.</strong> {question}</p>
              <textarea
                placeholder="Sinu vastus..."
                style={{
                  width: "100%",
                  minHeight: 80,
                  padding: 15,
                  borderRadius: 8,
                  border: "2px solid #40E0D0",
                  fontSize: 16,
                  lineHeight: 1.5,
                  backgroundColor: "white",
                  color: "#000",
                  resize: "vertical"
              }}
            />
          </div>
        ))}
      </div>

      {!showTest ? (
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <button
            onClick={startTest}
            style={{
              background: "linear-gradient(135deg, #FF9800 0%, #F57C00 100%)",
              color: "white",
              padding: "18px 35px",
              border: "none",
              borderRadius: 15,
              fontSize: 20,
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(255,152,0,0.3)",
              transition: "all 0.3s ease"
            }}
          >
            🚀 Alusta testi (10 küsimust)
          </button>
        </div>
      ) : testCompleted ? (
        <div style={{ marginBottom: 40, backgroundColor: "#F0F8F0", padding: 30, borderRadius: 15, border: "3px solid #40E0D0" }}>
          <h2 style={{ fontSize: 28, color: "#000", textAlign: "center", marginBottom: 20 }}>🎉 Test lõpetatud!</h2>
          <div style={{
            padding: 25,
            backgroundColor: "#FAFFFD",
            borderRadius: 12,
            border: "2px solid #40E0D0",
            whiteSpace: "pre-line",
            lineHeight: 1.7,
            fontSize: 16,
            color: "#000"
          }}>
            {finalFeedback}
          </div>
          <div style={{ textAlign: "center", marginTop: 25 }}>
            <button
              onClick={startTest}
              style={{
                background: "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
                color: "white",
                padding: "15px 30px",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
                marginRight: 15,
                fontSize: 16,
                fontWeight: "bold",
                boxShadow: "0 4px 12px rgba(33,150,243,0.3)"
              }}
            >
              🔄 Proovi uuesti
            </button>
            <Link href="/">
              <button
                style={{
                  background: "linear-gradient(135deg, #6C757D 0%, #495057 100%)",
                  color: "white",
                  padding: "15px 30px",
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: "bold",
                  boxShadow: "0 4px 12px rgba(108,117,125,0.3)"
                }}
              >
                🏠 Tagasi avalehele
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 40, backgroundColor: "#F0F8F0", padding: 25, borderRadius: 12, border: "2px solid #40E0D0" }}>
          <h2 style={{ fontSize: 26, color: "#000", marginBottom: 20, textAlign: "center" }}>🧠 Test ({helpContent.test.length} küsimust)</h2>

          <div style={{
            padding: 25,
            backgroundColor: "#E0F2F1",
            borderRadius: 12,
            border: "2px solid #008B8B",
            position: "relative"
          }}>
            <div style={{
              position: "absolute",
              top: 15,
              right: 15,
              background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
              color: "#000",
              padding: "8px 15px",
              borderRadius: 20,
              fontSize: 16,
              fontWeight: "bold",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}>
              {currentQuestion + 1} / {helpContent.test.length}
            </div>

            <h3 style={{ marginTop: 0, color: "#000", fontSize: 20 }}>Küsimus {currentQuestion + 1}</h3>
            <p style={{ fontSize: 18, marginBottom: 25, fontWeight: "bold", color: "#000", lineHeight: 1.6 }}>
              {helpContent.test[currentQuestion].question}
            </p>

            {helpContent.test[currentQuestion].type === "multiple-choice" ? (
              <div style={{ display: "grid", gap: 15 }}>
                {helpContent.test[currentQuestion].options!.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => answerQuestion(option.charAt(0))}
                    disabled={answers[currentQuestion] !== ""}
                    style={{
                      padding: 18,
                      borderRadius: 12,
                      border: "3px solid #40E0D0",
                      background: answers[currentQuestion] === option.charAt(0) ?
                        (answers[currentQuestion] === helpContent.test[currentQuestion].correct ? "#4CAF50" : "#DC3545") :
                        "#FAFFFD",
                      color: answers[currentQuestion] === option.charAt(0) ? "white" : "#006400",
                      cursor: answers[currentQuestion] === "" ? "pointer" : "default",
                      textAlign: "left",
                      fontSize: 16,
                      fontWeight: "bold",
                      transition: "all 0.3s ease",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Kirjuta siia oma vastus... Selgita oma mõtteid ja põhjenda oma seisukohta."
                  style={{
                    width: "100%",
                    minHeight: 140,
                    padding: 20,
                    borderRadius: 12,
                    border: "3px solid #40E0D0",
                    fontSize: 16,
                    lineHeight: 1.6,
                    marginBottom: 20,
                    backgroundColor: "#FAFFFD",
                    color: "#000",
                    resize: "vertical"
                  }}
                  disabled={answers[currentQuestion] !== ""}
                />
                <button
                  onClick={() => answerQuestion(currentAnswer)}
                  disabled={currentAnswer.trim() === "" || answers[currentQuestion] !== ""}
                  style={{
                    background: "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
                    color: "white",
                    padding: "15px 30px",
                    border: "none",
                    borderRadius: 12,
                    cursor: currentAnswer.trim() !== "" && answers[currentQuestion] === "" ? "pointer" : "not-allowed",
                    fontSize: 16,
                    fontWeight: "bold",
                    boxShadow: "0 4px 12px rgba(33,150,243,0.3)",
                    transition: "all 0.3s ease"
                  }}
                >
                  Esita vastus
                </button>
              </div>
            )}

            {testResults[currentQuestion] && (
              <div style={{
                marginTop: 25,
                padding: 20,
                backgroundColor: testResults[currentQuestion].correct ? "#E8F5E8" : "#FFEBEE",
                borderRadius: 12,
                border: `3px solid ${testResults[currentQuestion].correct ? "#4CAF50" : "#DC3545"}`,
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}>
                <p style={{
                  fontWeight: "bold",
                  color: testResults[currentQuestion].correct ? "#2E7D32" : "#C62828",
                  fontSize: 18,
                  marginBottom: 10
                }}>
                  {testResults[currentQuestion].correct ? "✅ Õige!" : "❌ Vajab täiendamist"}
                </p>
                <p style={{ color: "#000", lineHeight: 1.6, fontSize: 16 }}>{testResults[currentQuestion].feedback}</p>
                <p style={{ fontSize: 14, color: "#000", marginTop: 10 }}>
                  Punktid: {testResults[currentQuestion].points} / {helpContent.test[currentQuestion].points}
                </p>
              </div>
            )}

            {showHelp && (
              <div style={{
                marginTop: 25,
                padding: 20,
                backgroundColor: "#E3F2FD",
                borderRadius: 12,
                border: "3px solid #2196F3",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}>
                <p style={{ fontWeight: "bold", color: "#000", fontSize: 18, marginBottom: 10 }}>💡 Vajad abi?</p>
                <p style={{ color: "#000", marginBottom: 15 }}>Siin on mõned näpunäited, mis aitavad sul vastata:</p>
                <p style={{ fontSize: 15, color: "#000", lineHeight: 1.6, fontStyle: "italic" }}>
                  {helpContent.test[currentQuestion].sampleAnswer}
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 15 }}>
                  <button
                    onClick={acceptHelp}
                    style={{
                      background: "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
                      color: "white",
                      padding: "12px 20px",
                      border: "none",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontSize: 16,
                      fontWeight: "bold",
                      boxShadow: "0 4px 12px rgba(33,150,243,0.3)"
                    }}
                  >
                    Aitäh, proovin ise
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 40 }}>
        <Link href="/">
          <button style={{
            background: "linear-gradient(135deg, #6C757D 0%, #495057 100%)",
            color: "white",
            padding: "15px 30px",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: "bold",
            boxShadow: "0 4px 12px rgba(108,117,125,0.3)"
          }}>
            🏠 Tagasi avalehele
          </button>
        </Link>
      </div>
      </div>
    </main>
  );
}
export default function Abi() {
  return (
    <Suspense fallback={<div>Laeb...</div>}>
      <AbiContent />
    </Suspense>
  );
}