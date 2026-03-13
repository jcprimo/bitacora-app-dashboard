// ─── hooks/useIssueDetail.js — Issue Detail & Inline Editing ────
// Powers the Detail view: edit summary/description, change Stage or
// Priority via inline dropdowns, and delete with confirmation.
//
// changeField() is also used by BoardView for inline stage updates
// directly from the issue list (without opening the detail view).

import { useState, useCallback } from "react";
import { updateIssue, updateCustomField, deleteIssue, fetchIssues } from "../youtrack";

export function useIssueDetail(token, showToast, loadIssues, setView) {
  const [activeIssue, setActiveIssue] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const openDetail = (issue) => {
    setActiveIssue(issue);
    setEditFields({ summary: issue.summary, description: issue.description || "" });
    setConfirmDelete(false);
    setView("detail");
  };

  const saveEdit = useCallback(async () => {
    if (!activeIssue || !token) return;
    setActionLoading("save");
    try {
      await updateIssue(token, activeIssue.idReadable, {
        summary: editFields.summary,
        description: editFields.description,
      });
      showToast(`${activeIssue.idReadable} updated`);
      loadIssues();
      setView("board");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }, [activeIssue, editFields, token, loadIssues, showToast, setView]);

  const changeField = useCallback(
    async (issueId, field, value) => {
      setActionLoading(`${field}-${issueId}`);
      try {
        await updateCustomField(token, issueId, field, value);
        showToast(`${issueId}: ${field} → ${value}`);
        loadIssues();
        // If the changed issue is currently open in detail, refresh it
        if (activeIssue?.idReadable === issueId) {
          const updated = await fetchIssues(token, { query: `issue id: ${issueId}`, top: 1 });
          if (updated[0]) setActiveIssue(updated[0]);
        }
      } catch (e) {
        showToast(e.message, "error");
      } finally {
        setActionLoading(null);
      }
    },
    [token, loadIssues, activeIssue, showToast]
  );

  const handleDelete = useCallback(async () => {
    if (!activeIssue || !token) return;
    setActionLoading("delete");
    try {
      await deleteIssue(token, activeIssue.idReadable);
      showToast(`${activeIssue.idReadable} deleted`);
      setConfirmDelete(false);
      setActiveIssue(null);
      setView("board");
      loadIssues();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setActionLoading(null);
    }
  }, [activeIssue, token, loadIssues, showToast, setView]);

  return {
    activeIssue, setActiveIssue,
    editFields, setEditFields,
    actionLoading, confirmDelete, setConfirmDelete,
    openDetail, saveEdit, changeField, handleDelete,
  };
}
