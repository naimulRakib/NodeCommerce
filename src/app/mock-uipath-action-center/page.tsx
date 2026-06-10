"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./styles.module.css";

// Mock Timeline Events Generator
const generateTimeline = (status: string) => {
  const events = [];
  events.push({ time: "09:00 AM", text: "Phase 3 Approval Requested" });
  if (status === "source_approved" || status === "target_approved") {
    events.push({ time: "10:15 AM", text: "Partial Approval Received" });
  }
  if (status === "both_approved" || status === "dispatched" || status === "in_transit") {
    events.push({ time: "10:16 AM", text: "Both Districts Approved" });
    events.push({ time: "10:16 AM", text: "3PL Dispatch Triggered" });
  }
  if (status === "dispatched" || status === "in_transit") {
    events.push({ time: "10:20 AM", text: "Transport Agency Confirmed Booking" });
  }
  if (status === "in_transit") {
    events.push({ time: "11:00 AM", text: "Phase 4 Triggered — 8 distribution trucks dispatched to upazillas" });
  }
  return events;
};

// Edge Case 45: Format Money
const formatMoney = (amount: number | null | undefined) => {
  if (amount == null) return "Pending BDT";
  return new Intl.NumberFormat('en-BD').format(amount) + " BDT";
};

// Edge Case 46: Normalize Text
const normalizeText = (text: string | null | undefined, isPlate = false) => {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (isPlate) return cleaned.toUpperCase();
  
  // Title Case
  return cleaned.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

// Edge Case 43: Mock Products
const MOCK_PRODUCTS = [
  "Walton Prima X5", "Vision 43\" LED TV", "Jamuna Refrigerator", 
  "PRAN Mango Juice Carton", "RFL Chair Bundle", "Apex Formal Shoes",
  "Walton AC 1.5 Ton", "Click Fan", "Topper Cookware Set",
  "Minister Washing Machine", "BSRM Steel Rod Bundle", "Fresh Cement Bags",
  "Bashundhara Paper Box", "Rupchanda Soybean Oil", "Radhuni Spice Mix"
];

export default function MockUiPathActionCenter() {
  return (
    <Suspense fallback={<div style={{padding: 40, textAlign: 'center'}}>Loading...</div>}>
      <MockUiPathActionCenterInner />
    </Suspense>
  );
}

function MockUiPathActionCenterInner() {
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_MOCK_ACTION_CENTER === "true";
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") || "source";
  const shipmentIdParam = searchParams.get("shipmentId");
  const isDemoMode = searchParams.get("demo") === "true";
  const simulatedRiskChange = searchParams.get("simulatedRiskChange") === "true";

  const [tasks, setTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"myTasks" | "completed">("myTasks");
  
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [selectedAction, setSelectedAction] = useState<"approve" | "reject" | "request_info" | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<"none" | "success_both" | "success_partial" | "rejected" | "error" | "conflict">("none");
  const [liveStatus, setLiveStatus] = useState<string>("pending_approval");

  const [notFoundError, setNotFoundError] = useState(false);
  const [roleMismatch, setRoleMismatch] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  const [infoResponse, setInfoResponse] = useState<string | null>(null);
  
  const [demoPanelOpen, setDemoPanelOpen] = useState(true);
  const [quickFillActive, setQuickFillActive] = useState(false);
  const [resetError, setResetError] = useState(false);
  const [copyStateSource, setCopyStateSource] = useState<"idle"|"copied"|"fallback">("idle");
  const [copyStateTarget, setCopyStateTarget] = useState<"idle"|"copied"|"fallback">("idle");

  const [isOffline, setIsOffline] = useState(false);
  const [pollTick, setPollTick] = useState(false);

  // Edge Case 43: Show more
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Edge Case 47: Realtime Timer
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);

  // Edge Case 53: Target approved banner
  const [showOtherApprovedBanner, setShowOtherApprovedBanner] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (isEnabled && !process.env.NEXT_PUBLIC_UIPATH_WEBHOOK_SECRET) {
    return (
      <div style={{padding: 40, fontFamily: 'sans-serif', textAlign: 'center'}}>
        <h2 style={{color: '#D32F2F'}}>Configuration Error</h2>
        <p>Webhook secret not configured. Contact your administrator.</p>
        <p style={{fontSize: 12, color: '#666'}}>Missing NEXT_PUBLIC_UIPATH_WEBHOOK_SECRET</p>
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div style={{padding: 40, fontFamily: 'sans-serif', textAlign: 'center'}}>
        <h1>404 - Page Not Found</h1>
      </div>
    );
  }

  useEffect(() => {
    fetchTasks();
  }, [role, shipmentIdParam]);

  const fetchTasks = async (isBackgroundPoll = false) => {
    if (!isBackgroundPoll) setLoading(true);
    setNotFoundError(false);
    setRoleMismatch(false);
    try {
      const url = shipmentIdParam 
        ? `/api/uipath/action-center/tasks?role=${role}&shipmentId=${shipmentIdParam}`
        : `/api/uipath/action-center/tasks?role=${role}`;
      const res = await fetch(url);
      if (res.ok) {
        setIsOffline(false);
        const data = await res.json();
        
        if (shipmentIdParam) {
          if (!data.tasks || data.tasks.length === 0) {
            setNotFoundError(true);
          } else {
            const task = data.tasks[0];
            if (role === "source" && task.sourceApproved && !task.targetApproved) {
              setRoleMismatch(true);
            } else if (role === "target" && task.targetApproved && !task.sourceApproved) {
              setRoleMismatch(true);
            } else {
              setSelectedTask(task);
            }
          }
        } else {
          setTasks(data.tasks);
          if (isDemoMode && data.tasks.length > 0 && !shipmentIdParam) {
            setSelectedTask(data.tasks[0]);
            router.replace(`?role=${role}&demo=true&shipmentId=${data.tasks[0].id}`);
          }
        }
      } else {
        if (!isBackgroundPoll) setNotFoundError(true);
        setIsOffline(true);
      }
    } catch (e) {
      if (!isBackgroundPoll) setNotFoundError(true);
      setIsOffline(true);
    } finally {
      if (!isBackgroundPoll) setLoading(false);
    }
  };

  // Edge Case 47: Realtime Timer
  useEffect(() => {
    if (!selectedTask || !selectedTask.expiresAt) return;
    
    const calculateMs = () => new Date(selectedTask.expiresAt).getTime() - Date.now();
    setTimeRemainingMs(calculateMs());

    const timer = setInterval(() => {
      setTimeRemainingMs(calculateMs());
    }, 1000);

    return () => clearInterval(timer);
  }, [selectedTask]);

  useEffect(() => {
    if (selectedTask) return;
    const interval = setInterval(() => {
      fetchTasks(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedTask, role, shipmentIdParam]);

  // Live Status Polling
  useEffect(() => {
    let intervalTime = 15000;
    let interval: any;

    const doPoll = async () => {
      if (!selectedTask) return;
      try {
        const res = await fetch(`/api/aco/shipments/${selectedTask.id}`);
        if (res.ok) {
          setIsOffline(false);
          const data = await res.json();
          setPollTick(true);
          setTimeout(() => setPollTick(false), 1000);

          setLiveStatus(data.status);

          if (submissionState === "success_partial" && data.status === "both_approved") {
            setSubmissionState("success_both");
          }

          // Edge Case 53: Target Approved Banner
          if (submissionState === "none" && !isSubmitting) {
            if (role === "source" && data.targetApproved && !selectedTask.targetApproved) {
              setShowOtherApprovedBanner(true);
            } else if (role === "target" && data.sourceApproved && !selectedTask.sourceApproved) {
              setShowOtherApprovedBanner(true);
            }
          }

          // Edge Case 57: Target tab auto-moves to completed if rejected
          if (submissionState === "none" && (data.status === "source_rejected" || data.status === "target_rejected")) {
            // Already rejected, push to completed list
            setCompletedTasks(prev => [{...selectedTask, status: data.status, failureReason: data.failureReason}, ...prev]);
            setSelectedTask(null);
            setActiveTab("completed");
            router.push(`?role=${role}${isDemoMode ? '&demo=true' : ''}`);
          }

        } else {
          setIsOffline(true);
        }
      } catch (e) {
        setIsOffline(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        intervalTime = 60000;
      } else {
        intervalTime = 15000;
        doPoll();
      }
      clearInterval(interval);
      if (selectedTask) {
        interval = setInterval(doPoll, intervalTime);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (selectedTask) {
      interval = setInterval(doPoll, intervalTime);
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [submissionState, selectedTask, role, isSubmitting]);

  useEffect(() => {
    if (selectedAction === "request_info" && submissionState === "success_partial") {
      const infoInterval = setInterval(() => {
        setInfoResponse("Yes, the stock levels have been physically verified. You can proceed.");
        setSubmissionState("none");
      }, 10000);
      return () => clearInterval(infoInterval);
    }
  }, [selectedAction, submissionState]);

  useEffect(() => {
    if ((selectedAction === "reject" || selectedAction === "request_info") && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [selectedAction]);

  const fetchWeather = async () => {
    setWeatherLoading(true);
    setWeatherError(false);
    try {
      const res = await fetch(`/api/uipath/action-center/weather?fail=false`);
      if (res.ok) {
        const data = await res.json();
        setWeatherData(data.weather);
      } else {
        setWeatherError(true);
      }
    } catch (e) {
      setWeatherError(true);
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleTriggerAco = async () => {
    try {
      await fetch("/api/test/trigger-aco", { method: "POST" });
      setTimeout(() => fetchTasks(true), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTask || !selectedAction) return;
    setIsSubmitting(true);
    setSubmissionState("none");

    const actorDistrictId = role === "source" ? selectedTask.fromId : selectedTask.toId;
    const requestId = `req_${selectedTask.id}_${actorDistrictId}_${Date.now()}`;
    
    // Edge Case 54: Connection drop auto-retry
    const maxRetries = 2;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch("/api/uipath/approval", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-UiPath-Secret": process.env.NEXT_PUBLIC_UIPATH_WEBHOOK_SECRET || "default_test_secret"
          },
          body: JSON.stringify({
            shipmentId: selectedTask.id,
            actorDistrictId,
            action: selectedAction === "request_info" ? "reject" : selectedAction,
            note: actionNote,
            uipathJobId: selectedTask.uipathJobId,
            requestId
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.status === 409) {
          setSubmissionState("conflict");
          setIsSubmitting(false);
          return;
        }

        const data = await res.json();

        if (res.ok) {
          if (selectedAction === "reject") {
            setSubmissionState("rejected");
          } else if (selectedAction === "approve" && data.status === "both_approved") {
            setSubmissionState("success_both");
            setLiveStatus("pending_approval");
          } else {
            setSubmissionState("success_partial");
          }
          setIsSubmitting(false);
          return; // Success, exit retry loop
        } else {
          throw new Error("Server error");
        }
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (attempt === maxRetries) {
          setSubmissionState("error");
          setIsSubmitting(false);
          return;
        }
        // Wait 2 seconds before retrying quietly
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  };

  const handleResetShipment = async () => {
    if (!selectedTask) return;
    setResetError(false);
    try {
      const res = await fetch("/api/test/reset-shipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentId: selectedTask.id })
      });
      if (!res.ok) throw new Error();
      setSubmissionState("none");
      setSelectedAction(null);
      setInfoResponse(null);
      setLiveStatus("pending_approval");
      setShowOtherApprovedBanner(false);
      fetchTasks(true);
    } catch (e) {
      setResetError(true);
    }
  };

  const handleCopy = async (type: "source"|"target") => {
    const url = `${window.location.origin}/mock-uipath-action-center?role=${type}&demo=true&shipmentId=${selectedTask?.id || ''}`;
    try {
      await navigator.clipboard.writeText(url);
      if (type === "source") {
        setCopyStateSource("copied");
        setTimeout(() => setCopyStateSource("idle"), 2000);
      } else {
        setCopyStateTarget("copied");
        setTimeout(() => setCopyStateTarget("idle"), 2000);
      }
    } catch (err) {
      if (type === "source") setCopyStateSource("fallback");
      else setCopyStateTarget("fallback");
    }
  };

  const getTimeRemainingStr = (ms: number | null) => {
    if (ms === null) return "No deadline";
    if (ms <= 0) return "Expired";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m remaining`;
  };

  const renderDemoPanel = () => {
    if (!isDemoMode) return null;
    if (!demoPanelOpen) {
      return (
        <button className={styles.floatingDemoBtn} onClick={() => setDemoPanelOpen(true)}>
          Demo
        </button>
      );
    }

    return (
      <div className={styles.demoPanel}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#9C27B0'}}>
          <div className={styles.demoBadge} style={{background: 'transparent'}}>Demo Mode Controls</div>
          <button onClick={() => setDemoPanelOpen(false)} style={{background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0 12px'}}>✕</button>
        </div>
        <div className={styles.demoContent}>
          <div>
            <div className={styles.demoLabel}>Current Role</div>
            <div className={styles.demoToggle}>
              <button 
                className={`${styles.demoToggleBtn} ${role === "source" ? styles.active : ""}`}
                onClick={() => router.push(`?role=source&demo=true${selectedTask ? `&shipmentId=${selectedTask.id}` : ''}`)}
              >
                Source
              </button>
              <button 
                className={`${styles.demoToggleBtn} ${role === "target" ? styles.active : ""}`}
                onClick={() => router.push(`?role=target&demo=true${selectedTask ? `&shipmentId=${selectedTask.id}` : ''}`)}
              >
                Target
              </button>
            </div>
          </div>
          <div>
            <div className={styles.demoLabel}>Load Shipment</div>
            <select 
              className={styles.demoSelect}
              value={selectedTask?.id || ""}
              onChange={e => {
                if (e.target.value) {
                  setSelectedAction(null);
                  setActionNote("");
                  setShowOtherApprovedBanner(false);
                  router.push(`?role=${role}&demo=true&shipmentId=${e.target.value}`);
                }
              }}
            >
              <option value="">Select a shipment...</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.id} ({t.fromName} → {t.toName})</option>
              ))}
            </select>
          </div>
          {selectedTask && (
            <>
              <button 
                className={`${styles.demoBtn} ${styles.primary}`}
                onClick={() => {
                  setQuickFillActive(true);
                  setSelectedAction("approve");
                  setActionNote("Reviewed and approved. Stock levels confirmed. Proceeding with transfer.");
                  setTimeout(() => setQuickFillActive(false), 300);
                }}
              >
                ⚡ Quick Fill Approval
              </button>
              <button className={styles.demoBtn} onClick={handleResetShipment}>
                ↺ Reset This Shipment
              </button>
              {resetError && <div style={{color: '#D32F2F', fontSize: 11}}>Reset failed, server unreachable. <a href="#" onClick={(e) => { e.preventDefault(); handleResetShipment(); }}>Retry</a></div>}
            </>
          )}
          
          <div style={{display: 'flex', gap: 8}}>
            {copyStateSource === "fallback" ? (
              <input readOnly className={styles.copyInput} value={`${window.location.origin}/mock-uipath-action-center?role=source&demo=true&shipmentId=${selectedTask?.id || ''}`} onClick={(e) => e.currentTarget.select()} />
            ) : (
              <button className={styles.demoBtn} onClick={() => handleCopy("source")}>
                {copyStateSource === "copied" ? "Copied ✓" : "📋 Source URL"}
              </button>
            )}

            {copyStateTarget === "fallback" ? (
              <input readOnly className={styles.copyInput} value={`${window.location.origin}/mock-uipath-action-center?role=target&demo=true&shipmentId=${selectedTask?.id || ''}`} onClick={(e) => e.currentTarget.select()} />
            ) : (
              <button className={styles.demoBtn} onClick={() => handleCopy("target")}>
                {copyStateTarget === "copied" ? "Copied ✓" : "📋 Target URL"}
              </button>
            )}
          </div>

        </div>
      </div>
    );
  };

  const renderOverlays = () => {
    if (submissionState === "none") return null;

    if (submissionState === "success_both") {
      const timelineEvents = generateTimeline(liveStatus);
      return (
        <div className={styles.overlay}>
          <svg className={`${styles.successIcon} ${styles.animatedCheckmark}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          <div className={styles.overlayTitle}>Transfer Approved</div>
          <div className={styles.overlaySubtext}>Both districts have approved. The shipment is now being dispatched.</div>
          
          <div className={styles.timelineContainer}>
            {timelineEvents.map((ev, i) => (
              <div key={i} className={styles.timelineItem} style={{animationDelay: `${1.2 + (i * 0.2)}s`}}>
                <div className={styles.timelineLine}>
                  <div className={`${styles.timelineDot} ${i === timelineEvents.length - 1 ? styles.active : ''}`}></div>
                </div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineTime}>{ev.time}</div>
                  <div className={styles.timelineText}>{ev.text}</div>
                </div>
              </div>
            ))}
          </div>

          {isOffline && (
            <div className={styles.offlineIndicator}>
              <svg style={{width: 14}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Connection interrupted, retrying...
            </div>
          )}
          
          <div style={{marginTop: 32, display: 'flex', gap: 16}}>
            <button className={styles.demoBtn} style={{background: '#1B1F3B', color: 'white'}} onClick={() => {
              setCompletedTasks(prev => [{...selectedTask, completedAt: new Date().toISOString()}, ...prev]);
              setSelectedTask(null);
              setSubmissionState("none");
              setActiveTab("completed");
              router.push(`?role=${role}${isDemoMode ? '&demo=true' : ''}`);
            }}>
              View All Tasks
            </button>
            {isDemoMode && (
              <button className={styles.demoBtn} onClick={handleResetShipment}>Reset for Demo</button>
            )}
          </div>
        </div>
      );
    }

    if (submissionState === "success_partial") {
      return (
        <div className={styles.overlay}>
          <svg className={styles.successIcon} style={{color: '#0066FF'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className={styles.overlayTitle}>Approval Submitted</div>
          <div className={styles.overlaySubtext}>Your approval has been submitted. Waiting for the other district to respond.</div>
          
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 16}}>
            <div style={{fontSize: 24, fontWeight: 'bold', color: '#0066FF'}}>
              {role === "source" && selectedTask?.targetApproved ? "2" : role === "target" && selectedTask?.sourceApproved ? "2" : "1"} / 2
            </div>
            <div style={{fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 8}}>
              <svg style={{width: 14, animation: pollTick ? 'spin 0.5s linear' : 'none'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Checking for updates every 15 seconds
            </div>
          </div>

          <button className={styles.demoBtn} style={{marginTop: '24px'}} onClick={() => {
             setSelectedTask(null);
             setSubmissionState("none");
             fetchTasks(true);
             router.push(`?role=${role}${isDemoMode ? '&demo=true' : ''}`);
          }}>Back to Tasks</button>
        </div>
      );
    }

    if (submissionState === "rejected") {
      return (
        <div className={styles.overlay}>
          <svg className={styles.rejectIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <div className={styles.overlayTitle}>Transfer Rejected</div>
          <div className={styles.overlaySubtext}>The shipment has been blocked. The ACO engine will replan in the next cycle.</div>
          <button className={styles.demoBtn} style={{marginTop: '24px'}} onClick={() => {
             setSelectedTask(null);
             setSubmissionState("none");
             fetchTasks(true);
             router.push(`?role=${role}${isDemoMode ? '&demo=true' : ''}`);
          }}>Close</button>
        </div>
      );
    }

    if (submissionState === "error") {
      return (
        <div className={styles.overlay}>
          <svg className={styles.rejectIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className={styles.overlayTitle}>API Error</div>
          <div className={styles.overlaySubtext}>An error occurred while submitting the decision. Please check your network.</div>
          <button className={styles.demoBtn} style={{marginTop: '24px'}} onClick={() => handleSubmit()}>Retry</button>
        </div>
      );
    }

    if (submissionState === "conflict") {
      return (
        <div className={styles.overlay}>
          <svg className={styles.rejectIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className={styles.overlayTitle}>Conflict Detected</div>
          <div className={styles.overlaySubtext}>This district has already submitted a decision for this shipment.</div>
          <button className={styles.demoBtn} style={{marginTop: '24px'}} onClick={() => window.location.reload()}>Refresh</button>
        </div>
      );
    }
  };

  const renderTaskList = () => {
    if (loading) {
      return (
        <div className={`${styles.taskList} ${styles.taskListFallback}`}>
          {[1,2,3].map((i, idx) => (
            <div key={i} className={styles.taskCard} style={{height: '200px', background: '#f0f0f0', animationDelay: `${Math.min(idx * 100, 400)}ms`}} />
          ))}
        </div>
      );
    }

    if (notFoundError) {
      return (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} style={{color: '#D32F2F'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div className={styles.emptyTitle}>Shipment ID not found</div>
          <div className={styles.emptySubtext}>The requested shipment does not exist or was deleted.</div>
          <button className={styles.openTaskBtn} style={{marginTop: 16}} onClick={() => router.push(`/mock-uipath-action-center?role=${role}`)}>Back to Task List</button>
        </div>
      );
    }

    if (roleMismatch) {
      return (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} style={{color: '#F57C00'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div className={styles.emptyTitle}>Permission Error</div>
          <div className={styles.emptySubtext}>You are viewing this as the {role} district reseller but this task is assigned to the other district.</div>
          <button className={styles.openTaskBtn} style={{marginTop: 16}} onClick={() => router.push(`?role=${role === 'source' ? 'target' : 'source'}&shipmentId=${shipmentIdParam}`)}>
            Switch Role to {role === 'source' ? 'Target' : 'Source'}
          </button>
        </div>
      );
    }

    const currentList = activeTab === "myTasks" ? tasks : completedTasks;

    if (currentList.length === 0) {
      return (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className={styles.emptyTitle}>{activeTab === "myTasks" ? "All caught up. No pending approvals." : "No completed tasks yet."}</div>
          <div className={styles.emptySubtext}>{activeTab === "myTasks" ? "New shipment approvals will appear here automatically." : ""}</div>
          {activeTab === "myTasks" && (
            <button className={styles.openTaskBtn} style={{marginTop: 24, background: '#1B1F3B'}} onClick={handleTriggerAco}>
              Trigger ACO Run
            </button>
          )}
        </div>
      );
    }

    return (
      <div className={`${styles.taskList} ${styles.taskListFallback}`}>
        {currentList.map((task, idx) => {
          const isCritical = task.overallRisk === "CRITICAL";
          const isHigh = task.overallRisk === "HIGH";
          const priorityClass = isCritical ? styles.critical : isHigh ? styles.high : styles.normal;
          const priorityText = isCritical ? "Urgent" : isHigh ? "High" : "Normal";
          const title = role === "source" 
            ? `Approve Outbound Transfer from ${task.fromName}` 
            : `Approve Inbound Transfer to ${task.toName}`;
            
          const isNew = task.createdAt && (Date.now() - new Date(task.createdAt).getTime() < 30000);

          return (
            <div key={task.id} className={`${styles.taskCard} ${isCritical ? styles.criticalBorder : ''}`} style={{animationDelay: `${Math.min(idx * 100, 400)}ms`}}>
              {isNew && activeTab === "myTasks" && <div className={styles.newBadge}>NEW</div>}
              <div className={styles.cardHeader}>
                <span className={`${styles.priorityBadge} ${priorityClass}`}>{priorityText}</span>
                {activeTab === "completed" ? (
                  task.status.includes("rejected") ? (
                    <span className={styles.priorityBadge} style={{background: '#FFEAEA', color: '#D32F2F', marginLeft: '8px'}}>
                      ✕ Rejected by {task.status === "source_rejected" ? "Source" : "Target"}
                    </span>
                  ) : (
                    <span className={styles.priorityBadge} style={{background: '#E8F5E9', color: '#4CAF50', marginLeft: '8px'}}>✓ Completed</span>
                  )
                ) : (
                  (task.sourceApproved || task.targetApproved) && (
                    <span className={styles.priorityBadge} style={{background: '#E3F2FD', color: '#1976D2', marginLeft: '8px'}}>
                      1 of 2 Approved
                    </span>
                  )
                )}
              </div>
              <h3 className={styles.taskTitle}>{title}</h3>
              {/* Edge Case 44: District Name Truncation */}
              <div className={styles.assignee} title={`Assigned to ${role === "source" ? task.fromName : task.toName}`}>
                Assigned to <span className={styles.truncatedText}>{role === "source" ? task.fromName : task.toName}</span>
              </div>
              
              <div className={styles.pillsRow}>
                <div className={styles.pill} title={`${task.fromName} → ${task.toName}`}>
                  <span className={styles.truncatedText} style={{maxWidth: 100}}>{task.fromName}</span> 
                  <span>→</span> 
                  <span className={styles.truncatedText} style={{maxWidth: 100}}>{task.toName}</span>
                </div>
                <div className={styles.pill}>
                  📦 {task.totalWeightKg || task.totalQuantity} kg
                </div>
                {activeTab === "completed" ? (
                  <div className={styles.pill} style={{color: '#666'}}>
                     Completed {new Date(task.completedAt || Date.now()).toLocaleTimeString()}
                  </div>
                ) : (
                  <div className={`${styles.pill} ${task.expiresAt && new Date(task.expiresAt).getTime() - Date.now() < 3600000 ? styles.deadlineRed : task.expiresAt && new Date(task.expiresAt).getTime() - Date.now() < 10800000 ? styles.deadlineOrange : ''}`}>
                    ⏱ {getTimeRemainingStr(task.expiresAt ? new Date(task.expiresAt).getTime() - Date.now() : null)}
                  </div>
                )}
              </div>

              <div className={styles.cardFooter}>
                <button 
                  className={styles.openTaskBtn} 
                  onClick={() => router.push(`?role=${role}${isDemoMode ? '&demo=true' : ''}&shipmentId=${task.id}`)}
                >
                  Open Task
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTaskDetail = () => {
    if (!selectedTask) return null;
    
    const isCompleted = selectedTask.status !== "pending_approval";
    
    const isRejectedByMe = (role === "source" && selectedTask.status === "source_rejected") || (role === "target" && selectedTask.status === "target_rejected");
    const isRejectedByOther = (role === "source" && selectedTask.status === "target_rejected") || (role === "target" && selectedTask.status === "source_rejected");

    const title = role === "source" 
      ? `Approve Outbound Transfer from ${selectedTask.fromName}` 
      : `Approve Inbound Transfer to ${selectedTask.toName}`;

    const isCritical = selectedTask.overallRisk === "CRITICAL";
    const isHigh = selectedTask.overallRisk === "HIGH";
    const priorityClass = isCritical ? styles.critical : isHigh ? styles.high : styles.normal;
    const priorityText = isCritical ? "CRITICAL" : isHigh ? "HIGH" : selectedTask.overallRisk || "NORMAL";

    const isExpired = timeRemainingMs !== null && timeRemainingMs <= 0;

    return (
      <form onSubmit={handleSubmit} id="approvalForm" key={selectedTask.id} className={styles.taskDetailContainer}>
        {/* Edge Case 53: Target Approved Banner */}
        {showOtherApprovedBanner && !isCompleted && !isRejectedByMe && !isRejectedByOther && (
          <div className={styles.targetApprovedBanner}>
            <svg style={{width: 20}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            The {role === "source" ? "target" : "source"} district has just approved — your approval is now required to complete the transfer.
          </div>
        )}

        {isCritical && !isCompleted && !isRejectedByMe && !isRejectedByOther && (
          <div className={styles.criticalBanner}>
            CRITICAL RISK SHIPMENT — Review carefully before approving.
          </div>
        )}

        <div className={styles.detailHeaderWrapper} style={{paddingTop: isCritical && !showOtherApprovedBanner ? 16 : 0}}>
          <button type="button" className={styles.backBtn} onClick={() => router.push(`?role=${role}${isDemoMode ? '&demo=true' : ''}`)}>
            ← Back to Tasks
          </button>
          
          <h1 className={styles.detailTitle}>{title}</h1>
          <div className={styles.taskId}>{selectedTask.id}</div>
          
          <div className={styles.statusChips}>
            <span className={styles.chip}>Phase 3 Inter-District</span>
            <span className={`${styles.chip} ${priorityClass}`}>{priorityText} RISK</span>
            {!isCompleted && !isRejectedByMe && !isRejectedByOther && <span className={styles.chip}>⏱ {getTimeRemainingStr(timeRemainingMs)}</span>}
            {(selectedTask.sourceApproved || selectedTask.targetApproved) && !isCompleted && !isRejectedByMe && !isRejectedByOther && (
               <span className={styles.chip} style={{borderColor: '#1976D2', color: '#1976D2', background: '#E3F2FD'}}>
                 1 / 2 Approved
               </span>
            )}
            {isCompleted && !isRejectedByMe && !isRejectedByOther && (
               <span className={styles.chip} style={{borderColor: '#4CAF50', color: '#4CAF50', background: '#E8F5E9'}}>
                 ✓ Completed
               </span>
            )}
          </div>
        </div>

        {/* SECTION 1: Shipment Summary */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Shipment Summary</div>
          <div className={styles.sectionBody}>
            <div className={styles.dataGrid}>
              <div className={styles.dataRow}><span className={styles.dataLabel}>Route</span><span className={styles.dataValue} title={`${selectedTask.fromName} → ${selectedTask.toName}`}><span className={styles.truncatedText} style={{maxWidth: 120}}>{selectedTask.fromName}</span> → <span className={styles.truncatedText} style={{maxWidth: 120}}>{selectedTask.toName}</span></span></div>
              <div className={styles.dataRow}><span className={styles.dataLabel}>Distance</span><span className={styles.dataValue}>{selectedTask.distanceKm} km</span></div>
              
              {/* Edge Case 43: Expandable Product List */}
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>Products</span>
                <div className={styles.dataValue}>
                  <div className={styles.expandableList}>
                    {MOCK_PRODUCTS.slice(0, 3).map((p, i) => <div key={i}>{p} (x{(i+1)*12})</div>)}
                    {MOCK_PRODUCTS.slice(3).map((p, i) => (
                      <div key={i + 3} className={`${styles.hiddenProduct} ${showAllProducts ? styles.expanded : ''}`}>{p} (x{(i+1)*5})</div>
                    ))}
                  </div>
                  <button type="button" className={styles.toggleLink} onClick={() => setShowAllProducts(!showAllProducts)}>
                    {showAllProducts ? 'Collapse list' : 'Show 12 more'}
                  </button>
                </div>
              </div>

              <div className={styles.dataRow}><span className={styles.dataLabel}>Total Weight</span><span className={styles.dataValue}>{selectedTask.totalWeightKg || "N/A"} kg</span></div>
              {/* Edge Case 45: Format ACO Score */}
              <div className={styles.dataRow}><span className={styles.dataLabel}>ACO Optimization Score</span><span className={styles.dataValue}>{(selectedTask.overallAcoScore || 8.0).toFixed(2)}/10</span></div>
              {/* Edge Case 45: Format Money */}
              <div className={styles.dataRow}><span className={styles.dataLabel}>Freight Cost</span><span className={styles.dataValue}>{formatMoney(selectedTask.confirmedFreight)}</span></div>
              <div className={styles.dataRow}><span className={styles.dataLabel}>Budget Limit</span><span className={styles.dataValue}>{formatMoney(selectedTask.negotiatedMaxPrice)}</span></div>
              <div className={styles.dataRow}><span className={styles.dataLabel}>Transport Agency</span><span className={styles.dataValue}>{normalizeText(selectedTask.transportAgency) || "Pending Booking"}</span></div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Risk Intelligence */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Risk Intelligence</div>
          <div className={styles.sectionBody}>
            
            {simulatedRiskChange && (
              <div className={styles.riskChangeBanner}>
                <svg style={{width: 20}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Risk level updated since this task was created. Original risk was MEDIUM. Current risk is {priorityText} due to weather change.
              </div>
            )}

            <div className={styles.riskBarContainer}>
              <div className={styles.riskLevelText}>Current Risk Level: {priorityText}</div>
              <div className={styles.riskSegments}>
                <div className={`${styles.riskSegment} ${styles.filledLow} ${styles.animateFill}`} style={{animationDelay: '0ms'}}></div>
                <div className={`${styles.riskSegment} ${!isCritical && !isHigh && priorityText !== 'MEDIUM' ? '' : styles.filledMedium} ${styles.animateFill}`} style={{animationDelay: '100ms'}}></div>
                <div className={`${styles.riskSegment} ${isHigh || isCritical ? styles.filledHigh : ''} ${styles.animateFill}`} style={{animationDelay: '200ms'}}></div>
                <div className={`${styles.riskSegment} ${isCritical ? styles.filledCritical : ''} ${styles.animateFill}`} style={{animationDelay: '300ms'}}></div>
                <div className={`${styles.riskSegment} ${isCritical ? styles.filledCritical : ''} ${styles.animateFill}`} style={{animationDelay: '400ms'}}></div>
              </div>
            </div>

            <div className={styles.riskFactorsGrid}>
              <div className={styles.riskFactorRow}>
                <div className={styles.riskFactorName}><span className={`${styles.dot} ${styles.low}`}></span> ✓ Route Risk</div>
                <div className={styles.riskFactorValue}>Clear</div>
              </div>
              <div className={styles.riskFactorRow}>
                <div className={styles.riskFactorName}><span className={`${styles.dot} ${styles.low}`}></span> ✓ Weight Risk</div>
                <div className={styles.riskFactorValue}>{selectedTask.totalWeightKg} kg</div>
              </div>
              <div className={styles.riskFactorRow}>
                <div className={styles.riskFactorName}>
                  <span className={`${styles.dot} ${selectedTask.historicalDelayRate > 0.2 ? styles.high : styles.low}`}></span> 
                  {selectedTask.historicalDelayRate > 0.2 ? '!' : '-'} Historical Delays
                </div>
                <div className={styles.riskFactorValue}>
                  {selectedTask.historicalDelayRate === 0 ? 
                    <span style={{color: '#999', fontStyle: 'italic'}}>No historical data — first shipment on this route</span> : 
                    `${(selectedTask.historicalDelayRate * 100)}% avg`}
                </div>
              </div>
              <div className={styles.riskFactorRow}>
                <div className={styles.riskFactorName}><span className={`${styles.dot} ${selectedTask.seasonalRiskFlag === 'high' ? styles.high : styles.low}`}></span> {selectedTask.seasonalRiskFlag === 'high' ? '!' : '✓'} Seasonal Risk</div>
                <div className={styles.riskFactorValue}>{selectedTask.seasonalRiskFlag || "Normal"}</div>
              </div>
              <div className={styles.riskFactorRow}>
                <div className={styles.riskFactorName}><span className={`${styles.dot} ${selectedTask.overBudgetFlag ? styles.high : styles.low}`}></span> {selectedTask.overBudgetFlag ? '!' : '✓'} Budget Utilization</div>
                <div className={styles.riskFactorValue}>{selectedTask.confirmedFreight ? Math.round((selectedTask.confirmedFreight/selectedTask.negotiatedMaxPrice)*100) : 0}%</div>
              </div>
              <div className={styles.riskFactorRow}>
                <div className={styles.riskFactorName}><span className={`${styles.dot} ${!selectedTask.currentWeather && !weatherData ? styles.high : styles.low}`}></span> {(!selectedTask.currentWeather && !weatherData) ? '!' : '✓'} Weather</div>
                <div className={styles.riskFactorValue}>
                  {weatherData ? weatherData : selectedTask.currentWeather ? selectedTask.currentWeather : (
                    <span style={{display: 'flex', alignItems: 'center', gap: 4, color: weatherError ? '#D32F2F' : '#F57C00'}}>
                      {weatherError ? 'Could not load weather — proceed with caution.' : 'Unable to fetch weather data'}
                      {!weatherError && (
                        <button type="button" onClick={fetchWeather} disabled={weatherLoading} style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}}>
                          <svg style={{width: 14, animation: weatherLoading ? 'spin 1s linear infinite' : 'none'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.aiRecommendation}>
              <svg style={{width: 20, height: 20, flexShrink: 0}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>AI Recommendation: {isCritical ? "Manual review heavily advised due to critical risk factors." : "Standard transfer. No significant anomalies detected by the ACO engine."}</div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Transport Details */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Transport Details</div>
          <div className={styles.sectionBody}>
            <div className={styles.driverCard}>
              <div className={styles.driverInitials}>{selectedTask.driverName ? normalizeText(selectedTask.driverName).substring(0,2).toUpperCase() : "TBA"}</div>
              <div className={styles.driverInfo}>
                {/* Edge Case 46: Normalize Text */}
                <div className={styles.driverName}>{normalizeText(selectedTask.driverName) || "Driver not yet assigned"}</div>
                {selectedTask.driverPhone && <a href={`tel:${selectedTask.driverPhone}`} className={styles.driverPhone}>{selectedTask.driverPhone}</a>}
              </div>
              {selectedTask.licensePlate && <div className={styles.plateBadge}>{normalizeText(selectedTask.licensePlate, true)}</div>}
            </div>
            <div className={styles.dataGrid}>
              <div className={styles.dataRow}><span className={styles.dataLabel}>Agency</span><span className={styles.dataValue}>{normalizeText(selectedTask.transportAgency) || "Pending Phase 4"}</span></div>
              <div className={styles.dataRow}><span className={styles.dataLabel}>Booking Ref</span><span className={styles.dataValue}>PENDING-DISPATCH</span></div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Your Decision */}
        {isRejectedByMe || isRejectedByOther ? (
          <div className={`${styles.section} ${styles.actionSection}`} style={{padding: 32}}>
             <div style={{display: 'flex', gap: 16, alignItems: 'flex-start'}}>
                <svg style={{width: 40, color: '#D32F2F'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                  <h3 style={{fontSize: 18, color: '#D32F2F', margin: '0 0 8px'}}>This transfer was rejected {isRejectedByMe ? 'by your district' : 'by the other district'}.</h3>
                  <p style={{color: '#666', fontSize: 14, margin: '0 0 16px'}}><strong>Reason:</strong> {selectedTask.failureReason || "No reason provided."}</p>
                  <p style={{color: '#888', fontSize: 12, margin: '0 0 16px'}}>Rejected on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
                  <button className={styles.demoBtn} style={{width: 'auto', padding: '8px 24px'}}>Contact Ops Support</button>
                </div>
             </div>
          </div>
        ) : isCompleted ? (
          <div className={`${styles.section} ${styles.actionSection}`} style={{textAlign: 'center', padding: 32}}>
            <svg style={{width: 48, color: '#4CAF50', margin: '0 auto 16px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 style={{fontSize: 18, color: '#333'}}>This task is already completed.</h3>
            <p style={{color: '#666', fontSize: 14, marginTop: 8}}>Current Status: {selectedTask.status.toUpperCase()}</p>
          </div>
        ) : (
          <div className={`${styles.section} ${styles.actionSection}`}>
            <div className={styles.sectionHeader}>Your Decision</div>
            
            {isSubmitting && <div className={styles.blockingLayer}></div>}

            <div className={styles.sectionBody}>
              
              {/* Edge Case 47: Timer hit zero */}
              {isExpired ? (
                <div style={{background: '#FFEAEA', borderLeft: '4px solid #D32F2F', padding: '16px', color: '#D32F2F', fontWeight: '500', marginBottom: 24}}>
                  The approval window has closed. Your decision was not submitted in time.
                </div>
              ) : infoResponse ? (
                <div className={styles.aiRecommendation} style={{marginBottom: 24, background: '#E8F5E9', borderColor: '#4CAF50', color: '#2E7D32'}}>
                  <span style={{fontWeight: 'bold', marginRight: 8}}>New information received:</span> {infoResponse}
                </div>
              ) : null}

              <div className={styles.optionCards} style={{opacity: isExpired ? 0.5 : 1, pointerEvents: isExpired ? 'none' : 'auto'}}>
                <div 
                  className={`${styles.optionCard} ${selectedAction === 'approve' ? styles.selectedApprove : ''} ${styles.borderApprove} ${quickFillActive && selectedAction === 'approve' ? styles.quickFillHighlight : ''}`}
                  onClick={() => setSelectedAction("approve")}
                >
                  <div className={`${styles.optionIcon} ${styles.iconApprove}`}>✓</div>
                  <div className={styles.optionTitle}>Approve Transfer</div>
                  <div className={styles.optionSubtext}>Confirm this shipment can proceed.</div>
                </div>
                <div 
                  className={`${styles.optionCard} ${selectedAction === 'reject' ? styles.selectedReject : ''} ${styles.borderReject}`}
                  onClick={() => setSelectedAction("reject")}
                >
                  <div className={`${styles.optionIcon} ${styles.iconReject}`}>✕</div>
                  <div className={styles.optionTitle}>Reject Transfer</div>
                  <div className={styles.optionSubtext}>Block this shipment from proceeding.</div>
                </div>
                <div 
                  className={`${styles.optionCard} ${selectedAction === 'request_info' ? styles.selectedRequest : ''} ${styles.borderRequest}`}
                  onClick={() => setSelectedAction("request_info")}
                >
                  <div className={`${styles.optionIcon} ${styles.iconRequest}`}>?</div>
                  <div className={styles.optionTitle}>Request Information</div>
                  <div className={styles.optionSubtext}>Ask a question before deciding.</div>
                </div>
              </div>

              {(selectedAction === "reject" || selectedAction === "request_info") && !isExpired && (
                <div className={styles.reasonArea}>
                  <div className={styles.textareaLabel}>
                    <span>{selectedAction === "reject" ? "Reason" : "Question"}</span>
                    <span className={`${styles.charCounter} ${actionNote.length >= 1000 ? styles.counterRed : actionNote.length >= 500 ? styles.counterOrange : ''}`}>
                      {actionNote.length >= 500 ? `${actionNote.length} of 1000 characters used` : `${1000 - actionNote.length} characters remaining`}
                    </span>
                  </div>
                  <textarea 
                    ref={textareaRef}
                    className={styles.textarea}
                    placeholder="Enter details here..."
                    value={actionNote}
                    maxLength={1000}
                    onChange={e => setActionNote(e.target.value)}
                  />
                </div>
              )}

              <noscript>
                <input type="hidden" name="shipmentId" value={selectedTask.id} />
                <input type="hidden" name="actorDistrictId" value={role === "source" ? selectedTask.fromId : selectedTask.toId} />
                <input type="hidden" name="action" value={selectedAction || "approve"} />
                <input type="hidden" name="uipathJobId" value={selectedTask.uipathJobId} />
              </noscript>

              <button 
                type="submit"
                className={`${styles.submitBtn} ${selectedAction === 'approve' ? styles.submitBtnApprove : selectedAction === 'reject' ? styles.submitBtnReject : selectedAction === 'request_info' ? styles.submitBtnRequest : ''}`}
                disabled={!selectedAction || isSubmitting || isExpired}
              >
                {isSubmitting ? (
                  <div className={styles.spinner}></div>
                ) : selectedAction === 'approve' ? (
                  "Approve Transfer"
                ) : selectedAction === 'reject' ? (
                  "Reject Transfer"
                ) : selectedAction === 'request_info' ? (
                  "Send Question"
                ) : (
                  "Submit Decision"
                )}
              </button>

            </div>
          </div>
        )}

      </form>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.authBypassBanner}>
        Demo Mode — Authentication bypassed for presentation purposes
      </div>

      <header className={styles.header}>
        <div className={styles.logo}>UiPath Action Center</div>
        <div className={styles.userProfile}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {role === "source" ? "Source Reseller" : "Target Reseller"}
            </span>
            <span className={styles.userDistrict}>
              {role === "source" ? "Origin District" : "Destination District"}
            </span>
          </div>
          <div className={styles.avatar}>
            {role === "source" ? "SR" : "TR"}
          </div>
        </div>
      </header>

      {!selectedTask && !notFoundError && !roleMismatch && (
        <div className={styles.tabBar}>
          <div className={`${styles.tab} ${activeTab === "myTasks" ? styles.activeTab : ""}`} onClick={() => setActiveTab("myTasks")}>My Tasks ({tasks.length})</div>
          <div className={`${styles.tab} ${activeTab === "completed" ? styles.activeTab : ""}`} onClick={() => setActiveTab("completed")}>Completed ({completedTasks.length})</div>
        </div>
      )}

      <main className={styles.main}>
        {selectedTask ? renderTaskDetail() : renderTaskList()}
      </main>

      {renderDemoPanel()}
      {renderOverlays()}
    </div>
  );
}
