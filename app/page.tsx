"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PlanItem = {
  subject: string;
  task: string;
  type: "KT" | "ülesanne" | "koduülesanne";
  time: number;
};

export default function Home() {
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPlan = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/ai");
      if (!res.ok) throw new Error("API viga");

      const data = await res.json();
      setPlan(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError("AI plaani laadimine ebaõnnestus.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
  }, []);

  return (
    <main style={{ padding: 20, backgroundColor: "#F0F8F0", minHeight: "100vh", color: "#000" }}>
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          backgroundColor: "white",
          padding: 30,
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          color: "#000",
        }}
      >
        <h1 style={{ fontSize: 32, color: "#000", textAlign: "center", marginBottom: 10 }}>
          ÕpiAgent
        </h1>
        <p style={{ textAlign: "center", color: "#000", marginBottom: 30 }}>
          Sinu valmis AI õppeplaan
        </p>

        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <button
            onClick={loadPlan}
            style={{
              background: "linear-gradient(135deg, #006400 0%, #008B8B 100%)",
              color: "white",
              padding: "14px 24px",
              borderRadius: 12,
              border: "none",
              fontSize: 16,
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(0,100,0,0.3)",
            }}
          >
            Värskenda plaani
          </button>
        </div>

        {loading && <p style={{ textAlign: "center" }}>Laen AI plaani...</p>}

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: 18,
              borderRadius: 12,
              backgroundColor: "#FFE5E5",
              border: "1px solid #FFB3B3",
              color: "#800000",
            }}
          >
            <strong>Viga:</strong> {error}
          </div>
        )}

        {!loading &&
          !error &&
          plan.map((item, index) => {
            const isKT = item.type === "KT";

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
                  position: "relative",
                }}
              >
                {index === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      left: 20,
                      background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                      color: "#000",
                      padding: "5px 15px",
                      borderRadius: 20,
                      fontSize: 14,
                      fontWeight: "bold",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    ⭐ Kõige olulisem
                  </div>
                )}

                <div style={{ marginTop: index === 0 ? 20 : 0 }}>
                  <strong style={{ fontSize: 22, color: "#000", display: "block", marginBottom: 10 }}>
                    {item.subject} – {item.task}
                  </strong>

                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      backgroundColor: isKT ? "#008B8B" : "#4CAF50",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: 20,
                      fontSize: 16,
                      fontWeight: "bold",
                    }}
                  >
                    ⏱ {item.time} min
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <Link
                      href={`/abi?subject=${encodeURIComponent(item.subject)}&task=${encodeURIComponent(item.task)}&grade=3&deadline=7&isTest=${item.type === "KT"}`}
                    >
                      <button
                        style={{
                          background: "linear-gradient(135deg, #2196F3 0%, #1976D2 100%)",
                          color: "white",
                          padding: "12px 20px",
                          borderRadius: 10,
                          border: "none",
                          fontSize: 15,
                          fontWeight: "bold",
                          cursor: "pointer",
                          boxShadow: "0 4px 12px rgba(33,150,243,0.3)",
                        }}
                      >
                        Vajad abi?
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </main>
  );
}