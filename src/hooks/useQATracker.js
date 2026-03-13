// ─── hooks/useQATracker.js — QA Test Case Tracker State ──────────
// Manages: CSV import, column visibility, filtering, pagination,
// and per-test-case ticket creation state.
//
// CSV data AND ticket state are persisted in localStorage so they
// survive page rebuilds and refreshes. Multiple CSV files can be
// loaded — each import merges with (or replaces) existing data.
// The source CSV file is never modified.

import { useState, useCallback, useMemo } from "react";
import { parseCSVFile } from "../utils/csvParser";
import { createIssue, updateCustomField, fetchIssue } from "../youtrack";
import { buildContextBundle, buildLaunchCommand } from "../utils/contextBundle";
import { copyToClipboard } from "../utils/clipboard";
import {
  QA_COLUMNS,
  QA_COLUMNS_STORAGE_KEY,
  QA_TICKETS_STORAGE_KEY,
  QA_DATA_STORAGE_KEY,
  QA_PAGE_SIZE,
} from "../constants/qaColumns";

// ─── localStorage Helpers ─────────────────────────────────────────

function loadColumnVisibility() {
  try {
    const stored = localStorage.getItem(QA_COLUMNS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* fall through */ }
  const defaults = {};
  QA_COLUMNS.forEach((col) => { defaults[col.id] = col.defaultVisible; });
  return defaults;
}

function loadTicketState() {
  try {
    const stored = localStorage.getItem(QA_TICKETS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* fall through */ }
  return {};
}

function saveTicketState(state) {
  localStorage.setItem(QA_TICKETS_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Load persisted CSV data from localStorage.
 * Returns { testCases, csvHeaders, fileName } or null if nothing stored.
 */
function loadPersistedData() {
  try {
    const stored = localStorage.getItem(QA_DATA_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.testCases?.length > 0) return parsed;
    }
  } catch { /* fall through */ }
  return null;
}

/**
 * Persist CSV data to localStorage.
 */
function savePersistedData(testCases, csvHeaders, fileName) {
  localStorage.setItem(QA_DATA_STORAGE_KEY, JSON.stringify({
    testCases,
    csvHeaders,
    fileName,
    savedAt: Date.now(),
  }));
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useQATracker(token, showToast, loadIssues, openDetail) {
  // Restore persisted CSV data on first mount
  const persisted = useMemo(() => loadPersistedData(), []);

  // Raw test case data from CSV (restored from localStorage if available)
  const [testCases, setTestCases] = useState(persisted?.testCases || []);
  // CSV column headers
  const [csvHeaders, setCsvHeaders] = useState(persisted?.csvHeaders || []);
  // Column visibility map: { columnId: boolean }
  const [columnVisibility, setColumnVisibility] = useState(loadColumnVisibility);
  // Ticket state: { [Test_ID]: { ticketId, stage } }
  const [ticketState, setTicketState] = useState(loadTicketState);
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  // Loading states: { [Test_ID]: "creating" | "transitioning" }
  const [actionLoading, setActionLoading] = useState({});
  // Import state
  const [importError, setImportError] = useState(null);
  const [fileName, setFileName] = useState(persisted?.fileName || null);

  // ─── CSV Import ──────────────────────────────────────────────────

  const importCSV = useCallback(async (file) => {
    setImportError(null);
    const { data, headers, error } = await parseCSVFile(file);
    if (error) {
      setImportError(error);
      showToast(error, true);
      return;
    }
    if (data.length === 0) {
      setImportError("CSV file is empty or has no data rows.");
      showToast("CSV file is empty", true);
      return;
    }

    // Merge strategy: if the new CSV has a Test_ID column, merge by ID
    // to preserve ticket state correlation. Otherwise replace entirely.
    const hasTestId = headers.includes("Test_ID");
    let merged = data;
    let mergeCount = 0;

    if (hasTestId && testCases.length > 0) {
      const existingById = new Map(testCases.map((tc) => [tc.Test_ID, tc]));
      const newIds = new Set(data.map((tc) => tc.Test_ID));

      // Start with all new rows
      merged = [...data];

      // Append existing rows whose IDs aren't in the new file
      // (preserves test cases from previously loaded CSVs)
      for (const [id, tc] of existingById) {
        if (!newIds.has(id)) {
          merged.push(tc);
          mergeCount++;
        }
      }
    }

    // Merge headers from both datasets
    const mergedHeaders = [...new Set([...headers, ...csvHeaders])];

    setTestCases(merged);
    setCsvHeaders(mergedHeaders);
    setFileName(file.name);
    setCurrentPage(1);
    // Reset filters when loading new data
    setCategoryFilter("All");
    setPriorityFilter("All");
    setStatusFilter("All");

    // Persist to localStorage
    savePersistedData(merged, mergedHeaders, file.name);

    const msg = mergeCount > 0
      ? `Imported ${data.length} cases from ${file.name} (+${mergeCount} kept from previous)`
      : `Imported ${data.length} test cases from ${file.name}`;
    showToast(msg);
  }, [showToast, testCases, csvHeaders]);

  // ─── Column Visibility ──────────────────────────────────────────

  const toggleColumn = useCallback((columnId) => {
    setColumnVisibility((prev) => {
      const next = { ...prev, [columnId]: !prev[columnId] };
      localStorage.setItem(QA_COLUMNS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Visible columns in display order (only those present in CSV)
  const visibleColumns = useMemo(() => {
    const headerSet = new Set(csvHeaders);
    return QA_COLUMNS.filter(
      (col) => columnVisibility[col.id] && headerSet.has(col.id)
    );
  }, [columnVisibility, csvHeaders]);

  // ─── Filtering ──────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = new Set(testCases.map((tc) => tc.Category).filter(Boolean));
    return ["All", ...Array.from(cats).sort()];
  }, [testCases]);

  const priorities = useMemo(() => {
    const pris = new Set(testCases.map((tc) => tc.Priority).filter(Boolean));
    return ["All", ...Array.from(pris).sort()];
  }, [testCases]);

  const statuses = useMemo(() => {
    const sts = new Set(testCases.map((tc) => tc.Status).filter(Boolean));
    return ["All", ...Array.from(sts).sort()];
  }, [testCases]);

  const filteredCases = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return testCases.filter((tc) => {
      if (categoryFilter !== "All" && tc.Category !== categoryFilter) return false;
      if (priorityFilter !== "All" && tc.Priority !== priorityFilter) return false;
      if (statusFilter !== "All" && tc.Status !== statusFilter) return false;
      if (q) {
        return Object.values(tc).some(
          (val) => typeof val === "string" && val.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [testCases, searchQuery, categoryFilter, priorityFilter, statusFilter]);

  // ─── Pagination ─────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / QA_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedCases = filteredCases.slice(
    (safePage - 1) * QA_PAGE_SIZE,
    safePage * QA_PAGE_SIZE
  );

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  // ─── Ticket Actions ─────────────────────────────────────────────

  /**
   * Create a bug ticket in YouTrack for a test case.
   * Guards against duplicates — if a ticket already exists for this
   * Test_ID in localStorage, the creation is skipped with a toast.
   */
  const createBugTicket = useCallback(async (testCase) => {
    const testId = testCase.Test_ID;
    if (!token) {
      showToast("No YouTrack token configured", true);
      return;
    }

    // Duplicate guard: check if we already have a ticket for this test case
    if (ticketState[testId]) {
      showToast(`${testId} already has ticket ${ticketState[testId].ticketId}`, true);
      return;
    }

    setActionLoading((prev) => ({ ...prev, [testId]: "creating" }));
    try {
      const description = [
        `**Test Case:** ${testId}`,
        `**Category:** ${testCase.Category || "—"}`,
        `**Language Scope:** ${testCase.Language_Scope || "—"}`,
        `**School System:** ${testCase.School_System_Scope || "—"}`,
        `**Test Type:** ${testCase.Test_Type || "—"}`,
        `**FERPA Flag:** ${testCase.FERPA_Flag || "—"}`,
        "",
        "## Description",
        testCase.Description || "—",
        "",
        "## Steps to Reproduce",
        testCase.Steps || "—",
        "",
        "## Expected Result",
        testCase.Expected_Result || "—",
      ].join("\n");

      const result = await createIssue(token, {
        summary: `[QA] ${testCase.Title || testId}`,
        description,
        priority: testCase.Priority || "Normal",
      });

      const newState = {
        ...ticketState,
        [testId]: { ticketId: result.idReadable, stage: "Backlog" },
      };
      setTicketState(newState);
      saveTicketState(newState);
      showToast(`Created ${result.idReadable} for ${testId}`);
      // Refresh the board so the new ticket appears
      if (loadIssues) loadIssues();
    } catch (err) {
      showToast(`Failed to create ticket: ${err.message}`, true);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[testId];
        return next;
      });
    }
  }, [token, ticketState, showToast, loadIssues]);

  /**
   * Transition a test case's linked ticket to "Develop" stage,
   * then copy the agent context bundle to clipboard.
   */
  const startDevelopment = useCallback(async (testId) => {
    const info = ticketState[testId];
    if (!info?.ticketId || !token) return;

    const testCase = testCases.find((tc) => tc.Test_ID === testId);

    setActionLoading((prev) => ({ ...prev, [testId]: "transitioning" }));
    try {
      await updateCustomField(token, info.ticketId, "Stage", "Develop");
      const newState = {
        ...ticketState,
        [testId]: { ...info, stage: "Develop" },
      };
      setTicketState(newState);
      saveTicketState(newState);

      if (testCase) {
        const bundle = buildContextBundle(testCase, info.ticketId);
        await navigator.clipboard.writeText(bundle);
        showToast(`${info.ticketId} → Develop · Context copied to clipboard`);
      } else {
        showToast(`${info.ticketId} → Develop`);
      }
    } catch (err) {
      showToast(`Failed to update stage: ${err.message}`, true);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[testId];
        return next;
      });
    }
  }, [token, ticketState, testCases, showToast]);

  /**
   * Copy the agent context bundle for a test case already in development.
   */
  const copyContextBundle = useCallback((testId) => {
    const info = ticketState[testId];
    const testCase = testCases.find((tc) => tc.Test_ID === testId);
    if (!testCase || !info?.ticketId) return;

    const bundle = buildContextBundle(testCase, info.ticketId);
    copyToClipboard(bundle, `${testId} context`, showToast);
  }, [ticketState, testCases, showToast]);

  /**
   * Copy the Claude Code launch command for a test case.
   */
  const copyLaunchCommand = useCallback((testId) => {
    const info = ticketState[testId];
    const testCase = testCases.find((tc) => tc.Test_ID === testId);
    if (!testCase || !info?.ticketId) return;

    const cmd = buildLaunchCommand(testCase, info.ticketId);
    copyToClipboard(cmd, `${testId} launch command`, showToast);
  }, [ticketState, testCases, showToast]);

  /**
   * Navigate to the detail view for a test case's linked ticket.
   * Fetches the full issue from YouTrack and opens the detail view.
   */
  const viewTicket = useCallback(async (testId) => {
    const info = ticketState[testId];
    if (!info?.ticketId || !token || !openDetail) return;

    try {
      const issue = await fetchIssue(token, info.ticketId);
      openDetail(issue);
    } catch (err) {
      showToast(`Failed to load ${info.ticketId}: ${err.message}`, true);
    }
  }, [token, ticketState, openDetail, showToast]);

  // ─── Return ─────────────────────────────────────────────────────

  return {
    // Data
    testCases,
    csvHeaders,
    fileName,
    importError,
    // Columns
    columnVisibility,
    visibleColumns,
    toggleColumn,
    // Filters
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    categories,
    priorities,
    statuses,
    filteredCases,
    // Pagination
    pagedCases,
    currentPage,
    totalPages: Math.max(1, totalPages),
    goToPage,
    // Tickets
    ticketState,
    actionLoading,
    createBugTicket,
    startDevelopment,
    copyContextBundle,
    copyLaunchCommand,
    viewTicket,
    // Import
    importCSV,
  };
}
