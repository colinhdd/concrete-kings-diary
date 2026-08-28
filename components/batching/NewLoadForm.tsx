"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Truck as TruckIcon,
  Layers,
  Droplets,
  Eye,
  FileText,
  Save,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  Mic,
  Plus,
  Minus,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Check,
  FlaskConical,
  Scale,
} from "lucide-react";
import {
  MixDesign,
  Truck,
  MoistureReading,
  ObservationOption,
  AdjustmentOption,
  SelectedAdjustment,
  BatchingDay,
  calculateExpectedWater,
  generateBatchNumber,
  saveLoad,
  updateLoad,
  saveTruck,
  LoadRecord,
  extractLoadAdjustments,
  DEFAULT_MIX_DESIGNS,
  getLocalDateString,
} from "@/lib/db-batching";
import { calculateBatchFormulation, mlToFlOz, flOzToMl, ML_PER_FL_OZ } from "@/lib/batching-engine";

interface NewLoadFormProps {
  batchingDay: BatchingDay;
  currentMoisture?: MoistureReading;
  currentSandMoisture?: MoistureReading;
  currentStoneMoisture?: MoistureReading;
  mixDesigns: MixDesign[];
  trucks: Truck[];
  observationOptions: ObservationOption[];
  adjustmentOptions: AdjustmentOption[];
  onOpenMoistureModal?: (material: "Sand" | "Stone") => void;
  onLoadSaved: (load: LoadRecord) => void;
  onCancel: () => void;
  initialValues?: Partial<LoadRecord> | null;
  todaysLoads?: LoadRecord[];
}

const STEPS = [
  { id: 1, label: "Truck", icon: TruckIcon },
  { id: 2, label: "Mix & Qty", icon: Layers },
  { id: 3, label: "Review & Log", icon: Save },
];

