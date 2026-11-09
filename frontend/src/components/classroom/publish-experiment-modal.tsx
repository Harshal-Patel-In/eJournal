/**
 * Publish & Edit Practical Assignment Modal.
 *
 * Grounded in:
 * - Hallmark (Zero card-in-card nesting, zero emojis as icons, zero tracked mono eyebrows)
 * - Apple HIG (Segmented controls, clear hierarchy, deference to academic content)
 * - Superdesign (Linear / Apple Numbers tabular criteria matrix, unified spatial rhythm)
 * - Proportional typography (Inter / font-sans, tabular-nums for numeric weights)
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Clock,
  Code2,
  Compass,
  Cpu,
  FileCheck,
  FileText,
  FlaskConical,
  Layers,
  Lock,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

export interface RubricCriterionItem {
  id: string;
  title: string;
  maxMarks: number;
  description?: string;
}

interface PublishExperimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  classroomId: string;
  classroomBatches?: string[];
  existingClusterNames?: string[];
  mode?: "create" | "edit";
  initialData?: any;
  hasGradedSubmissions?: boolean;
}

interface RubricPreset {
  id: string;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ className?: string }>;
  criteria: Array<{
    title: string;
    description: string;
    percent: number;
  }>;
}

const RUBRIC_PRESETS: RubricPreset[] = [
  {
    id: "cs",
    name: "Computer Science & Coding",
    shortName: "Computer Science",
    icon: Code2,
    criteria: [
      {
        title: "Logic & Algorithm Design",
        description: "Problem decomposition, pseudocode, time/space complexity analysis",
        percent: 25,
      },
      {
        title: "Code Quality & Standards",
        description: "Clean code, modular structure, naming conventions, docstrings",
        percent: 25,
      },
      {
        title: "Execution & Test Cases",
        description: "Passing sample and edge test cases, handling boundary inputs",
        percent: 30,
      },
      {
        title: "Viva Voce & Conceptual Defense",
        description: "Understanding of underlying principles and code defense",
        percent: 20,
      },
    ],
  },
  {
    id: "ee",
    name: "Electrical & Electronics",
    shortName: "Electrical / Electronics",
    icon: Cpu,
    criteria: [
      {
        title: "Circuit Setup & Apparatus Wiring",
        description: "Accurate breadboard/bench wiring, safety protocol, component sizing",
        percent: 30,
      },
      {
        title: "Data Observation & Graph Plotting",
        description: "Precise multimeter/CRO measurements, tabulation, slope/curve plotting",
        percent: 40,
      },
      {
        title: "Conclusion, Error Analysis & Viva",
        description: "Theoretical vs experimental comparison, percentage error, viva defense",
        percent: 30,
      },
    ],
  },
  {
    id: "chem",
    name: "Chemistry & Wet Lab",
    shortName: "Chemistry",
    icon: FlaskConical,
    criteria: [
      {
        title: "Apparatus Setup & Safety Precautions",
        description: "Glassware handling, reagent measurements, PPE compliance",
        percent: 20,
      },
      {
        title: "Titration & Reaction Accuracy",
        description: "End-point concordance, observation precision, minimal reagent wastage",
        percent: 40,
      },
      {
        title: "Stoichiometry & Lab Record",
        description: "Calculations, yield percentage, observation record, viva",
        percent: 40,
      },
    ],
  },
  {
    id: "mech",
    name: "Mechanical & CAD",
    shortName: "Mechanical / CAD",
    icon: Compass,
    criteria: [
      {
        title: "CAD Modeling & Dimensioning Tolerance",
        description: "Parametric constraints, geometric tolerances, ISO drafting standards",
        percent: 35,
      },
      {
        title: "Machine Setup & Fabrication Precision",
        description: "Machine tool setting, dimensional accuracy, surface finish",
        percent: 35,
      },
      {
        title: "Technical Report & Engineering Viva",
        description: "Material analysis, failure modes, design defense",
        percent: 30,
      },
    ],
  },
  {
    id: "general",
    name: "General Report & Viva",
    shortName: "General Viva",
    icon: FileText,
    criteria: [
      {
        title: "Experimental Methodology & Procedure",
        description: "Theoretical foundation, setup execution, adherence to procedure",
        percent: 40,
      },
      {
        title: "Results, Data Tables & Graphical Inferences",
        description: "Systematic data recording, charts, statistical analysis",
        percent: 40,
      },
      {
        title: "Viva Voce & Technical Defense",
        description: "Direct oral questioning, concept mastery",
        percent: 20,
      },
    ],
  },
];

function toDateTimeLocalString(dateVal: string | null | undefined): string {
  if (!dateVal) return "";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function PublishExperimentModal({
  isOpen,
  onClose,
  classroomId,
  classroomBatches = [],
  existingClusterNames = [],
  mode = "create",
  initialData,
  hasGradedSubmissions = false,
}: PublishExperimentModalProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Form State - Step 1: Identity & Scope
  const [experimentNumber, setExperimentNumber] = useState<number>(1);
  const [maxMarks, setMaxMarks] = useState<number>(20);
  const [title, setTitle] = useState<string>("");
  const [aim, setAim] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [clusterName, setClusterName] = useState<string>("");
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  // Form State - Step 2: Timeline & Lab Session
  const [publishStrategy, setPublishStrategy] = useState<"immediate" | "scheduled">("immediate");
  const [publishDate, setPublishDate] = useState<string>("");
  const [conductedDate, setConductedDate] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [allowLateSubmissions, setAllowLateSubmissions] = useState<boolean>(true);
  const [lateGraceDays, setLateGraceDays] = useState<number>(3);
  const [notifyStudents, setNotifyStudents] = useState<boolean>(true);
  const [changeReason, setChangeReason] = useState<string>("");

  // Form State - Step 3: Dynamic Rubrics
  const [rubricMode, setRubricMode] = useState<"rubric" | "flat">("rubric");
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterionItem[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Validation Error State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form state whenever modal opens or initialData changes
  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && initialData) {
      setExperimentNumber(initialData.experimentNumber || 1);
      setMaxMarks(initialData.maxMarks || 20);
      setTitle(initialData.title || "");
      setAim(initialData.aim || "");
      setInstructions(initialData.instructions || "");
      setClusterName(initialData.clusterName || "");
      setSelectedBatches(initialData.targetBatches || []);

      if (initialData.publishDate && new Date(initialData.publishDate) > new Date()) {
        setPublishStrategy("scheduled");
        setPublishDate(toDateTimeLocalString(initialData.publishDate));
      } else {
        setPublishStrategy("immediate");
        setPublishDate(toDateTimeLocalString(initialData.publishDate) || "");
      }

      setConductedDate(toDateTimeLocalString(initialData.conductedDate) || "");
      setDeadline(toDateTimeLocalString(initialData.deadline) || "");
      setAllowLateSubmissions(initialData.allowLateSubmissions ?? true);
      setLateGraceDays(initialData.lateGraceDays ?? 3);
      setNotifyStudents(true);
      setChangeReason("");

      if (initialData.rubric && Array.isArray(initialData.rubric) && initialData.rubric.length > 0) {
        setRubricMode("rubric");
        setRubricCriteria(
          initialData.rubric.map((r: any, idx: number) => ({
            id: r.id || `c${idx + 1}`,
            title: r.title || `Criterion ${idx + 1}`,
            maxMarks: Number(r.maxMarks) || 5,
            description: r.description || "",
          }))
        );
      } else {
        setRubricMode("flat");
        setRubricCriteria([]);
      }
    } else {
      // Default Create Mode
      setExperimentNumber(1);
      setMaxMarks(20);
      setTitle("");
      setAim("");
      setInstructions("");
      setClusterName("");
      setSelectedBatches([]);

      setPublishStrategy("immediate");
      setPublishDate("");
      setConductedDate("");

      // Default deadline: 7 days from now at 23:59 IST
      const defaultDead = new Date();
      defaultDead.setDate(defaultDead.getDate() + 7);
      defaultDead.setHours(23, 59, 0, 0);
      setDeadline(toDateTimeLocalString(defaultDead.toISOString()));

      setAllowLateSubmissions(true);
      setLateGraceDays(3);
      setNotifyStudents(true);
      setChangeReason("");

      // Default Rubric: Computer Science preset scaled to 20 marks
      setRubricMode("rubric");
      applyPreset(RUBRIC_PRESETS[0], 20);
    }
    setErrors({});
    setCurrentStep(1);
  }, [isOpen, mode, initialData]);

  // Rubric Balance Calculation
  const rubricSum = useMemo(() => {
    return rubricCriteria.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);
  }, [rubricCriteria]);

  const rubricDifference = useMemo(() => {
    return Math.round((maxMarks - rubricSum) * 10) / 10;
  }, [maxMarks, rubricSum]);

  const isRubricBalanced = useMemo(() => {
    if (rubricMode === "flat") return true;
    return Math.abs(rubricDifference) < 0.05 && rubricCriteria.length > 0;
  }, [rubricMode, rubricDifference, rubricCriteria.length]);

  // Apply a discipline preset scaled to maxMarks
  function applyPreset(preset: RubricPreset, totalMarks = maxMarks) {
    setActivePresetId(preset.id);
    let remaining = totalMarks;
    const newCriteria: RubricCriterionItem[] = preset.criteria.map((c, idx) => {
      let marks = Math.round((c.percent / 100) * totalMarks * 2) / 2;
      if (idx === preset.criteria.length - 1) {
        marks = remaining;
      } else {
        remaining = Math.round((remaining - marks) * 10) / 10;
      }
      return {
        id: `c${idx + 1}`,
        title: c.title,
        maxMarks: Math.max(1, marks),
        description: c.description,
      };
    });
    setRubricCriteria(newCriteria);
  }

  // Add custom criterion row
  function handleAddCriterion() {
    const nextIdx = rubricCriteria.length + 1;
    const defaultMarks = Math.max(1, rubricDifference > 0 ? rubricDifference : 5);
    setRubricCriteria([
      ...rubricCriteria,
      {
        id: `c${Date.now().toString().slice(-4)}`,
        title: `Criterion ${nextIdx}`,
        maxMarks: defaultMarks,
        description: "",
      },
    ]);
    setActivePresetId(null);
  }

  // Remove criterion row
  function handleRemoveCriterion(index: number) {
    const updated = rubricCriteria.filter((_, idx) => idx !== index);
    setRubricCriteria(updated);
    setActivePresetId(null);
  }

  // Update criterion row field
  function handleUpdateCriterion(index: number, field: keyof RubricCriterionItem, value: any) {
    const updated = [...rubricCriteria];
    updated[index] = { ...updated[index], [field]: value };
    setRubricCriteria(updated);
    setActivePresetId(null);
  }

  // Auto-balance helper
  function handleAutoBalance() {
    if (rubricCriteria.length === 0 || rubricDifference === 0) return;
    const updated = [...rubricCriteria];
    const lastIdx = updated.length - 1;
    const newMarks = Math.max(0.5, (Number(updated[lastIdx].maxMarks) || 0) + rubricDifference);
    updated[lastIdx].maxMarks = Math.round(newMarks * 10) / 10;
    setRubricCriteria(updated);
  }

  // Toggle Batch selection
  function handleToggleBatch(batch: string) {
    if (selectedBatches.includes(batch)) {
      setSelectedBatches(selectedBatches.filter((b) => b !== batch));
    } else {
      setSelectedBatches([...selectedBatches, batch]);
    }
  }

  // Step 1 Validation
  function validateStep1(): boolean {
    const err: Record<string, string> = {};
    if (!experimentNumber || experimentNumber < 1) err.experimentNumber = "Experiment number must be 1 or higher";
    if (!maxMarks || maxMarks < 1 || maxMarks > 100) err.maxMarks = "Maximum marks must be between 1 and 100";
    if (!title.trim() || title.trim().length < 2) err.title = "Practical title is required (minimum 2 characters)";
    if (!aim.trim() || aim.trim().length < 2) err.aim = "Experiment aim is required";
    if (!instructions.trim() || instructions.trim().length < 2) err.instructions = "Lab procedure instructions are required";

    setErrors(err);
    return Object.keys(err).length === 0;
  }

  // Step 2 Validation
  function validateStep2(): boolean {
    const err: Record<string, string> = {};
    if (!deadline) {
      err.deadline = "Final submission deadline is required";
    } else {
      const deadDate = new Date(deadline);
      if (isNaN(deadDate.getTime())) {
        err.deadline = "Invalid deadline date format";
      }
    }

    if (publishStrategy === "scheduled") {
      if (!publishDate) {
        err.publishDate = "Scheduled release date is required";
      } else if (deadline && new Date(publishDate) >= new Date(deadline)) {
        err.publishDate = "Release date must be earlier than the submission deadline";
      }
    }

    if (conductedDate && deadline) {
      const condDate = new Date(conductedDate);
      const deadDate = new Date(deadline);
      if (condDate > deadDate) {
        err.conductedDate = "Lab session date should be scheduled on or before the deadline";
      }
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  }

  // Step 3 Validation
  function validateStep3(): boolean {
    const err: Record<string, string> = {};
    if (rubricMode === "rubric") {
      if (rubricCriteria.length === 0) {
        err.rubric = "Please add at least one criterion or switch to Flat marks";
      } else if (!isRubricBalanced) {
        err.rubric = `Rubric criteria sum (${rubricSum}) must equal Max Marks (${maxMarks})`;
      }
      for (const crit of rubricCriteria) {
        if (!crit.title.trim()) {
          err.rubric = "All criteria must have a title";
          break;
        }
        if (!crit.maxMarks || crit.maxMarks <= 0) {
          err.rubric = "Criterion marks must be greater than zero";
          break;
        }
      }
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/classrooms/${classroomId}/assignments`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["gradebook", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      toast.success(
        publishStrategy === "scheduled"
          ? `Practical scheduled for release on ${new Date(publishDate).toLocaleString()}`
          : "Practical assignment published successfully"
      );
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to publish practical assignment");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) =>
      api.patch(`/classrooms/${classroomId}/assignments/${initialData.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["gradebook", classroomId] });
      queryClient.invalidateQueries({ queryKey: ["submissions", classroomId] });
      toast.success("Practical assignment updated successfully");
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update practical assignment");
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Submit Handler
  function handleFormSubmit() {
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep3()) {
      setCurrentStep(3);
      return;
    }

    const payload: any = {
      title: title.trim(),
      aim: aim.trim(),
      instructions: instructions.trim(),
      maxMarks: Number(maxMarks),
      deadline: new Date(deadline).toISOString(),
      clusterName: clusterName.trim() || null,
      targetBatches: selectedBatches,
      conductedDate: conductedDate ? new Date(conductedDate).toISOString() : null,
      publishDate:
        publishStrategy === "scheduled" && publishDate ? new Date(publishDate).toISOString() : null,
      allowLateSubmissions,
      lateGraceDays: Number(lateGraceDays) || 3,
    };

    if (rubricMode === "rubric" && !hasGradedSubmissions) {
      payload.rubric = rubricCriteria.map((c, i) => ({
        id: c.id || `c${i + 1}`,
        title: c.title.trim(),
        maxMarks: Number(c.maxMarks),
        description: c.description?.trim() || null,
      }));
    } else if (rubricMode === "flat" && !hasGradedSubmissions) {
      payload.rubric = null;
    }

    if (mode === "edit") {
      payload.notifyStudents = notifyStudents;
      if (changeReason.trim()) {
        payload.changeReason = changeReason.trim();
      }
      updateMutation.mutate(payload);
    } else {
      payload.experimentNumber = Number(experimentNumber);
      createMutation.mutate(payload);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-150">
      <div
        className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-[680px] flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-card">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-lg text-foreground tracking-tight">
                {mode === "edit"
                  ? `Edit Practical #${experimentNumber}`
                  : "New Practical Assignment"}
              </h3>
              <span className="text-xs font-sans font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {mode === "edit" ? "Edit Mode" : "Step " + currentStep + " of 3"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define experiment scope, lab session schedule, and evaluation criteria
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Step Navigation Bar (Apple Segmented Style) */}
        <div className="px-6 py-2.5 bg-muted/20 border-b border-border shrink-0">
          <div className="flex items-center p-1 bg-muted/60 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer ${
                currentStep === 1
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              1. Identity & Scope
            </button>

            <button
              type="button"
              onClick={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer ${
                currentStep === 2
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              2. Timeline & Lab
            </button>

            <button
              type="button"
              onClick={() => {
                if (validateStep1() && validateStep2()) setCurrentStep(3);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer ${
                currentStep === 3
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              3. Dynamic Rubrics
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5 text-xs font-sans">
          {/* STEP 1: IDENTITY & SCOPE */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Experiment Number <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    disabled={mode === "edit"}
                    value={experimentNumber}
                    onChange={(e) => setExperimentNumber(parseInt(e.target.value) || 1)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs tabular-nums focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
                  />
                  {errors.experimentNumber && (
                    <span className="text-[11px] text-destructive">{errors.experimentNumber}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Total Maximum Marks <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={hasGradedSubmissions}
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(parseInt(e.target.value) || 20)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs tabular-nums focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
                  />
                  {errors.maxMarks && (
                    <span className="text-[11px] text-destructive">{errors.maxMarks}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Experiment Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verification of Ohm's Law and Resistive Circuits"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
                {errors.title && <span className="text-[11px] text-destructive">{errors.title}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Aim & Objectives <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="State the scientific hypothesis, circuit objective, or algorithm goal..."
                  value={aim}
                  onChange={(e) => setAim(e.target.value)}
                  className="rounded-lg border border-input bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none leading-relaxed"
                />
                {errors.aim && <span className="text-[11px] text-destructive">{errors.aim}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">
                  Instructions & Lab Procedure <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Step 1: Set up apparatus. Step 2: Vary input parameters and observe readings..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="rounded-lg border border-input bg-background p-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none leading-relaxed"
                />
                {errors.instructions && (
                  <span className="text-[11px] text-destructive">{errors.instructions}</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Layers className="size-3.5 text-muted-foreground" />
                    <span>Evaluation Cluster (Optional)</span>
                  </label>
                  <input
                    type="text"
                    list="cluster-options"
                    placeholder="e.g. Cluster 1: Analog Circuits"
                    value={clusterName}
                    onChange={(e) => setClusterName(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <datalist id="cluster-options">
                    {existingClusterNames.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {classroomBatches && classroomBatches.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Users className="size-3.5 text-muted-foreground" />
                      <span>Target Student Batches</span>
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedBatches([])}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                          selectedBatches.length === 0
                            ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All Batches
                      </button>
                      {classroomBatches.map((b) => {
                        const isSelected = selectedBatches.includes(b);
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => handleToggleBatch(b)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                              isSelected
                                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Batch {b}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: TIMELINE & LAB SCHEDULING (FLAT UNIFIED FORM - ZERO NESTED CARDS) */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-150">
              {/* Release Strategy Segmented Switch */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground">
                  Publishing Release Strategy
                </label>
                <div className="flex items-center p-1 bg-muted/60 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setPublishStrategy("immediate")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs text-left transition-all cursor-pointer ${
                      publishStrategy === "immediate"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-semibold text-xs">Immediate Release</div>
                    <div className="text-[11px] text-muted-foreground font-normal">
                      Publish immediately; visible to enrolled students right away
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPublishStrategy("scheduled")}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs text-left transition-all cursor-pointer ${
                      publishStrategy === "scheduled"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-semibold text-xs">Scheduled Release</div>
                    <div className="text-[11px] text-muted-foreground font-normal">
                      Hidden from students until the scheduled release date
                    </div>
                  </button>
                </div>

                {publishStrategy === "scheduled" && (
                  <div className="flex flex-col gap-1.5 pt-2 animate-in fade-in duration-100">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Clock className="size-3.5 text-primary" />
                      <span>Release Date & Time</span>
                      <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={publishDate}
                      onChange={(e) => setPublishDate(e.target.value)}
                      className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                    {errors.publishDate && (
                      <span className="text-[11px] text-destructive">{errors.publishDate}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Quiet Hairline Divider */}
              <div className="border-t border-border" />

              {/* Lab Session & Deadline Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Lab Conducted Date</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-normal flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-sky-500 shrink-0" />
                    <span>Physical practical session. Plotted as Upcoming on Academic Calendar.</span>
                  </p>
                  <input
                    type="datetime-local"
                    value={conductedDate}
                    onChange={(e) => setConductedDate(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  {errors.conductedDate && (
                    <span className="text-[11px] text-destructive">{errors.conductedDate}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Cut-off Deadline</span>
                    <span className="text-destructive">*</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground leading-normal flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>Final submission deadline. Plotted as Due or Due Soon on Academic Calendar.</span>
                  </p>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  {errors.deadline && (
                    <span className="text-[11px] text-destructive">{errors.deadline}</span>
                  )}
                </div>
              </div>

              {/* Quiet Hairline Divider */}
              <div className="border-t border-border" />

              {/* Submission Policy & Grace Period */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Allow Late Submissions
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Permit student submissions after deadline with an automatic "Late" label
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowLateSubmissions}
                    onChange={(e) => setAllowLateSubmissions(e.target.checked)}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                </div>

                {allowLateSubmissions && (
                  <div className="flex items-center gap-2.5 pt-1 text-xs">
                    <span className="text-muted-foreground">Late submission grace period:</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={lateGraceDays}
                      onChange={(e) => setLateGraceDays(parseInt(e.target.value) || 3)}
                      className="w-14 h-8 rounded-lg border border-input bg-background px-2 text-xs tabular-nums text-center focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                    <span className="text-muted-foreground">days permitted</span>
                  </div>
                )}
              </div>

              {/* Edit Mode: Real-time Notification Row */}
              {mode === "edit" && (
                <>
                  <div className="border-t border-border" />
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="size-3.5 text-primary" />
                        <div>
                          <span className="text-xs font-semibold text-foreground block">
                            Notify Enrolled Students
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Dispatches live toast notifications if date or deadline changes
                          </span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifyStudents}
                        onChange={(e) => setNotifyStudents(e.target.checked)}
                        className="size-4 accent-primary cursor-pointer rounded"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1">
                      <label className="text-[11px] text-muted-foreground font-medium">
                        Change Reason Note (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Deadline extended due to college symposium"
                        value={changeReason}
                        onChange={(e) => setChangeReason(e.target.value)}
                        className="h-8 rounded-lg border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3: DYNAMIC RUBRIC MATRIX (LINEAR / APPLE SPREADSHEET MATRIX) */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-150">
              {/* Evaluation Lock Banner */}
              {hasGradedSubmissions && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5">
                  <Lock className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-xs text-amber-900 dark:text-amber-300 block">
                      Rubric criteria are locked
                    </span>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed mt-0.5">
                      Submissions have already been evaluated using this rubric. To maintain academic grading
                      integrity, rubric criteria cannot be altered.
                    </p>
                  </div>
                </div>
              )}

              {/* Evaluation Mode Selector */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">Evaluation Mode</span>
                  <span className="text-[11px] text-muted-foreground">
                    Continuous assessment rubrics vs flat single-score grading
                  </span>
                </div>

                <div className="flex items-center p-1 bg-muted/60 rounded-xl gap-1">
                  <button
                    type="button"
                    disabled={hasGradedSubmissions}
                    onClick={() => {
                      setRubricMode("rubric");
                      if (rubricCriteria.length === 0) {
                        applyPreset(RUBRIC_PRESETS[0], maxMarks);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      rubricMode === "rubric"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Rubric Matrix
                  </button>

                  <button
                    type="button"
                    disabled={hasGradedSubmissions}
                    onClick={() => setRubricMode("flat")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      rubricMode === "flat"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Flat Marks
                  </button>
                </div>
              </div>

              {rubricMode === "rubric" && (
                <>
                  {/* Discipline Presets Starter Bar (Zero Emojis - Crisp Lucide SVG Icons) */}
                  {!hasGradedSubmissions && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Discipline Starters (100% Editable)
                        </span>
                        <span className="text-[11px] text-muted-foreground">Click to populate starter rows</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {RUBRIC_PRESETS.map((preset) => {
                          const IconComp = preset.icon;
                          const isActive = activePresetId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => applyPreset(preset, maxMarks)}
                              className={`p-2.5 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                                isActive
                                  ? "bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/20"
                                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/30"
                              }`}
                            >
                              <IconComp className="size-4 text-primary" />
                              <span className="font-semibold text-xs leading-tight line-clamp-1">
                                {preset.shortName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Refined Tabular Criteria Matrix (Linear/Apple Numbers Style) */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-foreground">
                        Evaluation Criteria ({rubricCriteria.length})
                      </span>
                      {!hasGradedSubmissions && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddCriterion}
                          className="h-7 px-2.5 text-xs gap-1 rounded-lg border-dashed text-primary hover:border-primary cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                          <span>Add Criterion</span>
                        </Button>
                      )}
                    </div>

                    {/* Criteria Spreadsheet Table */}
                    <div className="rounded-xl border border-border overflow-hidden bg-background">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 border-b border-border text-[11px] font-medium text-muted-foreground">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-8">Criterion Title & Guidance</div>
                        <div className="col-span-2 text-right">Weight</div>
                        <div className="col-span-1 text-center">Action</div>
                      </div>

                      <div className="divide-y divide-border/60">
                        {rubricCriteria.map((crit, index) => (
                          <div
                            key={crit.id || index}
                            className="grid grid-cols-12 gap-2 p-3 items-start hover:bg-muted/15 transition-colors"
                          >
                            <div className="col-span-1 text-center text-xs font-semibold text-muted-foreground pt-1.5">
                              {index + 1}
                            </div>

                            <div className="col-span-8 flex flex-col gap-1.5">
                              <input
                                type="text"
                                disabled={hasGradedSubmissions}
                                placeholder="Criterion title (e.g. Code Quality & Standards)"
                                value={crit.title}
                                onChange={(e) => handleUpdateCriterion(index, "title", e.target.value)}
                                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
                              />
                              <input
                                type="text"
                                disabled={hasGradedSubmissions}
                                placeholder="Guidance notes for scoring (e.g. modular structure, proper documentation)"
                                value={crit.description || ""}
                                onChange={(e) => handleUpdateCriterion(index, "description", e.target.value)}
                                className="h-7 rounded-lg border border-input/60 bg-muted/15 px-2.5 text-[11px] text-muted-foreground placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
                              />
                            </div>

                            <div className="col-span-2 flex items-center justify-end gap-1 pt-0.5">
                              <input
                                type="number"
                                min="0.5"
                                max={maxMarks}
                                step="0.5"
                                disabled={hasGradedSubmissions}
                                value={crit.maxMarks}
                                onChange={(e) =>
                                  handleUpdateCriterion(
                                    index,
                                    "maxMarks",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-14 h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold tabular-nums text-center focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
                              />
                              <span className="text-[11px] text-muted-foreground">pts</span>
                            </div>

                            <div className="col-span-1 flex items-center justify-center pt-0.5">
                              {!hasGradedSubmissions && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCriterion(index)}
                                  className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Delete criterion"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Integrated Mark Allocation Telemetry Strip (Single Icon - Zero Double Ticks) */}
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isRubricBalanced
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-300"
                          : rubricDifference > 0
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300"
                          : "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`size-6 rounded-full flex items-center justify-center shrink-0 ${
                            isRubricBalanced
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              : rubricDifference > 0
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                              : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          <Check className="size-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-xs leading-tight">
                            {isRubricBalanced
                              ? `Balanced: All ${maxMarks} marks allocated (${rubricSum} / ${maxMarks})`
                              : rubricDifference > 0
                              ? `Unallocated: ${rubricDifference} marks remaining (${rubricSum} / ${maxMarks})`
                              : `Exceeded by ${Math.abs(rubricDifference)} marks (${rubricSum} / ${maxMarks})`}
                          </div>
                          <span className="text-[11px] opacity-80">
                            Criteria total must equal total Max Marks before publishing
                          </span>
                        </div>
                      </div>

                      {!hasGradedSubmissions && !isRubricBalanced && rubricDifference > 0 && (
                        <button
                          type="button"
                          onClick={handleAutoBalance}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 transition-colors cursor-pointer border border-amber-500/30 shrink-0"
                        >
                          Auto-Balance (+{rubricDifference} pts)
                        </button>
                      )}
                    </div>

                    {errors.rubric && (
                      <span className="text-xs text-destructive font-medium">{errors.rubric}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <div>
            {currentStep > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3) : 1))}
                className="gap-1.5 h-8.5 px-3 text-xs font-semibold rounded-lg"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-8.5 px-3 text-xs font-medium rounded-lg"
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (currentStep === 1 && validateStep1()) setCurrentStep(2);
                  if (currentStep === 2 && validateStep2()) setCurrentStep(3);
                }}
                className="gap-1.5 h-8.5 px-4 text-xs font-semibold rounded-lg glass-btn-indigo-solid shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting || (rubricMode === "rubric" && !isRubricBalanced)}
                onClick={handleFormSubmit}
                className="gap-1.5 h-8.5 px-5 text-xs font-bold rounded-lg glass-btn-indigo-solid shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Saving practical...</span>
                ) : (
                  <>
                    <FileCheck className="size-3.5" />
                    <span>{mode === "edit" ? "Update Practical" : "Publish Practical"}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
