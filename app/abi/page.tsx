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
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [canProceed, setCanProceed] = useState(false);
  const [showHelpOverlay, setShowHelpOverlay] = useState(false);
  const [wantsHelp, setWantsHelp] = useState(true);
  const [showHelpPrompt, setShowHelpPrompt] = useState(false);

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
      // Näita videot vähemalt 2 sekundit
      await new Promise(resolve => setTimeout(resolve, 2000));
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
    setShowHelpOverlay(false);
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
    // Validate Estonian language for open-ended questions
    if (helpContent!.test[currentQuestion].type === "open-ended") {
      if (!isEstonianText(answer)) {
        setFeedbackMessage("⚠️ Palun kirjuta vastus Eesti keeles!");
        setShowFeedback(true);
        return;
      }
    }

    const timeSpent = Date.now() - questionStartTime;
    const question = helpContent!.test[currentQuestion];
    let isCorrect = false;
    let points = 0;
    let feedback = "";

    if (question.type === "multiple-choice") {
      isCorrect = answer === question.correct;
      points = isCorrect ? question.points : 0;
      if (isCorrect) {
        feedback = "✅ Suurepärane! Sa oled õigel teel.";
      } else {
        feedback = `Proovi uuesti mõelda. Kuidas seostub see teema põhikontseptsioonidega? Milliseid aspekte võiksid kaaluda?`;
      }
    } else {
      const evaluation = await evaluateOpenEndedAnswer(answer, question.sampleAnswer || "", question.question);
      isCorrect = evaluation.correct;
      points = evaluation.points;
      
      if (evaluation.correct) {
        feedback = "✅ Suurepärane! Vastus on täielikult õige.";
      } else if (evaluation.partiallyCorrect) {
        feedback = `Hea algus! ${evaluation.feedback}`;
      } else {
        feedback = `Proovi uuesti. ${evaluation.feedback}`;
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

    const newResults = [...testResults];
    newResults[currentQuestion] = result;
    setTestResults(newResults);

    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);

    // Show feedback and wait for user to click "Liigume edasi"
    setFeedbackMessage(feedback);
    setShowFeedback(true);
    setCanProceed(true);

    if (!isCorrect) {
      if (wantsHelp) {
        setShowHelpPrompt(true);
      }
    } else {
      setShowHelp(false);
      setShowHelpOverlay(false);
      setShowHelpPrompt(false);
      if (helpTimeout) clearTimeout(helpTimeout);
    }
  };

  const acceptHelp = () => {
    setShowHelp(false);
    setShowHelpOverlay(false);
    if (helpTimeout) clearTimeout(helpTimeout);
  };

  // Estonian language validation
  const isEstonianText = (text: string): boolean => {
    const estonianPattern = /[äöüõÄÖÜÕ]/;
    const latinPattern = /[a-zA-Z]/;
    const commonEstonianWords = ['ja', 'et', 'on', 'ta', 'see', 'kus', 'mis', 'kui', 'siis', 'nagu', 'pole', 'ei', 'jah', 'teeb', 'saab', 'olema', 'tuleb', 'või', 'õpi', 'kuidas', 'miks', 'kes', 'kelle', 'mida', 'kuhu'];

    const hasEstonianChars = estonianPattern.test(text);
    const hasLatinChars = latinPattern.test(text);
    if (!hasLatinChars) return false;

    const words = text.toLowerCase().split(/\s+/).map(w => w.replace(/[.,!?;:()\[\]"']/g, ''));
    const estonianWordCount = words.filter(w => commonEstonianWords.includes(w)).length;

    return hasEstonianChars || estonianWordCount >= 2 || text.length < 35;
  };

  // Content moderation
  const checkContentModeration = (text: string): { allowed: boolean; reason?: string } => {
    const bannedPatterns = [
      '\\bvägivald\\b', '\\btapa\\b', '\\bsurma\\b', '\\balkohol\\b', '\\bjoob\\b', '\\bnarkoot\\b', '\\bnarko\\b', '\\buimasti\\b',
      '\\bsigarett\\b', '\\btubakas\\b', '\\bnikotiin\\b', '\\brelw\\b', '\\bnuga\\b', '\\bpomm\\b',
      '\\bporno\\b', '\\bseksi\\b', '\\bseks\\b', '\\bterrorism\\b', '\\bkuritegu\\b', '\\brööv\\b', '\\bvargus\\b', '\\blapseporno\\b',
      '\\brennen\\b', '\\brass\\b', '\\brassism\\b', '\\bvihk\\b', '\\busk\\b', '\\bjumal\\b', '\\bsõda\\b', '\\blahing\\b'
    ];

    const lowerText = text.toLowerCase();
    for (const pattern of bannedPatterns) {
      if (new RegExp(pattern, 'i').test(lowerText)) {
        return {
          allowed: false,
          reason: '❌ See teema ei sobi koolitööks. Palun vali kooliteema, näiteks matemaatika, ajalugu, keemia või eesti keel.'
        };
      }
    }

    return { allowed: true };
  };

  const moveToNextQuestion = () => {
    setShowFeedback(false);
    setCanProceed(false);
    setFeedbackMessage("");
    
    if (currentQuestion < helpContent!.test.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setQuestionStartTime(Date.now());
      setShowHelp(false);
      setShowHelpOverlay(false);
      setShowHelpPrompt(false);
      setCurrentAnswer("");
      if (helpTimeout) clearTimeout(helpTimeout);
    } else {
      setTestCompleted(true);
      generateFinalFeedback();
    }
  };

  const generateFinalFeedback = async () => {
    const totalPoints = testResults.reduce((sum, result) => sum + (result?.points || 0), 0);
    const maxPoints = helpContent!.test.reduce((sum, question) => sum + question.points, 0);
    const percentage = Math.round((totalPoints / maxPoints) * 100);

    const correctCount = testResults.filter(r => r?.correct).length;
    const incorrectCount = testResults.length - correctCount;

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const reviewTopics: string[] = [];

    testResults.forEach((result, index) => {
      if (!result) return;
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
      <main style={{ 
        padding: 30, 
        minHeight: "100vh", 
        color: "#fff", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        flexDirection: "column",
        gap: 18,
        background: "radial-gradient(circle at top, #E5F7FF 0%, #D7EEFF 45%, #B7DDF8 100%)"
      }}>
        <div style={{ width: "100%", maxWidth: 1080, borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.18)", backgroundColor: "#fff", border: "1px solid rgba(0,0,0,0.08)" }}>
          <video
            autoPlay
            muted
            playsInline
            loop
            style={{
              width: "100%",
              height: "90vh",
              display: "block",
              objectFit: "cover"
            }}
          >
            <source src="/videos/grok-video-7fb95891-d1b2-48f5-b6fd-abf5e25e533f.mp4" type="video/mp4" />
          </video>
        </div>
        <p style={{ margin: 0, color: "#0d3679", fontSize: 24, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>Laen abi...</p>
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
            <div style={{ marginBottom: 25, padding: 20, borderRadius: 12, backgroundColor: "#F0F8F0", border: "2px solid #40E0D0" }}>
              <p style={{ margin: "0 0 15px 0", color: "#000", fontSize: 18, fontWeight: 600 }}>Kas soovid testi ajal abiakent kasutada?</p>
              <div style={{ display: "flex", gap: 15, justifyContent: "center" }}>
                <button
                  onClick={() => setWantsHelp(true)}
                  style={{
                    padding: "12px 24px",
                    background: wantsHelp ? "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)" : "#E0E0E0",
                    color: wantsHelp ? "white" : "#000",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: "bold",
                    boxShadow: wantsHelp ? "0 4px 12px rgba(76,175,80,0.3)" : "none"
                  }}
                >
                  ✅ Jah, aitab
                </button>
                <button
                  onClick={() => setWantsHelp(false)}
                  style={{
                    padding: "12px 24px",
                    background: !wantsHelp ? "linear-gradient(135deg, #DC3545 0%, #C82333 100%)" : "#E0E0E0",
                    color: !wantsHelp ? "white" : "#000",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: "bold",
                    boxShadow: !wantsHelp ? "0 4px 12px rgba(220,53,69,0.3)" : "none"
                  }}
                >
                  ❌ Ei, ise
                </button>
              </div>
            </div>
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
              🚀 Alusta testi ({helpContent.test.length} küsimust)
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

              {/* TESTI VASTUSE TAGASISIDE KAST */}
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

                  {/* KEELE- JA SISU KONTROLLI TAGASISIDE KUI VASTUS ON VALE JA TAHAB ABI */}
                  {!testResults[currentQuestion].correct && wantsHelp && (
                    <button
                      onClick={() => setShowHelpOverlay(true)}
                      style={{
                        marginTop: 15,
                        background: "linear-gradient(135deg, #FF9800 0%, #F57C00 100%)",
                        color: "white",
                        padding: "12px 24px",
                        border: "none",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 16,
                        fontWeight: "bold",
                        boxShadow: "0 4px 12px rgba(255,152,0,0.3)",
                        display: "block",
                        marginLeft: "auto",
                        marginRight: "auto"
                      }}
                    >
                      🔑 Abiaken
                    </button>
                  )}
                  
                  {canProceed && (
                    <button
                      onClick={moveToNextQuestion}
                      style={{
                        marginTop: 20,
                        background: "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)",
                        color: "white",
                        padding: "15px 30px",
                        border: "none",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 18,
                        fontWeight: "bold",
                        boxShadow: "0 6px 16px rgba(76,175,80,0.4)",
                        width: "100%",
                        transition: "all 0.3s ease",
                        textAlign: "center"
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.background = "linear-gradient(135deg, #45a049 0%, #3d8b40 100%)";
                        (e.target as HTMLButtonElement).style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.background = "linear-gradient(135deg, #4CAF50 0%, #45a049 100%)";
                        (e.target as HTMLButtonElement).style.transform = "translateY(0)";
                      }}
                    >
                      ➡️ Liigume edasi →
                    </button>
                  )}
                </div>
              )}

              {/* HOIATUSED (EESTI KEELE KONTROLL JNE), ENNE KUI TULEMUS SALVESTATAKSE */}
              {showFeedback && !testResults[currentQuestion] && (
                <div style={{
                  marginTop: 25,
                  padding: 20,
                  backgroundColor: "#FFEBEE",
                  borderRadius: 12,
                  border: "3px solid #DC3545",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                }}>
                  <p style={{
                    fontWeight: "bold",
                    color: "#C62828",
                    fontSize: 16,
                    marginBottom: 10
                  }}>
                    ⚠️ Hoiatus:
                  </p>
                  <p style={{ color: "#000", lineHeight: 1.6, fontSize: 16 }}>{feedbackMessage}</p>
                </div>
              )}

              {/* ABIAKEN OVERLAY */}
              {showHelpOverlay && (
                <div style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 9999,
                  backgroundColor: "rgba(0, 0, 0, 0.92)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 20
                }}>
                  <div style={{
                    width: "100%",
                    maxWidth: 1000,
                    maxHeight: "95vh",
                    overflowY: "auto",
                    borderRadius: 24,
                    backgroundColor: "#fff",
                    boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
                    position: "relative"
                  }}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 24,
                      borderBottom: "1px solid #E0E0E0"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <span style={{ fontSize: 42 }}>🦆</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#111" }}>Abiaken</p>
                          <p style={{ margin: 4, color: "#555", fontSize: 15 }}>Siin näed abi ja võid seejärel edasi liikuda.</p>
                        </div>
                      </div>
                      <button
                        onClick={acceptHelp}
                        style={{
                          background: "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
                          color: "white",
                          padding: "12px 22px",
                          border: "none",
                          borderRadius: 12,
                          cursor: "pointer",
                          fontSize: 16,
                          fontWeight: "bold",
                          boxShadow: "0 4px 12px rgba(33,150,243,0.25)"
                        }}
                      >
                        Sulge abi
                      </button>
                    </div>

                    <div style={{ padding: 24, display: "grid", gap: 24 }}>
                      <div style={{ borderRadius: 18, overflow: "hidden", backgroundColor: "#000" }}>
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          style={{ width: "100%", display: "block" }}
                        >
                          <source src="/videos/grok-video-6d7961a6-907d-47a7-bc67-6bf9b12c8494.mp4" type="video/mp4" />
                        </video>
                      </div>

                      <div style={{ padding: 22, borderRadius: 18, backgroundColor: "#F5F9FF", border: "1px solid #D3E3FF" }}>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 14 }}>💡 Mõtle nii:</p>
                        <p style={{ margin: 0, lineHeight: 1.8, color: "#222", fontSize: 16 }}>
                          {helpContent.test[currentQuestion].sampleAnswer || helpContent.test[currentQuestion].explanation || "Vaata konspekti ja mõtle põhipunktidele."}
                        </p>
                        <p style={{ marginTop: 16, color: "#555", fontSize: 14 }}>
                          See abi on mõeldud mõtteviisi avamiseks, mitte otse lahenduse andmiseks.
                        </p>
                      </div>
                    </div>
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
    <Suspense fallback={null}>
      <AbiContent />
    </Suspense>
  );
}