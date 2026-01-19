---
description: Run weekly research and growth agents
---

Run the weekly agent team to discover opportunities and grow the project.

## Process

1. Launch three agents in parallel:
   - **@agent:explore** - Codebase analysis for technical improvements
   - **@agent:business** - Market research and competitive analysis
   - **@agent:architect** - Architecture review and scaling recommendations

2. Collect findings from all agents

3. Add discovered tasks to ROADMAP.yaml with:
   - Source: `weekly-agent-run`
   - Date discovered
   - Recommended priority

4. Create run report at `.dev/agent-runs/YYYY-MM-DD-weekly.md`

5. Verify no breaking changes via `npm run lint`

## Agent Prompts

### Explorer Agent

Analyze the Radulator codebase for:

- Technical debt and improvement opportunities
- Missing test coverage
- Code consistency issues
- Performance optimization opportunities
- Accessibility gaps
  Return findings as a bulleted list with specific file references.

### Business Agent

Research the medical calculator market:

- Check MDCalc, Omni Calculator for new features
- Search for calculator ideas we're missing
- Find potential backlink opportunities (radiology blogs, residency sites)
- Look for affiliate program opportunities
- Analyze SEO opportunities
  Return findings with actionable recommendations.

### Architect Agent

Review Radulator architecture for:

- Scalability to 50+ calculators
- Performance at 100k+ monthly users
- Code organization improvements
- Infrastructure recommendations
  Return findings with specific technical recommendations.

## Output

Report saved to: `.dev/agent-runs/YYYY-MM-DD-weekly.md`

Tasks added to: `.dev/planning/ROADMAP.yaml`