export default function NewLoadForm({
  batchingDay,
  currentMoisture,
  currentSandMoisture,
  currentStoneMoisture,
  mixDesigns,
  trucks,
  observationOptions,
  adjustmentOptions,
  onOpenMoistureModal,
  onLoadSaved,
  onCancel,
  initialValues,
  todaysLoads,
}: NewLoadFormProps) {
  // Current Wizard Step (1 - 3)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Helper to find previous load matching a job code and optional mix
  const findPreviousLoadForJob = (job: string, mixId?: string): LoadRecord | null => {
    if (!todaysLoads || todaysLoads.length === 0) return null;
    const cleanJob = (job || "").trim().toUpperCase();
    if (!cleanJob) return null;

    // 1. Exact job + mix match
    if (mixId) {
      const match = todaysLoads.find(
        (l) =>
          !l.isVoid &&
          l.mixDesignId === mixId &&
          ((l.jobCode && l.jobCode.toUpperCase() === cleanJob) ||
            (l.batchNumber && l.batchNumber.split("-").slice(3, -1).join("-").toUpperCase() === cleanJob) ||
            (l.batchNumber && l.batchNumber.includes(`-${cleanJob}-`)))
      );
      if (match) return match;
    }

    // 2. Any previous load on this job
    const matchJob = todaysLoads.find(
      (l) =>
        !l.isVoid &&
        ((l.jobCode && l.jobCode.toUpperCase() === cleanJob) ||
          (l.batchNumber && l.batchNumber.split("-").slice(3, -1).join("-").toUpperCase() === cleanJob) ||
          (l.batchNumber && l.batchNumber.includes(`-${cleanJob}-`)))
    );
    if (matchJob) return matchJob;

    return null;
  };

  // Job / Batch Number tracking (Format: YEAR-MM-DD-JJ)
  const defaultJobCode = useMemo(() => {
    if (initialValues) {
      if ((initialValues as any).jobCode) return String((initialValues as any).jobCode);
      if (initialValues.batchNumber) {
        const parts = initialValues.batchNumber.split("-");
        if (parts.length >= 4) {
          return parts.slice(3).join("-");
        }
      }
    }
    if (todaysLoads && todaysLoads.length > 0) {
      const prevLoad = todaysLoads[0];
      if ((prevLoad as any).jobCode) return String((prevLoad as any).jobCode);
      if (prevLoad.batchNumber) {
        const parts = prevLoad.batchNumber.split("-");
        if (parts.length >= 4) {
          return parts.slice(3).join("-");
        }
      }
    }
    return "01";
  }, [initialValues, todaysLoads]);

  const [jobCode, setJobCode] = useState<string>(() => defaultJobCode);

  useEffect(() => {
    if (!jobCode && defaultJobCode) {
      setJobCode(defaultJobCode);
    }
  }, [defaultJobCode]);

  const todayDateStr = useMemo(() => getLocalDateString(), []);
  const currentBatchNumber = useMemo(() => {
    return generateBatchNumber(todayDateStr, jobCode);
  }, [todayDateStr, jobCode]);

  // 1. Truck selection
  const [selectedTruckId, setSelectedTruckId] = useState<string>(
    initialValues?.truckId || (trucks.length > 0 ? trucks[0].id : "")
  );
  const [manualTruckCode, setManualTruckCode] = useState<string>("");

  const effectiveMixes = useMemo(() => {
    if (Array.isArray(mixDesigns) && mixDesigns.length > 0) return mixDesigns;
    return DEFAULT_MIX_DESIGNS;
  }, [mixDesigns]);

  // 2. Mix design selection (defaults to last mix used on this job)
  const defaultMixId = useMemo(() => {
    if (initialValues?.mixDesignId) return initialValues.mixDesignId;
    const prev = findPreviousLoadForJob(defaultJobCode);
    if (prev?.mixDesignId && effectiveMixes.some((m) => m.id === prev.mixDesignId)) {
      return prev.mixDesignId;
    }
    return effectiveMixes.length > 0 ? effectiveMixes[0].id : "";
  }, [initialValues, defaultJobCode, todaysLoads, effectiveMixes]);

  const [selectedMixId, setSelectedMixId] = useState<string>(() => defaultMixId);

  useEffect(() => {
    if (!selectedMixId && effectiveMixes.length > 0) {
      setSelectedMixId(effectiveMixes[0].id);
    }
  }, [effectiveMixes, selectedMixId]);

  // 3. Quantity (yards)
  const [quantity, setQuantity] = useState<number>(
    initialValues?.quantity ? Number(initialValues.quantity) : 10.0
  );

  // Active mix design object
  const activeMix = useMemo(() => {
    return effectiveMixes.find((m) => m.id === selectedMixId) || effectiveMixes[0] || null;
  }, [effectiveMixes, selectedMixId]);

  // Active truck object (derived from manual input or selected preset button)
  const activeTruck = useMemo(() => {
    if (manualTruckCode.trim()) {
      const codeClean = manualTruckCode.trim().toUpperCase();
      const existing = trucks.find((t) => t.code.toUpperCase() === codeClean);
      if (existing) return existing;
      return {
        id: `truck_${codeClean.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        code: codeClean,
        driver: "",
        capacityYards: 10,
        active: true,
      };
    }
    return trucks.find((t) => t.id === selectedTruckId) || trucks[0] || null;
  }, [trucks, selectedTruckId, manualTruckCode]);

  // Active moisture percentages (Sand default: 3.0%, Stone default: 1.0%)
  const sandMoisturePct = currentSandMoisture ? currentSandMoisture.percentage : (currentMoisture?.percentage ?? 3.0);
  const stoneMoisturePct = currentStoneMoisture ? currentStoneMoisture.percentage : 1.0;

  // ── Initial Material Adjustments Computation (Carried over from prior truck on this job/mix) ──
  const initialAdjustments = useMemo(() => {
    if (initialValues) {
      return extractLoadAdjustments(initialValues);
    }
    const prev = findPreviousLoadForJob(defaultJobCode, defaultMixId);
    if (prev) {
      return extractLoadAdjustments(prev);
    }
    return extractLoadAdjustments(null);
  }, [initialValues, defaultJobCode, defaultMixId, todaysLoads]);

  // ── 1. Per-Yard Material Adjustments (Entered into plant batch computer) ──
  const [stoneAdjPerYard, setStoneAdjPerYard] = useState<number>(() => initialAdjustments.stoneAdjPerYard);
  const [stone38AdjPerYard, setStone38AdjPerYard] = useState<number>(() => initialAdjustments.stone38AdjPerYard);
  const [sandAdjPerYard, setSandAdjPerYard] = useState<number>(() => initialAdjustments.sandAdjPerYard);
  const [cementAdjPerYard, setCementAdjPerYard] = useState<number>(() => initialAdjustments.cementAdjPerYard);
  const [waterAdjPerYard, setWaterAdjPerYard] = useState<number>(() => initialAdjustments.waterAdjPerYard);
  const [plasticizerAdjPerYard, setPlasticizerAdjPerYard] = useState<number>(() => initialAdjustments.plasticizerAdjPerYard);
  const [retarderAdjPerYard, setRetarderAdjPerYard] = useState<number>(() => initialAdjustments.retarderAdjPerYard);

  // Carry-over provenance tracking for user visibility banner
  const [carriedOverFrom, setCarriedOverFrom] = useState<{
    truckCode?: string;
    batchNumber?: string;
    mixCode?: string;
    jobCode?: string;
  } | null>(() => {
    if (initialValues?.id) return null;
    const prev = findPreviousLoadForJob(defaultJobCode, defaultMixId);
    if (prev && initialAdjustments.hasAdjustments) {
      return {
        truckCode: prev.truckCode,
        batchNumber: prev.batchNumber,
        mixCode: prev.mixCode,
        jobCode: prev.jobCode || defaultJobCode,
      };
    }
    return null;
  });

  // Handler for changing Job # -> carries over previous mix and adjustments from prior truck on that job
  const handleJobCodeChange = (newJobCode: string) => {
    setJobCode(newJobCode);
    if (initialValues?.id) return; // Don't auto-override when editing an existing record

    const prev = findPreviousLoadForJob(newJobCode);
    if (prev) {
      if (prev.mixDesignId && mixDesigns.some((m) => m.id === prev.mixDesignId)) {
        setSelectedMixId(prev.mixDesignId);
      }
      const adjs = extractLoadAdjustments(prev);
      setStoneAdjPerYard(adjs.stoneAdjPerYard);
      setStone38AdjPerYard(adjs.stone38AdjPerYard);
      setSandAdjPerYard(adjs.sandAdjPerYard);
      setCementAdjPerYard(adjs.cementAdjPerYard);
      setWaterAdjPerYard(adjs.waterAdjPerYard);
      setPlasticizerAdjPerYard(adjs.plasticizerAdjPerYard);
      setRetarderAdjPerYard(adjs.retarderAdjPerYard);
      if (adjs.hasAdjustments) {
        setCarriedOverFrom({
          truckCode: prev.truckCode,
          batchNumber: prev.batchNumber,
          mixCode: prev.mixCode,
          jobCode: newJobCode,
        });
      } else {
        setCarriedOverFrom(null);
      }
    } else {
      setStoneAdjPerYard(0);
      setStone38AdjPerYard(0);
      setSandAdjPerYard(0);
      setCementAdjPerYard(0);
      setWaterAdjPerYard(0);
      setPlasticizerAdjPerYard(0);
      setRetarderAdjPerYard(0);
      setCarriedOverFrom(null);
    }
  };

  // Handler for changing Mix Design -> carries over adjustments if this mix was already tuned on this job
  const handleMixChange = (newMixId: string) => {
    setSelectedMixId(newMixId);

    if (initialValues?.id) return; // Don't auto-override in edit mode

    const prev = findPreviousLoadForJob(jobCode, newMixId);
    if (prev && prev.mixDesignId === newMixId) {
      const adjs = extractLoadAdjustments(prev);
      setStoneAdjPerYard(adjs.stoneAdjPerYard);
      setStone38AdjPerYard(adjs.stone38AdjPerYard);
      setSandAdjPerYard(adjs.sandAdjPerYard);
      setCementAdjPerYard(adjs.cementAdjPerYard);
      setWaterAdjPerYard(adjs.waterAdjPerYard);
      setPlasticizerAdjPerYard(adjs.plasticizerAdjPerYard);
      setRetarderAdjPerYard(adjs.retarderAdjPerYard);
      if (adjs.hasAdjustments) {
        setCarriedOverFrom({
          truckCode: prev.truckCode,
          batchNumber: prev.batchNumber,
          mixCode: prev.mixCode,
          jobCode: jobCode,
        });
      } else {
        setCarriedOverFrom(null);
      }
    } else {
      setStoneAdjPerYard(0);
      setStone38AdjPerYard(0);
      setSandAdjPerYard(0);
      setCementAdjPerYard(0);
      setWaterAdjPerYard(0);
      setPlasticizerAdjPerYard(0);
      setRetarderAdjPerYard(0);
      setCarriedOverFrom(null);
    }
  };

  // Base recipe rates
  const basePlRateFlOz = useMemo(() => {
    if (!activeMix?.plasticizer) return 0;
    return activeMix.plasticizer >= 40 ? mlToFlOz(activeMix.plasticizer) : activeMix.plasticizer;
  }, [activeMix]);

  const baseRetRateFlOz = useMemo(() => {
    if (!activeMix?.retarder) return 0;
    return activeMix.retarder >= 40 ? mlToFlOz(activeMix.retarder) : activeMix.retarder;
  }, [activeMix]);

  const baseStoneRate = activeMix?.threeQuarterStone || 0;
  const baseStone38Rate = activeMix?.threeEighthStone || 0;
  const baseSandRate = activeMix?.sand || 0;
  const baseCementRate = activeMix?.cement || 0;
  const baseWaterRate = activeMix?.designWater || 0;

  // Effective computer rates (per yd³) - ALL adjustable
  const effStoneRate = Math.max(0, baseStoneRate + stoneAdjPerYard);
  const effStone38Rate = Math.max(0, baseStone38Rate + stone38AdjPerYard);
  const effSandRate = Math.max(0, baseSandRate + sandAdjPerYard);
  const effCementRate = Math.max(0, baseCementRate + cementAdjPerYard);
  const effWaterRate = Math.max(0, baseWaterRate + waterAdjPerYard);
  const effPlRate = Math.max(0, basePlRateFlOz + plasticizerAdjPerYard);
  const effRetRate = Math.max(0, baseRetRateFlOz + retarderAdjPerYard);

  // Full-truck material totals from computer rates
  const totalCementBatchKg = Math.round(effCementRate * quantity);
  const totalPlasticizerBatchOz = Math.round(effPlRate * quantity);
  const totalRetarderBatchOz = Math.round(effRetRate * quantity);
  const baseSandDryTruck = Math.round(effSandRate * quantity);
  const baseStoneDryTruck = Math.round(effStoneRate * quantity);
  const baseStone38DryTruck = Math.round(effStone38Rate * quantity);

  // ── 2. Full-Truck Sand & Stone Moisture & Water Calculations ──
  // Sand Moisture
  const mSand = (sandMoisturePct || 0) / 100;
  const targetTruckSand = mSand < 1 ? Math.round(baseSandDryTruck / (1 - mSand)) : baseSandDryTruck;
  const waterInSand = Math.round(targetTruckSand * mSand);
  const replacementSand = Math.max(0, targetTruckSand - baseSandDryTruck);

  // Stone Moisture
  const mStone = (stoneMoisturePct || 0) / 100;
  const targetTruckStone = mStone < 1 ? Math.round(baseStoneDryTruck / (1 - mStone)) : baseStoneDryTruck;
  const targetTruckStone38 = mStone < 1 ? Math.round(baseStone38DryTruck / (1 - mStone)) : baseStone38DryTruck;
  const totalStoneBatchKg = targetTruckStone;
  const totalStone38BatchKg = targetTruckStone38;
  const waterInStone = Math.round((targetTruckStone + targetTruckStone38) * mStone);
  const replacementStone = Math.max(0, (targetTruckStone + targetTruckStone38) - (baseStoneDryTruck + baseStone38DryTruck));

  // Combined Water Compensation
  const totalWaterInAggregates = waterInSand + waterInStone;
  const theoreticalDesignWater = Math.round(effWaterRate * quantity);
  const targetAddedWaterExact = Math.max(0, theoreticalDesignWater - totalWaterInAggregates);
  const expectedBatchWaterL = Math.floor(targetAddedWaterExact / 50) * 50;

  const actualWaterNum = expectedBatchWaterL;
  const waterTruckAdjustment = 0;

  const actualSandNum = targetTruckSand;
  const sandTruckAdjustment = 0;

  // Full Mix Formulation Physics Engine (integrating per-yard computer rates + full-truck water/sand/stone)
  const batchPhysics = useMemo(() => {
    if (!activeMix) return null;
    return calculateBatchFormulation({
      master: activeMix,
      volume: quantity,
      moisturePct: sandMoisturePct,
      stoneMoisturePct: stoneMoisturePct,
      adj: {
        cementPerYard: cementAdjPerYard,
        sandPerYard: sandAdjPerYard,
        threeQuarterStonePerYard: stoneAdjPerYard,
        threeEighthStonePerYard: stone38AdjPerYard,
        waterPerYard: waterAdjPerYard,
        plasticizerPerYard: plasticizerAdjPerYard,
        retarderPerYard: retarderAdjPerYard,
        waterTruck: 0,
        sandTruck: 0,
      },
    });
  }, [activeMix, quantity, sandMoisturePct, stoneMoisturePct, cementAdjPerYard, sandAdjPerYard, stoneAdjPerYard, stone38AdjPerYard, waterAdjPerYard, plasticizerAdjPerYard, retarderAdjPerYard]);

  // 5. Observations (Mandatory - Default to "Perfect" for speed)
  const [selectedObs, setSelectedObs] = useState<string[]>(
    Array.isArray(initialValues?.concreteObservations) && initialValues.concreteObservations.length > 0
      ? initialValues.concreteObservations
      : ["Perfect"]
  );
  const [customObsText, setCustomObsText] = useState<string>("");

  // 6. Adjustments
  const [adjustments, setAdjustments] = useState<SelectedAdjustment[]>(
    Array.isArray(initialValues?.batchAdjustments) ? initialValues.batchAdjustments : []
  );

  // 7. Notes
  const [notes, setNotes] = useState<string>(initialValues?.batcherNotes || "");
  const [isListeningSpeech, setIsListeningSpeech] = useState<boolean>(false);

  // Validation & Saving
  const [warningModalOpen, setWarningModalOpen] = useState<boolean>(false);
  const [pendingWarningMessage, setPendingWarningMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Toggle observation with "Perfect" exclusivity
  const handleToggleObservation = (label: string, isNormalOption: boolean) => {
    if (isNormalOption || label === "Perfect" || label === "Normal") {
      setSelectedObs(["Perfect"]);
    } else {
      let updated = selectedObs.filter((o) => o !== "Perfect" && o !== "Normal");
      if (updated.includes(label)) {
        updated = updated.filter((o) => o !== label);
        if (updated.length === 0) updated = ["Perfect"];
      } else {
        updated.push(label);
      }
      setSelectedObs(updated);
    }
  };

  // Toggle adjustment option
  const handleToggleAdjustment = (option: AdjustmentOption) => {
    if (option.category === "none") {
      setAdjustments([{ optionId: option.id, label: option.label }]);
      return;
    }

    const withoutNone = adjustments.filter((a) => a.label !== "No Additional Adjustment");
    const existingIndex = withoutNone.findIndex((a) => a.optionId === option.id);

    if (existingIndex >= 0) {
      setAdjustments(withoutNone.filter((_, idx) => idx !== existingIndex));
    } else {
      let defaultVal: any = "";
      if (option.category === "water") defaultVal = 50;
      if (option.category === "sand" || option.category === "stone" || option.category === "cement") defaultVal = 50;
      if (option.category === "plasticizer" || option.category === "retarder") defaultVal = 200;

      setAdjustments([
        ...withoutNone,
        {
          optionId: option.id,
          label: option.label,
          value: defaultVal,
          unit: option.defaultUnit,
        },
      ]);
    }
  };

  // Voice speech notes
  const handleVoiceDictation = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice recognition is not supported on this tablet/browser. Please type your notes.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListeningSpeech(true);
      recognition.onend = () => setIsListeningSpeech(false);
      recognition.onerror = () => setIsListeningSpeech(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNotes((prev) => (prev ? `${prev}. ${transcript}` : transcript));
        setIsListeningSpeech(false);
      };

      recognition.start();
    } catch (err) {
      console.warn("Speech error:", err);
      setIsListeningSpeech(false);
    }
  };

  // Submission validation
  const handlePerformSave = async () => {
    if (!jobCode.trim()) {
      alert("Please enter the Job Number (JJ) before saving.");
      setCurrentStep(1);
      return;
    }

    if (!activeMix || !activeTruck) {
      alert("Please ensure both a truck license plate and a mix design are selected.");
      return;
    }

    try {
      setIsSaving(true);

      // Auto-save manual truck license plate for future loads
      if (manualTruckCode.trim()) {
        try {
          await saveTruck({
            id: activeTruck.id,
            code: activeTruck.code,
            driver: "",
            capacityYards: 10,
            active: true,
          });
        } catch (e) {
          console.warn("Truck save notice:", e);
        }
      }

      const allObs = [...selectedObs];
      if (customObsText.trim()) {
        allObs.push(customObsText.trim());
      }

      // Merge per-yard and per-truck adjustments
      const allAdjustments = [...adjustments];
      if (stoneAdjPerYard !== 0) {
        allAdjustments.push({
          optionId: "adj_stone_rate",
          label: `¾ Stone (${stoneAdjPerYard > 0 ? `+${stoneAdjPerYard}` : stoneAdjPerYard} kg/yd³ → ${totalStoneBatchKg} kg)`,
          value: stoneAdjPerYard,
          unit: "kg/yd³",
        });
      }
      if (stone38AdjPerYard !== 0) {
        allAdjustments.push({
          optionId: "adj_stone38_rate",
          label: `⅜ Stone (${stone38AdjPerYard > 0 ? `+${stone38AdjPerYard}` : stone38AdjPerYard} kg/yd³ → ${totalStone38BatchKg} kg)`,
          value: stone38AdjPerYard,
          unit: "kg/yd³",
        });
      }
      if (sandAdjPerYard !== 0) {
        allAdjustments.push({
          optionId: "adj_sand_rate",
          label: `Sand Rate (${sandAdjPerYard > 0 ? `+${sandAdjPerYard}` : sandAdjPerYard} kg/yd³)`,
          value: sandAdjPerYard,
          unit: "kg/yd³",
        });
      }
      if (cementAdjPerYard !== 0) {
        allAdjustments.push({
          optionId: "adj_cement_rate",
          label: `Cement (${cementAdjPerYard > 0 ? `+${cementAdjPerYard}` : cementAdjPerYard} kg/yd³ → ${totalCementBatchKg} kg)`,
          value: cementAdjPerYard,
          unit: "kg/yd³",
        });
      }
      if (waterAdjPerYard !== 0) {
        allAdjustments.push({
          optionId: "adj_design_water_rate",
          label: `Design Water (${waterAdjPerYard > 0 ? `+${waterAdjPerYard}` : waterAdjPerYard} L/yd³ → ${effWaterRate} L/yd³)`,
          value: waterAdjPerYard,
          unit: "L/yd³",
        });
      }
      if (plasticizerAdjPerYard !== 0) {
        allAdjustments.push({
          optionId: "adj_plasticizer_rate",
          label: `Plasticizer (${plasticizerAdjPerYard > 0 ? `+${plasticizerAdjPerYard}` : plasticizerAdjPerYard} fl oz/yd³ → ${totalPlasticizerBatchOz} fl oz)`,
          value: plasticizerAdjPerYard,
          unit: "fl oz/yd³",
        });
      }
      if (retarderAdjPerYard !== 0) {
        allAdjustments.push({
          optionId: "adj_retarder_rate",
          label: `Retarder (${retarderAdjPerYard > 0 ? `+${retarderAdjPerYard}` : retarderAdjPerYard} fl oz/yd³ → ${totalRetarderBatchOz} fl oz)`,
          value: retarderAdjPerYard,
          unit: "fl oz/yd³",
        });
      }
      if (sandTruckAdjustment !== 0) {
        allAdjustments.push({
          optionId: "adj_sand_truck",
          label: `Truck Sand (${sandTruckAdjustment > 0 ? `+${sandTruckAdjustment}` : sandTruckAdjustment} kg → ${actualSandNum} kg)`,
          value: sandTruckAdjustment,
          unit: "kg",
        });
      }
      if (waterTruckAdjustment !== 0) {
        allAdjustments.push({
          optionId: "adj_water_truck",
          label: `Truck Water (${waterTruckAdjustment > 0 ? `+${waterTruckAdjustment}` : waterTruckAdjustment} L → ${actualWaterNum} L)`,
          value: waterTruckAdjustment,
          unit: "L",
        });
      }

      let saved: LoadRecord | null = null;
      if (initialValues?.id) {
        saved = await updateLoad(
          initialValues.id,
          {
            truckId: activeTruck.id,
            truckCode: activeTruck.code,
            mixDesignId: activeMix.id,
            mixCode: activeMix.code,
            mixDesignVersion: activeMix.version || 1,
            quantity: quantity,
            sandMoisturePercent: sandMoisturePct,
            stoneMoisturePercent: stoneMoisturePct,
            actualBatchWater: actualWaterNum,
            expectedBatchWater: expectedBatchWaterL,
            designWater: theoreticalDesignWater,
            actualCement: totalCementBatchKg,
            actualSand: actualSandNum,
            actualThreeQuarterStone: totalStoneBatchKg,
            actualThreeEighthStone: totalStone38BatchKg,
            actualPlasticizer: totalPlasticizerBatchOz,
            actualRetarder: totalRetarderBatchOz,
            concreteObservations: allObs.length > 0 ? allObs : ["Perfect"],
            batchAdjustments: allAdjustments,
            stoneAdjPerYard,
            stone38AdjPerYard,
            sandAdjPerYard,
            cementAdjPerYard,
            waterAdjPerYard,
            plasticizerAdjPerYard,
            retarderAdjPerYard,
            batcherNotes: notes.trim(),
            batchNumber: initialValues.batchNumber || currentBatchNumber,
            jobCode: jobCode,
          },
          batchingDay.batcherName,
          batchingDay.batcherId,
          "Edited / re-batched in batching form"
        );
      }

      if (!saved) {
        saved = await saveLoad({
          batchingDayId: batchingDay.id,
          batcherId: batchingDay.batcherId,
          batcherName: batchingDay.batcherName,
          plantId: batchingDay.plantId,
          plantName: batchingDay.plantName,
          truckId: activeTruck.id,
          truckCode: activeTruck.code,
          mixDesign: activeMix,
          quantity: quantity,
          sandMoisturePercent: sandMoisturePct,
          stoneMoisturePercent: stoneMoisturePct,
          actualBatchWater: actualWaterNum,
          expectedBatchWater: expectedBatchWaterL,
          designWater: theoreticalDesignWater,
          actualCement: totalCementBatchKg,
          actualSand: actualSandNum,
          actualThreeQuarterStone: totalStoneBatchKg,
          actualThreeEighthStone: totalStone38BatchKg,
          actualPlasticizer: totalPlasticizerBatchOz,
          actualRetarder: totalRetarderBatchOz,
          concreteObservations: allObs.length > 0 ? allObs : ["Perfect"],
          batchAdjustments: allAdjustments,
          stoneAdjPerYard,
          stone38AdjPerYard,
          sandAdjPerYard,
          cementAdjPerYard,
          waterAdjPerYard,
          plasticizerAdjPerYard,
          retarderAdjPerYard,
          batcherNotes: notes.trim(),
          batchNumber: currentBatchNumber,
          jobCode: jobCode,
        });
      }

      onLoadSaved(saved);
    } catch (err: any) {
      alert(`Failed to save load: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !jobCode.trim()) {
      alert("Please enter the Job Number (JJ) to continue.");
      return;
    }
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      onCancel();
    }
  };

  // Group mix designs for dropdown
  const groupedMixes = useMemo(() => {
    const groups: { [key: string]: MixDesign[] } = {
      "Pump Mixes": [],
      "Direct Chute Mixes": [],
      "Stone Blend Mixes (50/50 & 75/25)": [],
      "Specialty Slab / Wall Mixes": [],
      "Client & Project Formulations": [],
      "Other Mixes": [],
    };

    effectiveMixes.forEach((mix) => {
      const code = mix.code.toUpperCase();
      if (code.includes("ICC") || code.includes("CAMPBELL")) {
        groups["Client & Project Formulations"].push(mix);
      } else if (code.includes("MX-") || mix.threeEighthStone > 0) {
        groups["Stone Blend Mixes (50/50 & 75/25)"].push(mix);
      } else if (code.startsWith("S-") || code.startsWith("W-")) {
        groups["Specialty Slab / Wall Mixes"].push(mix);
      } else if (code.startsWith("P-") || mix.placementType === "Pump") {
        groups["Pump Mixes"].push(mix);
      } else if (code.startsWith("C-") || mix.placementType === "Direct Chute") {
        groups["Direct Chute Mixes"].push(mix);
      } else {
        groups["Other Mixes"].push(mix);
      }
    });

    return Object.entries(groups).filter(([_, list]) => list.length > 0);
  }, [effectiveMixes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Top Header */}
      <div className="glass-panel" style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={handlePrevStep}
              className="btn-secondary"
              style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.82rem", minHeight: "34px" }}
            >
              <ArrowLeft size={15} /> {currentStep === 1 ? (initialValues?.id ? "Cancel Edit" : "Exit") : "Back"}
            </button>
            <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)", fontWeight: "800" }}>
              {initialValues?.id ? "Edit Batched Load" : "New Batching Load"}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span className="badge synced" style={{ fontSize: "0.8rem", fontWeight: "800", letterSpacing: "0.02em", padding: "3px 8px" }}>
              Batch #{initialValues?.batchNumber || currentBatchNumber}
            </span>
            {activeTruck?.code && (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(224, 83, 0, 0.15)",
                  color: "#e05300",
                  fontSize: "0.8rem",
                  fontWeight: "800",
                }}
              >
                🚛 {activeTruck.code}
              </span>
            )}
            {activeMix?.code && (
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                  color: "#3b82f6",
                  fontSize: "0.8rem",
                  fontWeight: "800",
                }}
              >
                🧱 {activeMix.code} ({quantity} yd³)
              </span>
            )}
          </div>
        </div>

        {initialValues?.id && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px 12px",
              borderRadius: "8px",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              border: "1.5px solid rgba(59, 130, 246, 0.35)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.1rem" }}>✏️</span>
              <div>
                <strong style={{ color: "var(--text-primary)", fontSize: "0.85rem" }}>
                  Editing Batch #{initialValues.batchNumber || initialValues.id}
                </strong>
                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                  Prepopulated with recorded batch info. Make changes and confirm to update record.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
              style={{ padding: "4px 10px", fontSize: "0.75rem", fontWeight: "700", minHeight: "30px" }}
            >
              Cancel Edit
            </button>
          </div>
        )}
      </div>

      {/* ================= STEP 1: TRUCK & JOB NUMBER ================= */}
      {currentStep === 1 && (
        <div className="glass-panel" style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
              <TruckIcon size={18} color="#e05300" /> 1. Job Number & Truck
            </h3>
            {activeTruck && (
              <span className="badge synced" style={{ fontSize: "0.8rem", fontWeight: "800", padding: "3px 7px" }}>
                Truck: {activeTruck.code}
              </span>
            )}
          </div>

          {/* Job Number Manual Input with Auto-Prefix */}
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              backgroundColor: jobCode.trim() ? "rgba(224, 83, 0, 0.08)" : "rgba(239, 68, 68, 0.08)",
              border: jobCode.trim() ? "1.5px solid rgba(224, 83, 0, 0.35)" : "1.5px solid rgba(239, 68, 68, 0.4)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: "800", color: "var(--text-primary)", margin: 0 }}>
                Job Number (JJ) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                {todaysLoads && todaysLoads.length > 0 ? "Auto from previous" : "Auto: 01"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                  fontFamily: "Outfit, monospace",
                  fontSize: "0.95rem",
                  fontWeight: "800",
                  letterSpacing: "0.02em",
                }}
              >
                {todayDateStr}-
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                className="form-input"
                placeholder="Job # (e.g. 01, 42)"
                value={jobCode}
                onChange={(e) => handleJobCodeChange(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                style={{
                  fontSize: "1.05rem",
                  fontWeight: "900",
                  fontFamily: "Outfit, monospace",
                  padding: "8px 12px",
                  border: jobCode.trim() ? "2px solid #e05300" : "2px solid #ef4444",
                  flex: 1,
                  letterSpacing: "0.03em",
                  minHeight: "38px",
                }}
              />
            </div>

            <div style={{ fontSize: "0.75rem", color: jobCode.trim() ? "#10b981" : "#ef4444", fontWeight: "700", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                {jobCode.trim()
                  ? `✓ Batch Code: ${currentBatchNumber}`
                  : "⚠️ Job Number required"}
              </span>
              {jobCode !== "01" && (
                <button
                  type="button"
                  onClick={() => handleJobCodeChange("01")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    fontSize: "0.72rem",
                    fontWeight: "700",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Reset to 01
                </button>
              )}
            </div>
          </div>

          {/* Mixer Truck License Plate Dropdown Selector */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                marginBottom: "4px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Mixer Truck License Plate:
            </label>
            <select
              className="form-input"
              value={manualTruckCode.trim() ? "__custom__" : (selectedTruckId || (trucks.length > 0 ? trucks[0].id : ""))}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__custom__") {
                  setSelectedTruckId("");
                  if (!manualTruckCode) setManualTruckCode("");
                } else {
                  setSelectedTruckId(val);
                  setManualTruckCode("");
                }
              }}
              style={{
                width: "100%",
                fontSize: "1rem",
                fontWeight: "800",
                padding: "8px 12px",
                minHeight: "42px",
                backgroundColor: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              <option value="" disabled>-- Select Truck License Plate --</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code}
                </option>
              ))}
              <option value="__custom__">➕ Other / Custom Plate...</option>
            </select>
          </div>

          {/* Custom license plate input if __custom__ selected */}
          {(manualTruckCode.trim() || selectedTruckId === "" || selectedTruckId === "__custom__") && (
            <div style={{ marginTop: "2px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  color: "#e05300",
                  marginBottom: "4px",
                  fontWeight: "700",
                }}
              >
                Enter Custom License Plate:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CT3617, CU2573..."
                value={manualTruckCode}
                onChange={(e) => setManualTruckCode(e.target.value.toUpperCase())}
                autoFocus={selectedTruckId === "__custom__"}
                style={{
                  fontSize: "0.95rem",
                  fontWeight: "800",
                  letterSpacing: "0.03em",
                  padding: "8px 12px",
                  border: "2px solid #e05300",
                  minHeight: "38px",
                }}
              />
            </div>
          )}

          {/* Wizard Next Button */}
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleNextStep}
              className="btn-primary"
              style={{ padding: "10px 20px", fontSize: "0.95rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px", minHeight: "42px" }}
            >
              Next: Mix & Quantity <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: MIX DESIGN & QUANTITY ================= */}
      {currentStep === 2 && (
        <div className="glass-panel" style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
            <Layers size={18} color="#e05300" /> 2. Mix Design & Batch Quantity
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {/* 1. TOP GROUP: Aggregate Moisture Settings (Sand & Stone) */}
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--text-secondary)", marginBottom: "4px", display: "block", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Aggregate Moisture Settings
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {/* Sand Moisture */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(59, 130, 246, 0.08)",
                    border: "1.5px solid rgba(59, 130, 246, 0.4)",
                    minHeight: "38px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Droplets size={14} color="#3b82f6" />
                    <div>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", display: "block", lineHeight: 1 }}>Sand</span>
                      <span style={{ fontSize: "0.95rem", fontWeight: "900", color: "#3b82f6", fontFamily: "Outfit, sans-serif" }}>
                        {sandMoisturePct}%
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenMoistureModal?.("Sand")}
                    className="btn-secondary"
                    style={{ padding: "2px 6px", fontSize: "0.68rem", fontWeight: "800", minHeight: "26px" }}
                  >
                    Edit
                  </button>
                </div>

                {/* Stone Moisture */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1.5px solid rgba(16, 185, 129, 0.4)",
                    minHeight: "38px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Droplets size={14} color="#10b981" />
                    <div>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", display: "block", lineHeight: 1 }}>Stone</span>
                      <span style={{ fontSize: "0.95rem", fontWeight: "900", color: "#10b981", fontFamily: "Outfit, sans-serif" }}>
                        {stoneMoisturePct}%
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenMoistureModal?.("Stone")}
                    className="btn-secondary"
                    style={{ padding: "2px 6px", fontSize: "0.68rem", fontWeight: "800", minHeight: "26px" }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>

            {/* 2. BOTTOM GROUP: Mix Design & Batch Quantity */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(95px, 120px)", gap: "8px", alignItems: "end" }}>
              {/* Mix Design */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "3px", display: "block" }}>
                  Select Concrete Mix Design
                </label>
                <select
                  className="form-input"
                  value={selectedMixId}
                  onChange={(e) => handleMixChange(e.target.value)}
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: "800",
                    padding: "8px 10px",
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1.5px solid var(--glass-border)",
                    borderRadius: "8px",
                    width: "100%",
                    minHeight: "38px",
                    cursor: "pointer",
                  }}
                >
                  {groupedMixes.map(([groupName, list]) => (
                    <optgroup key={groupName} label={`── ${groupName} ──`}>
                      {list.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} - {m.description} ({m.strength})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Batch Quantity */}
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "3px", display: "block" }}>
                  Quantity (yd³)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    max="15"
                    step="0.5"
                    className="form-input"
                    value={quantity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setQuantity(isNaN(val) ? 0 : val);
                    }}
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: "900",
                      fontFamily: "Outfit, sans-serif",
                      textAlign: "center",
                      padding: "6px 4px",
                      backgroundColor: "var(--bg-secondary)",
                      color: "#e05300",
                      border: "2px solid #e05300",
                      borderRadius: "8px",
                      width: "100%",
                      minHeight: "38px",
                    }}
                  />
                  <span style={{ fontSize: "0.85rem", fontWeight: "900", color: "#e05300", fontFamily: "Outfit, sans-serif", flexShrink: 0 }}>
                    yd³
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Material Adjustments Carry-Over Banner */}
          {(stoneAdjPerYard !== 0 || stone38AdjPerYard !== 0 || sandAdjPerYard !== 0 || cementAdjPerYard !== 0 || waterAdjPerYard !== 0 || plasticizerAdjPerYard !== 0 || retarderAdjPerYard !== 0) && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                border: "1.5px solid rgba(16, 185, 129, 0.35)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.15rem" }}>⚡</span>
                <div>
                  <strong style={{ color: "#10b981", fontSize: "0.88rem" }}>
                    Mix Adjustments Carried Over
                  </strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    {carriedOverFrom?.truckCode
                      ? `Loaded previous cement/water/aggregate rates from Truck ${carriedOverFrom.truckCode} on Job #${jobCode}`
                      : `Custom 1-yd rates automatically carried over for Job #${jobCode}`}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStoneAdjPerYard(0);
                  setStone38AdjPerYard(0);
                  setSandAdjPerYard(0);
                  setCementAdjPerYard(0);
                  setWaterAdjPerYard(0);
                  setPlasticizerAdjPerYard(0);
                  setRetarderAdjPerYard(0);
                  setCarriedOverFrom(null);
                }}
                className="btn-secondary"
                style={{ padding: "5px 12px", fontSize: "0.75rem", fontWeight: "800", color: "#f59e0b" }}
              >
                Reset to Standard Recipe
              </button>
            </div>
          )}

          {/* Active Formulation Card: 2 Distinct Rows (1-Yard Mix Base Values & Truck Batch Totals) */}
          {activeMix && (
            <div
              style={{
                padding: "14px",
                borderRadius: "14px",
                backgroundColor: "rgba(224, 83, 0, 0.06)",
                border: "1.5px solid rgba(224, 83, 0, 0.25)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "0.95rem", fontWeight: "900", color: "#e05300", fontFamily: "Outfit, sans-serif" }}>
                    {activeMix.code} 1-Yard Base &amp; Batch ({quantity} yd³)
                  </span>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                    1-yd recipe base scales to truck &bull; Edit numbers to trim load
                  </div>
                </div>

                {(stoneAdjPerYard !== 0 || stone38AdjPerYard !== 0 || sandAdjPerYard !== 0 || cementAdjPerYard !== 0 || waterAdjPerYard !== 0 || plasticizerAdjPerYard !== 0 || retarderAdjPerYard !== 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStoneAdjPerYard(0);
                      setStone38AdjPerYard(0);
                      setSandAdjPerYard(0);
                      setCementAdjPerYard(0);
                      setWaterAdjPerYard(0);
                      setPlasticizerAdjPerYard(0);
                      setRetarderAdjPerYard(0);
                      setCarriedOverFrom(null);
                    }}
                    className="btn-secondary"
                    style={{ padding: "4px 10px", fontSize: "0.72rem", fontWeight: "800", color: "#f59e0b" }}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Row 1: Cement, Sand, Stone */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "800", textTransform: "uppercase" }}>
                  Row 1 &bull; Cement, Sand &amp; Stone (Aggregates)
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: activeMix.threeEighthStone > 0 ? "repeat(auto-fit, minmax(120px, 1fr))" : "repeat(auto-fit, minmax(95px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {/* Cement Card */}
                  <div style={{ backgroundColor: "var(--bg-tertiary)", padding: "10px 8px", borderRadius: "10px", border: cementAdjPerYard !== 0 ? "1.5px solid #3b82f6" : "1px solid var(--glass-border)", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem", fontWeight: "800" }}>Cement</span>
                      <span style={{ fontSize: "0.62rem", color: cementAdjPerYard !== 0 ? "#3b82f6" : "var(--text-muted)", fontWeight: "700" }}>
                        {baseCementRate} kg
                      </span>
                    </div>

                    {/* Editable 1-Yard Base Input */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        className="form-input"
                        value={effCementRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setCementAdjPerYard(val - baseCementRate);
                        }}
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "900",
                          fontFamily: "Outfit, sans-serif",
                          textAlign: "center",
                          padding: "6px",
                          border: "1.5px solid #3b82f6",
                          borderRadius: "8px",
                          width: "100%",
                        }}
                      />
                      <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>kg/y</span>
                    </div>

                    {/* Full Truck Total */}
                    <div style={{ backgroundColor: "rgba(59, 130, 246, 0.08)", padding: "6px 4px", borderRadius: "8px", textAlign: "center", marginTop: "1px" }}>
                      <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700" }}>In Truck</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "#3b82f6", fontFamily: "Outfit, sans-serif" }}>
                        {totalCementBatchKg} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>kg</span>
                      </div>
                    </div>
                  </div>

                  {/* Sand Card */}
                  <div style={{ backgroundColor: "var(--bg-tertiary)", padding: "10px 8px", borderRadius: "10px", border: sandAdjPerYard !== 0 ? "1.5px solid #e05300" : "1px solid var(--glass-border)", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem", fontWeight: "800" }}>Sand</span>
                      <span style={{ fontSize: "0.62rem", color: sandAdjPerYard !== 0 ? "#e05300" : "var(--text-muted)", fontWeight: "700" }}>
                        {baseSandRate} kg
                      </span>
                    </div>

                    {/* Editable 1-Yard Base Input */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        className="form-input"
                        value={effSandRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSandAdjPerYard(val - baseSandRate);
                        }}
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "900",
                          fontFamily: "Outfit, sans-serif",
                          textAlign: "center",
                          padding: "6px",
                          border: "1.5px solid #e05300",
                          borderRadius: "8px",
                          width: "100%",
                        }}
                      />
                      <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>kg/y</span>
                    </div>

                    {/* Sub-details: Dry Base & Replacement Sand */}
                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Dry: {baseSandDryTruck} &bull; +{replacementSand}
                    </div>

                    {/* Full Truck Total with Moisture */}
                    <div style={{ backgroundColor: "rgba(224, 83, 0, 0.08)", padding: "5px 4px", borderRadius: "8px", textAlign: "center", marginTop: "1px" }}>
                      <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700" }}>Weighed ({sandMoisturePct}%)</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "#e05300", fontFamily: "Outfit, sans-serif" }}>
                        {targetTruckSand} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>kg</span>
                      </div>
                    </div>
                  </div>

                  {/* ¾ Stone Card */}
                  <div style={{ backgroundColor: "var(--bg-tertiary)", padding: "10px 8px", borderRadius: "10px", border: stoneAdjPerYard !== 0 ? "1.5px solid #10b981" : "1px solid var(--glass-border)", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem", fontWeight: "800" }}>¾ Stone</span>
                      <span style={{ fontSize: "0.62rem", color: stoneAdjPerYard !== 0 ? "#10b981" : "var(--text-muted)", fontWeight: "700" }}>
                        {baseStoneRate} kg
                      </span>
                    </div>

                    {/* Editable 1-Yard Base Input */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        className="form-input"
                        value={effStoneRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setStoneAdjPerYard(val - baseStoneRate);
                        }}
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "900",
                          fontFamily: "Outfit, sans-serif",
                          textAlign: "center",
                          padding: "6px",
                          border: "1.5px solid #10b981",
                          borderRadius: "8px",
                          width: "100%",
                        }}
                      />
                      <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>kg/y</span>
                    </div>

                    {/* Sub-details: Dry Base & Replacement Stone */}
                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Dry: {baseStoneDryTruck} &bull; +{replacementStone}
                    </div>

                    {/* Full Truck Total */}
                    <div style={{ backgroundColor: "rgba(16, 185, 129, 0.08)", padding: "5px 4px", borderRadius: "8px", textAlign: "center", marginTop: "1px" }}>
                      <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700" }}>Weighed ({stoneMoisturePct}%)</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "#10b981", fontFamily: "Outfit, sans-serif" }}>
                        {totalStoneBatchKg} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>kg</span>
                      </div>
                    </div>
                  </div>

                  {/* ⅜ Stone Card (if present) */}
                  {activeMix.threeEighthStone > 0 && (
                    <div style={{ backgroundColor: "var(--bg-tertiary)", padding: "10px 8px", borderRadius: "10px", border: stone38AdjPerYard !== 0 ? "1.5px solid #10b981" : "1px solid var(--glass-border)", display: "flex", flexDirection: "column", gap: "5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.7rem", fontWeight: "800" }}>⅜ Stone</span>
                        <span style={{ fontSize: "0.62rem", color: stone38AdjPerYard !== 0 ? "#10b981" : "var(--text-muted)", fontWeight: "700" }}>
                          {baseStone38Rate} kg
                        </span>
                      </div>

                      {/* Editable 1-Yard Base Input for ⅜ Stone */}
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="1"
                          className="form-input"
                          value={effStone38Rate}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setStone38AdjPerYard(val - baseStone38Rate);
                          }}
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: "900",
                            fontFamily: "Outfit, sans-serif",
                            textAlign: "center",
                            padding: "6px",
                            border: "1.5px solid #10b981",
                            borderRadius: "8px",
                            width: "100%",
                          }}
                        />
                        <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>kg/y</span>
                      </div>

                      <div style={{ backgroundColor: "rgba(16, 185, 129, 0.08)", padding: "5px 4px", borderRadius: "8px", textAlign: "center", marginTop: "1px" }}>
                        <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700" }}>Weighed ({stoneMoisturePct}%)</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "var(--text-primary)", fontFamily: "Outfit, sans-serif" }}>
                          {totalStone38BatchKg} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>kg</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Water, Plasticizer, Retarder */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: "800", textTransform: "uppercase" }}>
                  Row 2 &bull; Water &amp; Chemical Admixtures
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(95px, 1fr))",
                    gap: "8px",
                  }}
                >
                  {/* Water Card (Adjustable Design Water Base) */}
                  <div style={{ backgroundColor: "var(--bg-tertiary)", padding: "10px 8px", borderRadius: "10px", border: waterAdjPerYard !== 0 ? "1.5px solid #3b82f6" : "1px solid rgba(59, 130, 246, 0.3)", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#3b82f6", fontSize: "0.7rem", fontWeight: "800" }}>Water</span>
                      <span style={{ fontSize: "0.62rem", color: waterAdjPerYard !== 0 ? "#3b82f6" : "var(--text-muted)", fontWeight: "700" }}>
                        {baseWaterRate} L
                      </span>
                    </div>

                    {/* Editable 1-Yard Base Input for Design Water */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        className="form-input"
                        value={effWaterRate}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setWaterAdjPerYard(val - baseWaterRate);
                        }}
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "900",
                          fontFamily: "Outfit, sans-serif",
                          textAlign: "center",
                          padding: "6px",
                          border: "1.5px solid #3b82f6",
                          borderRadius: "8px",
                          width: "100%",
                        }}
                      />
                      <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>L/y</span>
                    </div>

                    {/* Sub-details & Full Truck Total */}
                    <div style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      Des: {theoreticalDesignWater}L &bull; Aggs: -{totalWaterInAggregates}L
                    </div>
                    <div style={{ backgroundColor: "rgba(59, 130, 246, 0.08)", padding: "5px 4px", borderRadius: "8px", textAlign: "center", marginTop: "1px" }}>
                      <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700" }}>To Mixer</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "#3b82f6", fontFamily: "Outfit, sans-serif" }}>
                        {expectedBatchWaterL} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>L</span>
                      </div>
                    </div>
                  </div>

                  {/* Plasticizer (Adjustable Chemical) */}
                  <div style={{ backgroundColor: "var(--bg-tertiary)", padding: "10px 8px", borderRadius: "10px", border: plasticizerAdjPerYard !== 0 ? "1.5px solid #8b5cf6" : "1px solid rgba(139, 92, 246, 0.3)", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#8b5cf6", fontSize: "0.7rem", fontWeight: "800" }}>Plasticizer</span>
                      <span style={{ fontSize: "0.62rem", color: plasticizerAdjPerYard !== 0 ? "#8b5cf6" : "var(--text-muted)", fontWeight: "700" }}>
                        {basePlRateFlOz.toFixed(1)} oz
                      </span>
                    </div>

                    {/* Editable 1-Yard Base Input for Plasticizer */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        className="form-input"
                        value={Math.round(effPlRate * 10) / 10}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setPlasticizerAdjPerYard(Math.round((val - basePlRateFlOz) * 10) / 10);
                        }}
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "900",
                          fontFamily: "Outfit, sans-serif",
                          textAlign: "center",
                          padding: "6px",
                          border: "1.5px solid #8b5cf6",
                          borderRadius: "8px",
                          width: "100%",
                        }}
                      />
                      <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>oz/y</span>
                    </div>

                    {/* Full Truck Total */}
                    <div style={{ backgroundColor: "rgba(139, 92, 246, 0.08)", padding: "6px 4px", borderRadius: "8px", textAlign: "center", marginTop: "1px" }}>
                      <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700" }}>In Truck</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "#8b5cf6", fontFamily: "Outfit, sans-serif" }}>
                        {totalPlasticizerBatchOz} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>oz</span>
                      </div>
                    </div>
                  </div>

                  {/* Retarder (Adjustable Chemical) */}
                  <div style={{ backgroundColor: "var(--bg-tertiary)", padding: "10px 8px", borderRadius: "10px", border: retarderAdjPerYard !== 0 ? "1.5px solid #f59e0b" : "1px solid rgba(245, 158, 11, 0.3)", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#f59e0b", fontSize: "0.7rem", fontWeight: "800" }}>Retarder</span>
                      <span style={{ fontSize: "0.62rem", color: retarderAdjPerYard !== 0 ? "#f59e0b" : "var(--text-muted)", fontWeight: "700" }}>
                        {baseRetRateFlOz.toFixed(1)} oz
                      </span>
                    </div>

                    {/* Editable 1-Yard Base Input for Retarder */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        className="form-input"
                        value={Math.round(effRetRate * 10) / 10}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setRetarderAdjPerYard(Math.round((val - baseRetRateFlOz) * 10) / 10);
                        }}
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: "900",
                          fontFamily: "Outfit, sans-serif",
                          textAlign: "center",
                          padding: "6px",
                          border: "1.5px solid #f59e0b",
                          borderRadius: "8px",
                          width: "100%",
                        }}
                      />
                      <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>oz/y</span>
                    </div>

                    {/* Full Truck Total */}
                    <div style={{ backgroundColor: "rgba(245, 158, 11, 0.08)", padding: "6px 4px", borderRadius: "8px", textAlign: "center", marginTop: "1px" }}>
                      <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700" }}>In Truck</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "#f59e0b", fontFamily: "Outfit, sans-serif" }}>
                        {totalRetarderBatchOz} <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>oz</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Navigation */}
          <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={handlePrevStep}
              className="btn-secondary"
              style={{ padding: "14px 24px", fontSize: "1rem", fontWeight: "700" }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="btn-primary"
              style={{ padding: "14px 28px", fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}
            >
              Next: Review &amp; Log Batch <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: REVIEW & CONFIRM LOAD ================= */}
      {currentStep === 3 && (
        <div className="glass-panel" style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
              <Save size={18} color="#e05300" /> 3. Review &amp; Confirm Batch
            </h3>
            <span className="badge synced" style={{ fontSize: "0.75rem", padding: "2px 6px" }}>
              Ready to Log
            </span>
          </div>

          {/* Load Summary Confirmation Sheet */}
          <div
            style={{
              padding: "10px",
              borderRadius: "10px",
              backgroundColor: "var(--bg-tertiary)",
              border: "1.5px solid var(--glass-border)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ paddingBottom: "6px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: "700" }}>
                Official Batch #
              </span>
              <span style={{ fontSize: "0.95rem", fontWeight: "900", color: "#e05300", fontFamily: "Outfit, monospace" }}>
                {currentBatchNumber}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Truck Plate
                </span>
                <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "var(--text-primary)" }}>
                  {activeTruck?.code}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Batch Quantity
                </span>
                <div style={{ fontSize: "1.15rem", fontWeight: "900", color: "#e05300" }}>
                  {quantity} yd³
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "6px" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Mix Design
              </span>
              <div style={{ fontSize: "0.95rem", fontWeight: "800", color: "var(--text-primary)" }}>
                {activeMix?.code} &bull; {activeMix?.description}
              </div>
            </div>

            {/* Batch Quality & Performance Prediction replacing verbose batching information */}
            {batchPhysics && (
              <div
                style={{
                  marginTop: "4px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                  border: "1.5px solid rgba(16, 185, 129, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "800", color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Sparkles size={16} /> Batch Quality & Performance Prediction
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "800",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      backgroundColor:
                        batchPhysics.wcStatus === "Optimal"
                          ? "rgba(16, 185, 129, 0.2)"
                          : batchPhysics.wcStatus === "Acceptable"
                          ? "rgba(245, 158, 11, 0.2)"
                          : "rgba(239, 68, 68, 0.2)",
                      color:
                        batchPhysics.wcStatus === "Optimal"
                          ? "#10b981"
                          : batchPhysics.wcStatus === "Acceptable"
                          ? "#f59e0b"
                          : "#ef4444",
                    }}
                  >
                    W/C: {batchPhysics.wcRatio} ({batchPhysics.wcStatus})
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
                    gap: "8px",
                    fontSize: "0.8rem",
                  }}
                >
                  <div style={{ backgroundColor: "var(--bg-secondary)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.68rem" }}>W/C Target</div>
                    <strong style={{ color: "var(--text-primary)" }}>{batchPhysics.wcTarget}</strong>
                  </div>

                  <div style={{ backgroundColor: "var(--bg-secondary)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.68rem" }}>Est. Set Time</div>
                    <strong style={{ color: "var(--text-primary)" }}>{batchPhysics.settingTimeFormatted}</strong>
                  </div>

                  <div style={{ backgroundColor: "var(--bg-secondary)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.68rem" }}>Aggregate Ratio</div>
                    <strong style={{ color: "#3b82f6" }}>
                      {batchPhysics.aggregateRatio?.ratioFormatted || "60:40"}{" "}
                      <span style={{ fontSize: "0.68rem", fontWeight: "normal", color: "var(--text-muted)" }}>
                        (Sand:Stone)
                      </span>
                    </strong>
                  </div>

                  <div style={{ backgroundColor: "var(--bg-secondary)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.68rem" }}>28d Strength</div>
                    <strong style={{ color: "#10b981" }}>{batchPhysics.strength.s28d.toLocaleString()} PSI</strong>
                  </div>

                  <div style={{ backgroundColor: "var(--bg-secondary)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.68rem" }}>Paste Fraction</div>
                    <strong style={{ color: "var(--text-primary)" }}>{batchPhysics.paste.pastePct}% ({batchPhysics.paste.pasteStatus})</strong>
                  </div>

                  <div style={{ backgroundColor: "var(--bg-secondary)", padding: "8px 10px", borderRadius: "8px", textAlign: "center" }}>
                    <div style={{ color: "var(--text-secondary)", fontSize: "0.68rem" }}>Batch Yield</div>
                    <strong style={{ color: "#e05300" }}>{batchPhysics.yieldCYD} yd³</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button
              type="button"
              onClick={handlePrevStep}
              className="btn-secondary"
              style={{ flex: 1, padding: "10px 14px", fontSize: "0.9rem", fontWeight: "700", minHeight: "44px" }}
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={handlePerformSave}
              disabled={isSaving}
              style={{
                flex: 2,
                padding: "10px 18px",
                borderRadius: "10px",
                border: "none",
                background: "linear-gradient(135deg, #e05300 0%, #c2410c 100%)",
                color: "#fff",
                fontSize: "1.05rem",
                fontWeight: "900",
                fontFamily: "Outfit, sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 16px rgba(224, 83, 0, 0.35)",
                minHeight: "44px",
              }}
            >
              <Save size={18} /> {isSaving ? "Saving..." : initialValues?.id ? "SAVE LOAD" : "LOG BATCH"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
