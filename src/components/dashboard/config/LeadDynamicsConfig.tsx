"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import "./lead-dynamics.css";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Code2,
  FileText,
  Calendar,
  Clock,
  Hash,
  ListFilter,
  CheckSquare,
  UploadCloud,
  Check,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";

export type InputType =
  | "TEXT"
  | "TEXTAREA"
  | "NUMBER"
  | "SELECT"
  | "RADIO"
  | "CHECKBOX"
  | "DATE"
  | "FILE"
  | "DATETIME";

export interface FieldOption {
  id: string;
  label: string;
  value: string;
}

export interface DynamicFieldDefinition {
  id: string;
  name: string;
  inputType: InputType;
  isRequired: boolean;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  options?: FieldOption[];
  config?: {
    maxFileSizeMb?: number;
    allowedFileTypes?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

const SUPPORTED_INPUT_TYPES: { type: InputType; label: string; description: string }[] = [
  { type: "TEXT", label: "TEXT", description: "Single-line text input." },
  { type: "TEXTAREA", label: "TEXTAREA", description: "Multiline text input." },
  { type: "NUMBER", label: "NUMBER", description: "Numeric input with numeric validation." },
  { type: "SELECT", label: "SELECT", description: "Dropdown menu with one selectable option." },
  { type: "RADIO", label: "RADIO", description: "Radio group with single selectable option." },
  { type: "CHECKBOX", label: "CHECKBOX", description: "Checkbox group allowing multiple choices." },
  { type: "DATE", label: "DATE", description: "Date picker without timezone offset." },
  { type: "FILE", label: "FILE", description: "File upload with authorized access controls." },
  { type: "DATETIME", label: "DATETIME", description: "Date and time selector with timezone handling." },
];

export function LeadDynamicsConfig() {
  const [mounted, setMounted] = useState(false);
  const [fields, setFields] = useState<DynamicFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tab State
  const [activeTab, setActiveTab] = useState<"fields" | "highlights">("fields");

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<DynamicFieldDefinition | null>(null);

  // Delete Confirmation Modal
  const [deletingField, setDeletingField] = useState<DynamicFieldDefinition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    inputType: InputType;
    isRequired: boolean;
    status: "ACTIVE" | "INACTIVE";
    sortOrder: number;
    options: { id: string; label: string; value: string }[];
  }>({
    name: "",
    inputType: "TEXT",
    isRequired: false,
    status: "ACTIVE",
    sortOrder: 1,
    options: [
      { id: "opt_1", label: "Option 1", value: "Option 1" },
      { id: "opt_2", label: "Option 2", value: "Option 2" },
    ],
  });

  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load custom fields from API
  const fetchFields = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/custom-fields?all=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load fields.");
      setFields(data.fields || []);
    } catch (err: any) {
      setError(err.message || "Could not fetch dynamic fields.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, []);

  // Compute Statistics Cards
  const stats = useMemo(() => {
    const total = fields.length;
    const active = fields.filter((f) => f.status === "ACTIVE").length;
    const selectable = fields.filter((f) =>
      ["SELECT", "RADIO", "CHECKBOX"].includes(f.inputType)
    ).length;
    return { total, active, selectable };
  }, [fields]);

  // Filtered Fields List
  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ACTIVE"
          ? f.status === "ACTIVE"
          : f.status === "INACTIVE";
      return matchesSearch && matchesStatus;
    });
  }, [fields, searchQuery, statusFilter]);

  // Suggested next sort order
  const suggestedNextSortOrder = useMemo(() => {
    if (fields.length === 0) return 1;
    const maxSort = Math.max(...fields.map((f) => f.sortOrder || 0));
    return maxSort + 1;
  }, [fields]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingField(null);
    setFormData({
      name: "",
      inputType: "TEXT",
      isRequired: false,
      status: "ACTIVE",
      sortOrder: suggestedNextSortOrder,
      options: [
        { id: `opt_${Date.now()}_1`, label: "Option 1", value: "Option 1" },
        { id: `opt_${Date.now()}_2`, label: "Option 2", value: "Option 2" },
      ],
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (field: DynamicFieldDefinition) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      inputType: field.inputType,
      isRequired: field.isRequired,
      status: field.status,
      sortOrder: field.sortOrder,
      options: Array.isArray(field.options) && field.options.length > 0
        ? field.options.map((opt, idx) => ({
            id: opt.id || `opt_${Date.now()}_${idx}`,
            label: opt.label || opt.value || "",
            value: opt.value || opt.label || "",
          }))
        : [
            { id: `opt_${Date.now()}_1`, label: "Option 1", value: "Option 1" },
            { id: `opt_${Date.now()}_2`, label: "Option 2", value: "Option 2" },
          ],
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Modal Close with ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  // Handle Form Submit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const name = formData.name.trim();
    if (!name) {
      setFormError("Field name is required.");
      return;
    }

    if (["SELECT", "RADIO", "CHECKBOX"].includes(formData.inputType)) {
      if (formData.options.length === 0) {
        setFormError(`At least one option is required for ${formData.inputType} fields.`);
        return;
      }
      const labels = formData.options.map((o) => o.label.trim());
      if (labels.some((l) => !l)) {
        setFormError("All option labels must be filled out.");
        return;
      }
      const uniqueSet = new Set(labels.map((l) => l.toLowerCase()));
      if (uniqueSet.size < labels.length) {
        setFormError("Option labels must be unique.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        inputType: formData.inputType,
        isRequired: formData.isRequired,
        status: formData.status,
        sortOrder: Number(formData.sortOrder) || 1,
        options: ["SELECT", "RADIO", "CHECKBOX"].includes(formData.inputType)
          ? formData.options.map((opt) => ({
              id: opt.id,
              label: opt.label.trim(),
              value: opt.value.trim() || opt.label.trim(),
            }))
          : [],
      };

      const url = editingField
        ? `/api/leads/custom-fields/${editingField.id}`
        : `/api/leads/custom-fields`;
      const method = editingField ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save field.");

      setIsModalOpen(false);
      await fetchFields();
    } catch (err: any) {
      setFormError(err.message || "Failed to save field.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingField) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/leads/custom-fields/${deletingField.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete field.");
      setDeletingField(null);
      await fetchFields();
    } catch (err: any) {
      alert(err.message || "Failed to delete field.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Option Editors
  const handleAddOption = () => {
    setFormData((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        {
          id: `opt_${Date.now()}_${prev.options.length + 1}`,
          label: `Option ${prev.options.length + 1}`,
          value: `Option ${prev.options.length + 1}`,
        },
      ],
    }));
  };

  const handleUpdateOption = (index: number, label: string) => {
    setFormData((prev) => {
      const newOpts = [...prev.options];
      newOpts[index] = { ...newOpts[index], label, value: label };
      return { ...prev, options: newOpts };
    });
  };

  const handleRemoveOption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));
  };

  const handleMoveOption = (index: number, direction: "up" | "down") => {
    setFormData((prev) => {
      const newOpts = [...prev.options];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newOpts.length) return prev;
      const temp = newOpts[index];
      newOpts[index] = newOpts[targetIndex];
      newOpts[targetIndex] = temp;
      return { ...prev, options: newOpts };
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="ld-config-container">
      {/* 1. Header Area */}
      <div className="ld-header">
        <div className="ld-header-text">
          <span className="ld-master-badge">MASTER</span>
          <h1 className="ld-title">Lead Dynamics Fields</h1>
          <p className="ld-subtitle">Configure custom fields for lead forms</p>
        </div>
        <button type="button" className="ld-add-btn" onClick={handleOpenCreateModal}>
          <Plus className="ld-btn-icon" />
          <span>Add Field</span>
        </button>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="ld-tabs">
        <button
          type="button"
          className={`ld-tab-item ${activeTab === "fields" ? "active" : ""}`}
          onClick={() => setActiveTab("fields")}
        >
          Form Fields
          {activeTab === "fields" && <span className="ld-tab-line" />}
        </button>
        <button
          type="button"
          className={`ld-tab-item ${activeTab === "highlights" ? "active" : ""}`}
          onClick={() => setActiveTab("highlights")}
        >
          Re-Edit Highlights
          {activeTab === "highlights" && <span className="ld-tab-line" />}
        </button>
      </div>

      {activeTab === "highlights" ? (
        <div className="ld-empty-card">
          <h3>Re-Edit Highlights</h3>
          <p>Highlight configuration is synchronized with workspace settings.</p>
        </div>
      ) : (
        <>
          {/* 3. Statistics Cards */}
          <div className="ld-stats-grid">
            <div className="ld-stat-card">
              <div className="ld-stat-info">
                <span className="ld-stat-label">TOTAL FIELDS</span>
                <span className="ld-stat-value">{stats.total}</span>
              </div>
              <div className="ld-stat-icon-box green">
                <Code2 className="ld-stat-icon" />
              </div>
            </div>

            <div className="ld-stat-card">
              <div className="ld-stat-info">
                <span className="ld-stat-label">ACTIVE FIELDS</span>
                <span className="ld-stat-value">{stats.active}</span>
              </div>
              <div className="ld-stat-icon-box blue">
                <CheckCircle2 className="ld-stat-icon" />
              </div>
            </div>

            <div className="ld-stat-card">
              <div className="ld-stat-info">
                <span className="ld-stat-label">SELECTABLE FIELDS</span>
                <span className="ld-stat-value">{stats.selectable}</span>
              </div>
              <div className="ld-stat-icon-box yellow">
                <Code2 className="ld-stat-icon" />
              </div>
            </div>
          </div>

          {/* 4. Filter Bar & Table Panel */}
          <div className="ld-table-panel">
            <div className="ld-table-toolbar">
              <div className="ld-search-box">
                <Search className="ld-search-icon" />
                <input
                  type="text"
                  placeholder="Search by field name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ld-search-input"
                />
              </div>

              <div className="ld-filter-box">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="ld-status-select"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="ld-error-banner">
                <AlertCircle className="ld-error-icon" />
                <span>{error}</span>
                <button type="button" onClick={fetchFields} className="ld-retry-btn">
                  <RefreshCw className="ld-retry-icon" /> Retry
                </button>
              </div>
            )}

            {/* Table or Empty State */}
            {loading ? (
              <div className="ld-loading-box">
                <div className="ld-spinner" />
                <p>Loading field configurations...</p>
              </div>
            ) : filteredFields.length === 0 ? (
              <div className="ld-no-results">
                <p>
                  {searchQuery || statusFilter !== "ALL"
                    ? "No matching fields found."
                    : "No custom fields configured yet."}
                </p>
                {(searchQuery || statusFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("ALL");
                    }}
                    className="ld-reset-filter-btn"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="ld-table-wrapper">
                <table className="ld-table">
                  <thead>
                    <tr>
                      <th>FIELD NAME</th>
                      <th>INPUT TYPE</th>
                      <th>REQUIRED</th>
                      <th>STATUS</th>
                      <th>SORT ORDER</th>
                      <th>CREATED DATE</th>
                      <th className="text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFields.map((field) => (
                      <tr key={field.id}>
                        <td className="ld-field-name-cell">
                          <strong>{field.name}</strong>
                        </td>
                        <td>
                          <span className="ld-type-badge">{field.inputType}</span>
                        </td>
                        <td>
                          <span
                            className={`ld-req-badge ${
                              field.isRequired ? "mandatory" : "optional"
                            }`}
                          >
                            {field.isRequired ? "MANDATORY" : "OPTIONAL"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`ld-status-badge ${
                              field.status === "ACTIVE" ? "active" : "inactive"
                            }`}
                          >
                            {field.status}
                          </span>
                        </td>
                        <td>
                          <strong className="ld-sort-num">{field.sortOrder}</strong>
                        </td>
                        <td className="ld-date-cell">{formatDate(field.createdAt)}</td>
                        <td className="ld-actions-cell">
                          <button
                            type="button"
                            className="ld-action-icon-btn edit"
                            title="Edit Field"
                            aria-label={`Edit field ${field.name}`}
                            onClick={() => handleOpenEditModal(field)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="ld-action-icon-btn delete"
                            title="Delete Field"
                            aria-label={`Delete field ${field.name}`}
                            onClick={() => setDeletingField(field)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* 5. Add / Edit Field Modal (Screenshot 3 & 4) */}
      {isModalOpen && mounted && createPortal(
        <div className="ld-modal-overlay" tabIndex={-1}>
          <div className="ld-modal-card" role="dialog" aria-modal="true">
            <div className="ld-modal-header">
              <div>
                <h2>{editingField ? "Edit Lead Dynamics Field" : "Add Lead Dynamics Field"}</h2>
                <p>Configure custom fields for lead forms.</p>
              </div>
              <button
                type="button"
                className="ld-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="ld-modal-form">
              {formError && (
                <div className="ld-form-error-msg">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Row 1: Field Name & Input Type */}
              <div className="ld-form-row">
                <div className="ld-form-group">
                  <label className="ld-label">FIELD NAME</label>
                  <input
                    type="text"
                    className="ld-input"
                    placeholder="Call Category"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="ld-form-group">
                  <label className="ld-label">INPUT TYPE</label>
                  <select
                    className="ld-select"
                    value={formData.inputType}
                    onChange={(e) =>
                      setFormData({ ...formData, inputType: e.target.value as InputType })
                    }
                  >
                    {SUPPORTED_INPUT_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span className="ld-input-hint">
                    Pick the best input format for how your team will capture this lead detail.
                  </span>
                </div>
              </div>

              {/* Row 2: Sort Order, Required, Status */}
              <div className="ld-form-row three-col">
                <div className="ld-form-group">
                  <label className="ld-label">SORT ORDER</label>
                  <input
                    type="number"
                    min={1}
                    className="ld-input"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, sortOrder: Number(e.target.value) || 1 })
                    }
                  />
                  <span className="ld-input-hint">
                    Suggested: {editingField ? editingField.sortOrder : suggestedNextSortOrder}
                  </span>
                </div>

                <div className="ld-form-group">
                  <label className="ld-label">REQUIRED</label>
                  <div className="ld-pill-toggle-group">
                    <button
                      type="button"
                      className={`ld-pill-toggle-btn ${formData.isRequired ? "active" : ""}`}
                      onClick={() => setFormData({ ...formData, isRequired: true })}
                    >
                      Mandatory
                    </button>
                    <button
                      type="button"
                      className={`ld-pill-toggle-btn ${!formData.isRequired ? "active" : ""}`}
                      onClick={() => setFormData({ ...formData, isRequired: false })}
                    >
                      Optional
                    </button>
                  </div>
                </div>

                <div className="ld-form-group">
                  <label className="ld-label">STATUS</label>
                  <div className="ld-pill-toggle-group">
                    <button
                      type="button"
                      className={`ld-pill-toggle-btn ${
                        formData.status === "ACTIVE" ? "active active-green" : ""
                      }`}
                      onClick={() => setFormData({ ...formData, status: "ACTIVE" })}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={`ld-pill-toggle-btn ${
                        formData.status === "INACTIVE" ? "active" : ""
                      }`}
                      onClick={() => setFormData({ ...formData, status: "INACTIVE" })}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              {/* Options Editor (for SELECT, RADIO, CHECKBOX) */}
              {["SELECT", "RADIO", "CHECKBOX"].includes(formData.inputType) && (
                <div className="ld-options-editor-box">
                  <div className="ld-options-header">
                    <label className="ld-label">CONFIGURED OPTIONS</label>
                    <button
                      type="button"
                      className="ld-add-opt-btn"
                      onClick={handleAddOption}
                    >
                      <Plus size={14} /> Add Choice
                    </button>
                  </div>

                  <div className="ld-options-list">
                    {formData.options.map((opt, idx) => (
                      <div key={opt.id || idx} className="ld-option-row">
                        <span className="ld-opt-idx">{idx + 1}.</span>
                        <input
                          type="text"
                          className="ld-input option-input"
                          value={opt.label}
                          onChange={(e) => handleUpdateOption(idx, e.target.value)}
                          placeholder={`Choice ${idx + 1}`}
                        />
                        <div className="ld-opt-actions">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveOption(idx, "up")}
                            title="Move Up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === formData.options.length - 1}
                            onClick={() => handleMoveOption(idx, "down")}
                            title="Move Down"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            title="Remove Choice"
                            className="remove-opt"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Preview Card (Screenshot 3 & 4) */}
              <div className="ld-preview-card">
                <span className="ld-preview-title">LIVE PREVIEW</span>
                <div className="ld-preview-body">
                  <label className="ld-preview-field-label">
                    {formData.name || "Field Preview"}
                    {formData.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {formData.inputType === "TEXT" && (
                    <input
                      type="text"
                      className="ld-preview-input"
                      placeholder={`Preview text input`}
                      disabled
                    />
                  )}

                  {formData.inputType === "TEXTAREA" && (
                    <textarea
                      className="ld-preview-input"
                      rows={3}
                      placeholder="Preview multiline text input"
                      disabled
                    />
                  )}

                  {formData.inputType === "NUMBER" && (
                    <input
                      type="number"
                      className="ld-preview-input"
                      placeholder="Enter number (e.g. 0 or 100)"
                      disabled
                    />
                  )}

                  {formData.inputType === "SELECT" && (
                    <select className="ld-preview-input" disabled>
                      <option value="">Select option...</option>
                      {formData.options.map((opt) => (
                        <option key={opt.id} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {formData.inputType === "RADIO" && (
                    <div className="ld-preview-options-group">
                      {formData.options.map((opt) => (
                        <label key={opt.id} className="ld-preview-radio-item">
                          <input type="radio" name="preview_radio" disabled />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {formData.inputType === "CHECKBOX" && (
                    <div className="ld-preview-options-group">
                      {formData.options.map((opt) => (
                        <label key={opt.id} className="ld-preview-check-item">
                          <input type="checkbox" disabled />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {formData.inputType === "DATE" && (
                    <input type="date" className="ld-preview-input" disabled />
                  )}

                  {formData.inputType === "DATETIME" && (
                    <input type="datetime-local" className="ld-preview-input" disabled />
                  )}

                  {formData.inputType === "FILE" && (
                    <div className="ld-preview-file-dropzone">
                      <UploadCloud size={20} />
                      <span>Choose file or drag & drop (PDF, PNG, JPG up to 5MB)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="ld-modal-footer">
                <button
                  type="button"
                  className="ld-modal-cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="ld-modal-submit-btn" disabled={isSaving}>
                  {isSaving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1 inline" />
                      {editingField ? "Save Changes" : "Create Field"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* 6. Delete Confirmation Modal */}
      {deletingField && mounted && createPortal(
        <div className="ld-modal-overlay">
          <div className="ld-confirm-card" role="dialog">
            <h3 className="ld-confirm-title">Archive / Delete Field</h3>
            <p className="ld-confirm-desc">
              Are you sure you want to remove <strong>"{deletingField.name}"</strong>? If this field has existing saved lead entries, it will be safely archived to protect historical data.
            </p>
            <div className="ld-confirm-actions">
              <button
                type="button"
                className="ld-modal-cancel-btn"
                onClick={() => setDeletingField(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ld-confirm-delete-btn"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting ? "Processing..." : "Confirm Removal"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
