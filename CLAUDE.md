# Project Goals

- Create a Claude Skill that automatically trades on Trade Republic in order to maximize profits.
- Use a custom MCP server to interface between Claude and Trade Republic.

# General Rules

- All code must be written in TypeScript.
- Use Jest for testing.
- Use Test-Driven Development (TDD) practices:
    - Write one test and prove it fails.
    - Write the minimum code necessary to make the test pass.
    - Refactor the code while ensuring all tests still pass.
- Follow best practices for code quality and maintainability.
- Never guess about API requests, responses or authentication; always refer to the official documentation or other reliable sources.
- Never guess about trading strategies; always refer to established financial principles.
- Document all assumptions and decisions made during development in architecture decision records (ADRs) in the folder `docs/adr`.

# Workflow

IMPORTANT: This workflow MUST be followed STRICTLY. It is SACRED. <reasoning>Following a structured workflow ensures quality, maintainability, and reduces the likelihood of errors.</reasoning>
GATHER DATA: Whenever you detect that something went wrong or could be improved (with the workflow, with the implementation, with the tests, with how you are following the rules, even with this document, ... anything that occurs to you), you MUST document the issue in `docs/retrospective-notes.md` IMMEDIATELY. <reasoning>This is crucial for continuous improvement and ensuring that issues are addressed promptly.</reasoning>

Files:
- task list file: `docs/tasks.md`
- initial task plan files: `docs/plans/{task-index}-{task-name}-plan-{sub-agent-index}.md`,
    e.g. `docs/plans/01-very-important-feature-plan-1.md`
- combined task plan file: `docs/plans/{task-index}-{task-name}-plan-combined.md`,
    e.g. `docs/plans/01-very-important-feature-plan-combined.md`
- final task plan file: `docs/plans/{task-index}-{task-name}-plan-final.md`,
    e.g. `docs/plans/01-very-important-feature-plan-final.md`

1. Define a high-level task list (write to: task list file).
2. Let at least two sub agents independently create a detailed plan for each task (write to: initial task plan files).
3. Compare the two plans and merge them into a combined plan for this task (write to: combined task plan file).
4. Let at least two sub agents verify the combined plan for this task for correctness and completeness and fix any issues found (write to: final task plan file).
5. Start a sub agent to implement the final task plan by following the TDD red-green-refactor cycle.
6. Let at least two sub agents review the implementation for correctness, completeness, and code quality and fix any issues found.
7. Go over the retrospective notes and address any issues found NOW. Mark addressed issues as addressed (do not remove them - keeping history helps remember previous issues and solutions).
8. Create a conventional commit for the completed task.
9. Repeat for the next task until all tasks are completed.

# Code Quality
- Use ESLint with the recommended TypeScript rules. (npm run lint)
- Use Prettier for code formatting. (npm run format)
- Ensure 100% test coverage. (npm run test:coverage)
- Use Git and write clear and concise commit messages following the Conventional Commits specification.
- Follow YAGNI (You Aren't Gonna Need It) and KISS (Keep It Simple, Stupid) principles.
- Follow Software Craftsmanship principles.
- Use meaningful names for variables, functions, classes, and modules.
- Write readable and maintainable code.

# Data Validation

- Validate all inputs and outputs using Zod schemas.

# Related Projects

You will find an autonomous trading bot for Coinbase here: `../coinbase-mcp-server`. It consists of a custom MCP server and a Claude Skill that trades on Coinbase. You can use it as a reference for building the Trade Republic trading bot but you do not have to adhere to its implementation details. What you should take away from it are:
- How to structure the MCP server and Claude Skill.
- How to use knip, lint, prettier, jest, rollup, and zod in a TypeScript project.

# When to start

You MUST start working on this project immediately.