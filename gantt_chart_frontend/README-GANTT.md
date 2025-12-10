# Gantt Usage

- Start app: npm start (port 3000).
- Toolbar:
  - Upload CSV: choose a CSV file. Supported headers include: Task/Name/Sprint, Start/End (dates), Start Week/End Week or Duration (Weeks), Assignee/Owner, Progress, Dependencies.
  - Export CSV: downloads current in-memory tasks (reflects edits).
  - Download Image: saves a PNG of the visible chart area.
  - Zoom + / − and Zoom to Fit.
- Editing:
  - Drag a bar to move dates.
  - Drag the left/right white handles to resize duration.
  - Double-click a task name (left column) to edit inline. Press Enter to commit, Esc to cancel, or blur to commit.
- Styling: Ocean Professional theme; see src/styles/theme.css.
