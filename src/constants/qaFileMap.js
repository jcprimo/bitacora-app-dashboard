// ─── constants/qaFileMap.js — Category → iOS Source File Mapping ──
// Maps QA test case categories to the Swift files the agent needs
// to read and potentially modify when working on that category.
//
// Paths are relative to the student-reports-ios repo root:
//   StudentReports/StudentReports/...
//
// To add a category: add a new key matching the CSV Category value.
// The agent context builder uses this to scope what gets attached.

const BASE = "StudentReports/StudentReports";

export const QA_FILE_MAP = {
  Onboarding: [
    `${BASE}/Views/Shared/OnboardingView.swift`,
    `${BASE}/Models/Teacher.swift`,
    `${BASE}/Models/SchoolSystem.swift`,
    `${BASE}/ViewModels/TeacherManager.swift`,
    `${BASE}/ViewModels/SchoolSystemManager.swift`,
    `${BASE}/Services/APIKeyManager.swift`,
    `${BASE}/Localization/Translations.swift`,
  ],
  "Recording-AI": [
    `${BASE}/Services/AudioRecorderService.swift`,
    `${BASE}/Services/TranscriptionService.swift`,
    `${BASE}/Services/WhisperKitTranscriptionService.swift`,
    `${BASE}/Services/OpenAIService.swift`,
    `${BASE}/Services/AIIncidentPipeline.swift`,
    `${BASE}/Views/Recording/RecordingView.swift`,
    `${BASE}/Views/Recording/WaveformView.swift`,
    `${BASE}/ViewModels/RecordingViewModel.swift`,
  ],
  "Recording-Manual": [
    `${BASE}/Views/Recording/RecordingView.swift`,
    `${BASE}/Views/Recording/IncidentFormView.swift`,
    `${BASE}/Views/Recording/IncidentReviewView.swift`,
    `${BASE}/ViewModels/RecordingViewModel.swift`,
    `${BASE}/Models/IncidentCategory.swift`,
    `${BASE}/Models/Severity.swift`,
  ],
  "AI Review": [
    `${BASE}/Services/OpenAIService.swift`,
    `${BASE}/Services/AIIncidentPipeline.swift`,
    `${BASE}/Services/IncidentAnalyzer.swift`,
    `${BASE}/Services/OnDeviceIncidentAnalyzer.swift`,
    `${BASE}/Models/IncidentCategory.swift`,
    `${BASE}/Models/Severity.swift`,
  ],
  "Offline Queue": [
    `${BASE}/Services/OfflineQueueManager.swift`,
    `${BASE}/Services/OpenAIService.swift`,
    `${BASE}/Services/AIIncidentPipeline.swift`,
  ],
  "Student Management": [
    `${BASE}/Models/Student.swift`,
    `${BASE}/ViewModels/StudentListViewModel.swift`,
    `${BASE}/ViewModels/StudentMetricsProvider.swift`,
    `${BASE}/Views/Students/StudentDirectoryView.swift`,
    `${BASE}/Views/Students/StudentCardView.swift`,
    `${BASE}/Views/Students/AddStudentSheet.swift`,
    `${BASE}/Views/Students/EditStudentSheet.swift`,
    `${BASE}/Views/Shared/StudentSearchField.swift`,
  ],
  "Report Management": [
    `${BASE}/Models/Report.swift`,
    `${BASE}/ViewModels/ReportListViewModel.swift`,
    `${BASE}/Views/Reports/ReportListView.swift`,
    `${BASE}/Views/Reports/ReportCardView.swift`,
    `${BASE}/Views/Reports/ReportFilterView.swift`,
    `${BASE}/Views/Detail/ReportDetailView.swift`,
    `${BASE}/Views/Detail/ReportMetaView.swift`,
  ],
  Navigation: [
    `${BASE}/App/StudentReportsApp.swift`,
    `${BASE}/App/ContentView.swift`,
    `${BASE}/App/AppNavigationState.swift`,
    `${BASE}/Views/Navigation/SideDrawer.swift`,
  ],
  Settings: [
    `${BASE}/Views/Shared/SettingsView.swift`,
    `${BASE}/Services/APIKeyManager.swift`,
    `${BASE}/ViewModels/LanguageManager.swift`,
    `${BASE}/ViewModels/SchoolSystemManager.swift`,
  ],
  "Data Persistence": [
    `${BASE}/Models/Student.swift`,
    `${BASE}/Models/Report.swift`,
    `${BASE}/Models/Teacher.swift`,
    `${BASE}/Services/ExportService.swift`,
    `${BASE}/Services/OfflineQueueManager.swift`,
  ],
  Accessibility: [
    `${BASE}/Utilities/DesignTokens.swift`,
    `${BASE}/Views/Shared/OnboardingView.swift`,
    `${BASE}/Views/Recording/RecordingView.swift`,
    `${BASE}/Views/Students/StudentDirectoryView.swift`,
    `${BASE}/Views/Reports/ReportListView.swift`,
    `${BASE}/Views/Detail/ReportDetailView.swift`,
    `${BASE}/Views/Navigation/SideDrawer.swift`,
  ],
  Localization: [
    `${BASE}/Localization/Translations.swift`,
    `${BASE}/ViewModels/LanguageManager.swift`,
    `${BASE}/Utilities/Formatters.swift`,
  ],
  Performance: [
    `${BASE}/ViewModels/StudentListViewModel.swift`,
    `${BASE}/ViewModels/ReportListViewModel.swift`,
    `${BASE}/Services/AudioRecorderService.swift`,
    `${BASE}/Services/OpenAIService.swift`,
  ],
  "Security/Privacy": [
    `${BASE}/Services/APIKeyManager.swift`,
    `${BASE}/Services/OpenAIService.swift`,
    `${BASE}/Services/ExportService.swift`,
    `${BASE}/Models/Report.swift`,
    `${BASE}/Models/Student.swift`,
  ],
  Regression: [
    `${BASE}/App/ContentView.swift`,
    `${BASE}/Models/Student.swift`,
    `${BASE}/Models/Report.swift`,
    `${BASE}/Services/OpenAIService.swift`,
    `${BASE}/Services/AudioRecorderService.swift`,
    `${BASE}/Localization/Translations.swift`,
  ],
};

// Existing XCTest files — included as reference for the agent
export const EXISTING_TESTS = [
  "StudentReports/StudentReportsTests/FormattersTests.swift",
  "StudentReports/StudentReportsTests/IDGeneratorTests.swift",
  "StudentReports/StudentReportsTests/IncidentCategoryTests.swift",
  "StudentReports/StudentReportsTests/OnDeviceIncidentAnalyzerTests.swift",
  "StudentReports/StudentReportsTests/SeverityTests.swift",
  "StudentReports/StudentReportsTests/TranslationsTests.swift",
];

/**
 * Get relevant iOS source files for a test case category.
 * Falls back to an empty array for unknown categories.
 */
export function getFilesForCategory(category) {
  return QA_FILE_MAP[category] || [];
}
