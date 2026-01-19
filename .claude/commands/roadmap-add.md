---
description: Add a new task to the roadmap
---

Add a new task to `.dev/planning/ROADMAP.yaml`.

Task details from user: $ARGUMENTS

Process:

1. Parse the task description from the arguments
2. Determine the appropriate section (SEO, Content, Monetization, Infrastructure, Testing, Monitoring, Brand, Planning)
3. Determine the appropriate subsection
4. Generate a unique task ID (section-prefix + next sequential number)
5. If priority not specified, ask the user
6. If effort estimate not specified, make a reasonable estimate and confirm
7. Determine appropriate assignee based on task type:
   - Technical/code tasks: @claude
   - Decisions/accounts: @human
   - Research: @agent:business or @agent:explore
8. Add the task to ROADMAP.yaml with all required fields
9. Update the metadata.last_updated field
10. Confirm the addition with the task details

Required task fields:

- id (generated)
- title (from user)
- description (from user or inferred)
- status: pending (default)
- priority (ask if not specified)
- assignee (determine based on task type)
- effort (estimate in hours)
- tags (relevant tags)
- dependencies (if any mentioned)
