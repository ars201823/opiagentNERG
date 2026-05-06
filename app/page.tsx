"use client";
import { useState } from "react";
import Link from "next/link";

interface TaskInput {
  subject: string;
  task: string;
  deadline: number;
  grade: number;
}

export default function Home() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [inputTasks, setInputTasks] = useState<TaskInput[]>([
    { subject: "", task: "", deadline: 0, grade: 0 }
  ]);
  const [topicWarning, setTopicWarning] = useState("");

  const blockedTopicPatterns = [
    '\\bvägivald\\b', '\\btapa\\b', '\\bsurma\\b', '\\balkohol\\b', '\\bjoob\\b', '\\bnarkoot\\b', '\\bnarko\\b', '\\buimasti\\b',
    '\\bsigarett\\b', '\\btubakas\\b', '\\bnikotiin\\b', '\\brelv\\b', '\\bnuga\\b', '\\bpomm\\b',
    '\\bporno\\b', '\\bseksi\\b', '\\bseks\\b', '\\bterrorism\\b', '\\bkuritegu\\b', '\\brööv\\b', '\\bvargus\\b', '\\blapseporno\\b',
    '\\brass\\b', '\\brassism\\b', '\\bvihk\\b', '\\busk\\b', '\\bjumal\\b', '\\bsõda\\b', '\\blahing\\b'
  ];

  const containsBlockedTopic = (text: string) => {
    const lower = text.toLowerCase();
    return blockedTopicPatterns.some(pattern => new RegExp(pattern, 'i').test(lower));
  };

  const validateInputTasks = (tasks: TaskInput[]) => {
    for (const task of tasks) {
      if (containsBlockedTopic(task.subject) || containsBlockedTopic(task.task)) {
        return 'Mõni sisestatud teema ei sobi koolitööks. Kasuta palun kooliteemadel põhinevaid aineid, näiteks matemaatikat, ajalugu, keemiat või eesti keelt.';
      }
    }
    return '';
  };

  const addTask = () => {
    setInputTasks([...inputTasks, { subject: "", task: "", deadline: 0, grade: 0 }]);
  };

  const updateTask = (index: number, field: keyof TaskInput, value: string | number) => {
    const newTasks = [...inputTasks];
    newTasks[index] = { ...newTasks[index], [field]: value };
    setInputTasks(newTasks);
    setTopicWarning(validateInputTasks(newTasks));
  };

  const removeTask = (index: number) => {
    if (inputTasks.length > 1) {
      setInputTasks(inputTasks.filter((_, i) => i !== index));
    }
  };

  const loadAI = async () => {
    const warning = validateInputTasks(inputTasks);
    if (warning) {
      setTopicWarning(warning);
      return;
    }

    setTopicWarning("");
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(inputTasks)
    });
    const data = await res.json();
    setTasks(data);
  };

  return (
    <main style={{ padding: 20, backgroundColor: "#F0F8F0", minHeight: "100vh", color: "#000" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", backgroundColor: "white", padding: 30, borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", color: "#000" }}>
        <h1 style={{ fontSize: 32, color: "#000", textAlign: "center", marginBottom: 10 }}>TÄNA</h1>
        <p style={{ textAlign: "center", color: "#000", marginBottom: 30 }}>Sinu isiklik õppeassistent</p>

        <div style={{ marginBottom: 40, backgroundColor: "#F0F8F0", padding: 25, borderRadius: 10, border: "2px solid #40E0D0" }}>
          <h2 style={{ fontSize: 24, color: "#000", marginBottom: 20 }}>📚 Sisesta ülesanded</h2>
          <p style={{ marginTop: 0, marginBottom: 20, color: "#000", fontSize: 15, lineHeight: 1.6 }}>
            Täida iga ülesanne korrektselt: mis aine, mis töö, mitu päeva on jäänud ja millise hinde sa selle aine eest saad.
          </p>

        {inputTasks.map((task, index) => (
          <div key={index} style={{ marginBottom: 20, padding: 20, border: "2px solid #40E0D0", borderRadius: 10, backgroundColor: "#FAFFFD" }}>
            <div style={{ display: "flex", gap: 15, marginBottom: 15 }}>
              <input
                type="text"
                placeholder="Aine (nt Matemaatika)"
                value={task.subject}
                onChange={(e) => updateTask(index, "subject", e.target.value)}
                style={{ flex: 1, padding: 12, borderRadius: 6, border: "2px solid #40E0D0", fontSize: 16, backgroundColor: "white" }}
              />
              <input
                type="text"
                placeholder="Ülesanne (nt Lahenda 10 võrrandit)"
                value={task.task}
                onChange={(e) => updateTask(index, "task", e.target.value)}
                style={{ flex: 2, padding: 12, borderRadius: 6, border: "2px solid #40E0D0", fontSize: 16, backgroundColor: "white" }}
              />
            </div>
            <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
              <label style={{ color: "#000", fontWeight: "bold" }}>
                Tähtaeg (päevad):
                <input
                  type="number"
                  min="1"
                  value={task.deadline}
                  onChange={(e) => updateTask(index, "deadline", parseInt(e.target.value) || 0)}
                  style={{ marginLeft: 8, padding: 10, width: 80, borderRadius: 6, border: "2px solid #40E0D0", backgroundColor: "white", color: "#000" }}
                />
                <span style={{ display: "block", marginTop: 6, fontSize: 13, color: "#333" }}>
                  Valige, mitu päeva on jäänud kodutöö esitamise või testi ettevalmistamise lõpuni.
                </span>
              </label>
              <label style={{ color: "#000", fontWeight: "bold" }}>
                Enesetunne:
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={task.grade}
                  onChange={(e) => updateTask(index, "grade", parseInt(e.target.value) || 0)}
                  style={{ marginLeft: 8, padding: 10, width: 60, borderRadius: 6, border: "2px solid #40E0D0", backgroundColor: "white", color: "#000" }}
                />
                <span style={{ display: "block", marginTop: 6, fontSize: 13, color: "#333" }}>
                  Pane siia oma hinnang, kui hästi sa selle ainega hakkama saad. 1 tähendab, et see on väga raske ja 5 tähendab, et see on lihtne.
                </span>
              </label>
              {inputTasks.length > 1 && (
                <button
                  onClick={() => removeTask(index)}
                  style={{ padding: "10px 15px", background: "#DC3545", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
                >
                  Eemalda
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={addTask}
          style={{ marginRight: 15, padding: "12px 20px", background: "#28A745", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16 }}
        >
          ➕ Lisa ülesanne
        </button>
      </div>

      {topicWarning && (
        <div style={{ marginBottom: 20, padding: 18, borderRadius: 12, backgroundColor: "#FFE5E5", border: "1px solid #FFB3B3", color: "#800000" }}>
          <strong>Hoiatus:</strong> {topicWarning}
        </div>
      )}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <button
          onClick={loadAI}
          style={{
            background: "linear-gradient(135deg, #006400 0%, #008B8B 100%)",
            color: "white",
            padding: "15px 30px",
            borderRadius: 12,
            border: "none",
            fontSize: 18,
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow: "0 4px 15px rgba(0,100,0,0.3)",
            transition: "all 0.3s ease"
          }}
        >
          🚀 Genereeri AI plaan
        </button>
      </div>
      {tasks.map((task, index) => {
        const isKT = task.type === "KT";

        return (
          <div
            key={index}
            style={{
              marginBottom: 25,
              padding: 25,
              borderRadius: 15,
              backgroundColor: isKT ? "#E0F2F1" : "#F1F8E9",
              border: `3px solid ${isKT ? "#008B8B" : "#4CAF50"}`,
              boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
              position: "relative"
            }}
          >
            {index === 0 && (
              <div style={{
                position: "absolute",
                top: -10,
                left: 20,
                background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                color: "#000",
                padding: "5px 15px",
                borderRadius: 20,
                fontSize: 14,
                fontWeight: "bold",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
              }}>
                ⭐ Kõige olulisem
              </div>
            )}

            <div style={{ marginTop: index === 0 ? 20 : 0 }}>
              <strong style={{ fontSize: 22, color: "#000", display: "block", marginBottom: 10 }}>
                {task.subject} – {task.task}
              </strong>

              <div style={{
                display: "inline-flex",
                alignItems: "center",
                backgroundColor: isKT ? "#008B8B" : "#4CAF50",
                color: "white",
                padding: "8px 16px",
                borderRadius: 20,
                fontSize: 16,
                fontWeight: "bold"
              }}>
                ⏱ {task.time} min
              </div>
            </div>

            {containsBlockedTopic(task.subject) || containsBlockedTopic(task.task) ? (
              <button
                disabled
                style={{
                  marginTop: 20,
                  padding: "12px 20px",
                  background: "#B30000",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  cursor: "not-allowed",
                  fontSize: 16,
                  fontWeight: "bold",
                  boxShadow: "0 4px 12px rgba(179,0,0,0.3)",
                  width: "100%"
                }}
              >
                🚫 See teema ei sobi
              </button>
            ) : (
              <Link href={`/abi?subject=${encodeURIComponent(task.subject)}&task=${encodeURIComponent(task.task)}&grade=${inputTasks.find(t => t.subject === task.subject && t.task === task.task)?.grade || 3}&deadline=${inputTasks.find(t => t.subject === task.subject && t.task === task.task)?.deadline || 7}&isTest=${task.type === 'KT'}`}>
                <button
                  style={{
                    marginTop: 20,
                    padding: "12px 20px",
                    background: "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 16,
                    fontWeight: "bold",
                    boxShadow: "0 4px 12px rgba(33,150,243,0.3)",
                    transition: "all 0.3s ease"
                  }}
                >
                  📚 Vajad abi? 🤔
                </button>
              </Link>
            )}
          </div>
        );
      })}
      </div>
    </main>
  );
}