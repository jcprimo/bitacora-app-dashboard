// ─── constants/qaColumns.js — QA Tracker Column Definitions ──────
// Defines all possible columns for the QA test case table.
// Each column has an id (matching CSV header), a display label,
// default visibility, and optional width hint.
//
// To add a new column: append an entry here. The table and column
// picker will automatically include it — no other file changes needed.

export const QA_COLUMNS = [
  { id: "Test_ID",            label: "ID",             defaultVisible: true,  width: "100px" },
  { id: "Category",           label: "Category",       defaultVisible: true,  width: "130px" },
  { id: "Priority",           label: "Priority",       defaultVisible: true,  width: "100px" },
  { id: "Title",              label: "Title",          defaultVisible: true,  width: "auto"  },
  { id: "Description",        label: "Description",    defaultVisible: false, width: "auto"  },
  { id: "Steps",              label: "Steps",          defaultVisible: false, width: "auto"  },
  { id: "Expected_Result",    label: "Expected Result",defaultVisible: false, width: "auto"  },
  { id: "Language_Scope",     label: "Language",       defaultVisible: true,  width: "90px"  },
  { id: "School_System_Scope",label: "School System",  defaultVisible: false, width: "110px" },
  { id: "Test_Type",          label: "Type",           defaultVisible: true,  width: "90px"  },
  { id: "FERPA_Flag",         label: "FERPA",          defaultVisible: true,  width: "70px"  },
  { id: "Status",             label: "Status",         defaultVisible: true,  width: "110px" },
];

// localStorage key for persisting column visibility preferences
export const QA_COLUMNS_STORAGE_KEY = "bitacora-qa-columns";

// localStorage key for persisting ticket link state per test case
export const QA_TICKETS_STORAGE_KEY = "bitacora-qa-tickets";

// localStorage key for persisting imported CSV data across rebuilds
export const QA_DATA_STORAGE_KEY = "bitacora-qa-data";

// Number of rows per page in the QA table
export const QA_PAGE_SIZE = 25;
