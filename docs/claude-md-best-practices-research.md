# CLAUDE.md Best Practices Research: Official Guidance vs. Our Implementation

**Research Date:** 2026-01-12
**Purpose:** Evaluate the CLAUDE.md rewrite (395 → 672 lines) against actual best practices

---

## Executive Summary

### The Verdict: **Mixed Results**

The rewrite **violated the primary best practice** (keep it short) but **followed other best practices** (structure, tables, progressive disclosure). The research reveals we should:

1. **Significantly reduce length** - Current 672 lines vs. recommended <300 lines (ideally <150)
2. **Keep ASCII diagrams** - They help comprehension despite token cost
3. **Keep tables** - More token-efficient than prose
4. **Leverage modular rules better** - Move more content to `.claude/rules/`

---

## Research Findings

### 1. Length Recommendations

#### Official Anthropic Guidance

> "There's no required format for CLAUDE.md files. We recommend keeping them **concise and human-readable**."
> — [Anthropic Official Documentation](https://www.anthropic.com/engineering/claude-code-best-practices)

#### Community Consensus

> "General consensus is that **< 300 lines is best, and shorter is even better**."
> — [HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

> "At HumanLayer, our root CLAUDE.md file is **less than sixty lines**."
> — [HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

> "A focused **150-line CLAUDE.md** that Claude can fully process is far more effective than a 300-line document it only partially references."
> — [AI Engineer Guide](https://aiengineerguide.com/blog/notes-on-writing-a-good-claude-md/)

#### The Science Behind It

> "Frontier thinking LLMs can follow **~ 150-200 instructions** with reasonable consistency. Claude Code's system prompt contains **~50 individual instructions**, meaning you have limited 'instruction budget' left for your CLAUDE.md."
> — [HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

**Our Status:**
- ❌ **672 lines** - More than 2x the recommended maximum
- ❌ Significantly longer than ideal (60-150 lines)
- ⚠️ Risk of instruction overload and degraded performance

### 2. ASCII Diagrams: Helpful or Token Waste?

#### Official Guidance: Mixed Evidence

**Evidence They Help:**
- Claude Code has dedicated skills for ASCII diagram generation ([ASCII Diagram Creator](https://mcpmarket.com/tools/skills/ascii-diagram-creator-1))
- Real-world workflows report: "Claude Code sees this and knows EXACTLY what to build" from ASCII wireframes ([Nathan Onn](https://www.nathanonn.com/codex-plans-with-ascii-wireframes-%E2%86%92-claude-code-builds-%E2%86%92-codex-reviews/))
- Claude has strong vision capabilities for understanding charts and diagrams ([Anthropic Claude 3 Announcement](https://www.anthropic.com/news/claude-3-family))

**Evidence of Limitations:**
- When asked to create architecture diagrams, Claude "yielded a useful but **slightly broken** ASCII diagram" ([Builder.io Blog](https://www.builder.io/blog/claude-code))
- The core warning: CLAUDE.md should be "concise" and avoid "extensive content without iterating on its effectiveness"

**Our Diagrams:**
- 3 ASCII diagrams (system architecture, type flow, data flow)
- Total: ~30 lines of ASCII art
- Clear structural value for understanding system architecture

**Verdict:**
- ✅ **Keep the diagrams** - They provide high-value structural understanding
- ✅ Token cost is justified by comprehension improvement
- ⚠️ Monitor effectiveness - watch if Claude references them in practice

### 3. Tables vs. Prose: Token Efficiency

#### Research Findings

> "A 'Skill Trigger Table' format... appears **more token-efficient than verbose prose** explanations."
> — [Medium: Token Efficiency](https://medium.com/@pierreyohann16/optimizing-token-efficiency-in-claude-code-workflows-managing-large-model-context-protocol-f41eafdab423)

> One optimization reduced verbose examples from **4,887 bytes to just hard rules at 1,084 bytes** by removing prose and keeping structured formats.
> — [GitHub: Context Optimization](https://gist.github.com/johnlindquist/849b813e76039a908d962b2f0923dc9a)

**Our Tables:**
- Commands table (9 rows)
- File locations table (embedded in code block)
- Verification commands table
- Environment variables (collapsible details)
- Troubleshooting table (7 rows)
- User roles table (2 rows)
- Cron jobs table (8 rows + 5 rows)

**Verdict:**
- ✅ **Tables are more efficient than prose**
- ✅ Keep all current tables
- ✅ Consider converting MORE prose to tables

### 4. Progressive Disclosure

#### Official Guidance

> "Use **Progressive Disclosure** - don't tell Claude all the information you could possibly want it to know. Rather, tell it **how to find important information** so that it can find and use it, but only when it needs to."
> — [HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

> "Progressive disclosure reduces context overhead and can achieve **50-80% token savings** vs monolithic setups."
> — [GitHub: claude-modular](https://github.com/oxygen-fragment/claude-modular)

> "Claude loads main skill first, loads resources only when needed."
> — [MCP Market: Progressive Disclosure](https://mcpmarket.com/tools/skills/progressive-disclosure-pattern)

**Our Implementation:**
- ✅ Uses `.claude/rules/` modular files (6 files)
- ✅ Table of Contents points to modular rules
- ✅ "When to use modular rules" section guides Claude
- ⚠️ BUT main CLAUDE.md still too long with content that should be modular

**Verdict:**
- ✅ Progressive disclosure pattern is correct
- ❌ Not leveraging it enough - too much in main file
- 🔄 **Action needed:** Move more content to modular files

### 5. What Should Be In CLAUDE.md?

#### Official Anthropic Recommendations

From [Anthropic Documentation](https://www.anthropic.com/engineering/claude-code-best-practices):
- ✅ Common bash commands
- ✅ Core files and utility functions
- ✅ Code style guidelines
- ✅ Testing instructions
- ✅ Repository etiquette
- ✅ Developer environment setup
- ✅ Unexpected behaviors or warnings

#### Structure: WHAT, WHY, HOW

From [HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md):
- **WHAT**: Tell Claude about the tech, stack, project structure
- **WHY**: Tell Claude the purpose of the project
- **HOW**: Tell Claude how it should work on the project

**Our Current Structure:**
- ✅ Quick Reference (commands, files, verification) - **HOW**
- ✅ Environment Setup (variables, Python) - **HOW**
- ✅ Architecture (system overview, patterns) - **WHAT**
- ✅ Development Workflow (local dev, feature flow) - **HOW**
- ✅ Deployment (pre-flight, process, verification) - **HOW**
- ✅ Troubleshooting (common issues, decision trees) - **HOW**
- ✅ User Access and Business Logic - **WHY**

**Verdict:**
- ✅ Structure follows WHAT/WHY/HOW pattern
- ✅ Content categories are appropriate
- ❌ Too much detail in each section

### 6. What Should NOT Be In CLAUDE.md?

#### Official Guidance

> "Don't use CLAUDE.md for code formatting rules—**linters handle this better**."
> — [HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

> "Don't include sensitive information, API keys, credentials, database connection strings, or detailed security vulnerability information."
> — [API Dog Blog](https://apidog.com/blog/claude-md/)

> "Since CLAUDE.md goes into every single session, ensure its contents are as **universally applicable as possible**, avoiding instructions about specific scenarios that won't matter when working on unrelated tasks."
> — [HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

**Our Content Review:**
- ✅ No sensitive information (env vars show format only)
- ✅ No code formatting rules (we use Prettier)
- ⚠️ Some sections are scenario-specific (e.g., detailed deployment checklist)
- ⚠️ Troubleshooting section is very specific

**Verdict:**
- ✅ No prohibited content
- ⚠️ Some overly-specific content that could move to modular rules

---

## Specific Issues With Our CLAUDE.md

### Length Breakdown Analysis

| Section | Lines | Assessment |
|---------|-------|------------|
| Header & TOC | 50 | ✅ Appropriate - navigation is valuable |
| Quick Reference | 65 | ✅ Good - essential commands and locations |
| Environment Setup | 98 | ⚠️ **Too long** - move details to `development.md` |
| Architecture | 88 | ⚠️ **Too detailed** - keep diagrams, reduce prose |
| Development Workflow | 72 | ⚠️ **Too detailed** - move patterns to `development.md` |
| Deployment | 87 | ❌ **Way too long** - move to `deployment.md` in `.claude/rules/` |
| Troubleshooting | 98 | ❌ **Move to separate file** - scenario-specific |
| User Access & Business | 79 | ⚠️ **Reduce** - keep roles table, move details elsewhere |
| Claude Models | 19 | ✅ Keep - useful reference |
| Additional Resources | 16 | ✅ Keep - points to modular rules |

**Total: 672 lines**

### Content That Should Move to Modular Files

#### Create `.claude/rules/deployment.md` (87 lines to move)
- Pre-flight checks detail
- Deployment process steps
- Post-deployment verification
- Hotfix pattern details
- Emergency procedures

Keep in main CLAUDE.md:
- Link to `/deploy` skill
- Reference to deployment.md for details

#### Expand `.claude/rules/development.md` (70 lines to move)
- Feature implementation order details
- Code pattern examples
- Python environment details
- Hydration-safe patterns

Keep in main CLAUDE.md:
- Basic local dev commands
- When to restart
- Reference to development.md

#### Create `.claude/rules/troubleshooting.md` (98 lines to move)
- Common issues table
- Decision trees
- Emergency procedures

Keep in main CLAUDE.md:
- Reference to troubleshooting.md
- Top 3 most common issues only

#### Expand `.claude/rules/integrations.md` (30 lines to move)
- Camera integrations details
- Nest Legacy token refresh process
- Dropbox namespace details

Keep in main CLAUDE.md:
- High-level mention only
- Reference to integrations.md

#### Reduce Architecture Section (40 lines)
- Keep diagrams (valuable)
- Reduce prose explanations
- Move detailed patterns to development.md

---

## Comparison: Official Examples vs. Our Implementation

### Anthropic's Example (Concise)

```markdown
# Bash commands
- npm run build: Build the project
- npm run typecheck: Run the typechecker

# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible

# Workflow
- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
```

**Length:** ~12 lines
**Style:** Bullet points, minimal prose, actionable

### Our Implementation (Verbose)

```markdown
### Available Commands

| Command | Purpose | Use When |
|---------|---------|----------|
| `/deploy` | Full deployment pipeline | Ready to ship to production |
| `/build` | TypeScript type check | Before committing code changes |
...
```

**Length:** ~15 lines for similar info
**Style:** Table format, more context

**Assessment:**
- Our table is slightly longer but arguably clearer
- Trade-off is reasonable for complexity of project
- BUT we have 50+ similar tables/sections (too much cumulative length)

---

## Recommendations

### Immediate Actions (High Priority)

#### 1. Reduce Main CLAUDE.md to <300 Lines

**Target: 250 lines** (currently 672)

**Specific cuts:**
- ❌ Remove entire Deployment section (87 lines) → create `.claude/rules/deployment.md`
- ❌ Remove entire Troubleshooting section (98 lines) → create `.claude/rules/troubleshooting.md`
- ✂️ Reduce Architecture section (keep diagrams, cut prose: -40 lines)
- ✂️ Reduce Environment Setup (move Python details to development.md: -40 lines)
- ✂️ Reduce Development Workflow (move patterns: -30 lines)
- ✂️ Reduce User Access section (keep table only: -40 lines)

**Total cuts: ~335 lines → New length: ~337 lines**

#### 2. Create New Modular Files

**`.claude/rules/deployment.md`** (new file)
- Pre-flight checks
- Deployment process
- Post-deployment verification
- Hotfix patterns
- Emergency procedures

**`.claude/rules/troubleshooting.md`** (new file)
- Common issues table
- Decision trees
- Emergency rollback procedures
- When to use which skill

#### 3. Update Table of Contents

```markdown
**Modular Rules** (Auto-loaded by context):
- `.claude/rules/database.md` - Schema, enums, query patterns
- `.claude/rules/security.md` - Auth, OAuth, role-based access
- `.claude/rules/payments.md` - Bills, taxes, payment workflows
- `.claude/rules/integrations.md` - Dropbox, Gmail, Nest cameras, tax sync
- `.claude/rules/pinning.md` - Smart pins and user pins system
- `.claude/rules/development.md` - Docker, workers, Python, migrations
- `.claude/rules/deployment.md` - **NEW** Pre-flight, deploy process, verification
- `.claude/rules/troubleshooting.md` - **NEW** Common issues, decision trees, emergency procedures
```

### Content Decisions

#### ✅ Keep (These are good)

1. **All ASCII diagrams** - High value for comprehension
2. **All tables** - More token-efficient than prose
3. **Quick Reference section** - Essential commands
4. **Critical Rules section** - Most important warnings
5. **Table of Contents** - Navigation to modular files
6. **Progressive disclosure pattern** - Already implemented well

#### ✂️ Reduce (Too detailed for main file)

1. **Environment Setup** - Keep list, move details to development.md
2. **Architecture prose** - Keep diagrams, reduce explanations
3. **Development Workflow** - Keep basics, move patterns elsewhere
4. **User Access** - Keep roles table, move business logic

#### ❌ Move to Modular Files (Scenario-specific)

1. **Deployment** → `.claude/rules/deployment.md`
2. **Troubleshooting** → `.claude/rules/troubleshooting.md`
3. **Emergency procedures** → troubleshooting.md
4. **Code patterns** → development.md
5. **Camera integration details** → integrations.md

### Medium Priority

#### Improve Progressive Disclosure Triggers

Add a "When to Load Modular Files" section:

```markdown
## When to Load Modular Files

**Before making changes, read the relevant context file:**

- 🗄️ Database work? → Read `.claude/rules/database.md` first
- 🔐 Auth/security? → Read `.claude/rules/security.md` first
- 💰 Payments/bills? → Read `.claude/rules/payments.md` first
- 🔌 Integrations? → Read `.claude/rules/integrations.md` first
- 📌 Pinning logic? → Read `.claude/rules/pinning.md` first
- 🐳 Infrastructure? → Read `.claude/rules/development.md` first
- 🚀 Deployment? → Read `.claude/rules/deployment.md` first
- 🔧 Production issues? → Read `.claude/rules/troubleshooting.md` first
```

### Low Priority (Optional Improvements)

1. **Reduce collapsible sections** - They hide content but still consume tokens
2. **Consolidate verification commands** - Multiple similar bash command blocks
3. **Reduce example code blocks** - Some SQL examples could be shorter
4. **Consider emoji reduction** - Small token savings, but lower priority

---

## The ASCII Diagram Question: Detailed Analysis

### Token Cost Calculation

**Our 3 ASCII diagrams:**
- System Architecture diagram: ~25 lines, ~1,200 characters ≈ 300 tokens
- Type Flow diagram: ~10 lines, ~400 characters ≈ 100 tokens
- Data Flow examples: ~15 lines, ~600 characters ≈ 150 tokens

**Total cost: ~550 tokens** (out of ~8,000 tokens for full CLAUDE.md)

### Value Assessment

**Benefits:**
1. **Structural understanding** - Shows container relationships
2. **Data flow clarity** - Type generation pipeline
3. **Quick reference** - No need to read multiple files to understand architecture
4. **Reduces questions** - Claude doesn't need to ask "how does X relate to Y?"

**Alternatives (and why they're worse):**
1. **Prose description** - Would be longer and less clear
2. **No architecture docs** - Claude would need to infer from code
3. **External diagrams** - Can't be loaded automatically

**Research Support:**
- Claude has "sophisticated vision capabilities" for charts/diagrams ([Anthropic](https://www.anthropic.com/news/claude-3-family))
- Real workflows report ASCII wireframes let "Claude Code sees this and knows EXACTLY what to build" ([Nathan Onn](https://www.nathanonn.com/codex-plans-with-ascii-wireframes-%E2%86%92-claude-code-builds-%E2%82%92-codex-reviews/))
- Multiple Claude Code skills exist specifically for ASCII diagram generation ([MCP Market](https://mcpmarket.com/tools/skills/ascii-diagram-creator-1))

### Verdict: Keep the Diagrams

**Reasoning:**
- 550 tokens is ~6.9% of total CLAUDE.md
- High comprehension value relative to cost
- No better alternative for showing architecture
- Aligns with Claude Code community practices

**BUT: Watch for usage**
Monitor if Claude actually references these diagrams. If not used in practice over 10+ sessions, reconsider.

---

## The Length Question: Why Shorter is Better

### The Instruction Budget Problem

Research shows:
> "Frontier thinking LLMs can follow **~ 150-200 instructions** with reasonable consistency."

Claude Code's system prompt uses **~50 instructions**, leaving **~100-150 instructions** for CLAUDE.md.

**Our 672 lines likely contains 200+ distinct instructions:**
- 6 CRITICAL RULES (6 instructions)
- 9 command descriptions (9 instructions)
- ~40 environment variables (40 instructions)
- ~20 file locations (20 instructions)
- Architecture patterns (10 instructions)
- Development workflow steps (15 instructions)
- Code patterns (10 instructions)
- Deployment checklist (15 instructions)
- Troubleshooting rules (20 instructions)
- Business rules (15 instructions)
- Cron job schedules (13 instructions)

**Estimated total: ~173 explicit instructions** (likely more counting implicit rules)

### Performance Degradation

> "Smaller models get MUCH worse, MUCH more quickly" as instruction count increases, while "larger frontier thinking models exhibit a linear decay."
> — [HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

**Translation:** Even Sonnet 4.5 gets worse with too many instructions.

### Why HumanLayer Uses 60 Lines

HumanLayer's 60-line CLAUDE.md likely contains **~30-40 instructions**, well within the budget.

Their approach:
- Main file: Essential commands, stack overview, critical rules
- Separate files: Detailed procedures, referenced when needed
- Result: "More effective" performance

---

## Testing the Hypothesis

### Suggested Experiment

1. **Baseline measurement** (current 672-line version)
   - Track how often Claude violates critical rules
   - Track how often Claude asks for basic project info
   - Track response quality over 20 sessions

2. **Create reduced version** (target 250 lines)
   - Follow recommendations above
   - Move content to modular files

3. **A/B test over 2 weeks**
   - Compare rule adherence
   - Compare need to provide context
   - Compare overall task completion quality

4. **Iterate based on data**
   - If shorter is worse, add back critical content
   - If shorter is better, continue reducing
   - Find optimal length for THIS project

---

## Conclusion: The Rewrite Assessment

### What We Got Right ✅

1. **Structure (WHAT/WHY/HOW)** - Follows official guidance
2. **Tables over prose** - More token-efficient
3. **ASCII diagrams** - High-value comprehension aid
4. **Progressive disclosure pattern** - Modular rules system
5. **Table of Contents** - Easy navigation
6. **Critical Rules section** - Prominent placement of essential warnings
7. **Command reference** - Quick lookup for skills

### What We Got Wrong ❌

1. **Length** - 672 lines vs. recommended <300 (ideally <150)
2. **Not modular enough** - Too much in main file vs. `.claude/rules/`
3. **Scenario-specific content** - Deployment and troubleshooting should be separate
4. **Instruction overload** - Likely 170+ instructions vs. budget of ~100-150

### The Bottom Line

**The rewrite made CLAUDE.md BETTER in structure but WORSE in length.**

**We improved:**
- Organization and findability
- Visual clarity (diagrams, tables)
- Progressive disclosure setup

**We violated:**
- Primary best practice: keep it short
- Instruction budget constraints
- Universal applicability principle

### Recommended Action

**Implement Phase 1 immediately:**
1. Create `.claude/rules/deployment.md` (move 87 lines)
2. Create `.claude/rules/troubleshooting.md` (move 98 lines)
3. Reduce other sections by 150 lines (keep structure, cut details)
4. **Target: 337 lines** (still above ideal, but 50% reduction)

**Then monitor and iterate:**
- Track if Claude performance improves
- Watch for sections that need to come back
- Continue refining toward 150-250 line target

---

## Sources

### Official Anthropic Documentation
- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Introducing the next generation of Claude](https://www.anthropic.com/news/claude-3-family)

### Community Best Practices
- [Writing a good CLAUDE.md | HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Notes on Writing a good CLAUDE.md - AI Engineer Guide](https://aiengineerguide.com/blog/notes-on-writing-a-good-claude-md/)
- [What is CLAUDE.md in Claude Code | ClaudeLog](https://claudelog.com/faqs/what-is-claude-md/)
- [What's a Claude.md File? 5 Best Practices](https://apidog.com/blog/claude-md/)

### Progressive Disclosure & Token Optimization
- [GitHub: claude-modular - Production-ready modular framework](https://github.com/oxygen-fragment/claude-modular)
- [Progressive Disclosure Pattern - Claude Code Skill](https://mcpmarket.com/tools/skills/progressive-disclosure-pattern)
- [Optimizing Token Efficiency in Claude Code Workflows | Medium](https://medium.com/@pierreyohann16/optimizing-token-efficiency-in-claude-code-workflows-managing-large-model-context-protocol-f41eafdab423)
- [Claude Code Context Optimization | GitHub Gist](https://gist.github.com/johnlindquist/849b813e76039a908d962b2f0923dc9a)

### ASCII Diagrams & Visualization
- [ASCII Diagram Creator - Claude Code Skill](https://mcpmarket.com/tools/skills/ascii-diagram-creator-1)
- [Codex plans with ASCII Wireframes → Claude Code builds | Nathan Onn](https://www.nathanonn.com/codex-plans-with-ascii-wireframes-%E2%86%92-claude-code-builds-%E2%86%92-codex-reviews/)
- [How To Create Software Diagrams With ChatGPT and Claude | The New Stack](https://thenewstack.io/how-to-create-software-diagrams-with-chatgpt-and-claude/)
- [Can Claude Code generate diagrams or visualizations?](https://milvus.io/ai-quick-reference/can-claude-code-generate-diagrams-or-visualizations)

### Additional References
- [Claude Skills and CLAUDE.md: a practical 2026 guide](https://www.gend.co/blog/claude-skills-claude-md-guide)
- [Using CLAUDE.MD files | Claude Blog](https://claude.com/blog/using-claude-md-files)
- [How I Use Every Claude Code Feature | Shrivu Shankar](https://blog.sshh.io/p/how-i-use-every-claude-code-feature)
- [Cooking with Claude Code: The Complete Guide | Sid Bharath](https://www.siddharthbharath.com/claude-code-the-complete-guide/)

---

**End of Research Document**
