---
name: HRMO prototype data boundaries
description: Scope and disclosure rules for user-management import demos.
---

HRMO user-management mockups are demonstrations, not connected data-processing systems. Any CSV parsing shown in a prototype must be described as local-only and non-persistent. Do not imply an XLSX file was parsed unless actual XLSX parsing exists; use clearly labeled synthetic rows for an Excel demo. Make it clear that no backend or university database is connected.

**Why:** The user specified that this mockup should not imply real data processing and should use sample data when spreadsheet parsing is not implemented.

**How to apply:** Preserve these disclosures in future prototype refinements. Treat real server-side importing, storage, or Excel parsing as a separate implementation request.
